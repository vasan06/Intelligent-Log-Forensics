from datetime import datetime, timezone
import os
from pathlib import Path


class Settings:
    ROOT_DIR: Path = Path(__file__).resolve().parent.parent
    INSTANCE_DIR: Path = ROOT_DIR / "instance"

    APP_NAME: str = "Intelligent Log Forensics"
    APP_VERSION: str = "1.0.0"

    SECRET_KEY: str = os.environ.get("ILF_SECRET_KEY", "7d3a0b8f4c1e9e2a6d5b8c3f0a1d4e7b9c2a5e8f1b4d7a0c3e6f9b2d5a8c1e4f")
    TOKEN_KEY: str = os.environ.get("ILF_TOKEN_KEY", "c1e4f7d3a0b8f4c1e9e2a6d5b8c3f0a1d4e7b9c2a5e8f1b4d7a0c3e6f9b2d5a8")

    DATABASE_PATH: str = os.environ.get("ILF_DB_PATH", str(INSTANCE_DIR / "ilf.db"))
    UPLOADS_PATH: str = os.environ.get("ILF_UPLOADS_PATH", str(INSTANCE_DIR / "uploads"))
    REPORTS_PATH: str = os.environ.get("ILF_REPORTS_PATH", str(INSTANCE_DIR / "reports"))

    MAX_UPLOAD_BYTES: int = int(os.environ.get("ILF_MAX_BYTES", 100 * 1024 * 1024))
    ALLOWED_EXTENSIONS: set = {"csv", "json", "jsonl", "txt", "log"}

    SESSION_LIFETIME_SECONDS: int = 8 * 3600
    SECURE_COOKIES: bool = os.environ.get("ILF_SECURE_COOKIES", "false").lower() == "true"

    # SMTP
    SMTP_HOST: str = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.environ.get("SMTP_PORT", "587"))
    SMTP_USER: str = os.environ.get("SMTP_USER", "")
    SMTP_PASS: str = os.environ.get("SMTP_PASS", "")
    SMTP_FROM: str = os.environ.get("SMTP_FROM", "noreply@ilf.security")

    # Default admin
    ADMIN_NAME: str = "System Administrator"
    ADMIN_EMAIL: str = os.environ.get("ILF_ADMIN_EMAIL", "admin@ilf.security")
    ADMIN_PASSWORD: str = os.environ.get("ILF_ADMIN_PASSWORD", "ILFAdmin2026!")

    @staticmethod
    def now_utc() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")

    @staticmethod
    def now_display() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
