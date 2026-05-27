"""
Cliente Supabase para el bot courier.
Maneja las 4 tablas:
  - Revaluos
  - Retenciones
  - Recoge_Oficina
  - Clientes_DirEspeciales
"""
import logging
import asyncio
from typing import Optional
from datetime import datetime

import httpx
from config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

# ── Cliente base ──────────────────────────────────────────────────────────────

async def _post(table: str, payload: dict | list) -> dict:
    """INSERT en Supabase vía REST."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, headers=HEADERS, json=payload)
        r.raise_for_status()
        return r.json()


async def _get(table: str, params: dict = {}) -> list:
    """SELECT en Supabase vía REST."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, headers={**HEADERS, "Prefer": "count=exact"}, params=params)
        r.raise_for_status()
        return r.json()


async def _exists(table: str, column: str, value: str) -> bool:
    """Verifica si ya existe un registro."""
    try:
        rows = await _get(table, {column: f"eq.{value}", "select": column, "limit": "1"})
        return len(rows) > 0
    except Exception:
        return False


# ── Revaluos ──────────────────────────────────────────────────────────────────

async def insertar_revaluos(guias: list[dict]) -> tuple[int, list[str]]:
    """
    Inserta guías en la tabla Revaluos.
    guias: [{"guia_numero": str, "nombre_destinatario": str, "revaluo": str}]
    Retorna (insertados, duplicados)
    """
    insertados = 0
    duplicados = []

    for g in guias:
        guia = g["guia_numero"]
        if await _exists("Revaluos", "guia_numero", guia):
            duplicados.append(guia)
            continue
        await _post("Revaluos", {
            "guia_numero":         guia,
            "nombre_destinatario": g.get("nombre_destinatario", ""),
            "revaluo":             g.get("revaluo", "Pendiente"),
        })
        insertados += 1
        logger.info(f"Revaluo insertado: {guia}")

    return insertados, duplicados


async def obtener_revaluos() -> list[dict]:
    return await _get("Revaluos", {"select": "*", "order": "created_at.desc", "limit": "50"})


# ── Retenciones ───────────────────────────────────────────────────────────────

async def insertar_retenciones(guias: list[dict]) -> tuple[int, list[str]]:
    """
    guias: [{"guia_numero": str, "nombre_destinatario": str, "motivo": str, "piezas": int}]
    """
    insertados = 0
    duplicados = []

    for g in guias:
        guia = g["guia_numero"]
        if await _exists("Retenciones", "guia_numero", guia):
            duplicados.append(guia)
            continue
        await _post("Retenciones", {
            "guia_numero":         guia,
            "nombre_destinatario": g.get("nombre_destinatario", ""),
            "motivo":              g.get("motivo", "Sin motivo especificado"),
            "piezas":              int(g.get("piezas", 1)),
        })
        insertados += 1
        logger.info(f"Retencion insertada: {guia} — motivo: {g.get('motivo')}")

    return insertados, duplicados


async def obtener_retenciones() -> list[dict]:
    return await _get("Retenciones", {"select": "*", "order": "created_at.desc", "limit": "50"})


# ── Recoge en Oficina ─────────────────────────────────────────────────────────

async def obtener_recoge_oficina() -> list[dict]:
    return await _get("Recoge_Oficina", {"select": "*"})


async def insertar_recoge_oficina(guias: list[dict]) -> tuple[int, list[str]]:
    """
    guias: [{"guia_numero": str, "nombre_destinatario": str, "ciudad": str, "piezas": int}]
    """
    insertados = 0
    duplicados = []

    for g in guias:
        guia = g["guia_numero"]
        if await _exists("Recoge_Oficina", "guia_numero", guia):
            duplicados.append(guia)
            continue
        await _post("Recoge_Oficina", {
            "guia_numero":         guia,
            "nombre_destinatario": g.get("nombre_destinatario", ""),
            "ciudad":              g.get("ciudad", ""),
            "piezas":              int(g.get("piezas", 1)),
        })
        insertados += 1

    return insertados, duplicados


# ── Direcciones Especiales ────────────────────────────────────────────────────

async def obtener_dir_especiales() -> list[dict]:
    return await _get("Clientes_DirEspeciales", {"select": "*"})


async def insertar_dir_especial(guias: list[dict]) -> tuple[int, list[str]]:
    """
    guias: [{"guia_numero": str, "nombre_destinatario": str, "direccion": str, "ciudad": str}]
    """
    insertados = 0
    duplicados = []

    for g in guias:
        guia = g["guia_numero"]
        if await _exists("Clientes_DirEspeciales", "guia_numero", guia):
            duplicados.append(guia)
            continue
        await _post("Clientes_DirEspeciales", {
            "guia_numero":         guia,
            "nombre_destinatario": g.get("nombre_destinatario", ""),
            "direccion":           g.get("direccion", ""),
            "ciudad":              g.get("ciudad", ""),
        })
        insertados += 1

    return insertados, duplicados


# ── Cruce de Excel con tablas ─────────────────────────────────────────────────

async def cruzar_excel_con_recoge_oficina(df) -> list[dict]:
    """
    Cruza el DataFrame con la tabla Recoge_Oficina.
    Detecta coincidencias por nombre_destinatario (fuzzy) o guia_numero exacto.
    Retorna lista de filas del Excel que están en Recoge_Oficina.
    """
    import pandas as pd

    registros = await obtener_recoge_oficina()
    if not registros:
        return []

    # Nombres y guías en la tabla (lowercase para comparación)
    nombres_bd = {r["nombre_destinatario"].lower().strip() for r in registros}
    guias_bd   = {r["guia_numero"].strip() for r in registros}

    coincidencias = []
    for _, row in df.iterrows():
        nombre = str(row.get("Nombre Destinatario", "")).lower().strip()
        guia   = str(row.get("Guia#", "")).strip()

        # Coincidencia exacta por guía o por nombre parcial
        if guia in guias_bd or any(nombre in n or n in nombre for n in nombres_bd if len(n) > 3):
            coincidencias.append({
                "guia":    guia,
                "nombre":  row.get("Nombre Destinatario", ""),
                "ciudad":  row.get("Ciudad", ""),
                "piezas":  row.get("Piezas", ""),
            })

    return coincidencias


async def cruzar_excel_con_dir_especiales(df) -> list[dict]:
    """
    Cruza el DataFrame con Clientes_DirEspeciales.
    Detecta por nombre o dirección.
    """
    registros = await obtener_dir_especiales()
    if not registros:
        return []

    nombres_bd    = {r["nombre_destinatario"].lower().strip() for r in registros}
    direcciones_bd = {r["direccion"].lower().strip() for r in registros}

    coincidencias = []
    for _, row in df.iterrows():
        nombre    = str(row.get("Nombre Destinatario", "")).lower().strip()
        direccion = str(row.get("Dirección", "")).lower().strip()
        guia      = str(row.get("Guia#", "")).strip()

        hit_nombre = any(nombre in n or n in nombre for n in nombres_bd if len(n) > 3)
        hit_dir    = any(direccion in d or d in direccion for d in direcciones_bd if len(d) > 5)

        if hit_nombre or hit_dir:
            coincidencias.append({
                "guia":      guia,
                "nombre":    row.get("Nombre Destinatario", ""),
                "direccion": row.get("Dirección", ""),
                "ciudad":    row.get("Ciudad", ""),
                "motivo":    "nombre" if hit_nombre else "dirección",
            })

    return coincidencias


# ── Test de conexión ──────────────────────────────────────────────────────────

async def test_conexion() -> str:
    try:
        rows = await _get("Revaluos", {"select": "id", "limit": "1"})
        return f"✅ Conexión a Supabase OK ({SUPABASE_URL[:40]}...)"
    except httpx.HTTPStatusError as e:
        return f"❌ Error HTTP {e.response.status_code}: {e.response.text[:200]}"
    except Exception as e:
        return f"❌ Error de conexión: {e}"


# ── CRUD genérico por tabla ───────────────────────────────────────────────────

TABLAS_VALIDAS = {
    "revaluos":          "Revaluos",
    "retenciones":       "Retenciones",
    "recoge_oficina":    "Recoge_Oficina",
    # aliases comunes (LLM / usuario)
    "recogeoficina":     "Recoge_Oficina",
    "recoge oficina":    "Recoge_Oficina",
    "recoge-oficina":    "Recoge_Oficina",
    "dir_especiales":    "Clientes_DirEspeciales",
    "direcciones_especiales": "Clientes_DirEspeciales",
    "clientes_direspeciales": "Clientes_DirEspeciales",
}

# Esquema por tabla: campos insertables y valores por defecto
TABLA_SCHEMA: dict[str, dict] = {
    "revaluos": {
        "campos": ["guia_numero", "nombre_destinatario", "revaluo"],
        "defaults": {"revaluo": "Pendiente de pago"},
        "int_fields": set(),
    },
    "retenciones": {
        "campos": ["guia_numero", "nombre_destinatario", "motivo", "piezas"],
        "defaults": {"motivo": "Sin motivo especificado", "piezas": 1},
        "int_fields": {"piezas"},
    },
    "recoge_oficina": {
        "campos": ["guia_numero", "nombre_destinatario", "ciudad", "piezas"],
        "defaults": {"piezas": 1},
        "int_fields": {"piezas"},
    },
    "dir_especiales": {
        "campos": ["guia_numero", "nombre_destinatario", "direccion", "ciudad"],
        "defaults": {},
        "int_fields": set(),
    },
}

def _norm_tabla_key(tabla_key: str) -> str:
    key = (tabla_key or "").strip().lower().replace("__", "_")
    key = key.replace("-", "_").replace(" ", "_")
    # RecogeOficina → recogeoficina
    return key


def resolver_tabla(tabla_key: str) -> tuple[str, str]:
    """Retorna (clave_normalizada, nombre_tabla_supabase)."""
    norm = _norm_tabla_key(tabla_key)
    tabla = TABLAS_VALIDAS.get(norm)
    if not tabla:
        raise ValueError(
            f"Tabla '{tabla_key}' no reconocida. "
            f"Válidas: {', '.join(sorted(TABLA_SCHEMA.keys()))}"
        )
    # Mapear nombre Supabase → clave de esquema
    schema_key = next(
        (k for k, v in TABLAS_VALIDAS.items() if v == tabla and k in TABLA_SCHEMA),
        norm,
    )
    if schema_key not in TABLA_SCHEMA:
        for k, v in TABLAS_VALIDAS.items():
            if v == tabla and k in TABLA_SCHEMA:
                schema_key = k
                break
    return schema_key, tabla


def _safe_str(val) -> str:
    if val is None:
        return ""
    if isinstance(val, (list, tuple)) and val:
        return _safe_str(val[0])
    return str(val).strip()


def _build_payload(schema_key: str, registro: dict, extras: dict | None = None) -> dict:
    """Arma el payload de INSERT según el esquema de la tabla."""
    schema = TABLA_SCHEMA[schema_key]
    merged = {**schema["defaults"], **registro, **(extras or {})}
    payload = {}
    for campo in schema["campos"]:
        if campo in merged and merged[campo] not in (None, ""):
            val = merged[campo]
            if campo in schema["int_fields"]:
                try:
                    val = int(str(val).replace(",", "") or 1)
                except (ValueError, TypeError):
                    val = 1
            else:
                val = _safe_str(val)
            payload[campo] = val
    if "guia_numero" not in payload:
        raise ValueError("Falta guia_numero en el registro.")
    return payload


async def _delete(table: str, filters: dict) -> int:
    """DELETE con filtros. Retorna filas eliminadas."""
    url    = f"{SUPABASE_URL}/rest/v1/{table}"
    params = {k: f"eq.{_safe_str(v)}" for k, v in filters.items()}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.delete(
            url,
            headers={**HEADERS, "Prefer": "count=exact"},
            params=params,
        )
        r.raise_for_status()
        # Supabase devuelve Content-Range con el conteo
        cr = r.headers.get("content-range", "0")
        try:
            return int(cr.split("/")[-1])
        except Exception:
            return 0


async def _patch(table: str, filters: dict, data: dict) -> int:
    """UPDATE con filtros. Retorna filas actualizadas."""
    url    = f"{SUPABASE_URL}/rest/v1/{table}"
    params = {k: f"eq.{_safe_str(v)}" for k, v in filters.items()}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.patch(
            url,
            headers={**HEADERS, "Prefer": "count=exact"},
            params=params,
            json=data,
        )
        r.raise_for_status()
        cr = r.headers.get("content-range", "0")
        try:
            return int(cr.split("/")[-1])
        except Exception:
            return 0


# ── Consultar tabla completa o filtrada ───────────────────────────────────────

async def consultar_tabla(tabla_key: str, filtros: dict = {}) -> list[dict]:
    """
    Trae registros de una tabla.
    tabla_key: 'revaluos' | 'retenciones' | 'recoge_oficina' | 'dir_especiales'
    filtros: {"guia_numero": "BOG001", "motivo": "..."} (opcional)
    """
    _, tabla = resolver_tabla(tabla_key)
    params = {"select": "*", "order": "created_at.desc", "limit": "100"}
    for col, val in (filtros or {}).items():
        val = _safe_str(val)
        if not val:
            continue
        if col == "guia_numero":
            params[col] = f"eq.{val}"
        else:
            params[col] = f"ilike.*{val}*"
    return await _get(tabla, params)


async def insertar_en_tabla(
    tabla_key: str,
    registros: list[dict],
    campos_extra: dict | None = None,
) -> tuple[int, list[str], list[str]]:
    """
    INSERT genérico en cualquier tabla válida.
    Retorna (insertados, duplicados, errores).
    """
    schema_key, tabla = resolver_tabla(tabla_key)
    insertados, duplicados, errores = 0, [], []

    for reg in registros:
        try:
            payload = _build_payload(schema_key, reg, campos_extra)
            guia = payload["guia_numero"]
            if await _exists(tabla, "guia_numero", guia):
                duplicados.append(guia)
                continue
            await _post(tabla, payload)
            insertados += 1
            logger.info(f"Insertado en {tabla}: {guia}")
        except Exception as e:
            guia = _safe_str(reg.get("guia_numero", "?"))
            errores.append(f"{guia}: {e}")
            logger.error(f"Error insertando {guia} en {tabla}: {e}")

    return insertados, duplicados, errores


# ── Eliminar por guía o por ID ────────────────────────────────────────────────

async def eliminar_por_guia(tabla_key: str, guia_numero: str) -> int:
    _, tabla = resolver_tabla(tabla_key)
    return await _delete(tabla, {"guia_numero": _safe_str(guia_numero)})


async def eliminar_por_id(tabla_key: str, record_id: str) -> int:
    _, tabla = resolver_tabla(tabla_key)
    return await _delete(tabla, {"id": _safe_str(record_id)})


# ── Editar (actualizar campo) ─────────────────────────────────────────────────

async def editar_registro(tabla_key: str, guia_numero: str, campos: dict) -> int:
    """
    Actualiza campos de un registro identificado por guia_numero.
    campos: {"motivo": "Nuevo motivo", "revaluo": "Actualizado"}
    """
    schema_key, tabla = resolver_tabla(tabla_key)
    campos = dict(campos or {})
    campos.pop("id", None)
    campos.pop("created_at", None)
    campos.pop("guia_numero", None)
    if not campos:
        raise ValueError("No hay campos válidos para actualizar.")
    # Normalizar tipos según esquema
    schema = TABLA_SCHEMA.get(schema_key, {})
    clean = {}
    for k, v in campos.items():
        if k in schema.get("int_fields", set()):
            try:
                clean[k] = int(str(v).replace(",", "") or 1)
            except (ValueError, TypeError):
                clean[k] = 1
        else:
            clean[k] = _safe_str(v)
    return await _patch(tabla, {"guia_numero": _safe_str(guia_numero)}, clean)
