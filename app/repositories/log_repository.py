from app.models import Entity
from app.repositories.database import fetch_all


def for_file(file_id, status=None, search=None, source_type=None, limit=500):
    clauses, params = ["file_id=%s"], [file_id]
    if status is not None:
        if status == 1:
            clauses.append("id IN (SELECT log_id FROM risk_events WHERE file_id=%s)")
            params.append(file_id)
        elif status == 0:
            clauses.append("id NOT IN (SELECT log_id FROM risk_events WHERE file_id=%s)")
            params.append(file_id)
        else:
            clauses.append("status_code=%s")
            params.append(status)
    if search:
        clauses.append("(raw_log ILIKE %s OR endpoint ILIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])
    if source_type:
        clauses.append("log_source_type=%s")
        params.append(source_type)
    params.append(limit)
    return [Entity(row) for row in fetch_all(f"SELECT * FROM normalized_logs WHERE {' AND '.join(clauses)} ORDER BY timestamp DESC LIMIT %s", tuple(params))]


def source_counts(file_id):
    return {row["log_source_type"]: row["count"] for row in fetch_all("SELECT log_source_type,COUNT(*) AS count FROM normalized_logs WHERE file_id=%s GROUP BY log_source_type", (file_id,))}
