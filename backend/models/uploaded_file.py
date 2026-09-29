"""
Uploaded log file database table.

Functional database definition.
No ORM model class is used.
"""

import uuid

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    String,
    Table,
    func,
)

from backend.database import Base


metadata = Base.metadata


uploaded_files = Table(
    "uploaded_files",
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
        "filename",
        String(255),
        nullable=False,
    ),

    Column(
        "storage_path",
        String(1000),
        nullable=False,
    ),

    Column(
        "size",
        BigInteger,
        nullable=False,
    ),

    Column(
        "status",
        String(30),
        nullable=False,
        default="uploaded",
    ),

    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    ),
)