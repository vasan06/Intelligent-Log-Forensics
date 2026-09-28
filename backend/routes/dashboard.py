"""routes/dashboard.py — Dashboard stats + ML summary"""
import random
from flask import Blueprint, jsonify
from backend.services.log_simulator import SOURCES

dash_bp = Blueprint('dashboard', __name__)

@dash_bp.route('/dashboard/stats')
def stats():
    hours = list(range(24))
    return jsonify({
        'kpis': {
            'total_logs':      random.randint(120000, 250000),
            'anomalies':       random.randint(24, 180),
            'active_sources':  random.randint(6, len(SOURCES)),
            'avg_response_ms': random.randint(8, 95),
        },
        'log_volume': {
            'labels':   [f'{h:02d}:00' for h in hours],
            'INFO':     [random.randint(100, 900) for _ in hours],
            'WARN':     [random.randint(20,  300) for _ in hours],
            'ERROR':    [random.randint(5,   120) for _ in hours],
            'CRITICAL': [random.randint(0,    30) for _ in hours],
        },
        'severity_dist': {
            'labels': ['INFO','WARN','ERROR','CRITICAL','DEBUG'],
            'values': [42, 22, 18, 8, 10],
            'colors': ['#4A6FA5','#B87333','#C0392B','#7B2D8B','#2D2B6B'],
        },
        'top_sources': {
            'labels': SOURCES,
            'values': [random.randint(800, 9000) for _ in SOURCES],
        },
        'activity': {
            'days':  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
            'hours': [f'{h:02d}h' for h in range(0, 24, 2)],
            'data':  [[random.randint(0, 100) for _ in range(12)] for _ in range(7)],
        },
    })

@dash_bp.route('/dashboard/ml-summary')
def ml_summary():
    from backend.services.log_simulator import generate_logs
    from backend.services.ml_service import run_ensemble
    logs   = generate_logs(50, 'random')
    result = run_ensemble(logs)
    return jsonify({
        'anomaly_score':    result['anomaly_score'],
        'risk_level':       result['risk_level'],
        'best_algorithm':   result['best_algorithm'],
        'flagged_count':    len(result['flagged_entries']),
        'all_scores':       [{
            'algorithm': r['algorithm'], 'score': r['score'], 'is_best': r['is_best']
        } for r in result['all_results']],
    })
