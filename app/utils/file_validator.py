from pathlib import Path

from flask import current_app


def validate_upload(file_storage):
    if not file_storage or not file_storage.filename:
        return "Choose a log file to upload."
    extension = Path(file_storage.filename).suffix.lower().lstrip(".")
    if extension not in current_app.config["ALLOWED_EXTENSIONS"]:
        return "Unsupported file type. Use CSV, JSON, TXT, or LOG."
    return None

