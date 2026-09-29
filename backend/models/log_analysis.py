"""
Log analysis database table.

Functional database definition.
No ORM model class is used.
"""

import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    JSON,
    MetaData,
    String,
    Table,
    func,
)

from backend.database import Base


metadata = Base.metadata


log_analyses = Table(
    "log_analyses",
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
        "file_id",
        String(36),
        ForeignKey("uploaded_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),

    Column(
        "status",
        String(30),
        nullable=False,
        default="pending",
    ),

    Column(
        "results",
        JSON,
        nullable=True,
    ),

    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    ),
)