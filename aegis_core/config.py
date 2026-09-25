from datetime import datetime, timezone
import os
from pathlib import Path

class SentinelSettings:
    ROOT_DIR=Path(__file__).resolve().parent.parent
    INSTANCE_DIR=ROOT_DIR/"instance"
    APPLICATION_IDENTITY="Intelligent Log Forensics"
    SYSTEM_RELEASE="4.0.0"
    SECRET_KEY=os.environ.get("SECRET_KEY")
    TOKEN_SIGNING_KEY=os.environ.get("JWT_SECRET_KEY") or SECRET_KEY
    DATABASE_LOCATION=os.environ.get("DATABASE_URL",str(INSTANCE_DIR/"forensics.db")).replace("sqlite:///","")
    VAULT_STORAGE_PATH=os.environ.get("UPLOAD_FOLDER",str(INSTANCE_DIR/"uploads"))
    DOSSIER_STORAGE_PATH=os.environ.get("REPORT_FOLDER",str(INSTANCE_DIR/"reports"))
    MAX_BUNDLE_BYTES=int(os.environ.get("MAX_CONTENT_LENGTH",100*1024*1024))
    PERMITTED_FORMATS={"csv","json","jsonl","txt","log"}
    SESSION_LIFESPAN_SECONDS=int(os.environ.get("SESSION_LIFESPAN_SECONDS",8*3600))
    COOKIE_TRANSPORT_SECURITY=os.environ.get("COOKIE_SECURE","true").lower()=="true"
    DEFAULT_COMMANDER_NAME=os.environ.get("ADMIN_NAME","System Administrator")
    DEFAULT_COMMANDER_EMAIL=os.environ.get("ADMIN_EMAIL","admin@example.local")
    DEFAULT_COMMANDER_PASSWORD=os.environ.get("ADMIN_PASSWORD")
    SMTP_HOST=os.environ.get("SMTP_HOST")
    SMTP_PORT=int(os.environ.get("SMTP_PORT","587"))
    SMTP_USERNAME=os.environ.get("SMTP_USERNAME")
    SMTP_PASSWORD=os.environ.get("SMTP_PASSWORD")
    SMTP_FROM=os.environ.get("SMTP_FROM") or SMTP_USERNAME
    APP_ORIGIN=os.environ.get("APP_ORIGIN","http://localhost:5000")
    @staticmethod
    def get_current_utc_timestamp():
        return datetime.now(timezone.utc).isoformat(timespec="seconds")
