"""
Capa de persistencia SQLite.
Guarda: sesiones de usuario, patrones personalizados, historial de archivos.
"""
import sqlite3
import json
import os
from datetime import datetime
from contextlib import contextmanager
from config import DB_PATH


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            user_id     INTEGER PRIMARY KEY,
            username    TEXT,
            excel_path  TEXT,
            processed_path TEXT,
            summary     TEXT,
            column_map  TEXT,
            updated_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS guide_patterns (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            label       TEXT NOT NULL UNIQUE,
            pattern     TEXT NOT NULL,
            description TEXT,
            active      INTEGER DEFAULT 1,
            created_by  INTEGER,
            created_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS file_history (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER,
            original_name   TEXT,
            excel_path      TEXT,
            processed_path  TEXT,
            total_rows      INTEGER,
            bogota_rows     INTEGER,
            cities_rows     INTEGER,
            patterns_json   TEXT,
            processed_at    TEXT
        );

        CREATE TABLE IF NOT EXISTS action_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER,
            action      TEXT,
            detail      TEXT,
            timestamp   TEXT
        );
        """)
        # Insertar patrones por defecto si la tabla está vacía
        cur = conn.execute("SELECT COUNT(*) FROM guide_patterns")
        if cur.fetchone()[0] == 0:
            defaults = [
                ("0081",  r"(?<=[A-Z]{3})0081",  "Patrón courier 0081"),
                ("00581", r"(?<=[A-Z]{3})00581",  "Patrón courier 00581"),
                ("01181", r"(?<=[A-Z]{3})0118",   "Patrón courier 01181"),
                ("0063",  r"(?<=[A-Z]{3})0063",   "Patrón courier 0063"),
                ("0022",  r"(?<=[A-Z]{3})0022",   "Patrón courier 0022"),
                ("0084",  r"(?<=[A-Z]{3})0084",   "Patrón courier 0084"),
            ]
            conn.executemany(
                "INSERT INTO guide_patterns (label, pattern, description, created_at) VALUES (?,?,?,?)",
                [(lbl, pat, desc, datetime.now().isoformat()) for lbl, pat, desc in defaults]
            )


# ── Sesiones ──────────────────────────────────────────────────────────────────

def save_session(user_id: int, username: str, excel_path: str,
                 processed_path: str, summary: str, column_map: dict):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO user_sessions
                (user_id, username, excel_path, processed_path, summary, column_map, updated_at)
            VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
                username=excluded.username,
                excel_path=excluded.excel_path,
                processed_path=excluded.processed_path,
                summary=excluded.summary,
                column_map=excluded.column_map,
                updated_at=excluded.updated_at
        """, (user_id, username, excel_path, processed_path,
              summary, json.dumps(column_map), datetime.now().isoformat()))


def get_session(user_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM user_sessions WHERE user_id=?", (user_id,)
        ).fetchone()
        return dict(row) if row else None


# ── Patrones ──────────────────────────────────────────────────────────────────

def get_patterns() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT label, pattern, description FROM guide_patterns WHERE active=1 ORDER BY id"
        ).fetchall()
        return [dict(r) for r in rows]


def add_pattern(label: str, pattern: str, description: str, user_id: int) -> bool:
    try:
        with get_conn() as conn:
            conn.execute(
                "INSERT INTO guide_patterns (label, pattern, description, created_by, created_at) VALUES (?,?,?,?,?)",
                (label, pattern, description, user_id, datetime.now().isoformat())
            )
        return True
    except sqlite3.IntegrityError:
        return False  # ya existe


def delete_pattern(label: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE guide_patterns SET active=0 WHERE label=?", (label,)
        )
        return cur.rowcount > 0


# ── Historial ─────────────────────────────────────────────────────────────────

def save_history(user_id: int, original_name: str, excel_path: str,
                 processed_path: str, stats: dict):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO file_history
                (user_id, original_name, excel_path, processed_path,
                 total_rows, bogota_rows, cities_rows, patterns_json, processed_at)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (user_id, original_name, excel_path, processed_path,
              stats.get("total", 0), stats.get("bogota", 0),
              stats.get("cities", 0), json.dumps(stats.get("patterns", {})),
              datetime.now().isoformat()))


def get_history(user_id: int, limit: int = 5) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM file_history WHERE user_id=? ORDER BY processed_at DESC LIMIT ?",
            (user_id, limit)
        ).fetchall()
        return [dict(r) for r in rows]


# ── Logs ──────────────────────────────────────────────────────────────────────

def log_action(user_id: int, action: str, detail: str = ""):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO action_logs (user_id, action, detail, timestamp) VALUES (?,?,?,?)",
            (user_id, action, detail, datetime.now().isoformat())
        )
