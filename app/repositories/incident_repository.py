from app.models import Incident


def for_file(file_id):
    return Incident.query.filter_by(file_id=file_id)

