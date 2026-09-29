"""
Persistent authentication session database table.

Functional database definition.
No ORM model class is used.
"""

import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    Table,
    func,
)

from backend.database import Base


metadata = Base.metadata


sessions = Table(
    "sessions",
    metadata,

    Column(
        "id",
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    ),

    Column(
        "user_id",
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),

    Column(
        "refresh_token_hash",
        String(255),
        nullable=False,
        unique=True,
        index=True,
    ),

    Column(
        "expires_at",
        DateTime(timezone=True),
        nullable=False,
    ),

    Column(
        "revoked_at",
        DateTime(timezone=True),
        nullable=True,
    ),

    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    ),
)