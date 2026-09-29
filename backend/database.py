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
    Create all registered database tables.

    Intended for development/initial setup.
    """

    # Import models so SQLAlchemy registers their tables.
    from backend.models.user import User
    from backend.models.session import Session
    from backend.models.uploaded_file import UploadedFile
    from backend.models.log_analysis import LogAnalysis
    from backend.models.report import Report

    Base.metadata.create_all(bind=engine)