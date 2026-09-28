"""
ml_service.py — ILF ML Ensemble Service
Runs Isolation Forest + LOF + One-Class SVM + LSTM-proxy simultaneously.
Picks best algorithm by confidence score and returns ensemble result.
No single-algorithm selection — all run, best wins.
"""
import random, time

# ── Algorithm mock implementations ───────────────
# In production, plug in sklearn / torch models here.

def _isolation_forest(logs: list) -> dict:
    """Isolation Forest — good at global anomalies."""
    score   = round(random.uniform(0.25, 0.95), 4)
    flagged = [l for l in logs if l.get('severity') in ('ERROR', 'CRITICAL')]
    return {
        'algorithm': 'Isolation Forest',
        'algorithm_id': 'isolation_forest',
        'score': score,
        'confidence': round(random.uniform(0.70, 0.95), 3),
        'flagged': flagged[:8],
        'features': {
            'labels': ['freq_deviation', 'ip_entropy', 'payload_size', 'time_delta', 'port_entropy'],
            'values': [round(random.uniform(0.1, 0.9), 2) for _ in range(5)],
        },
        'note': 'Best at detecting point anomalies and rare events.',
    }

def _lof(logs: list) -> dict:
    """Local Outlier Factor — density-based, good at contextual anomalies."""
    score   = round(random.uniform(0.30, 0.90), 4)
    flagged = [l for l in logs if l.get('severity') in ('WARN', 'ERROR', 'CRITICAL')]
    return {
        'algorithm': 'Local Outlier Factor',
        'algorithm_id': 'lof',
        'score': score,
        'confidence': round(random.uniform(0.65, 0.90), 3),
        'flagged': flagged[:8],
        'features': {
            'labels': ['local_density', 'neighbor_dist', 'cluster_deviation', 'session_len', 'req_rate'],
            'values': [round(random.uniform(0.1, 0.9), 2) for _ in range(5)],
        },
        'note': 'Best at contextual anomalies in dense log clusters.',
    }

def _one_class_svm(logs: list) -> dict:
    """One-Class SVM — learned boundary of normal behaviour."""
    score   = round(random.uniform(0.20, 0.88), 4)
    flagged = [l for l in logs if l.get('severity') == 'CRITICAL']
    return {
        'algorithm': 'One-Class SVM',
        'algorithm_id': 'one_class_svm',
        'score': score,
        'confidence': round(random.uniform(0.60, 0.88), 3),
        'flagged': flagged[:6],
        'features': {
            'labels': ['kernel_margin', 'nu_support', 'rbf_gamma', 'error_rate', 'seq_pattern'],
            'values': [round(random.uniform(0.1, 0.9), 2) for _ in range(5)],
        },
        'note': 'Best when training data is purely normal behaviour.',
    }

def _lstm_proxy(logs: list) -> dict:
    """LSTM Sequence Model — temporal pattern anomalies."""
    score   = round(random.uniform(0.35, 0.97), 4)
    flagged = logs[-6:]  # last N logs (temporal context)
    return {
        'algorithm': 'LSTM Sequence Model',
        'algorithm_id': 'lstm_seq',
        'score': score,
        'confidence': round(random.uniform(0.72, 0.96), 3),
        'flagged': flagged,
        'features': {
            'labels': ['seq_loss', 'pattern_break', 'temporal_spike', 'recurrence', 'hidden_state'],
            'values': [round(random.uniform(0.1, 0.9), 2) for _ in range(5)],
        },
        'note': 'Best at sequential pattern breaks and time-series anomalies.',
    }

_ALGORITHMS = [_isolation_forest, _lof, _one_class_svm, _lstm_proxy]

# ── Risk level from score ─────────────────────────
def _risk_level(score: float) -> str:
    if score >= 0.85: return 'CRITICAL'
    if score >= 0.70: return 'HIGH'
    if score >= 0.50: return 'MEDIUM'
    return 'LOW'

# ── Timeline generator ────────────────────────────
def _timeline(base_score: float) -> dict:
    labels = [f'T-{(11-i)*5}m' for i in range(12)]
    scores = [round(max(0, min(1, base_score + random.uniform(-0.25, 0.25))), 2) for _ in range(12)]
    scores[-1] = base_score  # last point is current score
    return {'labels': labels, 'scores': scores}

# ── Main ensemble entry point ─────────────────────
def run_ensemble(logs: list, source: str = 'all', time_range: str = '1h') -> dict:
    """
    Run all algorithms on provided logs.
    Select best by highest confidence × score product.
    Returns full results from all algorithms + winner.
    """
    time.sleep(0.3)  # simulate inference latency

    results = [fn(logs) for fn in _ALGORITHMS]

    # Score each: composite = confidence * 0.6 + anomaly_score * 0.4
    for r in results:
        r['composite'] = round(r['confidence'] * 0.6 + r['score'] * 0.4, 4)

    best  = max(results, key=lambda r: r['composite'])
    score = best['score']

    return {
        'success':      True,
        'source':       source,
        'time_range':   time_range,
        'best_algorithm': best['algorithm'],
        'best_algorithm_id': best['algorithm_id'],
        'anomaly_score': score,
        'confidence':   best['confidence'],
        'risk_level':   _risk_level(score),
        'flagged_entries': best['flagged'],
        'feature_importance': best['features'],
        'timeline':     _timeline(score),
        'all_results':  [
            {
                'algorithm':    r['algorithm'],
                'algorithm_id': r['algorithm_id'],
                'score':        r['score'],
                'confidence':   r['confidence'],
                'composite':    r['composite'],
                'note':         r['note'],
                'is_best':      r is best,
            }
            for r in results
        ],
    }
