"""
config.py — ILF Backend Configuration

Centralised settings for JWT, SMTP, PostgreSQL, and application behaviour.

Secrets must come from environment variables.
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Config:

    # ── JWT ─────────────────────────────────────
    JWT_SECRET_KEY = os.getenv(
        "ILF_JWT_SECRET",
        "ilf-dev-secret-change-in-prod-2026",
    )

    JWT_ACCESS_EXPIRES = 3600
    JWT_ALGORITHM = "HS256"

    # ── OTP ─────────────────────────────────────
    OTP_EXPIRY_SECONDS = 1800
    OTP_LENGTH = 6

    # ── PostgreSQL ──────────────────────────────
    DB_HOST = os.getenv("ILF_DB_HOST", "localhost")
    DB_PORT = int(os.getenv("ILF_DB_PORT", "5432"))
    DB_NAME = os.getenv("ILF_DB_NAME", "ilf")
    DB_USER = os.getenv("ILF_DB_USER", "ilf_user")
    DB_PASSWORD = os.getenv("ILF_DB_PASSWORD", "")

    # SQLAlchemy connection URL
    DATABASE_URL = os.getenv(
        "ILF_DATABASE_URL",
        (
            f"postgresql+psycopg://"
            f"{DB_USER}:{DB_PASSWORD}"
            f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        ),
    )

    # ── SMTP ────────────────────────────────────
    SMTP_HOST = os.getenv("ILF_SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("ILF_SMTP_PORT", "587"))
    SMTP_USER = os.getenv("ILF_SMTP_USER", "")
    SMTP_PASS = os.getenv("ILF_SMTP_PASS", "")
    SMTP_FROM = os.getenv("ILF_SMTP_FROM", "")

    EMAIL_ENABLED = bool(SMTP_USER)

    # ── CORS ────────────────────────────────────
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "null",
        "*",
    ]

    # ── Logging ─────────────────────────────────
    LOG_LEVEL = "INFO"
    SUPPRESS_OTP_LOGS = True