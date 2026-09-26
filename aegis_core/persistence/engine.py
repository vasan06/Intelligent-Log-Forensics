from contextlib import contextmanager
from pathlib import Path
import sqlite3
from typing import Generator

from flask import current_app, has_app_context
from werkzeug.security import generate_password_hash

from aegis_core.config import Settings


@contextmanager
def get_db(target: str | None = None) -> Generator[sqlite3.Connection, None, None]:
    if target:
        db_path = target
    elif has_app_context() and current_app.config.get("DATABASE_PATH"):
        db_path = current_app.config["DATABASE_PATH"]
    else:
        db_path = Settings.DATABASE_PATH

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(target: str | None = None) -> None:
    ddl_path = Path(__file__).resolve().parent / "schema.sql"
    ddl = ddl_path.read_text(encoding="utf-8")

    with get_db(target) as conn:
        conn.executescript(ddl)

        # Create default admin
        existing = conn.execute(
            "SELECT user_id FROM users WHERE email = ?",
            (Settings.ADMIN_EMAIL,)
        ).fetchone()

        if not existing:
            conn.execute(
                """
                INSERT INTO users (name, email, password_hash, role, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    Settings.ADMIN_NAME,
                    Settings.ADMIN_EMAIL,
                    generate_password_hash(Settings.ADMIN_PASSWORD),
                    "admin",
                    Settings.now_utc(),
                )
            )

# Keep backward compat alias used by old code
acquire_connection = get_db
bootstrap_persistence = init_db
