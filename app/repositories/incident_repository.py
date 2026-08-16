from app.repositories.upload_repository import get


def for_file(file_id):
    upload = get(file_id)
    return upload.incidents if upload else []
