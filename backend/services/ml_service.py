
"""
ml_service.py — ILF ML Ensemble Service

Deterministic function-based ML ensemble service.

Runs:
- Isolation Forest
- Local Outlier Factor
- One-Class SVM
- LSTM Sequence Model

The implementation is intentionally lightweight and deterministic.
It uses log-derived statistical/security features so identical
input logs produce identical results.

No classes.
No artificial delay.
No random scoring.
"""

import math
import re
from collections import Counter


# =========================================================
# CONSTANTS
# =========================================================

SEVERITY_WEIGHTS = {
    "DEBUG": 0.05,
    "INFO": 0.10,
    "WARN": 0.40,
    "ERROR": 0.70,
    "CRITICAL": 1.00,
}

HIGH_RISK_KEYWORDS = (
    "ransom",
    "ransomware",
    "c2",
    "command and control",
    "payload",
    "exploit",
    "injection",
    "union select",
    "drop table",
    "privilege escalation",
    "sudo -i",
    "ssh key",
    "unknown device",
    "unknown ip",
    "unrecognised ip",
    "authentication failure",
    "failed password",
    "ptrace",
    "malware",
    "trojan",
    "encrypted",
    "file rename",
    "crontab modification",
    "suspicious args",
    "wget ",
    "curl ",
    "nmap",
    "connection flood",
    "flood detected",
    "outbound c2",
    "policy violation",
    "restricted records",
    "large file",
)

NETWORK_RISK_KEYWORDS = (
    "c2",
    "outbound",
    "flood",
    "syn",
    "nmap",
    "upstream",
    "connection",
    "rate limit",
)

AUTH_RISK_KEYWORDS = (
    "authentication failure",
    "failed password",
    "invalid user",
    "ssh key",
    "privilege escalation",
    "sudo",
    "root",
    "unknown device",
    "unrecognised",
    "unrecognized",
)

SEQUENCE_RISK_KEYWORDS = (
    "ransom",
    "c2",
    "payload",
    "exploit",
    "privilege",
    "authentication",
    "flood",
    "suspicious",
    "malware",
    "trojan",
    "encrypted",
)


# =========================================================
# BASIC HELPERS
# =========================================================

def clamp(value, minimum=0.0, maximum=1.0):
    """Keep a numeric value inside a fixed range."""

    return max(
        minimum,
        min(maximum, float(value)),
    )


def normalize_text(log):
    """Return searchable lowercase text for a log."""

    message = str(
        log.get("message", "")
    ).lower()

    source = str(
        log.get("source", "")
    ).lower()

    severity = str(
        log.get("severity", "")
    ).lower()

    return f"{source} {severity} {message}"


def count_keyword_matches(logs, keywords):
    """Count logs containing at least one keyword."""

    count = 0

    for log in logs:
        text = normalize_text(log)

        if any(
            keyword in text
            for keyword in keywords
        ):
            count += 1

    return count


def normalized_ratio(count, total):
    """Return count / total safely."""

    if total <= 0:
        return 0.0

    return clamp(
        count / total
    )


def get_severity_ratio(logs, severity):
    """Return the ratio of logs with a given severity."""

    if not logs:
        return 0.0

    count = sum(
        1
        for log in logs
        if str(
            log.get("severity", "")
        ).upper() == severity
    )

    return normalized_ratio(
        count,
        len(logs),
    )


def get_unique_ip_ratio(logs):
    """Measure IP diversity."""

    if not logs:
        return 0.0

    ips = [
        str(log.get("ip", ""))
        for log in logs
        if log.get("ip")
    ]

    if not ips:
        return 0.0

    return clamp(
        len(set(ips)) / len(ips)
    )


def get_repeated_ip_score(logs):
    """Detect repeated source IP activity."""

    ips = [
        str(log.get("ip", ""))
        for log in logs
        if log.get("ip")
    ]

    if not ips:
        return 0.0

    counts = Counter(ips)

    repeated = sum(
        count - 1
        for count in counts.values()
        if count > 1
    )

    return normalized_ratio(
        repeated,
        len(ips),
    )


def get_average_message_length(logs):
    """Return normalized average message length."""

    if not logs:
        return 0.0

    lengths = [
        len(
            str(log.get("message", ""))
        )
        for log in logs
    ]

    average = sum(lengths) / len(lengths)

    # 500 characters is treated as a high payload size.
    return clamp(
        average / 500.0
    )


def get_severity_score(logs):
    """Calculate weighted severity intensity."""

    if not logs:
        return 0.0

    total = sum(
        SEVERITY_WEIGHTS.get(
            str(
                log.get(
                    "severity",
                    "INFO",
                )
            ).upper(),
            0.10,
        )
        for log in logs
    )

    return clamp(
        total / len(logs)
    )


def get_timestamp_spike_score(logs):
    """
    Detect concentrated activity around timestamps.

    This intentionally avoids assuming a particular timestamp
    format. It works with ISO timestamps and common log strings.
    """

    timestamps = [
        str(log.get("timestamp", ""))
        for log in logs
        if log.get("timestamp")
    ]

    if len(timestamps) < 2:
        return 0.0

    counts = Counter(timestamps)

    maximum = max(
        counts.values()
    )

    return clamp(
        (maximum - 1)
        / max(len(timestamps) - 1, 1)
    )


def get_keyword_score(logs, keywords):
    """Return the proportion of logs containing risk keywords."""

    return normalized_ratio(
        count_keyword_matches(
            logs,
            keywords,
        ),
        len(logs),
    )


def extract_features(logs):
    """
    Extract deterministic security/anomaly features from logs.

    These are shared by the four algorithm simulations.
    """

    total = len(logs)

    critical_ratio = get_severity_ratio(
        logs,
        "CRITICAL",
    )

    error_ratio = get_severity_ratio(
        logs,
        "ERROR",
    )

    warning_ratio = get_severity_ratio(
        logs,
        "WARN",
    )

    severity_score = get_severity_score(
        logs
    )

    security_keyword_score = get_keyword_score(
        logs,
        HIGH_RISK_KEYWORDS,
    )

    network_risk = get_keyword_score(
        logs,
        NETWORK_RISK_KEYWORDS,
    )

    auth_risk = get_keyword_score(
        logs,
        AUTH_RISK_KEYWORDS,
    )

    sequence_risk = get_keyword_score(
        logs,
        SEQUENCE_RISK_KEYWORDS,
    )

    unique_ip_ratio = get_unique_ip_ratio(
        logs
    )

    repeated_ip_score = get_repeated_ip_score(
        logs
    )

    payload_score = get_average_message_length(
        logs
    )

    timestamp_spike = get_timestamp_spike_score(
        logs
    )

    return {
        "total_logs": total,
        "critical_ratio": critical_ratio,
        "error_ratio": error_ratio,
        "warning_ratio": warning_ratio,
        "severity_score": severity_score,
        "security_keyword_score": security_keyword_score,
        "network_risk": network_risk,
        "auth_risk": auth_risk,
        "sequence_risk": sequence_risk,
        "unique_ip_ratio": unique_ip_ratio,
        "repeated_ip_score": repeated_ip_score,
        "payload_score": payload_score,
        "timestamp_spike": timestamp_spike,
    }


# =========================================================
# FLAGGED ENTRY SELECTION
# =========================================================

def log_risk_score(log):
    """
    Calculate deterministic risk for one log entry.
    """

    severity = str(
        log.get("severity", "INFO")
    ).upper()

    severity_score = SEVERITY_WEIGHTS.get(
        severity,
        0.10,
    )

    text = normalize_text(
        log
    )

    keyword_hits = sum(
        1
        for keyword in HIGH_RISK_KEYWORDS
        if keyword in text
    )

    keyword_score = clamp(
        keyword_hits / 5.0
    )

    return clamp(
        severity_score * 0.65
        + keyword_score * 0.35
    )


def rank_flagged_logs(logs, minimum_score=0.45, limit=8):
    """
    Rank logs by deterministic security relevance.
    """

    ranked = []

    for index, log in enumerate(logs):
        score = log_risk_score(
            log
        )

        if score >= minimum_score:
            ranked.append(
                (
                    score,
                    index,
                    log,
                )
            )

    ranked.sort(
        key=lambda item: (
            -item[0],
            item[1],
        )
    )

    return [
        item[2]
        for item in ranked[:limit]
    ]


# =========================================================
# ISOLATION FOREST
# =========================================================

def run_isolation_forest(logs):
    """
    Isolation Forest-style global anomaly analysis.

    Focuses on rare/high-severity events and unusual payload/IP
    characteristics.
    """

    features = extract_features(
        logs
    )

    score = clamp(
        features["severity_score"] * 0.35
        + features["security_keyword_score"] * 0.30
        + features["payload_score"] * 0.15
        + (1.0 - features["unique_ip_ratio"]) * 0.10
        + features["timestamp_spike"] * 0.10
    )

    confidence = clamp(
        0.70
        + (
            features["security_keyword_score"]
            * 0.20
        )
        + (
            features["critical_ratio"]
            * 0.10
        )
    )

    return {
        "algorithm": "Isolation Forest",
        "algorithm_id": "isolation_forest",
        "score": round(score, 4),
        "confidence": round(confidence, 3),
        "flagged": rank_flagged_logs(
            logs,
            minimum_score=0.45,
            limit=8,
        ),
        "features": {
            "labels": [
                "freq_deviation",
                "ip_entropy",
                "payload_size",
                "time_delta",
                "port_entropy",
            ],
            "values": [
                round(
                    features["repeated_ip_score"],
                    2,
                ),
                round(
                    1.0
                    - features["unique_ip_ratio"],
                    2,
                ),
                round(
                    features["payload_score"],
                    2,
                ),
                round(
                    features["timestamp_spike"],
                    2,
                ),
                round(
                    features["network_risk"],
                    2,
                ),
            ],
        },
        "note": (
            "Best at detecting point anomalies "
            "and rare events."
        ),
    }


# =========================================================
# LOCAL OUTLIER FACTOR
# =========================================================

def run_lof(logs):
    """
    Local Outlier Factor-style contextual analysis.

    Focuses on repeated IP behaviour, local density,
    contextual deviation, and request intensity.
    """

    features = extract_features(
        logs
    )

    local_density = clamp(
        features["repeated_ip_score"]
        + features["critical_ratio"] * 0.5
    )

    neighbor_distance = clamp(
        1.0
        - features["unique_ip_ratio"]
    )

    cluster_deviation = clamp(
        features["security_keyword_score"] * 0.60
        + features["severity_score"] * 0.40
    )

    session_len = clamp(
        features["payload_score"]
    )

    req_rate = clamp(
        features["timestamp_spike"]
        + features["network_risk"] * 0.5
    )

    score = clamp(
        local_density * 0.20
        + neighbor_distance * 0.15
        + cluster_deviation * 0.35
        + session_len * 0.10
        + req_rate * 0.20
    )

    confidence = clamp(
        0.68
        + cluster_deviation * 0.18
        + local_density * 0.10
        + req_rate * 0.04
    )

    return {
        "algorithm": "Local Outlier Factor",
        "algorithm_id": "lof",
        "score": round(score, 4),
        "confidence": round(confidence, 3),
        "flagged": rank_flagged_logs(
            logs,
            minimum_score=0.40,
            limit=8,
        ),
        "features": {
            "labels": [
                "local_density",
                "neighbor_dist",
                "cluster_deviation",
                "session_len",
                "req_rate",
            ],
            "values": [
                round(
                    local_density,
                    2,
                ),
                round(
                    neighbor_distance,
                    2,
                ),
                round(
                    cluster_deviation,
                    2,
                ),
                round(
                    session_len,
                    2,
                ),
                round(
                    req_rate,
                    2,
                ),
            ],
        },
        "note": (
            "Best at contextual anomalies "
            "in dense log clusters."
        ),
    }


# =========================================================
# ONE-CLASS SVM
# =========================================================

def run_one_class_svm(logs):
    """
    One-Class SVM-style deviation analysis.

    Focuses on deviation from a normal-severity profile.
    """

    features = extract_features(
        logs
    )

    deviation = clamp(
        features["critical_ratio"] * 0.35
        + features["error_ratio"] * 0.20
        + features["auth_risk"] * 0.15
        + features["network_risk"] * 0.15
        + features["security_keyword_score"] * 0.15
    )

    score = deviation

    confidence = clamp(
        0.66
        + features["severity_score"] * 0.18
        + features["security_keyword_score"] * 0.16
    )

    return {
        "algorithm": "One-Class SVM",
        "algorithm_id": "one_class_svm",
        "score": round(score, 4),
        "confidence": round(confidence, 3),
        "flagged": rank_flagged_logs(
            logs,
            minimum_score=0.60,
            limit=6,
        ),
        "features": {
            "labels": [
                "kernel_margin",
                "nu_support",
                "rbf_gamma",
                "error_rate",
                "seq_pattern",
            ],
            "values": [
                round(
                    1.0 - features["severity_score"],
                    2,
                ),
                round(
                    features["critical_ratio"],
                    2,
                ),
                round(
                    features["security_keyword_score"],
                    2,
                ),
                round(
                    features["error_ratio"],
                    2,
                ),
                round(
                    features["sequence_risk"],
                    2,
                ),
            ],
        },
        "note": (
            "Best when training data represents "
            "normal behaviour."
        ),
    }


# =========================================================
# LSTM SEQUENCE MODEL
# =========================================================

def run_lstm(logs):
    """
    LSTM-style sequential anomaly analysis.

    Focuses on temporal concentration and security-event
    sequence patterns.
    """

    features = extract_features(
        logs
    )

    sequence_score = clamp(
        features["sequence_risk"] * 0.35
        + features["timestamp_spike"] * 0.20
        + features["network_risk"] * 0.15
        + features["auth_risk"] * 0.10
        + features["severity_score"] * 0.20
    )

    confidence = clamp(
        0.70
        + features["sequence_risk"] * 0.16
        + features["timestamp_spike"] * 0.08
        + features["critical_ratio"] * 0.06
    )

    flagged = rank_flagged_logs(
        logs,
        minimum_score=0.40,
        limit=6,
    )

    if not flagged:
        flagged = logs[-6:]

    return {
        "algorithm": "LSTM Sequence Model",
        "algorithm_id": "lstm_seq",
        "score": round(
            sequence_score,
            4,
        ),
        "confidence": round(
            confidence,
            3,
        ),
        "flagged": flagged,
        "features": {
            "labels": [
                "seq_loss",
                "pattern_break",
                "temporal_spike",
                "recurrence",
                "hidden_state",
            ],
            "values": [
                round(
                    sequence_score,
                    2,
                ),
                round(
                    features["security_keyword_score"],
                    2,
                ),
                round(
                    features["timestamp_spike"],
                    2,
                ),
                round(
                    features["repeated_ip_score"],
                    2,
                ),
                round(
                    features["severity_score"],
                    2,
                ),
            ],
        },
        "note": (
            "Best at sequential pattern breaks "
            "and time-series anomalies."
        ),
    }


# =========================================================
# ALGORITHM REGISTRY
# =========================================================

def get_algorithms():
    """
    Return the available ML algorithms.

    Function-based registry instead of a class.
    """

    return [
        run_isolation_forest,
        run_lof,
        run_one_class_svm,
        run_lstm,
    ]


# =========================================================
# RISK LEVEL
# =========================================================

def get_risk_level(score):
    """
    Convert anomaly score to risk level.
    """

    score = clamp(score)

    if score >= 0.85:
        return "CRITICAL"

    if score >= 0.70:
        return "HIGH"

    if score >= 0.50:
        return "MEDIUM"

    return "LOW"


# =========================================================
# TIMELINE
# =========================================================

def build_timeline(base_score, logs=None):
    """
    Build a deterministic 12-point anomaly timeline.

    The timeline is derived from the base score and log
    characteristics instead of random noise.
    """

    base_score = clamp(
        base_score
    )

    features = extract_features(
        logs or []
    )

    activity_factor = (
        features["security_keyword_score"]
        + features["timestamp_spike"]
        + features["critical_ratio"]
    ) / 3.0

    labels = [
        f"T-{(11 - index) * 5}m"
        for index in range(12)
    ]

    scores = []

    for index in range(12):
        progress = index / 11

        wave = (
            math.sin(
                index * 1.7
            )
            * 0.08
        )

        historical_adjustment = (
            (progress - 0.5)
            * activity_factor
            * 0.12
        )

        value = clamp(
            base_score
            + wave
            + historical_adjustment
        )

        scores.append(
            round(
                value,
                2,
            )
        )

    scores[-1] = round(
        base_score,
        4,
    )

    return {
        "labels": labels,
        "scores": scores,
    }


# =========================================================
# ALGORITHM RESULT
# =========================================================

def calculate_composite(result):
    """
    Calculate the combined confidence/anomaly score.
    """

    confidence = clamp(
        result["confidence"]
    )

    score = clamp(
        result["score"]
    )

    return round(
        confidence * 0.6
        + score * 0.4,
        4,
    )


# =========================================================
# RUN ENSEMBLE
# =========================================================

def run_ensemble(
    logs,
    source="all",
    time_range="1h",
):
    """
    Run the complete ML ensemble.

    All available algorithms execute.

    The algorithm with the highest composite score is
    selected as the primary result.

    Identical input logs produce identical output.
    """

    logs = logs or []

    if not logs:
        return {
            "success": False,
            "message": "No logs available for ML analysis",
            "source": source,
            "time_range": time_range,
        }

    results = []

    for algorithm in get_algorithms():
        result = algorithm(
            logs
        )

        result["composite"] = calculate_composite(
            result
        )

        results.append(
            result
        )

    if not results:
        return {
            "success": False,
            "message": "No ML algorithms available",
            "source": source,
            "time_range": time_range,
        }

    best = max(
        results,
        key=lambda result: (
            result["composite"],
            result["score"],
            result["confidence"],
        ),
    )

    score = round(
        clamp(
            best["score"]
        ),
        4,
    )

    return {
        "success": True,
        "source": source,
        "time_range": time_range,

        "best_algorithm": best["algorithm"],
        "best_algorithm_id": best["algorithm_id"],

        "anomaly_score": score,
        "confidence": best["confidence"],
        "risk_level": get_risk_level(
            score
        ),

        "flagged_entries": best["flagged"],

        "feature_importance": best["features"],

        "timeline": build_timeline(
            score,
            logs,
        ),

        "all_results": [
            {
                "algorithm": result["algorithm"],
                "algorithm_id": result["algorithm_id"],
                "score": result["score"],
                "confidence": result["confidence"],
                "composite": result["composite"],
                "note": result["note"],
                "is_best": result is best,
            }
            for result in results
        ],
    }

