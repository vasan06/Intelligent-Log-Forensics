"""
database.py — ILF PostgreSQL Database Layer

Provides:
- SQLAlchemy engine
- database session factory
- declarative model base
- database initialization
- connectivity check

Authentication/routes should not create raw PostgreSQL connections.
"""

from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from backend.config import Config


class Base(DeclarativeBase):
    """Base class for all ILF database models."""
    pass


engine = create_engine(
    Config.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    future=True,
)


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


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


def check_database_connection() -> bool:
    """
    Verify that PostgreSQL is reachable.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return True

    except Exception:
        return False


def init_database():
    """
    Create all registered tables.

    This is intended for development/initial setup.
    A proper migration system can replace this later.
    """
    # Import models so SQLAlchemy knows about every table.
    from backend.models.user import User
    from backend.models.session import Session
    
    from backend.models.uploaded_file import UploadedFile
    from backend.models.log_analysis import LogAnalysis
    from backend.models.report import Report

    Base.metadata.create_all(bind=engine)