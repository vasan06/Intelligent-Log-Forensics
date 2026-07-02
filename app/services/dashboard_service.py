from collections import Counter
from datetime import datetime, timedelta, timezone

from flask_login import current_user
from sqlalchemy import func

from app.extensions import db
from app.models import Incident, MitreMapping, NormalizedLog, RiskEvent, UploadedFile


def accessible_file_ids():
    query = db.session.query(UploadedFile.id)
    if current_user.role != "admin":
        query = query.filter(UploadedFile.user_id == current_user.id)
    return query


def summary():
    file_ids = accessible_file_ids()
    total_logs = NormalizedLog.query.filter(NormalizedLog.file_id.in_(file_ids)).count()
    risk_count = RiskEvent.query.filter(RiskEvent.file_id.in_(file_ids)).count()
    incident_count = Incident.query.filter(Incident.file_id.in_(file_ids)).count()
    avg_risk = (
        db.session.query(func.avg(RiskEvent.risk_score))
        .filter(RiskEvent.file_id.in_(file_ids))
        .scalar()
        or 0
    )
    return {
        "total_logs": total_logs,
        "risk_events": risk_count,
        "incidents": incident_count,
        "average_risk": round(float(avg_risk), 1),
    }


def risk_distribution():
    rows = (
        db.session.query(RiskEvent.risk_category, func.count(RiskEvent.id))
        .filter(RiskEvent.file_id.in_(accessible_file_ids()))
        .group_by(RiskEvent.risk_category)
        .all()
    )
    return {category: count for category, count in rows}


def mitre_stats():
    rows = (
        db.session.query(MitreMapping.tactic, func.count(MitreMapping.id))
        .join(RiskEvent)
        .filter(RiskEvent.file_id.in_(accessible_file_ids()))
        .group_by(MitreMapping.tactic)
        .all()
    )
    return {tactic: count for tactic, count in rows}


def top_risky_ips():
    rows = (
        db.session.query(
            NormalizedLog.source_ip,
            func.count(RiskEvent.id),
            func.avg(RiskEvent.risk_score),
        )
        .join(RiskEvent, RiskEvent.log_id == NormalizedLog.id)
        .filter(RiskEvent.file_id.in_(accessible_file_ids()))
        .filter(NormalizedLog.source_ip.isnot(None))
        .group_by(NormalizedLog.source_ip)
        .order_by(func.avg(RiskEvent.risk_score).desc())
        .limit(8)
        .all()
    )
    return [
        {"ip": ip, "events": count, "score": round(float(score), 1)}
        for ip, count, score in rows
    ]


def error_trends():
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now - timedelta(days=6)
    rows = (
        NormalizedLog.query.filter(NormalizedLog.file_id.in_(accessible_file_ids()))
        .filter(NormalizedLog.timestamp >= cutoff)
        .filter(NormalizedLog.status_code >= 400)
        .all()
    )
    counts = Counter(log.timestamp.strftime("%Y-%m-%d") for log in rows if log.timestamp)
    labels = [(now - timedelta(days=offset)).strftime("%Y-%m-%d") for offset in range(6, -1, -1)]
    return {"labels": labels, "values": [counts[label] for label in labels]}
