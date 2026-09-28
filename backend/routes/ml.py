"""routes/ml.py — ML ensemble analysis"""
from flask import Blueprint, request, jsonify
from backend.services.ml_service import run_ensemble
from backend.services.log_simulator import generate_logs

ml_bp = Blueprint('ml', __name__)

@ml_bp.route('/ml/analyze', methods=['POST'])
def analyze():
    data   = request.json or {}
    source = data.get('source', 'all')
    trange = data.get('time_range', '1h')
    # Use uploaded file logs if provided, else generate simulation
    logs   = data.get('logs') or generate_logs(80, 'random', source)
    result = run_ensemble(logs, source, trange)
    return jsonify(result)
