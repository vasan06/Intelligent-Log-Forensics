from app.models import NormalizedLog


def for_file(file_id):
    return NormalizedLog.query.filter_by(file_id=file_id)

