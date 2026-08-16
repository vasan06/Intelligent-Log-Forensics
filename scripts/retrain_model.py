import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from flask import current_app
from sklearn.metrics import f1_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import create_app
from app.engines.feature_engine import extract_feature_rows
from app.engines.ml_engine import score, train
from app.repositories import risk_repository
from app.services.log_generator import LogGenerator, generate_labeled_dataset


def _evaluation(bundle):
    records = generate_labeled_dataset(80, seed=9001)
    features = extract_feature_rows(records)
    truth = np.asarray([int(row["generator_mode"] != "normal") for row in records])
    predicted = np.asarray(score(bundle, features)["predictions"])
    return float(f1_score(truth, predicted, zero_division=0))


def retrain(model_path=None, artifact_dir=None):
    rows = risk_repository.labeled_logs()
    if not rows:
        raise ValueError("At least one analyst label is required")
    records = [dict(row) for row in rows]
    labeled_features = extract_feature_rows(records)
    normal_feedback = [features for features, row in zip(labeled_features, rows) if row["analyst_label"] == "false_positive"]
    baseline = LogGenerator(seed=700).generate("normal", 160)
    training_features = extract_feature_rows(baseline) + normal_feedback
    confirmed_ratio = sum(row["analyst_label"] == "confirmed" for row in rows) / len(rows)
    contamination = min(0.35, max(0.02, confirmed_ratio))
    model_path = Path(model_path or current_app.config["MODEL_PATH"])
    old_f1 = _evaluation(joblib.load(model_path)) if model_path.exists() else None
    version = datetime.now(timezone.utc).strftime("ensemble-%Y%m%dT%H%M%S%fZ")
    directory = Path(artifact_dir or model_path.parent)
    versioned_path = directory / f"{version}.joblib"
    bundle = train(training_features, versioned_path, contamination=contamination)
    new_f1 = _evaluation(bundle)
    joblib.dump(bundle, model_path)
    metrics = {"old_f1": old_f1, "new_f1": new_f1, "contamination": contamination,
               "confirmed": sum(row["analyst_label"] == "confirmed" for row in rows),
               "false_positive": len(normal_feedback)}
    risk_repository.record_retraining(version, len(rows), new_f1, metrics)
    return {"version": version, "label_count": len(rows), "old_f1": old_f1, "new_f1": new_f1,
            "artifact": str(versioned_path), "metrics": metrics}


def main():
    app = create_app()
    with app.app_context():
        result = retrain()
    print(f"version={result['version']} labels={result['label_count']} old_f1={result['old_f1']} new_f1={result['new_f1']}")


if __name__ == "__main__":
    main()
