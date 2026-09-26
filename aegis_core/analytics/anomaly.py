from collections import Counter
from dataclasses import dataclass
import json
from typing import Any
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from sklearn.svm import OneClassSVM

SUSPICIOUS_TOKENS = (
    "sqlmap", "union", "select", "exec", "cmd", "powershell",
    "../", "..\\", "/etc/passwd", "system32", "0x90", "script"
)


@dataclass
class AnomalyResult:
    composite_ml_score: int
    model_breakdown: dict[str, int]
    prominent_features: list[dict[str, Any]]
    detection_label: str


class MultiModelAnomalyEngine:
    def __init__(self, contamination: float = 0.1):
        self.contamination = contamination
        self.scaler = StandardScaler()
        self.iso_forest = IsolationForest(n_estimators=100, contamination=contamination, random_state=42)
        self.lof = LocalOutlierFactor(n_neighbors=5, contamination=contamination, novelty=True)
        self.svm = OneClassSVM(nu=contamination, kernel="rbf", gamma="scale")

    def _extract_features(self, records: list[dict]) -> np.ndarray:
        total = max(1, len(records))
        ip_counts = Counter(r.get("source_ip") or r.get("origin_address") for r in records if r.get("source_ip") or r.get("origin_address"))

        matrix = []
        for r in records:
            ip = r.get("source_ip") or r.get("origin_address")
            ip_freq = ip_counts[ip] / total if ip else 0.0
            blob = (r.get("raw_line") or r.get("payload_blob") or r.get("log_excerpt") or "").lower()
            code = r.get("status_code") or r.get("response_code")

            if code is None:
                status_w = 0.5
            elif code >= 500:
                status_w = 1.0
            elif code in (401, 403):
                status_w = 0.8
            elif code >= 400:
                status_w = 0.6
            else:
                status_w = 0.0

            suspicious_w = sum(1 for t in SUSPICIOUS_TOKENS if t in blob) / len(SUSPICIOUS_TOKENS)
            path_depth = blob.count("/") / 10.0
            param_count = blob.count("=") / 5.0
            payload_len = min(len(blob) / 500.0, 1.0)

            matrix.append([ip_freq, status_w, suspicious_w, path_depth, param_count, payload_len])

        return np.array(matrix, dtype=np.float32)

    def fit_and_score_ensemble(self, records: list[dict]) -> list[AnomalyResult]:
        if len(records) < 3:
            return [AnomalyResult(0, {"iso": 0, "lof": 0, "svm": 0}, [], "nominal")] * len(records)

        X = self._extract_features(records)
        try:
            Xs = self.scaler.fit_transform(X)
            self.iso_forest.fit(Xs)
            self.lof.fit(Xs)
            self.svm.fit(Xs)

            iso_scores = self.iso_forest.decision_function(Xs)
            lof_scores = self.lof.decision_function(Xs)
            svm_scores = self.svm.decision_function(Xs)

            def norm(arr):
                mn, mx = arr.min(), arr.max()
                if mx == mn:
                    return np.zeros_like(arr)
                return (arr - mn) / (mx - mn)

            iso_n = 1 - norm(iso_scores)
            lof_n = 1 - norm(lof_scores)
            svm_n = 1 - norm(svm_scores)
            combined = (iso_n * 0.4 + lof_n * 0.35 + svm_n * 0.25)

        except Exception:
            combined = np.zeros(len(records))
            iso_n = lof_n = svm_n = combined

        FEATURE_NAMES = ["ip_frequency", "status_weight", "suspicious_tokens", "path_depth", "param_count", "payload_length"]
        global_mean = X.mean(axis=0)

        results = []
        for i, record in enumerate(records):
            score = int(combined[i] * 100)
            breakdown = {
                "iso": int(iso_n[i] * 100),
                "lof": int(lof_n[i] * 100),
                "svm": int(svm_n[i] * 100),
            }
            features = []
            for j, name in enumerate(FEATURE_NAMES):
                val = X[i][j]
                dev = ((val - global_mean[j]) / (global_mean[j] + 1e-9)) * 100
                if abs(dev) > 20:
                    features.append({"feature": name, "value": round(float(val), 3), "deviation_percentage": round(float(dev), 1)})
            features.sort(key=lambda x: abs(x["deviation_percentage"]), reverse=True)

            label = "anomalous" if score > 60 else "suspicious" if score > 40 else "nominal"
            results.append(AnomalyResult(score, breakdown, features[:3], label))

        return results
