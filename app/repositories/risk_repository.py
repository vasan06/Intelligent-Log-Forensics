from app.repositories.upload_repository import get
from app.models import Entity
from app.repositories.database import execute, fetch_all, fetch_one


def for_file(file_id):
    upload = get(file_id)
    return upload.risks if upload else []


def get_event(risk_id):
    row = fetch_one("SELECT * FROM risk_events WHERE id=%s", (risk_id,))
    return Entity(row) if row else None


def label(risk_id, analyst_label, reviewer_id):
    row = execute("""UPDATE risk_events SET analyst_label=%s,reviewed_by=%s,reviewed_at=CURRENT_TIMESTAMP
                     WHERE id=%s RETURNING *""", (analyst_label, reviewer_id, risk_id))
    return Entity(row) if row else None


def labeled_logs():
    return fetch_all("""SELECT r.analyst_label,l.* FROM risk_events r
                      JOIN normalized_logs l ON l.id=r.log_id WHERE r.analyst_label IS NOT NULL
                      ORDER BY r.reviewed_at,r.id""")


def record_retraining(version, label_count, f1, metrics):
    from psycopg2.extras import Json
    return execute("INSERT INTO model_retraining_runs (model_version,label_count,f1_score,metrics) VALUES (%s,%s,%s,%s) RETURNING *",
                   (version, label_count, f1, Json(metrics)))


def retraining_history():
    return fetch_all("SELECT label_count,f1_score,model_version,created_at FROM model_retraining_runs ORDER BY created_at,id")
