from pathlib import Path

import joblib
import numpy as np
from pyod.models.combination import average
from pyod.models.iforest import IForest
from pyod.models.lof import LOF
from pyod.models.ocsvm import OCSVM
from sklearn.preprocessing import StandardScaler

from app.engines.feature_engine import matrix
from app.knowledge_base.taxonomy import entry


MODEL_VERSION = "ensemble-v1"


def _models(contamination=0.25):
    return {
        "isolation_forest": IForest(contamination=contamination, random_state=42),
        "one_class_svm": OCSVM(contamination=contamination),
        "lof": LOF(contamination=contamination, novelty=True),
    }


def train(feature_rows, artifact_path=None, contamination=0.25):
    values = np.asarray(matrix(feature_rows), dtype=float)
    scaler = StandardScaler().fit(values)
    scaled = scaler.transform(values)
    models = _models(contamination)
    for model in models.values():
        model.fit(scaled)
    training_scores = {name: model.decision_function(scaled) for name, model in models.items()}
    score_bounds = {name: (float(scores.min()), float(scores.max())) for name, scores in training_scores.items()}
    normalized = np.column_stack([
        (scores - score_bounds[name][0]) / ((score_bounds[name][1] - score_bounds[name][0]) or 1.0)
        for name, scores in training_scores.items()
    ])
    combined = average(normalized)
    threshold = float(np.quantile(combined, 1 - contamination))
    bundle = {"version": MODEL_VERSION, "scaler": scaler, "models": models,
              "score_bounds": score_bounds, "threshold": threshold, "combination": "pyod.average"}
    if artifact_path:
        path = Path(artifact_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(bundle, path)
    return bundle


def score(bundle, feature_rows):
    values = bundle["scaler"].transform(np.asarray(matrix(feature_rows), dtype=float))
    raw = {name: model.decision_function(values) for name, model in bundle["models"].items()}
    normalized = []
    for name, scores in raw.items():
        low, high = bundle.get("score_bounds", {}).get(name, (float(scores.min()), float(scores.max())))
        normalized.append(np.clip((scores - low) / ((high - low) or 1.0), 0.0, 1.0))
    combined = average(np.column_stack(normalized))
    threshold = float(bundle.get("threshold", np.quantile(combined, 0.75)))
    return {
        "scores": {name: values.tolist() for name, values in raw.items()},
        "combined_scores": combined.tolist(),
        "predictions": (combined >= threshold).astype(int).tolist(),
        "model": bundle["version"],
        "combination": bundle.get("combination", "legacy-average"),
    }


def classify(features, artifact_path=None):
    rows = features.get("rows") if isinstance(features, dict) else features
    if not rows:
        return {"risk_probability": 0.0, "model": MODEL_VERSION, "predictions": []}
    path = Path(artifact_path) if artifact_path else Path("instance/models/anomaly_ensemble.joblib")
    if not path.exists():
        return {"risk_probability": 0.0, "model": MODEL_VERSION, "predictions": []}
    result = score(joblib.load(path), rows)
    return {"risk_probability": max(result["combined_scores"]), **result}


def detect_risks(records, features, artifact_path=None):
    result = classify(features, artifact_path)
    taxonomy = entry("security-warning")
    rows = []
    for index, flagged in enumerate(result.get("predictions", [])):
        if not flagged:
            continue
        probability = float(result["combined_scores"][index])
        rows.append({"record_index": index, "risk_category": taxonomy["name"],
                     "attack_type": "security-warning", "risk_score": round(40 + probability * 55, 1),
                     "severity": "High" if probability >= 0.65 else "Medium", "source": "ml",
                     "reason": f"The {result['model']} ensemble marked this runtime-shaped feature vector anomalous (normalized score {probability:.3f}).",
                     "evidence": records[index]["raw_log"][:1000],
                     "recommendation": f"{taxonomy['fix']} Precaution: {taxonomy['precaution']}"})
    return rows
