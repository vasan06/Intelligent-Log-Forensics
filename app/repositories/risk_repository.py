from app.models import RiskEvent


def for_file(file_id):
    return RiskEvent.query.filter_by(file_id=file_id)

