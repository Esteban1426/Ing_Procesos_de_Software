"""
Cliente Supabase Storage para archivos Excel.
Bucket: Excels
  - originales/
  - procesados/
"""
import logging
from pathlib import Path
from urllib.parse import quote

import httpx

from config import (
    SUPABASE_URL,
    SUPABASE_KEY,
    STORAGE_BUCKET,
    STORAGE_FOLDER_ORIGINALES,
    STORAGE_FOLDER_PROCESADOS,
)

logger = logging.getLogger(__name__)

XLSX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

CARPETAS_VALIDAS = {
    "originales": STORAGE_FOLDER_ORIGINALES,
    "procesados": STORAGE_FOLDER_PROCESADOS,
}


class DuplicateStorageFileError(Exception):
    """El archivo ya existe en Storage y no se permitió sobrescribir."""
    def __init__(self, rutas: list[str]):
        self.rutas = rutas
        super().__init__(f"Duplicados: {', '.join(rutas)}")


def _headers(extra: dict | None = None) -> dict:
    h = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    if extra:
        h.update(extra)
    return h


def _check_config():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL o SUPABASE_KEY no configurados en .env")


def normalizar_carpeta(carpeta: str) -> str:
    key = (carpeta or "").strip().lower().replace(" ", "_").replace("-", "_")
    resolved = CARPETAS_VALIDAS.get(key)
    if not resolved:
        raise ValueError(
            f"Carpeta '{carpeta}' no válida. Usa: originales | procesados"
        )
    return resolved


def _batch_id_from_name(nombre_archivo: str) -> str:
    """
    Extrae un identificador corto a partir del nombre de archivo.
    Regla: tomar el último fragmento antes de la extensión, separado por '_'.
    Ej: '12345_2849.xlsx' -> '2849', '2849.xlsx' -> '2849'.
    """
    stem = Path(nombre_archivo).stem
    parts = stem.split("_")
    ident = parts[-1] if parts else stem
    return ident or stem


def _object_path(carpeta: str, nombre_archivo: str) -> str:
    nombre = Path(nombre_archivo).name
    return f"{carpeta.strip('/')}/{nombre}"


def _storage_object_url(object_path: str) -> str:
    encoded = "/".join(quote(part, safe="") for part in object_path.split("/"))
    return f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{encoded}"


def _storage_list_url() -> str:
    return f"{SUPABASE_URL}/storage/v1/object/list/{quote(STORAGE_BUCKET, safe='')}"


# ── CREATE ────────────────────────────────────────────────────────────────────

async def subir_archivo(
    carpeta: str,
    nombre_archivo: str,
    contenido: bytes,
    reemplazar: bool = False,
) -> str:
    """
    Sube un archivo al bucket Excels.
    Si reemplazar=False y ya existe, lanza DuplicateStorageFileError.
    """
    _check_config()
    carpeta = normalizar_carpeta(carpeta)
    object_path = _object_path(carpeta, nombre_archivo)

    if not reemplazar and await archivo_existe(carpeta, nombre_archivo):
        raise DuplicateStorageFileError([object_path])

    headers = _headers({
        "Content-Type": XLSX_CONTENT_TYPE,
        "x-upsert": "true" if reemplazar else "false",
    })

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            _storage_object_url(object_path),
            headers=headers,
            content=contenido,
        )
        if r.status_code == 400 and "Duplicate" in r.text and reemplazar:
            headers["x-upsert"] = "true"
            r = await client.post(
                _storage_object_url(object_path),
                headers=headers,
                content=contenido,
            )
        r.raise_for_status()

    logger.info(f"Storage upload OK: {STORAGE_BUCKET}/{object_path}")
    return object_path


async def subir_par_excels(
    orig_path: str,
    proc_path: str,
    user_id: int,
    reemplazar: bool = False,
) -> tuple[str, str]:
    """
    Sube original y procesado a sus carpetas con nombres limpios:
    {batch_id}_original.xlsx y {batch_id}_processed.xlsx
    """
    # Identificador base a partir del nombre original en disco
    disk_orig_name = Path(orig_path).name
    batch_id = _batch_id_from_name(disk_orig_name)

    orig_name = f"{batch_id}_original.xlsx"
    proc_name = f"{batch_id}_processed.xlsx"

    with open(orig_path, "rb") as f:
        orig_bytes = f.read()
    with open(proc_path, "rb") as f:
        proc_bytes = f.read()

    path_orig = await subir_archivo(
        STORAGE_FOLDER_ORIGINALES, orig_name, orig_bytes, reemplazar=reemplazar
    )
    path_proc = await subir_archivo(
        STORAGE_FOLDER_PROCESADOS, proc_name, proc_bytes, reemplazar=reemplazar
    )
    return path_orig, path_proc


async def verificar_duplicados_subida(orig_name: str, proc_name: str) -> list[str]:
    """
    Retorna rutas en Storage que ya existen para este par de archivos.
    Usa nombres limpios basados en el identificador de lote.
    """
    batch_id = _batch_id_from_name(orig_name)
    clean_orig = f"{batch_id}_original.xlsx"
    clean_proc = f"{batch_id}_processed.xlsx"

    duplicados: list[str] = []
    if await archivo_existe(STORAGE_FOLDER_ORIGINALES, clean_orig):
        duplicados.append(_object_path(STORAGE_FOLDER_ORIGINALES, clean_orig))
    if await archivo_existe(STORAGE_FOLDER_PROCESADOS, clean_proc):
        duplicados.append(_object_path(STORAGE_FOLDER_PROCESADOS, clean_proc))
    return duplicados


# ── READ ──────────────────────────────────────────────────────────────────────

async def listar_archivos(carpeta: str, limite: int = 100) -> list[dict]:
    """
    Lista archivos .xlsx en una carpeta.
    Retorna [{"nombre": str, "ruta": str, "tamano": int|None, "actualizado": str|None}, ...]
    """
    _check_config()
    carpeta = normalizar_carpeta(carpeta)
    prefix = f"{carpeta}/"

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            _storage_list_url(),
            headers={**_headers(), "Content-Type": "application/json"},
            json={"prefix": prefix, "limit": limite, "offset": 0},
        )
        r.raise_for_status()
        items = r.json()

    archivos = []
    for item in items or []:
        name = item.get("name", "")
        if not name or name.endswith("/"):
            continue
        # Supabase puede devolver solo el nombre o ruta relativa
        base = Path(name).name
        if not base.lower().endswith(".xlsx"):
            continue
        meta = item.get("metadata") or {}
        archivos.append({
            "nombre":      base,
            "ruta":        _object_path(carpeta, base),
            "tamano":      meta.get("size"),
            "actualizado": item.get("updated_at") or item.get("created_at"),
        })

    archivos.sort(key=lambda x: x.get("actualizado") or "", reverse=True)
    return archivos


async def listar_todas_carpetas(limite: int = 50) -> dict[str, list[dict]]:
    """Lista archivos en originales y procesados."""
    return {
        "originales": await listar_archivos(STORAGE_FOLDER_ORIGINALES, limite),
        "procesados": await listar_archivos(STORAGE_FOLDER_PROCESADOS, limite),
    }


async def archivo_existe(carpeta: str, nombre_archivo: str) -> bool:
    nombre = Path(nombre_archivo).name
    archivos = await listar_archivos(carpeta, limite=1000)
    return any(a["nombre"] == nombre for a in archivos)


async def descargar_archivo(carpeta: str, nombre_archivo: str) -> tuple[str, bytes]:
    """Descarga un archivo. Retorna (nombre_archivo, contenido_bytes)."""
    _check_config()
    carpeta = normalizar_carpeta(carpeta)
    object_path = _object_path(carpeta, nombre_archivo)

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.get(_storage_object_url(object_path), headers=_headers())
        if r.status_code == 404:
            raise FileNotFoundError(
                f"No existe `{nombre_archivo}` en `{carpeta}`."
            )
        r.raise_for_status()
        return Path(nombre_archivo).name, r.content


async def buscar_archivo_por_nombre(
    fragmento: str,
    carpeta: str | None = None,
) -> list[dict]:
    """Busca archivos cuyo nombre contiene el fragmento (case-insensitive)."""
    fragmento = fragmento.lower()
    resultados = []
    carpetas = [normalizar_carpeta(carpeta)] if carpeta else list(CARPETAS_VALIDAS.values())
    for carp in carpetas:
        for arch in await listar_archivos(carp, limite=200):
            if fragmento in arch["nombre"].lower():
                arch = {**arch, "carpeta": carp}
                resultados.append(arch)
    return resultados


# ── DELETE ────────────────────────────────────────────────────────────────────

async def eliminar_archivo(carpeta: str, nombre_archivo: str) -> str:
    """Elimina un archivo de Storage. Retorna la ruta eliminada."""
    _check_config()
    carpeta = normalizar_carpeta(carpeta)
    object_path = _object_path(carpeta, nombre_archivo)

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.delete(
            _storage_object_url(object_path),
            headers=_headers(),
        )
        if r.status_code == 404:
            raise FileNotFoundError(
                f"No existe `{nombre_archivo}` en `{carpeta}`."
            )
        r.raise_for_status()

    logger.info(f"Storage delete OK: {object_path}")
    return object_path


# ── Test ──────────────────────────────────────────────────────────────────────

async def test_storage() -> str:
    """Verifica acceso al bucket Excels."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return "❌ Supabase no configurado en .env"
    url = f"{SUPABASE_URL}/storage/v1/bucket/{quote(STORAGE_BUCKET, safe='')}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, headers=_headers())
            if r.status_code == 200:
                return f"✅ Bucket `{STORAGE_BUCKET}` accesible"
            return f"❌ Bucket `{STORAGE_BUCKET}`: HTTP {r.status_code} — {r.text[:200]}"
    except Exception as e:
        return f"❌ Error accediendo a Storage: {e}"
