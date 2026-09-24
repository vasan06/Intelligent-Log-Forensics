from collections import Counter
from dataclasses import dataclass
import json
from typing import Any
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from sklearn.svm import OneClassSVM


@dataclass
class AnomalyEvaluationResult:
    composite_ml_score: int
    model_breakdown: dict[str, int]
    prominent_features: list[dict[str, Any]]
    detection_label: str


SUSPICIOUS_TOKENS = (
    "sqlmap", "union", "select", "exec", "cmd", "powershell", 
    "../", "..\\", "/etc/passwd", "system32", "0x90", "script"
)


class MultiModelAnomalyEngine:
    def __init__(self, contamination: float = 0.1):
        self.contamination = contamination
        self.scaler = StandardScaler()
        self.isolation_forest = IsolationForest(
            n_estimators=100,
            contamination=self.contamination,
            random_state=42,
        )
        self.local_outlier_factor = LocalOutlierFactor(
            n_neighbors=min(20, 5),
            contamination=self.contamination,
            novelty=True,
        )
        self.one_class_svm = OneClassSVM(
            nu=self.contamination,
            kernel="rbf",
            gamma="scale",
        )

    def extract_feature_matrix(self, records: list[dict[str, Any]]) -> np.ndarray:
        total_count = max(1, len(records))
        ip_counts = Counter(r.get("origin_address") for r in records if r.get("origin_address"))

        matrix = []
        for r in records:
            ip = r.get("origin_address")
            ip_freq = ip_counts[ip] / total_count if ip else 0.0

            code = r.get("response_code")
            if code is None:
                status_weight = 0.5
            elif code >= 500:
                status_weight = 1.0
            elif code in (401, 403):
                status_weight = 0.8
            elif code >= 400:
                status_weight = 0.6
            else:
                status_weight = 0.1

            verb = (r.get("action_verb") or "").upper()
            verb_weight = 0.8 if verb in ("DELETE", "PUT", "TRACE", "CONNECT") else (0.4 if verb == "POST" else 0.1)

            blob = f"{r.get('log_excerpt') or ''} {r.get('payload_blob') or ''}".lower()
            keyword_hits = sum(1 for tok in SUSPICIOUS_TOKENS if tok in blob)
            keyword_density = min(1.0, keyword_hits / 3.0)

            has_epoch = 1.0 if r.get("observed_epoch") else 0.0
            has_identity = 1.0 if r.get("actor_identifier") else 0.0

            matrix.append([
                ip_freq,
                status_weight,
                verb_weight,
                keyword_density,
                has_epoch,
                has_identity,
            ])

        return np.array(matrix, dtype=np.float64)

    def fit_and_score_ensemble(self, records: list[dict[str, Any]]) -> list[AnomalyEvaluationResult]:
        if not records:
            return []

        features = self.extract_feature_matrix(records)
        sample_count = len(records)

        feature_means = np.mean(features, axis=0) if sample_count > 0 else np.zeros(6)
        feature_names = [
            "Origin IP Velocity",
            "HTTP Response Severity",
            "Action Verb Risk",
            "Exploit Keyword Density",
            "Timestamp Provenance",
            "Actor Identification",
        ]

        if sample_count < 4:
            results = []
            for i, row in enumerate(features):
                base_score = int(min(100, max(10, (row[1] * 40 + row[3] * 40 + row[0] * 20))))
                results.append(
                    AnomalyEvaluationResult(
                        composite_ml_score=base_score,
                        model_breakdown={
                            "isolation_forest": base_score,
                            "local_outlier_factor": base_score,
                            "one_class_svm": base_score,
                            "ensemble": base_score,
                        },
                        prominent_features=[
                            {
                                "feature": feature_names[j],
                                "name": feature_names[j],
                                "observed": round(float(row[j]), 3),
                                "baseline": round(float(feature_means[j]), 3),
                                "deviation_percentage": round(
                                    float((row[j] - feature_means[j]) * 100),
                                    1,
                                ),
                            }
                            for j in range(len(feature_names))
                        ],
                        detection_label="Elevated Variance" if base_score >= 50 else "Nominal",
                    )
                )
            return results

        try:
            X_scaled = self.scaler.fit_transform(features)
        except Exception:
            X_scaled = features

        try:
            self.isolation_forest.fit(X_scaled)
            if_scores = -self.isolation_forest.score_samples(X_scaled)
            if_norm = self._min_max_scale(if_scores)
        except Exception:
            if_norm = np.zeros(sample_count)

        try:
            n_neighbors = min(20, sample_count - 1)
            lof = LocalOutlierFactor(n_neighbors=max(2, n_neighbors), contamination=self.contamination, novelty=True)
            lof.fit(X_scaled)
            lof_scores = -lof.score_samples(X_scaled)
            lof_norm = self._min_max_scale(lof_scores)
        except Exception:
            lof_norm = if_norm

        try:
            self.one_class_svm.fit(X_scaled)
            ocsvm_scores = -self.one_class_svm.score_samples(X_scaled)
            ocsvm_norm = self._min_max_scale(ocsvm_scores)
        except Exception:
            ocsvm_norm = if_norm

        ensemble_scores = (if_norm * 0.40) + (lof_norm * 0.35) + (ocsvm_norm * 0.25)
        
        results: list[AnomalyEvaluationResult] = []
        for i in range(sample_count):
            comp_score = int(round(float(ensemble_scores[i])))
            if_val = int(round(float(if_norm[i])))
            lof_val = int(round(float(lof_norm[i])))
            ocsvm_val = int(round(float(ocsvm_norm[i])))

            observed_row = features[i]
            deviations = []
            for j in range(len(feature_names)):
                diff_pct = 0.0
                if feature_means[j] > 0.001:
                    diff_pct = round(((observed_row[j] - feature_means[j]) / feature_means[j]) * 100.0, 1)
                deviations.append({
                    "feature": feature_names[j],
                    "observed": round(float(observed_row[j]), 3),
                    "baseline": round(float(feature_means[j]), 3),
                    "deviation_percentage": diff_pct,
                })
            
            deviations.sort(key=lambda d: abs(d["deviation_percentage"]), reverse=True)

            label = "Critical Anomaly" if comp_score >= 75 else (
                "Elevated Risk" if comp_score >= 50 else (
                    "Moderate Variance" if comp_score >= 30 else "Nominal Signal"
                )
            )

            results.append(
                AnomalyEvaluationResult(
                    composite_ml_score=comp_score,
                    model_breakdown={
                        "isolation_forest": if_val,
                        "local_outlier_factor": lof_val,
                        "one_class_svm": ocsvm_val,
                        "ensemble": comp_score,
                    },
                    prominent_features=deviations[:3],
                    detection_label=label,
                )
            )

        return results

    @staticmethod
    def _min_max_scale(arr: np.ndarray) -> np.ndarray:
        arr_min = np.min(arr)
        arr_max = np.max(arr)
        if arr_max - arr_min < 1e-9:
            return np.full_like(arr, 30.0)
        return ((arr - arr_min) / (arr_max - arr_min)) * 100.0
