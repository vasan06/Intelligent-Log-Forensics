from contextlib import contextmanager
from pathlib import Path
import sqlite3
from typing import Generator
from flask import current_app,has_app_context
from werkzeug.security import generate_password_hash
from aegis_core.config import SentinelSettings

@contextmanager
def acquire_connection(target_uri=None)->Generator[sqlite3.Connection,None,None]:
    db_loc=target_uri or (current_app.config.get("DATABASE_LOCATION") if has_app_context() else SentinelSettings.DATABASE_LOCATION)
    conn=sqlite3.connect(db_loc,timeout=30)
    conn.row_factory=sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn;conn.commit()
    except Exception:
        conn.rollback();raise
    finally:conn.close()

def bootstrap_persistence(target_uri=None):
    ddl_path=Path(__file__).resolve().parent/"schema.sql"
    with acquire_connection(target_uri) as conn:
        conn.executescript(ddl_path.read_text(encoding="utf-8"))
        columns={r["name"] for r in conn.execute("PRAGMA table_info(operators)").fetchall()}
        if "account_status" not in columns: conn.execute("ALTER TABLE operators ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'")
        if "last_login_at" not in columns: conn.execute("ALTER TABLE operators ADD COLUMN last_login_at TEXT")
        if SentinelSettings.DEFAULT_COMMANDER_PASSWORD:
            exists=conn.execute("SELECT operator_id FROM operators WHERE work_email=?",(SentinelSettings.DEFAULT_COMMANDER_EMAIL,)).fetchone()
            if not exists:
                conn.execute("INSERT INTO operators(display_name,work_email,credential_hash,clearance_tier,account_status,registered_at) VALUES(?,?,?,?,?,?)",
                    (SentinelSettings.DEFAULT_COMMANDER_NAME,SentinelSettings.DEFAULT_COMMANDER_EMAIL,generate_password_hash(SentinelSettings.DEFAULT_COMMANDER_PASSWORD),"Commander","active",SentinelSettings.get_current_utc_timestamp()))
