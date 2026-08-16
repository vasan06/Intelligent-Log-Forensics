from app.models import Entity
from app.repositories.database import execute, fetch_one


def get(report_id):
    row = fetch_one("SELECT * FROM reports WHERE id=%s", (report_id,))
    return Entity(row) if row else None


def create(file_id, report_name, report_path, generated_by):
    return Entity(execute("INSERT INTO reports (file_id,report_name,report_path,generated_by) VALUES (%s,%s,%s,%s) RETURNING *", (file_id, report_name, report_path, generated_by)))
