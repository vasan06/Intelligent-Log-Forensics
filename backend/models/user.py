"""
User database table definition.

No ORM classes.
Uses SQLAlchemy Core Table definitions only.
"""

from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Table,
    Column,
    func,
)


from backend.database import Base

metadata = Base.metadata


users = Table(
    "users",
    metadata,

    Column(
        "id",
        String(36),
        primary_key=True,
    ),

    Column(
        "name",
        String(120),
        nullable=False,
    ),

    Column(
        "email",
        String(320),
        unique=True,
        nullable=False,
        index=True,
    ),

    Column(
        "password_hash",
        String(255),
        nullable=False,
    ),

    Column(
        "role",
        String(30),
        nullable=False,
        default="Analyst",
    ),

    Column(
        "verified",
        Boolean,
        nullable=False,
        default=False,
    ),

    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    ),

    Column(
        "updated_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    ),
)


def user_table():
    """
    Return the users table definition.
    """
    return users