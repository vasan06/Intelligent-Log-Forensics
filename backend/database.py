"""
database.py — ILF PostgreSQL Database Layer

Provides:
- SQLAlchemy engine
- database session factory
- declarative ORM base
- database initialization
- database connectivity check

No custom application classes or methods.
"""

from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from backend import config


# =========================================================
# SQLAlchemy ORM Base
# =========================================================

Base = declarative_base()


# =========================================================
# Database Engine
# =========================================================

engine = create_engine(
    config.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    future=True,
)


# =========================================================
# Session Factory
# =========================================================

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


# =========================================================
# Database Session
# =========================================================

@contextmanager
def get_db():
    """
    Provide a database session.

    Commits on successful completion.
    Rolls back on failure.
    Always closes the session.
    """

    db = SessionLocal()

    try:
        yield db
        db.commit()

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# =========================================================
# Database Connectivity
# =========================================================

def check_database_connection() -> bool:
    """
    Check whether PostgreSQL is reachable.
    """

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return True

    except Exception:
        return False


# =========================================================
# Database Initialization
# =========================================================

def init_database():
    """
    Create all registered database tables, apply non-destructive column migrations,
    normalize roles strictly to 'User' and 'Admin', and auto-seed/promote the administrator.
    """
    import os
    import uuid
    import bcrypt

    # Import table modules so SQLAlchemy registers every table on Base.metadata.
    from backend.models.user import users
    from backend.models.session import sessions
    from backend.models.uploaded_file import uploaded_files
    from backend.models.log_analysis import log_analyses
    from backend.models.report import reports

    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        # Non-destructive migrations for in-DB storage
        try:
            conn.execute(text("ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS content_data BYTEA;"))
            conn.execute(text("ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS db_location VARCHAR(500);"))
            conn.execute(text("ALTER TABLE uploaded_files ALTER COLUMN storage_path DROP NOT NULL;"))
        except Exception:
            pass

        try:
            conn.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_data BYTEA;"))
            conn.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS db_location VARCHAR(500);"))
            conn.execute(text("ALTER TABLE reports ALTER COLUMN file_path DROP NOT NULL;"))
            conn.execute(text("ALTER TABLE log_analyses ALTER COLUMN file_id DROP NOT NULL;"))
        except Exception:
            pass

        # Normalize roles strictly to 'User' and 'Admin'
        try:
            conn.execute(text("UPDATE users SET role = 'User' WHERE role NOT IN ('Admin');"))
        except Exception:
            pass

        # Auto-seed / Auto-promote configured admin from environment or config
        admin_email = (
            os.environ.get("ADMIN_EMAIL")
            or os.environ.get("ILF_ADMIN_EMAIL")
            or getattr(config, "ADMIN_EMAIL", "vasan83000@gmail.com")
        ).strip().lower()
        admin_pass = (
            os.environ.get("ADMIN_PASSWORD")
            or os.environ.get("ILF_ADMIN_PASSWORD")
            or getattr(config, "ADMIN_PASSWORD", "Vasan@83000")
        )

        if admin_email and admin_pass:
            admin_hash = bcrypt.hashpw(admin_pass.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

            existing_admin = conn.execute(
                text("SELECT id FROM users WHERE email = :email"),
                {"email": admin_email}
            ).fetchone()

            if existing_admin:
                conn.execute(
                    text("UPDATE users SET role = 'Admin', verified = True, password_hash = :p_hash WHERE email = :email"),
                    {"email": admin_email, "p_hash": admin_hash}
                )
            else:
                conn.execute(
                    text("""
                        INSERT INTO users (id, name, email, password_hash, role, verified)
                        VALUES (:id, 'Admin', :email, :p_hash, 'Admin', True)
                    """),
                    {"id": str(uuid.uuid4()), "email": admin_email, "p_hash": admin_hash}
                )
                print(f"Admin user seeded: {admin_email}")