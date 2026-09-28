from collections import Counter
import json
import sqlite3
from typing import Any

from aegis_core.analytics.anomaly import MultiModelAnomalyEngine
from aegis_core.analytics.signatures import BehavioralSignatureScanner
from aegis_core.config import Settings

SEVERITY_ORDER = {"Notice": 1, "Elevated": 2, "High": 3, "Critical": 4}


def correlate_and_persist_telemetry(conn: sqlite3.Connection, file_id: int) -> tuple[int, int]:
    rows = [dict(r) for r in conn.execute(
        "SELECT * FROM log_records WHERE file_id = ? ORDER BY record_id ASC", (file_id,)
    ).fetchall()]

    if not rows:
        return 0, 0

    ip_counter = Counter(r.get("source_ip") for r in rows if r.get("source_ip"))
    ml_engine = MultiModelAnomalyEngine(contamination=0.1)
    ml_results = ml_engine.fit_and_score_ensemble(rows)

    threat_count = 0
    incidents_created = set()

    for idx, record in enumerate(rows):
        ml_eval = ml_results[idx]
        ip = record.get("source_ip")
        freq = ip_counter[ip] if ip else 0

        # Map new column names to what the scanner expects
        scanner_record = {
            "log_excerpt": record.get("message"),
            "payload_blob": record.get("raw_line", ""),
            "signal_classification": record.get("event_type", ""),
            "response_code": record.get("status_code"),
            "origin_address": ip,
        }

        rule_finding = BehavioralSignatureScanner.evaluate_record(scanner_record, freq)

        rule_score = rule_finding.rule_score if rule_finding else 0
        rule_urgency = rule_finding.urgency_level if rule_finding else "Notice"
        rule_domain = rule_finding.threat_domain if rule_finding else "Anomaly"
        technique = rule_finding.technique_id if rule_finding else None
        rule_desc = rule_finding.rationale if rule_finding else "ML baseline deviation."
        rule_conf = rule_finding.confidence if rule_finding else 60

        composite = max(rule_score, ml_eval.composite_ml_score)

        if composite >= 85:
            urgency = "Critical"
        elif composite >= 70:
            urgency = "High"
        elif composite >= 50:
            urgency = "Elevated"
        else:
            urgency = "Notice"

        if SEVERITY_ORDER.get(rule_urgency, 1) > SEVERITY_ORDER.get(urgency, 1):
            urgency = rule_urgency

        ml_breakdown = json.dumps(ml_eval.model_breakdown)
        top_dev = ", ".join(
            f"{f['feature']}: {f['deviation_percentage']:+.1f}%"
            for f in ml_eval.prominent_features[:2]
        ) if ml_eval.prominent_features else "nominal"

        finding = f"{rule_desc} [ML Score: {ml_eval.composite_ml_score}/100 | Shifts: {top_dev}]"
        confidence = max(rule_conf, min(95, 50 + composite // 2))

        if composite >= 48 or rule_finding is not None:
            conn.execute(
                """INSERT INTO threats
                   (record_id, file_id, severity, score, ml_score, category,
                    technique_id, finding, confidence, detected_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (record.get("record_id"), file_id, urgency, composite,
                 ml_eval.composite_ml_score, rule_domain, technique,
                 finding, confidence, Settings.now_utc())
            )
            threat_count += 1

    # Create incidents for critical/high threats
    cluster_count = 0
    critical_threats = conn.execute(
        """SELECT category, technique_id, MAX(score) score, COUNT(*) c
           FROM threats WHERE file_id = ? AND severity IN ('Critical','High')
           GROUP BY category, technique_id""",
        (file_id,)
    ).fetchall()

    for ct in critical_threats:
        key = (ct["category"], ct["technique_id"])
        if key not in incidents_created:
            incidents_created.add(key)
            title = f"{ct['category']} — {ct['c']} event(s) detected"
            severity = "Critical" if ct["score"] >= 85 else "High"
            conn.execute(
                """INSERT INTO incidents
                   (file_id, title, severity, confidence, status, category,
                    technique_id, root_cause, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (file_id, title, severity, min(95, 50 + ct["score"] // 2),
                 "new", ct["category"], ct["technique_id"],
                 f"Pattern analysis identified {ct['c']} events matching {ct['category']} behavior.",
                 Settings.now_utc())
            )
            cluster_count += 1

    return threat_count, cluster_count
