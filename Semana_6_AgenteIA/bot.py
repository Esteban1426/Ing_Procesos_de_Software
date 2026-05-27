"""
Bot de Telegram para análisis de despachos courier.
Versión 3.0 - Producción
"""
import asyncio
import logging
import logging.handlers
import os
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict, deque

from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message, Document, BufferedInputFile, CallbackQuery,
    InlineKeyboardMarkup, InlineKeyboardButton,
)
from aiogram.filters import CommandStart, Command
from aiogram.exceptions import TelegramBadRequest

import config
import database as db
from config import (
    BOT_TOKEN, AUTHORIZED_USERS, MAX_FILE_BYTES, MAX_FILE_MB,
    EXCELS_DIR, PROCESSED_DIR, LOGS_DIR, MAX_CONCURRENT_JOBS, HISTORY_TURNS,
)
from excel_engine import read_excel_file, build_excel, make_summary
from ai_tools import ask_ai, pop_pending_download

# ── Logging ───────────────────────────────────────────────────────────────────
log_file = os.path.join(LOGS_DIR, "bot.log")
handler_file   = logging.handlers.RotatingFileHandler(log_file, maxBytes=5_000_000, backupCount=3)
handler_stdout = logging.StreamHandler()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[handler_file, handler_stdout],
)
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN)
dp  = Dispatcher()

# Semáforo para limitar jobs concurrentes
_semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)

# Historial de conversación por usuario (últimos HISTORY_TURNS*2 mensajes)
_history: dict[int, deque] = defaultdict(lambda: deque(maxlen=HISTORY_TURNS * 2))

# Pendiente de confirmación para subir Excels a Supabase Storage
_pending_storage: dict[int, dict] = {}


# ── Autorización ──────────────────────────────────────────────────────────────

def is_authorized(user_id: int) -> bool:
    if not AUTHORIZED_USERS:
        return True
    return user_id in AUTHORIZED_USERS


async def check_auth(msg: Message) -> bool:
    if not is_authorized(msg.from_user.id):
        await msg.answer("🚫 No tienes acceso a este bot.")
        logger.warning(f"Acceso denegado: user_id={msg.from_user.id}")
        return False
    return True


# ── Helpers ───────────────────────────────────────────────────────────────────

def excel_path_for(user_id: int, filename: str) -> str:
    return os.path.join(EXCELS_DIR, f"{user_id}_{filename}")


def processed_path_for(user_id: int, filename: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return os.path.join(PROCESSED_DIR, f"{user_id}_{ts}_{filename}")


# ── Comandos básicos ──────────────────────────────────────────────────────────

@dp.message(CommandStart())
async def cmd_start(msg: Message):
    if not await check_auth(msg): return
    await msg.answer(
        "👋 *¡Hola! Soy el bot de análisis de despachos courier.* v3.0\n\n"
        "📎 Envíame un archivo *.xlsx* y generaré:\n"
        "  • Pestaña *Original*, *Bogotá*, *Ciudades y Municipios*\n"
        "  • Una pestaña por cada *patrón numérico* detectado\n"
        "  • Ciudades ambiguas marcadas en 🟡 amarillo\n\n"
        "💬 Puedes hablar conmigo en lenguaje natural.\n"
        "Usa /ayuda para ver todos los comandos.",
        parse_mode="Markdown",
    )
    db.log_action(msg.from_user.id, "start")


@dp.message(Command("ayuda"))
async def cmd_help(msg: Message):
    if not await check_auth(msg): return
    await msg.answer(
        "📖 *Comandos disponibles:*\n\n"
        "📊 *Excel:*\n"
        "/resumen – Resumen del último Excel cargado\n"
        "/patrones – Patrones registrados\n"
        "/historial – Últimos 5 archivos procesados\n\n"
        "🗄 *Supabase:*\n"
        "/supabase – Test de conexión\n"
        "/storage – Test bucket Excels\n"
        "/revaluos – Últimos revaluos registrados\n"
        "/retenciones – Últimas retenciones registradas\n\n"
        "🤖 *Agente IA:*\n"
        "/modelo – Ver o cambiar modelo activo\n"
        "/limpiar – Borrar historial de conversación\n\n"
        "⚙️ *Patrones:*\n"
        "/agregar\\_patron – Instrucciones para agregar patrón\n"
        "/nuevo\\_patron – Agregar patrón con regex\n"
        "/eliminar\\_patron – Desactivar un patrón\n\n"
        "🛑 *Control:*\n"
        "/parar – Detener el bot desde Telegram\n\n"
        "🗣 *Ejemplos de lo que puedes pedirme:*\n"
        "• _'Las guías BOG001 y MED002 tienen revaluo'_\n"
        "• _'Retener BOG003 por falta de pago'_\n"
        "• _'Dame los clientes con APX en su nombre'_\n"
        "• _'¿Quién recoge en oficina?'_\n"
        "• _'Top ciudades del despacho'_\n\n"
        f"📎 Envía un *.xlsx* (máx. {MAX_FILE_MB} MB).",
        parse_mode="Markdown",
    )



@dp.message(Command("info"))
async def cmd_info(msg: Message):
    if not await check_auth(msg): return
    texto = (
        "🤖 *Bot de Despachos Courier — Guía Completa*\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

        "📎 *PROCESAMIENTO DE EXCEL*\n"
        "Envíame cualquier archivo `.xlsx` y automáticamente:\n"
        "  • Detecta las columnas aunque vengan con nombres distintos "
        "(más de 40 variantes reconocidas)\n"
        "  • Unifica ciudades escritas diferente → `BOGOTA D.C.`, `Bogota`, `bogotá` "
        "se convierten en `Bogotá`\n"
        "  • Genera un Excel organizado con estas pestañas:\n"
        "    — *Original* — todos los datos sin tocar\n"
        "    — *Bogotá* — solo despachos a Bogotá, sin guías de patrones\n"
        "    — *Ciudades y Municipios* — resto del país, sin guías de patrones\n"
        "    — *Patrón XXXXX* — una pestaña por cada patrón numérico detectado\n"
        "  • Marca en 🟡 *amarillo* las ciudades ambiguas que existen en varios "
        "departamentos (ej: Villanueva, San José, La Unión...)\n"
        "  • Avisa en el resumen si hay ciudades ambiguas para revisión\n\n"

        "🔍 *BÚSQUEDAS EN EL EXCEL (en tiempo real)*\n"
        "Puedes pedirme en lenguaje natural:\n"
        "  • _'Dame los clientes con APX en su nombre'_ → busca sin importar "
        "mayúsculas ni tildes\n"
        "  • _'Busca la guía BOG001'_ → búsqueda exacta o parcial\n"
        "  • _'Filtra los despachos a Medellín'_ → normaliza el nombre antes de buscar\n"
        "  • _'Top 5 ciudades con más despachos'_\n"
        "  • _'Estadísticas de peso del despacho'_\n"
        "  • _'Cuántas guías tienen el patrón 00581'_\n\n"

        "🗄 *BASE DE DATOS SUPABASE — CRUD COMPLETO*\n"
        "  • *Buscar:* _'guías de Pepito Perez'_ o _'busca BOG0011218820'_\n"
        "  • *Insertar:* _'registra en recoge oficina'_ / _'pon en retenciones'_\n"
        "  • *Buscar + insertar:* _'busca APX y agrégalo a revaluos'_ (un solo paso)\n"
        "  • *Consultar:* _'trae las retenciones'_ / _'qué hay en revaluos'_\n"
        "  • *Editar:* _'cambia el motivo de BOG001'_\n"
        "  • *Eliminar:* _'borra BOG003 de retenciones'_\n"
        "  • Tablas: `revaluos`, `retenciones`, `recoge_oficina`, `dir_especiales`\n"
        "  • Detecta duplicados y enriquece con datos del Excel\n\n"

        "🗄 *BASE DE DATOS SUPABASE — CONSULTA*\n"
        "  • _'Tráeme todas las retenciones'_\n"
        "  • _'Qué guías tienen revaluo'_\n"
        "  • _'Busca BOG001 en retenciones'_\n"
        "  • _'Muéstrame los que recogen en oficina'_\n"
        "  • _'Hay direcciones especiales de Cali'_\n\n"

        "🗄 *BASE DE DATOS SUPABASE — EDICIÓN Y ELIMINACIÓN*\n"
        "  • _'Cambia el motivo de BOG001 a documentación incompleta'_\n"
        "  • _'Actualiza el revaluo de MED002 a Pagado'_\n"
        "  • _'Elimina la guía BOG003 de retenciones'_\n"
        "  • _'Borra MED004 de revaluos'_\n\n"

        "🔎 *CRUCE EXCEL ↔ SUPABASE*\n"
        "  • _'¿Quién del despacho recoge en oficina?'_ → cruza el Excel con "
        "`Recoge_Oficina`\n"
        "  • _'Clientes con dirección especial'_ → cruza con `Clientes_DirEspeciales`\n"
        "  • Detecta por nombre del destinatario o número de guía\n\n"

        "⚙️ *PATRONES DE GUÍAS*\n"
        "Patrones predefinidos: `0081`, `00581`, `01181`, `0063`, `0022`, `0084`\n"
        "  • /nuevo_patron → agrega un patrón personalizado con regex\n"
        "  • /eliminar_patron → desactiva un patrón\n"
        "  • Los patrones se guardan en base de datos local y sobreviven reinicios\n\n"

        "💬 *CONVERSACIÓN CON CONTEXTO*\n"
        "  • Recuerdo los últimos 10 mensajes de la conversación\n"
        "  • Puedes hacer preguntas encadenadas:\n"
        "    _'Dame las guías con APX'_ → _'De esas, cuántas van a Bogotá'_ → "
        "_'Registra todas como revaluo'_\n"
        "  • /limpiar → borra el historial para empezar de cero\n\n"

        "🤖 *MODELOS DE IA DISPONIBLES*\n"
        "  • Al iniciar el bot desde consola eliges el modelo interactivamente\n"
        "  • /modelo → ver qué modelo está activo\n"
        "  • /modelo qwen3:8b → cambiar de modelo sin reiniciar\n\n"

        "🛡 *SEGURIDAD Y CONTROL*\n"
        "  • Lista blanca de usuarios autorizados por ID de Telegram\n"
        "  • /parar → detiene el bot limpiamente desde Telegram\n"
        "  • Límite de tamaño de archivo configurable (default 20 MB)\n"
        "  • Máximo de jobs simultáneos para no saturar recursos\n"
        "  • Logs rotativos en `logs/bot.log`\n\n"

        "💾 *PERSISTENCIA*\n"
        "  • Sesiones guardadas en SQLite → sobreviven reinicios del bot\n"
        "  • Historial de archivos procesados → /historial\n"
        "  • Archivos originales y procesados guardados en disco\n"
        "  • Tras procesar un Excel, el bot pregunta si deseas guardarlos en "
        "Supabase Storage (`Excels/originales` y `Excels/procesados`)\n"
        "  • Detecta duplicados y pide confirmación antes de reemplazar\n"
        "  • CRUD por lenguaje natural: listar, descargar, eliminar archivos en Storage\n\n"

        "📋 *COMANDOS RÁPIDOS*\n"
        "  /start · /ayuda · /info · /resumen · /patrones\n"
        "  /historial · /supabase · /revaluos · /retenciones\n"
        "  /modelo · /limpiar · /parar"
    )
    await msg.answer(texto, parse_mode="Markdown")
    db.log_action(msg.from_user.id, "info")

@dp.message(Command("resumen"))
async def cmd_resumen(msg: Message):
    if not await check_auth(msg): return
    session = db.get_session(msg.from_user.id)
    if not session or not session.get("summary"):
        await msg.answer("⚠️ Primero envíame un archivo .xlsx.")
        return
    await msg.answer(session["summary"], parse_mode="Markdown")


@dp.message(Command("patrones"))
async def cmd_patrones(msg: Message):
    if not await check_auth(msg): return
    patterns = db.get_patterns()
    lines = ["🔍 *Patrones registrados:*\n"]
    for p in patterns:
        lines.append(f"  • `{p['label']}` — regex: `{p['pattern']}`")
    lines.append("\n_Usa /nuevo\\_patron para agregar más._")
    await msg.answer("\n".join(lines), parse_mode="Markdown")


@dp.message(Command("historial"))
async def cmd_historial(msg: Message):
    if not await check_auth(msg): return
    history = db.get_history(msg.from_user.id)
    if not history:
        await msg.answer("📭 No tienes archivos procesados aún.")
        return
    lines = ["📁 *Últimos archivos procesados:*\n"]
    for h in history:
        ts = h["processed_at"][:16].replace("T", " ")
        lines.append(
            f"📄 *{h['original_name']}*\n"
            f"   {ts} | {h['total_rows']} guías | "
            f"Bogotá: {h['bogota_rows']} | Ciudades: {h['cities_rows']}\n"
        )
    await msg.answer("\n".join(lines), parse_mode="Markdown")


# ── Supabase ──────────────────────────────────────────────────────────────────

@dp.message(Command("supabase"))
async def cmd_supabase(msg: Message):
    if not await check_auth(msg): return
    from supabase_client import test_conexion
    status = await test_conexion()
    await msg.answer(status, parse_mode="Markdown")


@dp.message(Command("storage"))
async def cmd_storage(msg: Message):
    if not await check_auth(msg): return
    from supabase_storage import test_storage
    status = await test_storage()
    await msg.answer(status, parse_mode="Markdown")


@dp.message(Command("revaluos"))
async def cmd_revaluos(msg: Message):
    if not await check_auth(msg): return
    from supabase_client import obtener_revaluos
    try:
        rows = await obtener_revaluos()
        if not rows:
            await msg.answer("📭 No hay revaluos registrados.")
            return
        lines = [f"📋 *Últimos {len(rows)} revaluos:*\n"]
        for r in rows[:20]:
            ts = r.get("created_at", "")[:10]
            lines.append(f"  • `{r['guia_numero']}` — {r['nombre_destinatario']} | _{r['revaluo']}_ ({ts})")
        await msg.answer("\n".join(lines), parse_mode="Markdown")
    except Exception as e:
        await msg.answer(f"❌ Error consultando Supabase: {e}")


@dp.message(Command("retenciones"))
async def cmd_retenciones(msg: Message):
    if not await check_auth(msg): return
    from supabase_client import obtener_retenciones
    try:
        rows = await obtener_retenciones()
        if not rows:
            await msg.answer("📭 No hay retenciones registradas.")
            return
        lines = [f"📋 *Últimas {len(rows)} retenciones:*\n"]
        for r in rows[:20]:
            ts = r.get("created_at", "")[:10]
            lines.append(f"  • `{r['guia_numero']}` — {r['nombre_destinatario']} | _{r['motivo']}_ ({ts})")
        await msg.answer("\n".join(lines), parse_mode="Markdown")
    except Exception as e:
        await msg.answer(f"❌ Error consultando Supabase: {e}")


# ── Patrones ──────────────────────────────────────────────────────────────────

@dp.message(Command("agregar_patron"))
async def cmd_agregar_patron(msg: Message):
    if not await check_auth(msg): return
    await msg.answer(
        "➕ *Agregar nuevo patrón de guía*\n\n"
        "Formato:\n`/nuevo_patron LABEL REGEX descripción`\n\n"
        "Ejemplo:\n`/nuevo_patron 00991 (?<=[A-Z]{3})00991 Patrón courier 00991`",
        parse_mode="Markdown",
    )


@dp.message(Command("nuevo_patron"))
async def cmd_nuevo_patron(msg: Message):
    if not await check_auth(msg): return
    parts = msg.text.split(maxsplit=3)
    if len(parts) < 3:
        await msg.answer("⚠️ Formato: `/nuevo_patron LABEL REGEX descripción`", parse_mode="Markdown")
        return
    label   = parts[1].strip()
    pattern = parts[2].strip()
    desc    = parts[3].strip() if len(parts) > 3 else f"Patrón {label}"
    import re
    try:
        re.compile(pattern)
    except re.error as e:
        await msg.answer(f"❌ Regex inválido: `{e}`", parse_mode="Markdown")
        return
    ok = db.add_pattern(label, pattern, desc, msg.from_user.id)
    if ok:
        await msg.answer(f"✅ Patrón `{label}` agregado.", parse_mode="Markdown")
        db.log_action(msg.from_user.id, "add_pattern", f"{label}={pattern}")
    else:
        await msg.answer(f"⚠️ Ya existe un patrón `{label}`.", parse_mode="Markdown")


@dp.message(Command("eliminar_patron"))
async def cmd_eliminar_patron(msg: Message):
    if not await check_auth(msg): return
    parts = msg.text.split()
    if len(parts) < 2:
        patterns = db.get_patterns()
        labels   = [p["label"] for p in patterns]
        await msg.answer(
            f"Patrones activos: {', '.join(f'`{l}`' for l in labels)}\n\n"
            "Usa: `/eliminar_patron LABEL`",
            parse_mode="Markdown",
        )
        return
    label = parts[1].strip()
    ok = db.delete_pattern(label)
    if ok:
        await msg.answer(f"✅ Patrón `{label}` desactivado.", parse_mode="Markdown")
    else:
        await msg.answer(f"⚠️ No se encontró el patrón `{label}`.", parse_mode="Markdown")


# ── Control del bot ───────────────────────────────────────────────────────────

@dp.message(Command("parar"))
async def cmd_parar(msg: Message):
    if not await check_auth(msg): return
    await msg.answer(
        "🛑 *Deteniendo el bot...*\nEl proceso se cerrará en 2 segundos.",
        parse_mode="Markdown",
    )
    logger.info(f"Bot detenido por usuario {msg.from_user.id}")
    db.log_action(msg.from_user.id, "bot_stopped", "comando /parar")
    await asyncio.sleep(2)
    await dp.stop_polling()


@dp.message(Command("modelo"))
async def cmd_modelo(msg: Message):
    if not await check_auth(msg): return
    parts = msg.text.strip().split()
    if len(parts) == 1:
        await msg.answer(
            f"🤖 *Modelo activo:* `{config.ACTIVE_MODEL}`\n\n"
            "Para cambiar: `/modelo qwen3:4b` o `/modelo qwen3:8b`",
            parse_mode="Markdown",
        )
        return
    nuevo = parts[1].strip()
    try:
        import ollama as _ollama
        modelos_raw = await asyncio.to_thread(_ollama.list)
        nombres     = [m.model for m in modelos_raw.models]
        coincide    = any(nuevo == n or nuevo == n.split(":")[0] for n in nombres)
        if not coincide:
            lista = "\n".join(f"  • `{n}`" for n in nombres)
            await msg.answer(
                f"⚠️ Modelo `{nuevo}` no encontrado.\n\n*Disponibles:*\n{lista}",
                parse_mode="Markdown",
            )
            return
    except Exception as e:
        await msg.answer(f"❌ No pude consultar Ollama: {e}")
        return
    config.ACTIVE_MODEL = nuevo
    await msg.answer(f"✅ Modelo cambiado a `{nuevo}`", parse_mode="Markdown")
    db.log_action(msg.from_user.id, "model_changed", nuevo)


@dp.message(Command("limpiar"))
async def cmd_limpiar(msg: Message):
    if not await check_auth(msg): return
    _history[msg.from_user.id].clear()
    await msg.answer("🧹 Historial de conversación borrado.")


# ── Archivos Excel ────────────────────────────────────────────────────────────

@dp.message(F.document)
async def handle_document(msg: Message):
    if not await check_auth(msg): return
    doc: Document = msg.document

    if not doc.file_name.lower().endswith(".xlsx"):
        await msg.answer("⚠️ Solo acepto archivos *.xlsx*.", parse_mode="Markdown")
        return
    if doc.file_size > MAX_FILE_BYTES:
        await msg.answer(
            f"⚠️ Archivo demasiado grande ({doc.file_size // 1024 // 1024} MB). "
            f"Límite: {MAX_FILE_MB} MB."
        )
        return

    async with _semaphore:
        status_msg = await msg.answer("⏳ Procesando tu archivo...")
        db.log_action(msg.from_user.id, "upload_file", doc.file_name)

        file    = await bot.get_file(doc.file_id)
        file_io = await bot.download_file(file.file_path)
        raw     = file_io.read()

        orig_path = excel_path_for(msg.from_user.id, doc.file_name)
        with open(orig_path, "wb") as f:
            f.write(raw)

        try:
            df, col_map = read_excel_file(raw)
        except ValueError as e:
            await status_msg.edit_text(f"❌ *Error en el archivo:*\n{e}", parse_mode="Markdown")
            return
        except Exception as e:
            logger.exception("Error leyendo Excel")
            await status_msg.edit_text(f"❌ Error inesperado: {e}")
            return

        patterns = db.get_patterns()
        try:
            result_bytes, stats = build_excel(df, patterns)
        except Exception as e:
            logger.exception("Error construyendo Excel")
            await status_msg.edit_text(f"❌ Error generando el Excel: {e}")
            return

        out_name  = Path(doc.file_name).stem + "_procesado.xlsx"
        proc_path = processed_path_for(msg.from_user.id, out_name)
        with open(proc_path, "wb") as f:
            f.write(result_bytes)

        summary = make_summary(df, patterns, col_map)
        db.save_session(msg.from_user.id, msg.from_user.username or "",
                        orig_path, proc_path, summary, col_map)
        db.save_history(msg.from_user.id, doc.file_name, orig_path, proc_path, stats)
        db.log_action(msg.from_user.id, "file_processed", f"rows={stats['total']}")

        # Limpiar historial de conversación al cargar nuevo archivo
        _history[msg.from_user.id].clear()

        await status_msg.delete()
        await msg.answer_document(
            BufferedInputFile(result_bytes, filename=out_name),
            caption=f"✅ *Archivo procesado correctamente*\n\n{summary}",
            parse_mode="Markdown",
        )

        _pending_storage[msg.from_user.id] = {
            "orig_path": orig_path,
            "proc_path": proc_path,
            "orig_name": doc.file_name,
            "proc_name": out_name,
        }
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Sí, guardar en Supabase",
                    callback_data="storage_yes",
                ),
                InlineKeyboardButton(
                    text="❌ No",
                    callback_data="storage_no",
                ),
            ],
        ])
        await msg.answer(
            "☁️ *¿Guardar archivos en Supabase Storage?*\n\n"
            f"• Original → `{config.STORAGE_BUCKET}/{config.STORAGE_FOLDER_ORIGINALES}/`\n"
            f"• Procesado → `{config.STORAGE_BUCKET}/{config.STORAGE_FOLDER_PROCESADOS}/`\n\n"
            "_Se subirán ambos archivos (.xlsx) del despacho actual._",
            reply_markup=keyboard,
            parse_mode="Markdown",
        )


@dp.callback_query(F.data.in_({
    "storage_yes", "storage_no", "storage_replace_yes", "storage_replace_no",
}))
async def handle_storage_confirm(query: CallbackQuery):
    if not is_authorized(query.from_user.id):
        await query.answer("🚫 Sin acceso", show_alert=True)
        return

    await query.answer()

    if query.data == "storage_no":
        _pending_storage.pop(query.from_user.id, None)
        await query.message.edit_text(
            "☁️ De acuerdo, los archivos no se guardaron en Supabase Storage.",
        )
        db.log_action(query.from_user.id, "storage_declined")
        return

    if query.data == "storage_replace_no":
        _pending_storage.pop(query.from_user.id, None)
        await query.message.edit_text(
            "☁️ Subida cancelada. Los archivos existentes no fueron modificados.",
        )
        return

    pending = _pending_storage.get(query.from_user.id)
    if not pending:
        await query.message.edit_text(
            "⚠️ No hay archivos pendientes de guardar. Sube un Excel nuevo.",
        )
        return

    orig_path = pending["orig_path"]
    proc_path = pending["proc_path"]
    orig_name = pending["orig_name"]
    proc_name = pending["proc_name"]

    if not os.path.isfile(orig_path) or not os.path.isfile(proc_path):
        _pending_storage.pop(query.from_user.id, None)
        await query.message.edit_text(
            "⚠️ Los archivos ya no están en el servidor. Sube el Excel de nuevo.",
        )
        return

    reemplazar = query.data == "storage_replace_yes"

    if query.data == "storage_yes" and not reemplazar:
        from supabase_storage import verificar_duplicados_subida
        try:
            duplicados = await verificar_duplicados_subida(
                Path(orig_path).name, Path(proc_path).name
            )
        except Exception as e:
            await query.message.edit_text(f"❌ Error verificando Storage: {e}")
            return

        if duplicados:
            lista = "\n".join(f"  • `{d}`" for d in duplicados)
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="🔄 Sí, reemplazar",
                        callback_data="storage_replace_yes",
                    ),
                    InlineKeyboardButton(
                        text="❌ Cancelar",
                        callback_data="storage_replace_no",
                    ),
                ],
            ])
            await query.message.edit_text(
                f"⚠️ *Ya existen archivos en Storage:*\n{lista}\n\n"
                "¿Deseas reemplazarlos?",
                reply_markup=keyboard,
                parse_mode="Markdown",
            )
            return

    await query.message.edit_text("⏳ Subiendo archivos a Supabase Storage...")

    try:
        from supabase_storage import subir_par_excels
        path_orig, path_proc = await subir_par_excels(
            orig_path, proc_path, query.from_user.id, reemplazar=reemplazar
        )
        _pending_storage.pop(query.from_user.id, None)
        bucket = config.STORAGE_BUCKET
        accion = "reemplazados" if reemplazar else "guardados"
        await query.message.edit_text(
            f"✅ *Archivos {accion} en Supabase Storage*\n\n"
            f"📂 `{bucket}/{path_orig}`\n"
            f"📂 `{bucket}/{path_proc}`",
            parse_mode="Markdown",
        )
        db.log_action(
            query.from_user.id,
            "storage_uploaded",
            f"{path_orig}|{path_proc}|replace={reemplazar}",
        )
    except Exception as e:
        logger.exception("Error subiendo a Supabase Storage")
        await query.message.edit_text(
            f"❌ No se pudieron subir los archivos:\n`{e}`\n\n"
            "Verifica que el bucket `Excels` exista y que la API key tenga permisos de Storage.",
            parse_mode="Markdown",
        )


# ── Preguntas al agente ───────────────────────────────────────────────────────

@dp.message(F.text & ~F.text.startswith("/"))
async def handle_question(msg: Message):
    if not await check_auth(msg): return

    session = db.get_session(msg.from_user.id) or {}
    df = None
    summary = session.get("summary", "")

    if session.get("excel_path") and os.path.exists(session["excel_path"]):
        try:
            with open(session["excel_path"], "rb") as f:
                raw = f.read()
            df, _col_map = read_excel_file(raw)
        except Exception as e:
            logger.warning(f"No se pudo leer Excel de sesión: {e}")
            df = None

    if df is None:
        import pandas as pd
        df = pd.DataFrame()
        summary = summary or "No hay Excel cargado en la sesión (Storage/BD siguen disponibles)."

    thinking = await msg.answer("🤔 Analizando tu pregunta...")
    db.log_action(msg.from_user.id, "ai_question", msg.text[:200])

    answer = None
    try:
        patterns = db.get_patterns()
        history  = list(_history[msg.from_user.id])

        answer = await ask_ai(
            msg.text, df, summary, patterns, history=history,
            user_id=msg.from_user.id, session=session,
        )

        _history[msg.from_user.id].append({"role": "user",     "content": msg.text})
        _history[msg.from_user.id].append({"role": "assistant", "content": answer})

    except Exception as e:
        logger.exception(f"Error en handle_question: {type(e).__name__}: {e}")
        answer = f"❌ Error inesperado (`{type(e).__name__}`): {e}"

    db.log_action(msg.from_user.id, "ai_answer", (answer or "")[:200])
    await thinking.delete()
    text = answer or "Sin respuesta."
    try:
        await msg.answer(text, parse_mode="Markdown")
    except TelegramBadRequest as e:
        logger.warning(f"Markdown inválido en respuesta IA, enviando texto plano: {e}")
        await msg.answer(text)

    pending = pop_pending_download(msg.from_user.id)
    if pending:
        fname, data = pending
        await msg.answer_document(
            BufferedInputFile(data, filename=fname),
            caption=f"📥 Archivo desde Storage: `{fname}`",
            parse_mode="Markdown",
        )


# ── Menú de selección de modelo ───────────────────────────────────────────────

def select_model_interactive() -> str:
    """Muestra los modelos Ollama disponibles y deja elegir uno."""
    import ollama as _ollama
    print("\n🤖 Consultando modelos disponibles en Ollama...\n")
    try:
        result  = _ollama.list()
        modelos = [m.model for m in result.models]
    except Exception as e:
        print(f"⚠️  No se pudo conectar a Ollama: {e}")
        print(f"   Usando modelo del .env: {config.ACTIVE_MODEL}\n")
        return config.ACTIVE_MODEL

    if not modelos:
        print("⚠️  No hay modelos instalados en Ollama.\n")
        return config.ACTIVE_MODEL

    print("Modelos disponibles:")
    for i, m in enumerate(modelos, 1):
        marker = " ← (default)" if m == config.ACTIVE_MODEL or m.startswith(config.ACTIVE_MODEL.split(":")[0]) else ""
        print(f"  {i}) {m}{marker}")
    print(f"  0) Usar default ({config.ACTIVE_MODEL})")
    print()

    while True:
        try:
            raw = input("Elige el número del modelo [0]: ").strip()
            if raw == "" or raw == "0":
                return config.ACTIVE_MODEL
            idx = int(raw) - 1
            if 0 <= idx < len(modelos):
                return modelos[idx]
            print(f"  ⚠️  Elige un número entre 0 y {len(modelos)}")
        except (ValueError, EOFError):
            return config.ACTIVE_MODEL
        except KeyboardInterrupt:
            print("\nSaliendo...")
            sys.exit(0)


# ── Startup status ────────────────────────────────────────────────────────────

async def gather_startup_status() -> dict:
    """Ejecuta health checks y retorna estado del sistema."""
    try:
        from supabase_client import test_conexion as _test_db
        from supabase_storage import test_storage as _test_storage
        db_status      = await _test_db()
        storage_status = await _test_storage()
    except Exception as e:
        db_status      = f"❌ Error comprobando DB: {e}"
        storage_status = "❌ Error comprobando Storage (ver logs)"

    db_ok      = str(db_status).strip().startswith("✅")
    storage_ok = str(storage_status).strip().startswith("✅")
    system_ok  = db_ok and storage_ok

    return {
        "db_status":      db_status,
        "storage_status": storage_status,
        "model":          config.ACTIVE_MODEL,
        "db_ok":          db_ok,
        "storage_ok":     storage_ok,
        "system_ok":      system_ok,
        "timestamp":      datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def format_startup_banner_console(status: dict) -> str:
    return (
        "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "🚀 Courier Bot — Estado de arranque\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"• Bot status:           READY\n"
        f"• Supabase DB:         {status['db_status']}\n"
        f"• Supabase Storage:    {status['storage_status']}\n"
        f"• AI model activo:     {status['model']}\n"
        f"• Sistema:             {'OK, esperando mensajes...' if status['system_ok'] else 'DEGRADED — revisar servicios'}\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    )


def format_startup_message_telegram(status: dict) -> str:
    """Mensaje de bienvenida / dashboard para Telegram."""
    db_icon      = "✅" if status["db_ok"] else "❌"
    storage_icon = "✅" if status["storage_ok"] else "❌"
    bot_icon     = "✅"
    system_icon  = "✅" if status["system_ok"] else "⚠️"
    system_line  = (
        "Todos los servicios operativos. Puedes enviar un `.xlsx` o escribirme en lenguaje natural."
        if status["system_ok"]
        else "Algunos servicios fallaron. Revisa los logs o usa /supabase y /storage."
    )

    return (
        "🚀 *Courier Bot — Inicialización*\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "*Panel de estado*\n"
        f"  {bot_icon} *Bot:* `READY`\n"
        f"  {db_icon} *Supabase DB:* {'Conectado' if status['db_ok'] else 'Error de conexión'}\n"
        f"  {storage_icon} *Storage* \\(`{config.STORAGE_BUCKET}`\\): "
        f"{'Accesible' if status['storage_ok'] else 'No disponible'}\n"
        f"  🧠 *Modelo IA:* `{status['model']}`\n"
        f"  {system_icon} *Sistema:* {'Listo' if status['system_ok'] else 'Modo degradado'}\n\n"
        f"_{system_line}_\n\n"
        f"🕐 Arranque: `{status['timestamp']}`\n"
        "Comandos: /ayuda · /info · /supabase · /storage"
    )


async def send_startup_welcome(status: dict) -> None:
    """Envía el mensaje de bienvenida a usuarios autorizados."""
    if not AUTHORIZED_USERS:
        logger.info("Startup Telegram: AUTHORIZED_USERS vacío — notificación omitida")
        return

    text = format_startup_message_telegram(status)
    for user_id in AUTHORIZED_USERS:
        try:
            await bot.send_message(user_id, text, parse_mode="Markdown")
            logger.info(f"Startup welcome enviado a user_id={user_id}")
        except TelegramBadRequest as e:
            logger.warning(f"Markdown inválido en startup para {user_id}, enviando plano: {e}")
            try:
                await bot.send_message(user_id, text)
            except Exception as e2:
                logger.warning(f"No se pudo enviar startup a {user_id}: {e2}")
        except Exception as e:
            logger.warning(f"No se pudo enviar startup a {user_id}: {e}")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    db.init_db()
    status = await gather_startup_status()

    banner = format_startup_banner_console(status)
    print(banner)
    logger.info(banner.replace("\n", " "))
    print("   /parar desde Telegram o Ctrl+C para detener\n")

    await send_startup_welcome(status)
    await dp.start_polling(bot)


if __name__ == "__main__":
    modelo_elegido      = select_model_interactive()
    config.ACTIVE_MODEL = modelo_elegido
    print(f"\n▶  Iniciando con: {config.ACTIVE_MODEL}\n")
    asyncio.run(main())
