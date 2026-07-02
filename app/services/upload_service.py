from pathlib import Path
from uuid import uuid4

from flask import current_app
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models import UploadedFile
from app.services.log_processing_service import process_upload


def save_and_process(file_storage, user_id):
    filename = secure_filename(file_storage.filename)
    extension = Path(filename).suffix.lower().lstrip(".")
    stored_name = f"{uuid4().hex}.{extension}"
    path = Path(current_app.config["UPLOAD_FOLDER"]) / stored_name
    file_storage.save(path)

    upload = UploadedFile(
        user_id=user_id,
        file_name=filename,
        stored_name=stored_name,
        file_type=extension,
        file_size=path.stat().st_size,
    )
    db.session.add(upload)
    db.session.commit()
    process_upload(upload, path)
    return upload

