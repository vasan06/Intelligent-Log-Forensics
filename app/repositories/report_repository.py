from app.models import Report


def get(report_id):
    return Report.query.get_or_404(report_id)
