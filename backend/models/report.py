"""
Generated report database table.

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


reports = Table(
    "reports",
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
        "analysis_id",
        String(36),
        ForeignKey("log_analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),

    Column(
        "report_type",
        String(50),
        nullable=False,
    ),

    Column(
        "file_path",
        String(1000),
        nullable=False,
    ),

    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    ),
)