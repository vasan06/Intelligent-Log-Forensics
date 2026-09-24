from contextlib import contextmanager
from pathlib import Path
import sqlite3
from typing import Generator
from flask import current_app, has_app_context
from werkzeug.security import generate_password_hash

from aegis_core.config import SentinelSettings


@contextmanager
def acquire_connection(target_uri: str | None = None) -> Generator[sqlite3.Connection, None, None]:
    if target_uri:
        db_loc = target_uri
    elif has_app_context() and current_app.config.get("DATABASE_LOCATION"):
        db_loc = current_app.config["DATABASE_LOCATION"]
    else:
        db_loc = SentinelSettings.DATABASE_LOCATION

    conn = sqlite3.connect(db_loc)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def bootstrap_persistence(target_uri: str | None = None) -> None:
    ddl_path = Path(__file__).resolve().parent / "schema.sql"
    ddl_statements = ddl_path.read_text(encoding="utf-8")
    
    with acquire_connection(target_uri) as conn:
        conn.executescript(ddl_statements)
        
        cursor = conn.execute(
            "SELECT operator_id FROM operators WHERE work_email = ?",
            (SentinelSettings.DEFAULT_COMMANDER_EMAIL,)
        )
        if not cursor.fetchone():
            conn.execute(
                """
                INSERT INTO operators (display_name, work_email, credential_hash, clearance_tier, registered_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    SentinelSettings.DEFAULT_COMMANDER_NAME,
                    SentinelSettings.DEFAULT_COMMANDER_EMAIL,
                    generate_password_hash(SentinelSettings.DEFAULT_COMMANDER_PASSWORD),
                    "Commander",
                    SentinelSettings.get_current_utc_timestamp(),
                )
            )
