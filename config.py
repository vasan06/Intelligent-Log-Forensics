import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def database_url():
    url = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/intelligent_log_forensics",
    )
    # Some hosting providers still expose the deprecated postgres:// scheme.
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def runtime_path(environment_name, default_relative_path):
    configured = Path(os.getenv(environment_name, default_relative_path))
    if not configured.is_absolute():
        configured = BASE_DIR / configured
    return str(configured.resolve())


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "development-secret-change-me")
    SQLALCHEMY_DATABASE_URI = database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = runtime_path("UPLOAD_FOLDER", "instance/uploads")
    REPORT_FOLDER = runtime_path("REPORT_FOLDER", "instance/reports")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 10 * 1024 * 1024))
    ALLOWED_EXTENSIONS = {"csv", "json", "txt", "log"}
