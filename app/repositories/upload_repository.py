from app.models import Entity
from app.repositories.database import execute, fetch_all, fetch_one


def create(user_id, file_name, stored_name, file_type, file_size, content_hash=None):
    """Insert a new evidence record.

    ``upload_time`` and ``processing_status`` are set explicitly (not left to
    column defaults) so the insert works even when the database table was
    created without defaults on those NOT NULL columns.
    """
    return Entity(execute(
        """INSERT INTO uploaded_files
           (user_id,file_name,stored_name,file_type,file_size,content_hash,upload_time,processing_status)
           VALUES (%s,%s,%s,%s,%s,%s,CURRENT_TIMESTAMP,'uploaded') RETURNING *""",
        (user_id, file_name, stored_name, file_type, file_size, content_hash),
    ))


def update_stored_name(file_id, stored_name):
    return Entity(execute("UPDATE uploaded_files SET stored_name=%s WHERE id=%s RETURNING *", (stored_name, file_id)))


def update_status(file_id, status, *, total=None, valid=None, invalid=None, error=None, cursor=None):
    return execute(
        """UPDATE uploaded_files SET processing_status=%s,
           total_records=COALESCE(%s,total_records), valid_records=COALESCE(%s,valid_records),
           invalid_records=COALESCE(%s,invalid_records), error_message=%s WHERE id=%s RETURNING *""",
        (status, total, valid, invalid, error, file_id), cursor=cursor,
    )


def get(file_id, hydrate=True):
    row = fetch_one("SELECT * FROM uploaded_files WHERE id=%s", (file_id,))
    if not row:
        return None
    upload = Entity(row, quality=None, risks=[], incidents=[])
    if not hydrate:
        return upload
    quality = fetch_one("SELECT * FROM data_quality_results WHERE file_id=%s", (file_id,))
    upload.quality = Entity(quality) if quality else None
    mappings = {item["risk_event_id"]: Entity(item) for item in fetch_all("SELECT * FROM mitre_mappings WHERE risk_event_id IN (SELECT id FROM risk_events WHERE file_id=%s)", (file_id,))}
    upload.risks = [Entity(item, mitre_mapping=mappings.get(item["id"])) for item in fetch_all("SELECT * FROM risk_events WHERE file_id=%s ORDER BY risk_score DESC", (file_id,))]
    incidents = []
    for item in fetch_all("SELECT * FROM incidents WHERE file_id=%s ORDER BY overall_risk_score DESC", (file_id,)):
        events = [Entity(event) for event in fetch_all("SELECT * FROM incident_events WHERE incident_id=%s ORDER BY event_time", (item["id"],))]
        incidents.append(Entity(item, events=events))
    upload.incidents = incidents
    return upload


def list_accessible(user_id, role, limit=None):
    params = [] if role == "admin" else [user_id]
    where = "" if role == "admin" else "WHERE user_id=%s"
    limit_sql = "" if limit is None else " LIMIT %s"
    if limit is not None:
        params.append(limit)
    return [get(row["id"]) for row in fetch_all(f"SELECT id FROM uploaded_files {where} ORDER BY upload_time DESC{limit_sql}", tuple(params))]
