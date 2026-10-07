"""ILF backend configuration."""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

JWT_SECRET_KEY = os.getenv("ILF_JWT_SECRET", "")
if not JWT_SECRET_KEY:
    raise RuntimeError("ILF_JWT_SECRET must be set in .env")
JWT_ALGORITHM = os.getenv("ILF_JWT_ALGORITHM", "HS256")
JWT_ACCESS_EXPIRES = int(os.getenv("ILF_JWT_ACCESS_EXPIRES", "3600"))
JWT_REFRESH_EXPIRES = int(os.getenv("ILF_JWT_REFRESH_EXPIRES", "2592000"))

DB_HOST = os.getenv("ILF_DB_HOST", "localhost")
DB_PORT = int(os.getenv("ILF_DB_PORT", "5432"))
DB_NAME = os.getenv("ILF_DB_NAME", "ilf")
DB_USER = os.getenv("ILF_DB_USER", "ilf_user")
DB_PASSWORD = os.getenv("ILF_DB_PASSWORD", "")
# If inside Docker or ILF_DB_HOST is set to postgres, use the postgres service host
if os.getenv("ILF_DB_HOST") == "postgres":
    DATABASE_URL = f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
else:
    DATABASE_URL = os.getenv("ILF_DATABASE_URL") or os.getenv("DATABASE_URL") or (
        f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

SMTP_HOST = os.getenv("ILF_SMTP_HOST", "")
SMTP_PORT = int(os.getenv("ILF_SMTP_PORT", "587"))
SMTP_USER = os.getenv("ILF_SMTP_USER", "")
SMTP_PASS = os.getenv("ILF_SMTP_PASS", "")
SMTP_FROM = os.getenv("ILF_SMTP_FROM", SMTP_USER)
EMAIL_ENABLED = bool(SMTP_HOST and SMTP_USER and SMTP_PASS and SMTP_FROM)
OTP_LENGTH = int(os.getenv("ILF_OTP_LENGTH", "6"))
OTP_EXPIRY_SECONDS = int(os.getenv("ILF_OTP_EXPIRY_SECONDS", "1800"))

COOKIE_SECURE = os.getenv("ILF_COOKIE_SECURE", "false").lower() == "true"
CORS_ORIGINS = [x.strip() for x in os.getenv(
    "ILF_CORS_ORIGINS",
    "http://localhost:5000,http://127.0.0.1:5000,http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500,null"
).split(",") if x.strip()]
LOG_LEVEL = os.getenv("ILF_LOG_LEVEL", "INFO")
SUPPRESS_OTP_LOGS = True
MAX_UPLOAD_BYTES = int(os.getenv("ILF_MAX_UPLOAD_BYTES", str(64 * 1024 * 1024)))

ADMIN_EMAIL = os.getenv("ILF_ADMIN_EMAIL", "vasan83000@gmail.com").strip().lower()
ADMIN_PASSWORD = os.getenv("ILF_ADMIN_PASSWORD", "Vasan@83000")
