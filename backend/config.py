"""
config.py — ILF Backend Configuration
"""

import os
from backend import config
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()\n\nBASE_DIR = Path(__file__).resolve().parent.parent


# =========================================================
# JWT
# =========================================================

JWT_SECRET_KEY = os.getenv("ILF_JWT_SECRET", "")

JWT_ALGORITHM = os.getenv(
    "ILF_JWT_ALGORITHM",
    "HS256",
)

JWT_ACCESS_EXPIRES = int(
    os.getenv(
        "ILF_JWT_ACCESS_EXPIRES",
        "3600",
    )
)

JWT_REFRESH_EXPIRES = int(
    os.getenv(
        "ILF_JWT_REFRESH_EXPIRES",
        "2592000",
    )
)

# =========================================================
# PostgreSQL
# =========================================================

DB_HOST = os.getenv("ILF_DB_HOST", "localhost")
DB_PORT = int(os.getenv("ILF_DB_PORT", "5432"))
DB_NAME = os.getenv("ILF_DB_NAME", "ilf")
DB_USER = os.getenv("ILF_DB_USER", "ilf_user")
DB_PASSWORD = os.getenv("ILF_DB_PASSWORD", "")

DATABASE_URL = os.getenv(
    "ILF_DATABASE_URL",
    (
        f"postgresql+psycopg://"
        f"{DB_USER}:{DB_PASSWORD}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    ),
)


# =========================================================
# SMTP
# =========================================================

SMTP_HOST = os.getenv("ILF_SMTP_HOST", "")
SMTP_PORT = int(os.getenv("ILF_SMTP_PORT", "587"))
SMTP_USER = os.getenv("ILF_SMTP_USER", "")
SMTP_PASS = os.getenv("ILF_SMTP_PASS", "")
SMTP_FROM = os.getenv("ILF_SMTP_FROM", "")

EMAIL_ENABLED = bool(SMTP_USER)


# =========================================================
# CORS
# =========================================================

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "null",
]


# =========================================================
# Application
# =========================================================

LOG_LEVEL = "INFO"
SUPPRESS_OTP_LOGS = True