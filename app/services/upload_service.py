import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import current_app
from werkzeug.utils import secure_filename

from app.repositories import upload_repository
from app.services.log_processing_service import process_upload


def cleanup_expired_uploads(now=None):
    root = Path(current_app.config["UPLOAD_FOLDER"]).resolve()
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(hours=current_app.config.get("UPLOAD_RETENTION_HOURS", 24))
    removed = 0
    for path in root.iterdir():
        if path.name == ".gitkeep" or not path.is_file():
            continue
        modified = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
        if modified < cutoff:
            path.unlink()
            removed += 1
    return removed


def save_and_process(file_storage, user_id):
    cleanup_expired_uploads()
    filename = secure_filename(file_storage.filename)
    extension = Path(filename).suffix.lower().lstrip(".")
    payload = file_storage.read()
    digest = hashlib.sha256(payload).hexdigest()
    upload = upload_repository.create(user_id, filename, "pending", extension, len(payload), digest)
    stored_name = f"{upload.id}_{digest[:12]}.{extension}"
    path = (Path(current_app.config["UPLOAD_FOLDER"]) / stored_name).resolve()
    upload_repository.update_stored_name(upload.id, stored_name)
    path.write_bytes(payload)
    try:
        process_upload(upload, path)
    except Exception:
        raise
    else:
        path.unlink(missing_ok=True)
    return upload_repository.get(upload.id)
