"""
Sistema de herramientas IA — v3.0 con Supabase CRUD completo.
Ollama decide qué herramienta usar → Python la ejecuta.

Flujo principal:
  buscar_guias          → por número de guía o nombre de cliente (Excel)
  insertar_en_bd        → inserta guías en cualquier tabla Supabase
  buscar_e_insertar_en_bd → busca + inserta en un solo paso
  consultar_bd / editar_en_bd / eliminar_de_bd → CRUD en Supabase
  listar_storage / descargar_storage / eliminar_storage / subir_excels_storage → CRUD Storage
"""
import json
import logging
import asyncio
import os
import re
from pathlib import Path

import pandas as pd
import ollama

import config
from excel_engine import is_bogota, build_pattern_masks

logger = logging.getLogger(__name__)

# Archivos pendientes de enviar por Telegram tras descargar_storage
_pending_downloads: dict[int, tuple[str, bytes]] = {}


def pop_pending_download(user_id: int) -> tuple[str, bytes] | None:
    """Devuelve y limpia (nombre, bytes) si hay un archivo listo para enviar."""
    return _pending_downloads.pop(user_id, None)


# ── Schema de herramientas (lo lee el LLM) ────────────────────────────────────

TOOLS_SCHEMA = [
    # ── Excel ────────────────────────────────────────────────────────────────
    {
        "name": "buscar_por_nombre",
        "description": (
            "Filtra filas del Excel donde el nombre del destinatario contiene "
            "la palabra o texto indicado. Ej: 'clientes que tengan APX en su nombre'."
        ),
        "parameters": {
            "texto": "str - palabra o fragmento a buscar en el nombre del destinatario",
        },
    },
    {
        "name": "buscar_guia",
        "description": "Busca una o varias guías por número exacto o parcial en el Excel.",
        "parameters": {
            "texto": "str - número o fragmento de guía",
        },
    },
    {
        "name": "buscar_guias",
        "description": (
            "Herramienta unificada de búsqueda en el Excel actual. "
            "Busca por número de guía (tracking) O por nombre de cliente/destinatario. "
            "Úsala cuando el usuario pida: 'busca la guía BOG001', "
            "'guías de Pepito Perez', 'encuentra al cliente APX', etc. "
            "tipo_busqueda: 'auto' (detecta), 'guia' o 'nombre'."
        ),
        "parameters": {
            "criterio":       "str - número de guía o fragmento del nombre del cliente",
            "tipo_busqueda":  "str - auto | guia | nombre (default: auto)",
        },
    },
    {
        "name": "filtrar_ciudad",
        "description": "Filtra despachos de una ciudad específica del Excel.",
        "parameters": {"ciudad": "str - nombre de la ciudad"},
    },
    {
        "name": "top_ciudades",
        "description": "Muestra las ciudades con más despachos en el Excel.",
        "parameters": {"top_n": "int - cuántas ciudades mostrar (default 5)"},
    },
    {
        "name": "resumen_pesos",
        "description": "Estadísticas de peso (total, promedio, máximo, mínimo) del Excel.",
        "parameters": {},
    },
    {
        "name": "estadisticas_patron",
        "description": "Estadísticas de guías que tienen un patrón numérico específico.",
        "parameters": {"patron": "str - código del patrón, ej: 00581"},
    },
    # ── Supabase escritura ───────────────────────────────────────────────────
    {
        "name": "registrar_revaluos",
        "description": (
            "Registra una o varias guías como revaluos en Supabase. "
            "Úsala cuando el usuario diga 'estas guías tienen revaluo', "
            "'marcar revaluo', 'guía X tiene revaluo', etc. "
            "Busca los datos de cada guía en el Excel automáticamente."
        ),
        "parameters": {
            "guias":   "list[str] - lista de números de guía a registrar como revaluo",
            "revaluo": "str - descripción del revaluo (default: 'Pendiente de pago')",
        },
    },
    {
        "name": "registrar_retenciones",
        "description": (
            "Registra una o varias guías como retenidas en Supabase. "
            "Úsala cuando el usuario diga 'retener guías', 'falta de pago', "
            "'retención por X motivo', etc."
        ),
        "parameters": {
            "guias":  "list[str] - lista de números de guía a retener",
            "motivo": "str - motivo de la retención (ej: 'Falta de pago', 'Documentación incompleta')",
        },
    },
    # ── Supabase CRUD ────────────────────────────────────────────────────────
    {
        "name": "consultar_bd",
        "description": (
            "Consulta cualquiera de las 4 tablas de Supabase y devuelve los registros. "
            "Úsala cuando el usuario pida: 'trae las retenciones', 'qué guías tienen revaluo', "
            "'muéstrame los que recogen en oficina', 'lista las direcciones especiales', "
            "'busca la guía X en retenciones', etc. "
            "tablas válidas: revaluos, retenciones, recoge_oficina, dir_especiales."
        ),
        "parameters": {
            "tabla":   "str - tabla a consultar: revaluos | retenciones | recoge_oficina | dir_especiales",
            "filtros": "dict - filtros opcionales ej: {\"guia_numero\": \"BOG001\"} o {}",
        },
    },
    {
        "name": "eliminar_de_bd",
        "description": (
            "Elimina un registro de Supabase por número de guía. "
            "Úsala cuando el usuario pida: 'elimina la guía X de retenciones', "
            "'borra BOG001 de revaluos', 'quitar de la lista', etc."
        ),
        "parameters": {
            "tabla":        "str - tabla: revaluos | retenciones | recoge_oficina | dir_especiales",
            "guia_numero":  "str - número de guía a eliminar",
        },
    },
    {
        "name": "editar_en_bd",
        "description": (
            "Edita campos de un registro existente en Supabase. "
            "Úsala cuando el usuario pida: 'cambia el motivo de BOG001', "
            "'actualiza el revaluo de MED002', 'modifica la dirección de...', etc."
        ),
        "parameters": {
            "tabla":        "str - tabla: revaluos | retenciones | recoge_oficina | dir_especiales",
            "guia_numero":  "str - número de guía a editar",
            "campos":       "dict - campos a actualizar ej: {\"motivo\": \"Nuevo motivo\"}",
        },
    },
    {
        "name": "insertar_en_bd",
        "description": (
            "Inserta una o varias guías en CUALQUIER tabla de Supabase. "
            "Enriquece automáticamente con datos del Excel (nombre, ciudad, piezas, dirección). "
            "Úsala cuando el usuario ya dio los números de guía o tras una búsqueda previa. "
            "tablas: revaluos | retenciones | recoge_oficina | dir_especiales. "
            "campos_extra según tabla: revaluo, motivo, piezas, direccion, ciudad."
        ),
        "parameters": {
            "tabla":        "str - tabla destino",
            "guias":        "list[str] - números de guía a insertar",
            "campos_extra": "dict - campos adicionales opcionales ej: {\"motivo\": \"Falta de pago\"}",
        },
    },
    {
        "name": "buscar_e_insertar_en_bd",
        "description": (
            "Busca guías en el Excel por número de guía o nombre de cliente "
            "e inserta automáticamente los resultados en la tabla Supabase indicada. "
            "Úsala cuando el usuario pida en un solo paso: "
            "'busca Pepito Perez y regístralo en recoge oficina', "
            "'pon las guías de APX en retenciones por falta de pago', "
            "'agrega BOG0011218820 a revaluos'. "
            "Si solo hay una guía coincidente o el criterio es un número de guía, inserta esa."
        ),
        "parameters": {
            "tabla":          "str - revaluos | retenciones | recoge_oficina | dir_especiales",
            "criterio":       "str - número de guía o nombre/fragmento del cliente",
            "tipo_busqueda":  "str - auto | guia | nombre (default: auto)",
            "campos_extra":   "dict - campos extra opcionales ej: {\"motivo\": \"...\", \"revaluo\": \"...\"}",
        },
    },
    # ── Supabase Storage (Excels) ────────────────────────────────────────────
    {
        "name": "listar_storage",
        "description": (
            "Lista archivos Excel guardados en Supabase Storage (bucket Excels). "
            "Úsala cuando pidan: 'qué archivos hay en storage', 'lista los originales', "
            "'muéstrame los procesados guardados', etc. "
            "carpeta: originales | procesados | ambas (default: ambas)."
        ),
        "parameters": {
            "carpeta": "str - originales | procesados | ambas (default: ambas)",
        },
    },
    {
        "name": "descargar_storage",
        "description": (
            "Descarga y envía un archivo Excel desde Supabase Storage. "
            "Úsala cuando pidan: 'tráeme el archivo X', 'descarga el excel de originales', "
            "'envíame el procesado 2849_procesado.xlsx'. "
            "Si no conoces el nombre exacto, usa listar_storage primero."
        ),
        "parameters": {
            "carpeta":         "str - originales | procesados",
            "nombre_archivo":  "str - nombre del archivo .xlsx en esa carpeta",
        },
    },
    {
        "name": "eliminar_storage",
        "description": (
            "Elimina un archivo Excel de Supabase Storage. "
            "Úsala cuando pidan: 'borra el archivo X de storage', "
            "'elimina de originales el excel...', etc."
        ),
        "parameters": {
            "carpeta":         "str - originales | procesados",
            "nombre_archivo":  "str - nombre del archivo a eliminar",
        },
    },
    {
        "name": "subir_excels_storage",
        "description": (
            "Sube el Excel original y procesado de la sesión actual a Supabase Storage. "
            "Úsala cuando pidan guardar/subir a storage los archivos del despacho actual. "
            "Si hay duplicados, el sistema pedirá confirmación (reemplazar=false por defecto)."
        ),
        "parameters": {
            "reemplazar": "bool - true para sobrescribir si ya existen (default: false)",
        },
    },
    # ── Supabase cruce ───────────────────────────────────────────────────────
    {
        "name": "analizar_recoge_oficina",
        "description": (
            "Cruza el Excel actual con la tabla Recoge_Oficina de Supabase "
            "para identificar qué clientes del despacho recogen en oficina."
        ),
        "parameters": {},
    },
    {
        "name": "analizar_dir_especiales",
        "description": (
            "Cruza el Excel actual con la tabla Clientes_DirEspeciales de Supabase "
            "para identificar clientes con direcciones especiales en el despacho."
        ),
        "parameters": {},
    },
    # ── General ──────────────────────────────────────────────────────────────
    {
        "name": "respuesta_texto",
        "description": "Responde con texto libre cuando ninguna otra herramienta aplica.",
        "parameters": {"respuesta": "str - texto de respuesta"},
    },
]

SYSTEM_PROMPT = """Eres un asistente experto en logística y despachos courier.
Tienes acceso a un archivo Excel con despachos y a una base de datos Supabase con 4 tablas.

Cuando el usuario pida algo, responde ÚNICAMENTE con un JSON válido así:
{{"tool": "nombre_herramienta", "params": {{...}}}}

Herramientas disponibles:
{tools}

Estado actual del Excel:
{context}

TABLAS SUPABASE (usa estos nombres en params.tabla):
- revaluos          → guías con revaluo (campo extra: revaluo)
- retenciones       → guías retenidas (campo extra: motivo, piezas)
- recoge_oficina    → clientes que recogen en oficina (piezas, ciudad)
- dir_especiales    → direcciones especiales (direccion, ciudad)

CRUD — qué herramienta usar:
- BUSCAR en Excel: buscar_guias (por guía o nombre) o buscar_por_nombre / buscar_guia
- INSERTAR: insertar_en_bd (si ya tienes guías) o buscar_e_insertar_en_bd (buscar + insertar en un paso)
- LEER Supabase: consultar_bd
- ACTUALIZAR: editar_en_bd
- ELIMINAR: eliminar_de_bd

STORAGE SUPABASE (bucket Excels):
- listar_storage     → ver archivos en originales/ o procesados/
- descargar_storage  → obtener y enviar un archivo al usuario
- eliminar_storage   → borrar un archivo
- subir_excels_storage → subir original+procesado de la sesión actual

REGLAS CRÍTICAS:
- Responde SOLO con JSON. Sin texto antes ni después. Sin backticks. Sin markdown.
- Si pide buscar Y guardar/registrar/agregar en BD → usa buscar_e_insertar_en_bd.
- Si pide solo buscar → buscar_guias.
- Si pide insertar guías que ya mencionó → insertar_en_bd o registrar_revaluos/registrar_retenciones.
- guia_numero y guias SIEMPRE como string o list[str], nunca listas anidadas.
- Ejemplo buscar+insertar: {{"tool": "buscar_e_insertar_en_bd", "params": {{"tabla": "recoge_oficina", "criterio": "Pepito Perez", "tipo_busqueda": "nombre"}}}}
- Ejemplo CRUD update: {{"tool": "editar_en_bd", "params": {{"tabla": "retenciones", "guia_numero": "BOG001", "campos": {{"motivo": "Pagado"}}}}}}
"""


# ── Herramientas Excel ────────────────────────────────────────────────────────

def _md_plain(text) -> str:
    """Texto dinámico (Excel/BD) sin caracteres que rompan Markdown de Telegram."""
    if text is None:
        return ""
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace("_", "\\_")
        .replace("*", "\\*")
        .replace("`", "'")
        .replace("[", "(")
    )


def _md_code(text) -> str:
    """Número de guía en monoespaciado (seguro para Markdown legacy)."""
    safe = str(text or "").replace("`", "").strip()
    return f"`{safe}`"


def _strip_accents(s: str) -> str:
    import unicodedata
    s = unicodedata.normalize("NFD", str(s))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def _parece_numero_guia(texto: str) -> bool:
    """Heurística: tracking suele tener letras+números y pocos espacios."""
    t = texto.strip()
    if not t or " " in t:
        return False
    return bool(re.match(r"^[A-Za-z]{2,5}\d{4,}", t)) or bool(re.match(r"^\d{8,}", t))


def buscar_guias_en_excel(
    df: pd.DataFrame,
    criterio: str,
    tipo_busqueda: str = "auto",
) -> list[dict]:
    """
    Busca filas en el Excel por guía o nombre de destinatario.
    Retorna lista de dicts listos para insertar en Supabase.
    """
    criterio = _coerce_str(criterio).strip()
    if not criterio:
        return []

    tipo = (tipo_busqueda or "auto").strip().lower()
    if tipo == "auto":
        tipo = "guia" if _parece_numero_guia(criterio) else "nombre"

    if tipo == "guia":
        mask = df["Guia#"].astype(str).str.contains(criterio, case=False, na=False)
    else:
        crit = _strip_accents(criterio)
        mask = df["Nombre Destinatario"].apply(
            lambda x: crit in _strip_accents(str(x))
        )

    sub = df[mask]
    resultados = []
    for _, row in sub.iterrows():
        piezas_raw = row.get("Piezas", 1)
        try:
            piezas = int(str(piezas_raw).replace(",", "") or 1)
        except (ValueError, TypeError):
            piezas = 1
        resultados.append({
            "guia_numero":         str(row.get("Guia#", "")).strip(),
            "nombre_destinatario": str(row.get("Nombre Destinatario", "")),
            "ciudad":              str(row.get("Ciudad", "")),
            "piezas":              piezas,
            "direccion":           str(row.get("Dirección", "")),
        })
    return [r for r in resultados if r["guia_numero"]]


def _formatear_resultados_busqueda(
    resultados: list[dict],
    criterio: str,
    tipo: str,
) -> str:
    if not resultados:
        return f"No se encontraron guías para «{_md_plain(criterio)}» (búsqueda por {tipo})."
    lines = [
        f"🔎 *{len(resultados)} guía(s) encontrada(s)* — «{_md_plain(criterio)}»:\n"
    ]
    for r in resultados[:30]:
        line = (
            f"  • {_md_code(r['guia_numero'])} — {_md_plain(r['nombre_destinatario'])} "
            f"({_md_plain(r.get('ciudad', ''))})"
        )
        if r.get("piezas"):
            line += f" — {r['piezas']} pzs"
        lines.append(line)
    if len(resultados) > 30:
        lines.append(f"\n(...y {len(resultados) - 30} más)")
    guias = [_md_plain(g) for g in (r["guia_numero"] for r in resultados)]
    lines.append(
        "\nGuías: " + ", ".join(guias[:15]) + ("..." if len(guias) > 15 else "")
    )
    return "\n".join(lines)


def _buscar_por_nombre(df: pd.DataFrame, texto: str) -> str:
    """
    Búsqueda case-insensitive y sin tildes.
    'apx', 'APX', 'Apx' → todos encuentran 'Distribuidora APX S.A.S'
    """
    import unicodedata
    def strip_accents(s: str) -> str:
        s = unicodedata.normalize("NFD", s)
        return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()

    texto_clean = strip_accents(texto.strip())
    mask = df["Nombre Destinatario"].apply(
        lambda x: texto_clean in strip_accents(str(x))
    )
    sub = df[mask]
    if sub.empty:
        return f"No se encontraron destinatarios con \"{texto}\" en el nombre."
    lines = [f"🔎 *{len(sub)} guía(s) con \"{_md_plain(texto)}\" en el nombre:*\n"]
    for _, row in sub.iterrows():
        lines.append(
            f"  • {_md_code(row['Guia#'])} — {_md_plain(row['Nombre Destinatario'])} "
            f"({_md_plain(row.get('Ciudad', ''))})"
            + (f" — {row.get('Piezas','')} pzs" if row.get('Piezas') else "")
        )
    return "\n".join(lines)


def _buscar_guia(df: pd.DataFrame, texto: str) -> str:
    mask = df["Guia#"].str.contains(texto, case=False, na=False)
    sub  = df[mask]
    if sub.empty:
        return f"No se encontró ninguna guía con {_md_code(texto)}."
    lines = [f"🔎 *{len(sub)} guía(s) encontradas:*\n"]
    for _, row in sub.iterrows():
        lines.append(
            f"  • {_md_code(row['Guia#'])} — {_md_plain(row.get('Nombre Destinatario', ''))} "
            f"({_md_plain(row.get('Ciudad', ''))})"
        )
    if len(sub) > 15:
        lines.append(f"  (...y {len(sub)-15} más)")
    return "\n".join(lines)


def _filtrar_ciudad(df: pd.DataFrame, ciudad: str) -> str:
    import unicodedata
    def strip_accents(s: str) -> str:
        s = unicodedata.normalize("NFD", s)
        return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    ciudad_clean = strip_accents(ciudad.strip())
    mask = df["Ciudad"].apply(lambda x: ciudad_clean in strip_accents(str(x)))
    sub  = df[mask]
    if sub.empty:
        return f"No se encontraron despachos para '{ciudad}'."
    bog = sub["Ciudad"].apply(is_bogota).sum()
    lines = [
        f"🔍 *Despachos a '{ciudad}':*",
        f"  • Total: {len(sub)} guías",
        f"  • En Bogotá: {bog} | Fuera: {len(sub)-bog}",
    ]
    if "Peso-2" in sub.columns:
        try:
            total_peso = pd.to_numeric(sub["Peso-2"], errors="coerce").sum()
            lines.append(f"  • Peso total: {total_peso:.2f} kg")
        except Exception:
            pass
    return "\n".join(lines)


def _top_ciudades(df: pd.DataFrame, top_n: int = 5) -> str:
    counts = df["Ciudad"].value_counts().head(top_n)
    lines  = [f"🏆 *Top {top_n} ciudades:*\n"]
    for i, (ciudad, cnt) in enumerate(counts.items(), 1):
        pct = cnt / len(df) * 100
        lines.append(f"  {i}. {ciudad}: {cnt} guías ({pct:.1f}%)")
    return "\n".join(lines)


def _resumen_pesos(df: pd.DataFrame) -> str:
    if "Peso-2" not in df.columns:
        return "El archivo no tiene columna de peso."
    pesos = pd.to_numeric(df["Peso-2"], errors="coerce").dropna()
    if pesos.empty:
        return "No hay datos de peso válidos."
    return (
        f"⚖️ *Resumen de pesos:*\n"
        f"  • Total: {pesos.sum():.2f} kg\n"
        f"  • Promedio: {pesos.mean():.2f} kg\n"
        f"  • Máximo: {pesos.max():.2f} kg\n"
        f"  • Mínimo: {pesos.min():.2f} kg\n"
        f"  • Despachos con peso: {len(pesos)} de {len(df)}"
    )


def _estadisticas_patron(df: pd.DataFrame, patron: str, patterns: list[dict]) -> str:
    p_match = next((p for p in patterns if p["label"] == patron), None)
    if not p_match:
        return f"El patrón `{patron}` no está registrado."
    mask = df["Guia#"].str.contains(p_match["pattern"], regex=True, na=False)
    sub  = df[mask]
    if sub.empty:
        return f"No hay guías con el patrón `{patron}` en el archivo."
    lines = [
        f"📊 *Patrón `{patron}`:*",
        f"  • Total guías: {len(sub)}",
        f"  • Ciudades: {sub['Ciudad'].nunique()}",
    ]
    for ciudad, cnt in sub["Ciudad"].value_counts().head(8).items():
        lines.append(f"    - {ciudad}: {cnt}")
    return "\n".join(lines)


# ── Herramientas Supabase ─────────────────────────────────────────────────────

def _coerce_str(value) -> str:
    """Normaliza valores provenientes del LLM a string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    # Casos comunes: ["BOG001"] o [["BOG001"]]
    if isinstance(value, (list, tuple)) and value:
        return _coerce_str(value[0])
    return str(value)


def _coerce_dict(value) -> dict:
    """Normaliza campos_extra / campos desde el LLM."""
    if value is None:
        return {}
    if isinstance(value, dict):
        return {str(k): v for k, v in value.items()}
    return {}


def _coerce_list_of_str(value) -> list[str]:
    """Normaliza 'guias' desde LLM a list[str] (aplana listas)."""
    if value is None:
        return []
    if isinstance(value, str):
        # admitir "BOG001, MED002" o "BOG001 MED002"
        raw = value.replace("\n", " ").replace(";", ",")
        parts = []
        for chunk in raw.split(","):
            parts.extend(chunk.strip().split())
        return [p for p in (x.strip() for x in parts) if p]
    if isinstance(value, (list, tuple)):
        out: list[str] = []
        for item in value:
            out.extend(_coerce_list_of_str(item))
        return out
    # fallback: un solo valor (int, dict, etc.)
    s = str(value).strip()
    return [s] if s else []


def _enriquecer_guias(guias: list[str], df: pd.DataFrame, extra: dict) -> list[dict]:
    """
    Para cada número de guía, busca sus datos en el Excel.
    Si no existe, usa valores mínimos para no fallar el INSERT.
    """
    resultado = []
    for g in guias:
        g = _coerce_str(g).strip()
        if not g:
            continue
        row = df[df["Guia#"].str.strip() == g]
        if not row.empty:
            r = row.iloc[0]
            base = {
                "guia_numero":         g,
                "nombre_destinatario": str(r.get("Nombre Destinatario", "Sin nombre")),
                "ciudad":              str(r.get("Ciudad", "")),
                "piezas":              int(str(r.get("Piezas", "1")).replace(",","") or 1),
                "direccion":           str(r.get("Dirección", "")),
            }
        else:
            base = {
                "guia_numero":         g,
                "nombre_destinatario": "Sin nombre (no encontrado en Excel)",
                "ciudad": "", "piezas": 1, "direccion": "",
            }
        base.update(extra)
        resultado.append(base)
    return resultado


async def _tool_registrar_revaluos(guias: list[str], revaluo: str, df: pd.DataFrame) -> str:
    from supabase_client import insertar_revaluos
    datos = _enriquecer_guias(guias, df, {"revaluo": revaluo or "Pendiente de pago"})
    insertados, duplicados = await insertar_revaluos(datos)
    lines = [f"✅ *Revaluos registrados: {insertados}/{len(guias)}*"]
    if duplicados:
        dup = ", ".join(_md_code(g) for g in duplicados)
        lines.append(f"⚠️ Ya existían: {dup}")
    return "\n".join(lines)


async def _tool_registrar_retenciones(guias: list[str], motivo: str, df: pd.DataFrame) -> str:
    from supabase_client import insertar_retenciones
    datos = _enriquecer_guias(guias, df, {"motivo": motivo or "Sin motivo especificado"})
    insertados, duplicados = await insertar_retenciones(datos)
    lines = [f"✅ *Retenciones registradas: {insertados}/{len(guias)}*"]
    if duplicados:
        dup = ", ".join(_md_code(g) for g in duplicados)
        lines.append(f"⚠️ Ya existían: {dup}")
    return "\n".join(lines)


async def _tool_analizar_recoge_oficina(df: pd.DataFrame) -> str:
    from supabase_client import cruzar_excel_con_recoge_oficina
    coincidencias = await cruzar_excel_con_recoge_oficina(df)
    if not coincidencias:
        return "✅ Ningún cliente del despacho está marcado como *recoge en oficina* en la base de datos."
    lines = [f"🏢 *{len(coincidencias)} cliente(s) que recogen en oficina:*\n"]
    for c in coincidencias:
        lines.append(
            f"  • {_md_code(c['guia'])} — {_md_plain(c['nombre'])} ({_md_plain(c['ciudad'])})"
            + (f" — {c['piezas']} pzs" if c.get('piezas') else "")
        )
    return "\n".join(lines)


async def _tool_analizar_dir_especiales(df: pd.DataFrame) -> str:
    from supabase_client import cruzar_excel_con_dir_especiales
    coincidencias = await cruzar_excel_con_dir_especiales(df)
    if not coincidencias:
        return "✅ Ningún cliente del despacho está en la tabla de *direcciones especiales*."
    lines = [f"📍 *{len(coincidencias)} cliente(s) con dirección especial:*\n"]
    for c in coincidencias:
        lines.append(
            f"  • {_md_code(c['guia'])} — {_md_plain(c['nombre'])}\n"
            f"    📌 {_md_plain(c['direccion'])} ({_md_plain(c['ciudad'])}) "
            f"— detectado por: {_md_plain(c['motivo'])}"
        )
    return "\n".join(lines)



async def _tool_consultar_bd(tabla: str, filtros: dict) -> str:
    from supabase_client import consultar_tabla, TABLA_SCHEMA
    try:
        rows = await consultar_tabla(tabla, filtros or {})
    except ValueError as e:
        validas = ", ".join(f"`{k}`" for k in sorted(TABLA_SCHEMA.keys()))
        return f"❌ {e}\nTablas válidas: {validas}"
    except Exception as e:
        return f"❌ Error consultando Supabase: {e}"

    if not rows:
        desc = f" con filtros {filtros}" if filtros else ""
        return f"📭 No hay registros en *{tabla}*{desc}."

    CAMPOS = {
        "revaluos":       ["guia_numero", "nombre_destinatario", "revaluo", "created_at"],
        "retenciones":    ["guia_numero", "nombre_destinatario", "motivo", "piezas", "created_at"],
        "recoge_oficina": ["guia_numero", "nombre_destinatario", "ciudad", "piezas", "created_at"],
        "dir_especiales": ["guia_numero", "nombre_destinatario", "direccion", "ciudad", "created_at"],
    }
    cols = CAMPOS.get(tabla.lower(), list(rows[0].keys()))

    ICONOS = {
        "revaluos": "💰", "retenciones": "🔒",
        "recoge_oficina": "🏢", "dir_especiales": "📍",
    }
    icono = ICONOS.get(tabla.lower(), "📋")

    lines = [f"{icono} *{tabla.upper()} — {len(rows)} registro(s):*\n"]
    for r in rows[:25]:
        ts   = str(r.get("created_at", ""))[:10]
        guia = r.get("guia_numero", "")
        nombre = r.get("nombre_destinatario", "")
        extra_parts = []
        for c in cols:
            if c in ("guia_numero","nombre_destinatario","id","created_at"):
                continue
            val = r.get(c, "")
            if val and str(val) not in ("None","1"):
                extra_parts.append(f"{c}: {_md_plain(val)}")
        extra = " | ".join(extra_parts)
        line = f"  • {_md_code(guia)} — {_md_plain(nombre)}"
        if extra:
            line += f"\n    {_md_plain(extra)}"
        line += f" ({ts})"
        lines.append(line)

    if len(rows) > 25:
        lines.append(f"\n(...y {len(rows)-25} registros más. Usa filtros para acotar.)")
    return "\n".join(lines)


async def _tool_eliminar_de_bd(tabla: str, guia_numero: str) -> str:
    from supabase_client import eliminar_por_guia, TABLAS_VALIDAS
    try:
        n = await eliminar_por_guia(tabla, guia_numero.strip())
    except ValueError as e:
        return f"❌ {e}"
    except Exception as e:
        return f"❌ Error eliminando de Supabase: {e}"
    if n == 0:
        return f"⚠️ No se encontró la guía {_md_code(guia_numero)} en *{tabla}*."
    return f"🗑 Guía {_md_code(guia_numero)} eliminada de *{tabla}* ({n} registro(s) borrado(s))."


async def _tool_buscar_guias(
    df: pd.DataFrame,
    criterio: str,
    tipo_busqueda: str = "auto",
) -> str:
    tipo = (tipo_busqueda or "auto").strip().lower()
    if tipo == "auto":
        tipo = "guía" if _parece_numero_guia(_coerce_str(criterio)) else "nombre"
    resultados = buscar_guias_en_excel(df, criterio, tipo_busqueda)
    return _formatear_resultados_busqueda(resultados, criterio, tipo)


async def _tool_insertar_en_bd(
    tabla: str,
    guias: list[str],
    campos_extra: dict,
    df: pd.DataFrame,
) -> str:
    from supabase_client import insertar_en_tabla

    guias = _coerce_list_of_str(guias)
    if not guias:
        return "⚠️ No se indicaron guías para insertar."

    registros = _enriquecer_guias(guias, df, {})
    insertados, duplicados, errores = await insertar_en_tabla(
        tabla, registros, _coerce_dict(campos_extra)
    )

    lines = [f"✅ *Insertados en {tabla}:* {insertados}/{len(guias)}"]
    if duplicados:
        dup = ", ".join(_md_code(g) for g in duplicados[:10])
        lines.append(f"⚠️ Ya existían ({len(duplicados)}): {dup}")
        if len(duplicados) > 10:
            lines.append(f"  _...y {len(duplicados) - 10} más_")
    if errores:
        lines.append(f"❌ Errores ({len(errores)}):")
        for e in errores[:5]:
            lines.append(f"  • {e}")
    if insertados == 0 and not duplicados and not errores:
        lines.append("⚠️ No se insertó ningún registro. Verifica que las guías existan en el Excel.")
    return "\n".join(lines)


async def _tool_buscar_e_insertar_en_bd(
    tabla: str,
    criterio: str,
    tipo_busqueda: str,
    campos_extra: dict,
    df: pd.DataFrame,
) -> str:
    from supabase_client import insertar_en_tabla

    resultados = buscar_guias_en_excel(df, criterio, tipo_busqueda)
    if not resultados:
        return (
            f"📭 No se encontraron guías para «{criterio}» en el Excel. "
            "No se insertó nada en la base de datos."
        )

    busqueda = _formatear_resultados_busqueda(
        resultados, criterio,
        tipo_busqueda or "auto",
    )
    insertados, duplicados, errores = await insertar_en_tabla(
        tabla, resultados, _coerce_dict(campos_extra)
    )

    lines = [
        busqueda,
        "",
        f"💾 *Inserción en {tabla}:* {insertados}/{len(resultados)} registrado(s)",
    ]
    if duplicados:
        dup = ", ".join(_md_code(g) for g in duplicados[:10])
        lines.append(f"⚠️ Duplicados: {dup}")
    if errores:
        lines.append("❌ Errores:")
        for e in errores[:5]:
            lines.append(f"  • {e}")
    return "\n".join(lines)


async def _tool_listar_storage(carpeta: str = "ambas") -> str:
    from supabase_storage import listar_archivos, listar_todas_carpetas, CARPETAS_VALIDAS

    carpeta = (carpeta or "ambas").strip().lower()
    try:
        if carpeta in ("ambas", "ambos", "todo", "todos", "all", ""):
            datos = await listar_todas_carpetas()
            lines = [f"☁️ *Archivos en Storage* (`{config.STORAGE_BUCKET}`):\n"]
            for label, archivos in datos.items():
                lines.append(f"\n📁 *{label.upper()}* ({len(archivos)} archivo(s)):")
                if not archivos:
                    lines.append("  (vacío)")
                    continue
                for a in archivos[:20]:
                    tam = a.get("tamano")
                    tam_s = f" — {tam // 1024} KB" if tam else ""
                    ts  = str(a.get("actualizado", ""))[:10]
                    lines.append(f"  • {_md_code(a['nombre'])}{tam_s} ({ts})")
                if len(archivos) > 20:
                    lines.append(f"  (...y {len(archivos)-20} más)")
            return "\n".join(lines)

        carp = CARPETAS_VALIDAS.get(carpeta.replace(" ", "_"))
        if not carp:
            validas = ", ".join(CARPETAS_VALIDAS.keys())
            return f"❌ Carpeta '{carpeta}' no válida. Usa: {validas} o ambas"
        archivos = await listar_archivos(carp)
        lines = [f"📁 *{carpeta}* — {len(archivos)} archivo(s):\n"]
        if not archivos:
            return lines[0] + "\n(vacío)"
        for a in archivos[:25]:
            lines.append(f"  • {_md_code(a['nombre'])}")
        if len(archivos) > 25:
            lines.append(f"\n(...y {len(archivos)-25} más)")
        return "\n".join(lines)
    except Exception as e:
        return f"❌ Error listando Storage: {e}"


async def _tool_descargar_storage(
    carpeta: str,
    nombre_archivo: str,
    user_id: int | None,
) -> str:
    from supabase_storage import descargar_archivo, buscar_archivo_por_nombre

    nombre = _coerce_str(nombre_archivo).strip()
    if not nombre:
        return "⚠️ Indica el nombre del archivo a descargar."

    try:
        fname, data = await descargar_archivo(carpeta, nombre)
    except FileNotFoundError:
        hits = await buscar_archivo_por_nombre(nombre, carpeta or None)
        if len(hits) == 1:
            carp = hits[0]["carpeta"]
            fname, data = await descargar_archivo(carp, hits[0]["nombre"])
        elif len(hits) > 1:
            lista = "\n".join(
                f"  • {_md_code(h['nombre'])} ({h['carpeta']})" for h in hits[:10]
            )
            return (
                f"⚠️ Hay varios archivos similares. Sé más específico:\n{lista}"
            )
        else:
            return f"❌ No encontré `{nombre}` en Storage."
    except Exception as e:
        return f"❌ Error descargando: {e}"

    if user_id is not None:
        _pending_downloads[user_id] = (fname, data)
    return (
        f"📥 *Archivo listo:* {_md_code(fname)}\n"
        f"Carpeta: {_md_plain(carpeta)} — {len(data) // 1024} KB"
    )


async def _tool_eliminar_storage(carpeta: str, nombre_archivo: str) -> str:
    from supabase_storage import eliminar_archivo
    try:
        ruta = await eliminar_archivo(carpeta, _coerce_str(nombre_archivo))
        return f"🗑 Archivo eliminado: `{ruta}`"
    except FileNotFoundError as e:
        return f"❌ {e}"
    except Exception as e:
        return f"❌ Error eliminando: {e}"


async def _tool_subir_excels_storage(
    session: dict | None,
    reemplazar: bool,
    user_id: int | None,
) -> str:
    from supabase_storage import (
        subir_par_excels,
        verificar_duplicados_subida,
        DuplicateStorageFileError,
    )

    if not session:
        return "⚠️ No hay sesión activa. Sube un Excel primero."
    orig_path = session.get("excel_path")
    proc_path = session.get("processed_path")
    if not orig_path or not proc_path:
        return "⚠️ No hay archivos en la sesión actual."
    if not os.path.isfile(orig_path) or not os.path.isfile(proc_path):
        return "⚠️ Los archivos de la sesión ya no están en disco."

    orig_name = Path(orig_path).name
    proc_name = Path(proc_path).name

    if not reemplazar:
        dup = await verificar_duplicados_subida(orig_name, proc_name)
        if dup:
            lista = "\n".join(f"  • `{d}`" for d in dup)
            return (
                f"⚠️ *Ya existen archivos en Storage:*\n{lista}\n\n"
                "Di explícitamente que quieres *reemplazar* o *sobrescribir* "
                "para volver a subirlos."
            )

    try:
        path_orig, path_proc = await subir_par_excels(
            orig_path, proc_path, user_id or 0, reemplazar=reemplazar
        )
        return (
            f"✅ *Subidos a Storage:*\n"
            f"  • `{path_orig}`\n"
            f"  • `{path_proc}`"
        )
    except DuplicateStorageFileError as e:
        lista = "\n".join(f"  • `{d}`" for d in e.rutas)
        return (
            f"⚠️ Duplicados en Storage:\n{lista}\n"
            "Pide reemplazar/sobrescribir para continuar."
        )
    except Exception as e:
        return f"❌ Error subiendo a Storage: {e}"


async def _tool_editar_en_bd(tabla: str, guia_numero: str, campos: dict) -> str:
    from supabase_client import editar_registro, TABLAS_VALIDAS
    try:
        n = await editar_registro(tabla, guia_numero.strip(), _coerce_dict(campos))
    except ValueError as e:
        return f"❌ {e}"
    except Exception as e:
        return f"❌ Error editando en Supabase: {e}"
    if n == 0:
        return f"⚠️ No se encontró la guía {_md_code(guia_numero)} en *{tabla}*."
    cambios = ", ".join(f"{k}={_md_plain(v)}" for k, v in campos.items())
    return f"✏️ Guía {_md_code(guia_numero)} actualizada en *{tabla}*: {cambios}"


# ── Dispatcher central ────────────────────────────────────────────────────────

async def execute_tool(
    tool_name: str,
    params: dict,
    df: pd.DataFrame,
    patterns: list[dict],
    user_id: int | None = None,
    session: dict | None = None,
) -> str:
    try:
        # Excel tools (síncronos)
        if tool_name == "buscar_por_nombre":
            return _buscar_por_nombre(df, params.get("texto", ""))
        elif tool_name == "buscar_guia":
            return _buscar_guia(df, params.get("texto", ""))
        elif tool_name == "buscar_guias":
            return await _tool_buscar_guias(
                df,
                _coerce_str(params.get("criterio", "")),
                params.get("tipo_busqueda", "auto"),
            )
        elif tool_name == "filtrar_ciudad":
            return _filtrar_ciudad(df, params.get("ciudad", ""))
        elif tool_name == "top_ciudades":
            return _top_ciudades(df, int(params.get("top_n", 5)))
        elif tool_name == "resumen_pesos":
            return _resumen_pesos(df)
        elif tool_name == "estadisticas_patron":
            return _estadisticas_patron(df, params.get("patron", ""), patterns)

        # Supabase tools (asíncronos)
        elif tool_name == "registrar_revaluos":
            guias = _coerce_list_of_str(params.get("guias", []))
            return await _tool_registrar_revaluos(
                guias, params.get("revaluo", "Pendiente de pago"), df
            )
        elif tool_name == "registrar_retenciones":
            guias = _coerce_list_of_str(params.get("guias", []))
            return await _tool_registrar_retenciones(
                guias, params.get("motivo", "Sin motivo"), df
            )
        elif tool_name == "consultar_bd":
            return await _tool_consultar_bd(
                params.get("tabla", ""),
                params.get("filtros", {}),
            )
        elif tool_name == "eliminar_de_bd":
            return await _tool_eliminar_de_bd(
                params.get("tabla", ""),
                _coerce_str(params.get("guia_numero", "")).strip(),
            )
        elif tool_name == "editar_en_bd":
            return await _tool_editar_en_bd(
                params.get("tabla", ""),
                _coerce_str(params.get("guia_numero", "")).strip(),
                params.get("campos", {}),
            )
        elif tool_name == "insertar_en_bd":
            return await _tool_insertar_en_bd(
                params.get("tabla", ""),
                _coerce_list_of_str(params.get("guias", [])),
                params.get("campos_extra", {}),
                df,
            )
        elif tool_name == "buscar_e_insertar_en_bd":
            return await _tool_buscar_e_insertar_en_bd(
                params.get("tabla", ""),
                _coerce_str(params.get("criterio", "")),
                params.get("tipo_busqueda", "auto"),
                params.get("campos_extra", {}),
                df,
            )
        elif tool_name == "analizar_recoge_oficina":
            return await _tool_analizar_recoge_oficina(df)
        elif tool_name == "analizar_dir_especiales":
            return await _tool_analizar_dir_especiales(df)

        elif tool_name == "listar_storage":
            return await _tool_listar_storage(params.get("carpeta", "ambas"))
        elif tool_name == "descargar_storage":
            return await _tool_descargar_storage(
                params.get("carpeta", ""),
                params.get("nombre_archivo", ""),
                user_id,
            )
        elif tool_name == "eliminar_storage":
            return await _tool_eliminar_storage(
                params.get("carpeta", ""),
                params.get("nombre_archivo", ""),
            )
        elif tool_name == "subir_excels_storage":
            return await _tool_subir_excels_storage(
                session,
                bool(params.get("reemplazar", False)),
                user_id,
            )

        elif tool_name == "respuesta_texto":
            return params.get("respuesta", "")

        else:
            return f"⚠️ Herramienta `{tool_name}` no reconocida."

    except Exception as e:
        logger.error(f"Error en herramienta {tool_name}: {e}", exc_info=True)
        return f"❌ Error ejecutando `{tool_name}`: {e}"


# ── Limpieza de respuesta del LLM ─────────────────────────────────────────────

def _clean_llm_response(raw: str) -> str:
    """Elimina thinking tags, backticks y artefactos del LLM."""
    # Quitar bloques <think>...</think> de qwen3
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL)
    raw = raw.strip()
    # Quitar backticks y prefijo json
    raw = re.sub(r"^```(?:json)?", "", raw).rstrip("`").strip()
    # Si hay texto antes del JSON, extraer solo el JSON
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        raw = match.group(0)
    return raw


# ── Orquestador principal ─────────────────────────────────────────────────────

async def ask_ai(
    question: str,
    df: pd.DataFrame,
    summary: str,
    patterns: list[dict],
    history: list[dict] | None = None,
    user_id: int | None = None,
    session: dict | None = None,
) -> str:
    """
    1. Construye contexto enriquecido del Excel
    2. Llama a Ollama con el modelo activo (seleccionado al arrancar)
    3. Parsea el JSON de respuesta
    4. Ejecuta la herramienta correspondiente
    5. Retorna el resultado como texto
    """
    sample_rows = df.head(4).to_dict(orient="records")
    context = (
        f"{summary}\n\n"
        f"Columnas disponibles: {', '.join(df.columns.tolist())}\n"
        f"Muestra de datos (primeras 4 filas):\n"
        f"{json.dumps(sample_rows, ensure_ascii=False, indent=2)}"
    )

    tools_str = json.dumps(TOOLS_SCHEMA, ensure_ascii=False, indent=2)
    system    = SYSTEM_PROMPT.format(tools=tools_str, context=context)

    logger.info(f"Pregunta al agente: {question[:150]}")
    logger.info(f"Modelo activo: {config.ACTIVE_MODEL} | historial: {len(history or [])} msgs")

    # Construir lista de mensajes con historial
    messages = [{"role": "system", "content": system}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": question})

    raw = None
    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=config.ACTIVE_MODEL,
            options={"temperature": 0},
            messages=messages,
        )
        raw = response["message"]["content"]
        logger.info(f"LLM raw: {raw[:300]}")

        clean = _clean_llm_response(raw)
        logger.info(f"LLM clean: {clean[:200]}")

        parsed    = json.loads(clean)
        tool_name = parsed.get("tool", "respuesta_texto")
        params    = parsed.get("params", {})

        logger.info(f"Tool seleccionada: {tool_name} | params: {params}")
        result = await execute_tool(
            tool_name, params, df, patterns,
            user_id=user_id, session=session,
        )
        return result

    except json.JSONDecodeError:
        logger.warning("LLM no devolvió JSON válido, usando respuesta directa")
        if raw:
            cleaned = _clean_llm_response(raw)
            return cleaned if cleaned else "No pude interpretar tu solicitud. ¿Puedes reformularla?"
        return "No pude interpretar la respuesta del modelo."

    except ollama.ResponseError as e:
        logger.error(f"Ollama ResponseError: {e}")
        return (
            f"❌ Error del modelo Ollama: `{e}`\n\n"
            f"Modelo activo: `{config.ACTIVE_MODEL}`\n"
            "Verifica que el modelo esté descargado con `ollama list`."
        )
    except ConnectionError as e:
        logger.error(f"Ollama ConnectionError: {e}")
        return (
            "❌ No se pudo conectar a Ollama.\n"
            "Verifica que el servicio esté corriendo: `ollama serve`"
        )
    except Exception as e:
        logger.error(f"Error inesperado en ask_ai: {type(e).__name__}: {e}", exc_info=True)
        return f"❌ Error inesperado (`{type(e).__name__}`): {e}"
