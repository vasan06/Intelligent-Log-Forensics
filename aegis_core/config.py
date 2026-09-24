from datetime import datetime, timezone
import os
from pathlib import Path


class SentinelSettings:
    ROOT_DIR: Path = Path(__file__).resolve().parent.parent
    INSTANCE_DIR: Path = ROOT_DIR / "instance"
    
    APPLICATION_IDENTITY: str = "AEGIS Cyber-Forensic Telemetry Station"
    SYSTEM_RELEASE: str = "3.2.0-PROD"
    
    SECRET_KEY: str = os.environ.get("AEGIS_SECRET_KEY", "7d3a0b8f4c1e9e2a6d5b8c3f0a1d4e7b9c2a5e8f1b4d7a0c3e6f9b2d5a8c1e4f")
    TOKEN_SIGNING_KEY: str = os.environ.get("AEGIS_SIGNING_KEY", "c1e4f7d3a0b8f4c1e9e2a6d5b8c3f0a1d4e7b9c2a5e8f1b4d7a0c3e6f9b2d5a8")
    
    DATABASE_LOCATION: str = os.environ.get(
        "AEGIS_DATABASE_PATH", 
        str(INSTANCE_DIR / "aegis_vault.db")
    )
    VAULT_STORAGE_PATH: str = os.environ.get(
        "AEGIS_VAULT_PATH", 
        str(INSTANCE_DIR / "vault")
    )
    DOSSIER_STORAGE_PATH: str = os.environ.get(
        "AEGIS_DOSSIER_PATH", 
        str(INSTANCE_DIR / "dossiers")
    )
    
    MAX_BUNDLE_BYTES: int = int(os.environ.get("AEGIS_MAX_BYTES", 100 * 1024 * 1024))
    PERMITTED_FORMATS: set[str] = {"csv", "json", "jsonl", "txt", "log"}
    
    SESSION_LIFESPAN_SECONDS: int = 8 * 3600
    COOKIE_TRANSPORT_SECURITY: bool = os.environ.get("AEGIS_COOKIE_SECURE", "false").lower() == "true"
    
    DEFAULT_COMMANDER_NAME: str = "Chief Forensic Commander"
    DEFAULT_COMMANDER_EMAIL: str = "commander@aegis.defense"
    DEFAULT_COMMANDER_PASSWORD: str = os.environ.get("AEGIS_INIT_PASSWORD", "AegisSec2026!")

    @staticmethod
    def get_current_utc_timestamp() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")
