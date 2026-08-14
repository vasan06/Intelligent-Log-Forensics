import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def database_url():
    url = os.environ["DATABASE_URL"]
    # Some hosting providers still expose the deprecated postgres:// scheme.
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url.replace("postgresql+psycopg2://", "postgresql://", 1)


def runtime_path(environment_name, default_relative_path):
    configured = Path(os.getenv(environment_name, default_relative_path))
    if not configured.is_absolute():
        configured = BASE_DIR / configured
    return str(configured.resolve())


class Config:
    SECRET_KEY = os.environ["SECRET_KEY"]
    DATABASE_URL = database_url()
    UPLOAD_FOLDER = runtime_path("UPLOAD_FOLDER", "instance/uploads")
    REPORT_FOLDER = runtime_path("REPORT_FOLDER", "instance/reports")
    MODEL_FOLDER = runtime_path("MODEL_FOLDER", "instance/models")
    MODEL_PATH = runtime_path("MODEL_PATH", "instance/models/anomaly_ensemble.joblib")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 100 * 1024 * 1024))
    UPLOAD_RETENTION_HOURS = int(os.getenv("UPLOAD_RETENTION_HOURS", 24))
    GENERATOR_INTERVAL_SECONDS = float(os.getenv("GENERATOR_INTERVAL_SECONDS", 1.0))
    GENERATOR_BATCH_SIZE = int(os.getenv("GENERATOR_BATCH_SIZE", 10))
    ALLOWED_EXTENSIONS = {"csv", "json", "txt", "log"}
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_HTTPONLY = True
    JWT_COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 900))
    JWT_REFRESH_TOKEN_EXPIRES = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES", 604800))
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    APP_ORIGIN = os.getenv("APP_ORIGIN", "http://localhost:5000")
