def classify(features):
    """Lightweight deterministic baseline with an ML-compatible interface."""
    signal = (
        features["failed_auth_count"] * 8
        + features["server_error_count"] * 5
        + features["slow_request_count"] * 3
    )
    return {"risk_probability": min(0.99, signal / 100), "model": "baseline-v1"}

