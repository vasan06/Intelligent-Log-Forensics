from app.engines.data_quality_engine import analyze_quality
from app.engines.feature_engine import extract_features
from app.engines.mitre_engine import map_risk
from app.engines.normalizer_engine import normalize_records
from app.engines.parser_engine import parse_file
from app.engines.rule_engine import detect_risks
from app.engines.timeline_engine import build_incident_groups
from app.extensions import db
from app.models import (
    DataQualityResult,
    Incident,
    IncidentEvent,
    MitreMapping,
    NormalizedLog,
    RiskEvent,
)


def process_upload(upload, path):
    upload.processing_status = "processing"
    db.session.commit()
    try:
        records = normalize_records(parse_file(path))
        quality_data = analyze_quality(records)
        features = extract_features(records)

        log_models = []
        for record in records:
            model = NormalizedLog(file_id=upload.id, **record)
            db.session.add(model)
            log_models.append(model)
        db.session.flush()

        quality = DataQualityResult(file_id=upload.id, **quality_data)
        db.session.add(quality)

        risk_models = []
        for risk_data in detect_risks(records):
            record_index = risk_data.pop("record_index")
            risk = RiskEvent(file_id=upload.id, log_id=log_models[record_index].id, **risk_data)
            db.session.add(risk)
            db.session.flush()
            mapping_data = map_risk(risk.risk_category)
            mapping = None
            if mapping_data:
                mapping = MitreMapping(risk_event_id=risk.id, **mapping_data)
                db.session.add(mapping)
            risk_models.append((risk, log_models[record_index], mapping))

        db.session.flush()
        for (source_ip, category), rows in build_incident_groups(risk_models).items():
            scores = [row[0].risk_score for row in rows]
            logs = [row[1] for row in rows]
            times = [log.timestamp for log in logs if log.timestamp]
            top_risk = max(rows, key=lambda row: row[0].risk_score)[0]
            incident = Incident(
                file_id=upload.id,
                incident_title=f"{category} from {source_ip}",
                source_ip=None if source_ip == "unknown" else source_ip,
                affected_user=next((log.user_identifier for log in logs if log.user_identifier), None),
                start_time=min(times) if times else None,
                end_time=max(times) if times else None,
                overall_risk_score=round(sum(scores) / len(scores), 1),
                severity=top_risk.severity,
                summary=f"{len(rows)} related {category.lower()} event(s) were correlated.",
            )
            db.session.add(incident)
            db.session.flush()
            for risk, log, mapping in rows:
                db.session.add(
                    IncidentEvent(
                        incident_id=incident.id,
                        event_time=log.timestamp,
                        event_type=log.event_type or log.level or "Log event",
                        description=risk.reason,
                        risk_category=risk.risk_category,
                        mitre_tactic=mapping.tactic if mapping else None,
                        mitre_technique=mapping.technique_name if mapping else None,
                    )
                )

        upload.total_records = quality_data["total_logs"]
        upload.valid_records = quality_data["valid_logs"]
        upload.invalid_records = quality_data["invalid_logs"]
        upload.processing_status = "completed"
        db.session.commit()
        return {"quality": quality_data, "features": features}
    except Exception as exc:
        db.session.rollback()
        upload.processing_status = "failed"
        upload.error_message = str(exc)
        db.session.commit()
        raise

