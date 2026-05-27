"""
Configuración central del bot courier.
Carga variables de entorno y define constantes.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Telegram ──────────────────────────────────────────────────────────────────
BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")

# IDs de usuarios autorizados (separados por coma en .env)
# Ejemplo: AUTHORIZED_USERS=123456789,987654321
# Dejar vacío para permitir TODOS (no recomendado en producción)
_raw = os.getenv("AUTHORIZED_USERS", "")
AUTHORIZED_USERS: list[int] = [int(x.strip()) for x in _raw.split(",") if x.strip().isdigit()]

# ── Supabase ──────────────────────────────────────────────────────────────────
# Usar la service_role key (no la anon key) para escribir sin restricciones RLS
# Encuéntrala en: Supabase Dashboard → Settings → API → service_role secret
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

# Supabase Storage (bucket Excels)
STORAGE_BUCKET: str = os.getenv("STORAGE_BUCKET", "Excels")
STORAGE_FOLDER_ORIGINALES: str = os.getenv("STORAGE_FOLDER_ORIGINALES", "originales")
STORAGE_FOLDER_PROCESADOS: str = os.getenv("STORAGE_FOLDER_PROCESADOS", "procesados")

# ── Ollama ────────────────────────────────────────────────────────────────────
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen3:4b")

# ── Archivos ──────────────────────────────────────────────────────────────────
MAX_FILE_MB: int = int(os.getenv("MAX_FILE_MB", "20"))
MAX_FILE_BYTES: int = MAX_FILE_MB * 1024 * 1024

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR        = os.path.join(BASE_DIR, "data")
EXCELS_DIR      = os.path.join(DATA_DIR, "excels")
PROCESSED_DIR   = os.path.join(DATA_DIR, "processed")
LOGS_DIR        = os.path.join(BASE_DIR, "logs")
DB_PATH         = os.path.join(DATA_DIR, "bot.db")

for _d in (EXCELS_DIR, PROCESSED_DIR, LOGS_DIR):
    os.makedirs(_d, exist_ok=True)

# ── Concurrencia ──────────────────────────────────────────────────────────────
MAX_CONCURRENT_JOBS: int = int(os.getenv("MAX_CONCURRENT_JOBS", "3"))

# ── Bogotá aliases ────────────────────────────────────────────────────────────
BOGOTA_ALIASES: set[str] = {
    "bogota", "bogotá", "bogota d.c.", "bogotá d.c.", "bog",
    "santafe de bogota", "santafé de bogotá",
}

# ── Aliases de columnas (detección flexible) ──────────────────────────────────
COLUMN_ALIASES: dict[str, list[str]] = {
    "Guia#": [
        "guia#", "guía#", "guia", "guía", "tracking", "no guia",
        "no. guia", "numero guia", "número guía", "nro guia",
        "nro. guia", "código guia", "codigo guia", "guia numero",
    ],
    "Ciudad": [
        "ciudad", "destino", "municipio", "ciudad destino",
        "municipio destino", "ciudad_destino", "city",
    ],
    "Nombre Destinatario": [
        "nombre destinatario", "destinatario", "nombre", "cliente",
        "receptor", "nombre cliente", "nombre receptor",
    ],
    "Dirección": [
        "dirección", "direccion", "dirección destinatario",
        "dir", "direccion envio", "dirección envío", "address",
    ],
    "Tel-1": [
        "tel-1", "tel1", "telefono", "teléfono", "tel",
        "celular", "phone", "contacto", "tel destinatario",
    ],
    "Detalle": [
        "detalle", "descripcion", "descripción", "contenido",
        "producto", "articulo", "artículo", "mercancia", "mercancía",
    ],
    "Piezas": [
        "piezas", "cantidad", "qty", "unidades", "bultos", "pcs",
    ],
    "Peso-2": [
        "peso-2", "peso2", "peso", "weight", "kg", "kilos",
        "peso kg", "peso real",
    ],
}

REQUIRED_COLUMNS = ["Guia#", "Ciudad"]

# ── Conversación ──────────────────────────────────────────────────────────────
# Cuántos turnos (pares user/assistant) se recuerdan por usuario
HISTORY_TURNS: int = int(os.getenv("HISTORY_TURNS", "10"))

# Variable mutable: el modelo activo se puede cambiar en runtime
ACTIVE_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen3:4b")
