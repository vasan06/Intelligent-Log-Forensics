"""routes/ml.py — ML analysis routes"""

from flask import Blueprint, request, jsonify

from backend.services.ml_service import run_ensemble
from backend.services.log_simulator import generate_logs
from backend import config
from backend.database import get_db
from backend.models.user import users
from sqlalchemy import select
import jwt


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
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify({"success": False, "message": "Authentication required"}), 401
    try:
        payload = jwt.decode(auth[7:].strip(), config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        uid = payload.get("sub") if payload.get("type") == "access" else None
        with get_db() as db:
            active = uid and db.execute(select(users.c.id).where(users.c.id == str(uid), users.c.verified.is_(True))).first()
        if not active: return jsonify({"success": False, "message": "Authentication required"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"success": False, "message": "Authentication required"}), 401

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