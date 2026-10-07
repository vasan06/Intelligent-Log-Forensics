"""Persistent status for asynchronous uploaded-log processing."""

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text, func

from backend.database import Base


upload_jobs = Table(
    "upload_jobs",
    Base.metadata,
    Column("id", String(36), primary_key=True, default=lambda: str(uuid.uuid4())),
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("file_id", String(36), ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("analysis_id", String(36), ForeignKey("log_analyses.id", ondelete="CASCADE"), nullable=False, index=True),
    Column("status", String(30), nullable=False, default="queued"),
    Column("stage", String(40), nullable=False, default="queued"),
    Column("processed_records", Integer, nullable=False, default=0),
    Column("error", Text, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()),
)
