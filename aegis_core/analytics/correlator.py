from collections import Counter
import json
import sqlite3
from typing import Any

from aegis_core.analytics.anomaly import MultiModelAnomalyEngine
from aegis_core.analytics.signatures import BehavioralSignatureScanner
from aegis_core.config import SentinelSettings


SEVERITY_HIERARCHY = {"Notice": 1, "Elevated": 2, "High": 3, "Critical": 4}


def correlate_and_persist_telemetry(conn: sqlite3.Connection, vault_id: int) -> tuple[int, int]:
    # 1. Fetch ingested records for this vault
    cursor = conn.execute(
        "SELECT * FROM telemetry_records WHERE vault_ref = ? ORDER BY record_id ASC",
        (vault_id,)
    )
    raw_rows = [dict(row) for row in cursor.fetchall()]
    if not raw_rows:
        return 0, 0

    # 2. Extract IP frequency distribution
    ip_counter = Counter(r["origin_address"] for r in raw_rows if r["origin_address"])

    # 3. Execute ML anomaly ensemble
    ml_engine = MultiModelAnomalyEngine(contamination=0.1)
    ml_results = ml_engine.fit_and_score_ensemble(raw_rows)

    threat_signals: list[dict[str, Any]] = []

    # 4. Fused Detection Execution
    for idx, record in enumerate(raw_rows):
        ml_eval = ml_results[idx]
        ip = record.get("origin_address")
        freq = ip_counter[ip] if ip else 0

        rule_finding = BehavioralSignatureScanner.evaluate_record(record, freq)

        rule_score = rule_finding.rule_score if rule_finding else 0
        rule_urgency = rule_finding.urgency_level if rule_finding else "Notice"
        rule_domain = rule_finding.threat_domain if rule_finding else "Anomalous Variance"
        technique = rule_finding.technique_id if rule_finding else None
        rule_desc = rule_finding.rationale if rule_finding else "Machine learning baseline deviation detected."
        rule_conf = rule_finding.confidence if rule_finding else 60

        # Fusion: Take max magnitude and highest urgency
        composite_magnitude = max(rule_score, ml_eval.composite_ml_score)
        
        # Derive urgency level
        if composite_magnitude >= 85:
            urgency = "Critical"
        elif composite_magnitude >= 70:
            urgency = "High"
        elif composite_magnitude >= 50:
            urgency = "Elevated"
        else:
            urgency = "Notice"

        if SEVERITY_HIERARCHY.get(rule_urgency, 1) > SEVERITY_HIERARCHY.get(urgency, 1):
            urgency = rule_urgency

        # Explainability & Hypothesis assembly
        ml_breakdown_json = json.dumps(ml_eval.model_breakdown)
        top_dev_text = ", ".join(
            f"{f['feature']}: {f['deviation_percentage']:+0.1f}%"
            for f in ml_eval.prominent_features[:2]
        ) if ml_eval.prominent_features else "Nominal variance"

        hypothesis = f"{rule_desc} [Ensemble ML Score: {ml_eval.composite_ml_score}/100 | Shifts: {top_dev_text}]"
        confidence = max(rule_conf, min(95, 50 + composite_magnitude // 2))

        # Filter: Persist threat signal if composite magnitude is actionable (>= 48)
        if composite_magnitude >= 48 or rule_finding is not None:
            conn.execute(
                """
                INSERT INTO threat_signals (
                    record_ref, vault_ref, urgency_level, threat_magnitude,
                    ml_anomaly_score, ml_model_breakdown, threat_domain,
                    matrix_technique_ref, forensic_hypothesis, fidelity_percentage, recorded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["record_id"],
                    vault_id,
                    urgency,
                    composite_magnitude,
                    ml_eval.composite_ml_score,
                    ml_breakdown_json,
                    rule_domain,
                    technique,
                    hypothesis,
                    confidence,
                    SentinelSettings.get_current_utc_timestamp(),
                )
            )
            threat_signals.append({
                "urgency": urgency,
                "domain": rule_domain,
                "technique": technique,
                "confidence": confidence,
            })

    # 5. Incident Clustering into Threat Dockets
    clusters_opened = 0
    grouped_clusters = Counter((t["domain"], t["technique"]) for t in threat_signals)

    for (domain, tech), count in grouped_clusters.items():
        highest_severity = "Critical" if any(t["urgency"] == "Critical" and t["domain"] == domain for t in threat_signals) else (
            "High" if any(t["urgency"] == "High" and t["domain"] == domain for t in threat_signals) else "Elevated"
        )
        max_conf = max((t["confidence"] for t in threat_signals if t["domain"] == domain), default=75)
        
        headline = f"{domain} Incident Cluster"
        causal = (
            f"Correlated {count} anomalous signal(s) exhibiting consistent {domain} characteristics. "
            f"Cross-referenced against MITRE technique {tech or 'ATT&CK Generic'}. Immediate triage recommended."
        )

        conn.execute(
            """
            INSERT INTO incident_clusters (
                vault_ref, cluster_headline, triage_severity, attribution_confidence,
                cluster_disposition, causal_assessment, associated_technique, opened_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                vault_id,
                headline,
                highest_severity,
                max_conf,
                "Active",
                causal,
                tech,
                SentinelSettings.get_current_utc_timestamp(),
            )
        )
        clusters_opened += 1

    return len(threat_signals), clusters_opened
