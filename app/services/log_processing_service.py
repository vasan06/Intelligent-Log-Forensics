from flask import current_app

from app.engines.data_quality_engine import analyze_quality
from app.engines.feature_engine import extract_features
from app.engines.mitre_engine import map_risk
from app.engines.ml_engine import detect_risks as detect_ml_risks
from app.engines.normalizer_engine import normalize_records
from app.engines.parser_engine import parse_file
from app.engines.rule_engine import detect_risks
from app.engines.timeline_engine import build_incident_groups
from app.models import Entity
from app.repositories.database import transaction
from app.repositories.upload_repository import update_status


def process_upload(upload, path):
    records = normalize_records(parse_file(path))
    return process_records(upload, records, "uploaded")


def process_records(upload, records, source_status="uploaded"):
    update_status(upload.id, "processing")
    try:
        quality = analyze_quality(records)
        features = extract_features(records)
        with transaction() as connection:
            with connection.cursor() as cursor:
                logs = []
                for record in records:
                    cursor.execute(
                        """INSERT INTO normalized_logs
                        (file_id,timestamp,source_ip,user_identifier,method,endpoint,status_code,response_time,
                         log_source_type,event_type,level,message,raw_log,is_valid)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                        (upload.id, record["timestamp"], record["source_ip"], record["user_identifier"],
                         record["method"], record["endpoint"], record["status_code"], record["response_time"],
                         record["log_source_type"], record["event_type"], record["level"], record["message"],
                         record["raw_log"], record["is_valid"]),
                    )
                    logs.append(Entity(cursor.fetchone()))
                cursor.execute(
                    """INSERT INTO data_quality_results
                    (file_id,total_logs,valid_logs,invalid_logs,duplicate_logs,missing_timestamp_count,
                     missing_ip_count,quality_score,health_score) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (file_id) DO UPDATE SET
                      total_logs = EXCLUDED.total_logs,
                      valid_logs = EXCLUDED.valid_logs,
                      invalid_logs = EXCLUDED.invalid_logs,
                      duplicate_logs = EXCLUDED.duplicate_logs,
                      missing_timestamp_count = EXCLUDED.missing_timestamp_count,
                      missing_ip_count = EXCLUDED.missing_ip_count,
                      quality_score = EXCLUDED.quality_score,
                      health_score = EXCLUDED.health_score""",
                    (upload.id, quality["total_logs"], quality["valid_logs"], quality["invalid_logs"],
                     quality["duplicate_logs"], quality["missing_timestamp_count"], quality["missing_ip_count"],
                     quality["quality_score"], quality["health_score"]),
                )
                risk_rows = []
                detections = detect_risks(records) + detect_ml_risks(records, features, current_app.config["MODEL_PATH"])
                for detected in detections:
                    data = dict(detected)
                    record_index = data.pop("record_index")
                    cursor.execute(
                        """INSERT INTO risk_events
                        (file_id,log_id,risk_category,attack_type,risk_score,severity,reason,evidence,recommendation,source,source_status)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                        (upload.id, logs[record_index].id, data["risk_category"], data["attack_type"],
                         data["risk_score"], data["severity"], data["reason"], data["evidence"], data["recommendation"],
                         data.get("source", "rule"), source_status),
                    )
                    risk = Entity(cursor.fetchone())
                    mapping_data = map_risk(risk.risk_category)
                    mapping = None
                    if mapping_data:
                        cursor.execute(
                            """INSERT INTO mitre_mappings
                            (risk_event_id,tactic,technique_id,technique_name,confidence_score,mapping_reason)
                            VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""",
                            (risk.id, mapping_data["tactic"], mapping_data["technique_id"],
                             mapping_data["technique_name"], mapping_data["confidence_score"], mapping_data["mapping_reason"]),
                        )
                        mapping = Entity(cursor.fetchone())
                    risk_rows.append((risk, logs[record_index], mapping))
                for (source_ip, category), grouped in build_incident_groups(risk_rows).items():
                    scores = [row[0].risk_score for row in grouped]
                    event_logs = [row[1] for row in grouped]
                    times = [log.timestamp for log in event_logs if log.timestamp]
                    top_risk = max(grouped, key=lambda row: row[0].risk_score)[0]
                    cursor.execute(
                        """INSERT INTO incidents
                        (file_id,incident_title,source_ip,affected_user,start_time,end_time,overall_risk_score,severity,summary)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                        (upload.id, f"{category} from {source_ip}", None if source_ip == "unknown" else source_ip,
                         next((log.user_identifier for log in event_logs if log.user_identifier), None),
                         min(times) if times else None, max(times) if times else None,
                         round(sum(scores) / len(scores), 1), top_risk.severity,
                         f"{len(grouped)} related {category.lower()} event(s) were correlated."),
                    )
                    incident_id = cursor.fetchone()["id"]
                    for risk, log, mapping in grouped:
                        cursor.execute(
                            """INSERT INTO incident_events
                            (incident_id,event_time,event_type,description,risk_category,mitre_tactic,mitre_technique)
                            VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                            (incident_id, log.timestamp, log.event_type or log.level or "Log event", risk.reason,
                             risk.risk_category, mapping.tactic if mapping else None,
                             mapping.technique_name if mapping else None),
                        )
                update_status(upload.id, "completed", total=quality["total_logs"], valid=quality["valid_logs"],
                              invalid=quality["invalid_logs"], error=None, cursor=cursor)
        broker = current_app.extensions.get("event_broker")
        if broker:
            for risk, log, mapping in risk_rows:
                broker.publish({"id": risk.id, "file_id": upload.id, "category": risk.risk_category,
                                "attack_type": risk.attack_type, "severity": risk.severity,
                                "score": risk.risk_score, "reason": risk.reason,
                                "source_ip": log.source_ip, "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                                "mitre_tactic": mapping.tactic if mapping else None})
        return {"quality": quality, "features": features}
    except Exception as exc:
        update_status(upload.id, "failed", error=str(exc))
        raise
