from app.repositories.database import fetch_all, fetch_one


def calculate_trust_score(data_quality_score, average_risk_score, agreement_rate):
    """Return forensic actionability in [0,100].

    Formula: 0.40 * data quality + 0.30 * average detection risk +
    0.30 * rule/ML binary agreement percentage. This is confidence in the
    evidence/detections, not a claim that a high-risk system is healthy.
    """
    values = [max(0.0, min(100.0, float(value))) for value in
              (data_quality_score, average_risk_score, agreement_rate)]
    return round(0.40 * values[0] + 0.30 * values[1] + 0.30 * values[2], 1)


def for_file(file_id):
    quality = fetch_one("SELECT quality_score FROM data_quality_results WHERE file_id=%s", (file_id,))
    average = fetch_one("SELECT COALESCE(AVG(risk_score),0) AS value FROM risk_events WHERE file_id=%s", (file_id,))
    flags = fetch_all("""SELECT l.id,COALESCE(BOOL_OR(r.source='rule'),FALSE) AS rule_flag,
                      COALESCE(BOOL_OR(r.source='ml'),FALSE) AS ml_flag
                      FROM normalized_logs l LEFT JOIN risk_events r ON r.log_id=l.id
                      WHERE l.file_id=%s GROUP BY l.id""", (file_id,))
    agreement = 0.0 if not flags else 100.0 * sum(row["rule_flag"] == row["ml_flag"] for row in flags) / len(flags)
    data_quality = float(quality["quality_score"]) if quality else 0.0
    average_risk = float(average["value"])
    return {"score": calculate_trust_score(data_quality, average_risk, agreement),
            "data_quality_score": round(data_quality, 1), "average_risk_score": round(average_risk, 1),
            "agreement_rate": round(agreement, 1),
            "formula": "0.40*data_quality + 0.30*average_risk + 0.30*rule_ml_agreement"}
