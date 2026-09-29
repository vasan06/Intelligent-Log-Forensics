"""routes/ml.py — ML analysis routes"""

from flask import Blueprint, request, jsonify

from backend.services.ml_service import run_ensemble
from backend.services.log_simulator import generate_logs


ml_bp = Blueprint("ml", __name__)


# =========================================================
# ML ALGORITHMS
# =========================================================

@ml_bp.route("/ml/algorithms", methods=["GET"])
def algorithms():
    """Return the ML algorithms supported by ILF."""

    return jsonify({
        "success": True,
        "algorithms": [
            {
                "name": "Isolation Forest",
                "id": "isolation_forest",
            },
            {
                "name": "Local Outlier Factor",
                "id": "lof",
            },
            {
                "name": "One-Class SVM",
                "id": "one_class_svm",
            },
            {
                "name": "LSTM Sequence Model",
                "id": "lstm_seq",
            },
        ],
    }), 200


# =========================================================
# ML ANALYSIS
# =========================================================

@ml_bp.route("/ml/analyze", methods=["POST"])
def analyze():

    data = request.get_json(silent=True) or {}

    source = data.get("source") or "all"
    time_range = data.get("time_range") or "1h"

    # -----------------------------------------------------
    # Prefer logs supplied by the parser/frontend.
    # Only generate simulation logs when no logs are supplied.
    # -----------------------------------------------------

    logs = data.get("logs")

    if logs is None:
        logs = generate_logs(
            80,
            "random",
            source,
        )

    # -----------------------------------------------------
    # Validate logs
    # -----------------------------------------------------

    if not isinstance(logs, list):
        return jsonify({
            "success": False,
            "message": "logs must be a list",
        }), 400

    # -----------------------------------------------------
    # Run deterministic ML ensemble
    # -----------------------------------------------------

    result = run_ensemble(
        logs,
        source,
        time_range,
    )

    return jsonify(result), 200