from app.repositories.database import fetch_all, fetch_one

WEIGHTS = {
    "data_quality": 0.30,
    "average_risk": 0.20,
    "rule_ml_agreement": 0.20,
    "analysis_coverage": 0.10,
    "evidence_volume": 0.10,
    "mitre_coverage": 0.10,
}

FORMULA = "0.30*data_quality + 0.20*average_risk + 0.20*rule_ml_agreement + 0.10*analysis_coverage + 0.10*evidence_volume + 0.10*mitre_coverage"


def calculate_trust_score(data_quality_score, average_risk_score, agreement_rate,
                          coverage_rate=100.0, volume_score=100.0, mitre_coverage_rate=0.0):
    """Return forensic actionability in [0,100].

    A six-factor weighted blend of data quality, detection risk signal,
    rule/ML agreement, analysis coverage, evidence volume, and MITRE
    mapping coverage. Each factor is clamped to [0,100]; the weights sum
    to 1.0. High scores mean the evidence and its detections are reliable
    enough to act on.
    """
    values = [max(0.0, min(100.0, float(value))) for value in
              (data_quality_score, average_risk_score, agreement_rate,
               coverage_rate, volume_score, mitre_coverage_rate)]
    return round(
        WEIGHTS["data_quality"] * values[0]
        + WEIGHTS["average_risk"] * values[1]
        + WEIGHTS["rule_ml_agreement"] * values[2]
        + WEIGHTS["analysis_coverage"] * values[3]
        + WEIGHTS["evidence_volume"] * values[4]
        + WEIGHTS["mitre_coverage"] * values[5],
        1,
    )


def for_file(file_id):
    quality = fetch_one("SELECT quality_score FROM data_quality_results WHERE file_id=%s", (file_id,))
    average = fetch_one("SELECT COALESCE(AVG(risk_score),0) AS value FROM risk_events WHERE file_id=%s", (file_id,))
    counts = fetch_one("""SELECT COALESCE(SUM(valid_records),0) AS valid, COALESCE(SUM(total_records),0) AS total
                          FROM uploaded_files WHERE id=%s""", (file_id,))
    log_count = fetch_one("SELECT COUNT(*) AS value FROM normalized_logs WHERE file_id=%s", (file_id,))
    mapped = fetch_one("""SELECT COUNT(*) AS value FROM mitre_mappings m
                          JOIN risk_events r ON r.id = m.risk_event_id WHERE r.file_id=%s""", (file_id,))
    risk_count = fetch_one("SELECT COUNT(*) AS value FROM risk_events WHERE file_id=%s", (file_id,))
    flags = fetch_all("""SELECT l.id,COALESCE(BOOL_OR(r.source='rule'),FALSE) AS rule_flag,
                      COALESCE(BOOL_OR(r.source='ml'),FALSE) AS ml_flag
                      FROM normalized_logs l LEFT JOIN risk_events r ON r.log_id=l.id
                      WHERE l.file_id=%s GROUP BY l.id""", (file_id,))
    agreement = 0.0 if not flags else 100.0 * sum(row["rule_flag"] == row["ml_flag"] for row in flags) / len(flags)
    data_quality = float(quality["quality_score"]) if quality else 0.0
    average_risk = float(average["value"])
    total = float(counts["total"])
    coverage = 100.0 * float(counts["valid"]) / total if total > 0 else 0.0
    log_count_value = float(log_count["value"])
    volume = min(100.0, log_count_value / 200.0 * 100.0)
    risk_count_value = float(risk_count["value"])
    mitre = 100.0 * float(mapped["value"]) / risk_count_value if risk_count_value > 0 else 0.0
    return {
        "score": calculate_trust_score(data_quality, average_risk, agreement, coverage, volume, mitre),
        "data_quality_score": round(data_quality, 1),
        "average_risk_score": round(average_risk, 1),
        "agreement_rate": round(agreement, 1),
        "coverage_rate": round(coverage, 1),
        "volume_score": round(volume, 1),
        "mitre_coverage_rate": round(mitre, 1),
        "formula": FORMULA,
        "weights": WEIGHTS,
    }
