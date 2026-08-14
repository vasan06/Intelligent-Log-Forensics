import sys
import time
from pathlib import Path

import numpy as np
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.engines.feature_engine import extract_feature_rows, matrix, rule_baseline_predictions
from app.engines.ml_engine import score, train
from app.services.log_generator import generate_labeled_dataset


def metrics(y_true, y_pred, elapsed_ms):
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="binary", zero_division=0
    )
    tn, fp, _, _ = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {"precision": float(precision), "recall": float(recall), "f1": float(f1),
            "false_positive_rate": float(fp / max(1, fp + tn)), "detection_time_ms": elapsed_ms}


def evaluate(samples_per_mode=300, artifact_path=None):
    records = generate_labeled_dataset(samples_per_mode)
    features = extract_feature_rows(records)
    labels = np.asarray([int(row["generator_mode"] != "normal") for row in records])
    indices = np.arange(len(records))
    train_i, test_i = train_test_split(indices, test_size=0.30, stratify=labels, random_state=42)
    normal_train = [features[i] for i in train_i if labels[i] == 0]
    artifact_path = artifact_path or ROOT / "instance/models/anomaly_ensemble.joblib"
    bundle = train(normal_train, artifact_path, contamination=0.05)
    test_features = [features[i] for i in test_i]
    y_true = labels[test_i]
    scaled = bundle["scaler"].transform(np.asarray(matrix(test_features), dtype=float))

    rows = []
    started = time.perf_counter()
    rule_predictions = np.asarray(rule_baseline_predictions(test_features))
    rows.append({"model": "rules", **metrics(y_true, rule_predictions, (time.perf_counter() - started) * 1000)})

    for name, model in bundle["models"].items():
        started = time.perf_counter()
        predictions = np.asarray(model.predict(scaled))
        rows.append({"model": name, **metrics(y_true, predictions, (time.perf_counter() - started) * 1000)})

    started = time.perf_counter()
    combined = score(bundle, test_features)
    rows.append({"model": "combined", **metrics(y_true, combined["predictions"], (time.perf_counter() - started) * 1000)})
    return {"rows": rows, "y_true": y_true, "combined_scores": np.asarray(combined["combined_scores"]),
            "combined_predictions": np.asarray(combined["predictions"]), "combination": combined["combination"]}


def main():
    result = evaluate()
    print(f"{'model':20} {'precision':>9} {'recall':>9} {'f1':>9} {'fpr':>9} {'time_ms':>10}")
    for row in result["rows"]:
        print(f"{row['model']:20} {row['precision']:9.3f} {row['recall']:9.3f} {row['f1']:9.3f} "
              f"{row['false_positive_rate']:9.3f} {row['detection_time_ms']:10.2f}")
    print(f"combination={result['combination']}")


if __name__ == "__main__":
    main()
