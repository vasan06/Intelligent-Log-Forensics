"""routes/logs.py — Log streaming, upload, pipeline status"""
import random, uuid, time
from flask import Blueprint, request, jsonify
from backend.services.log_simulator import generate_logs, SOURCES, MODES

logs_bp   = Blueprint('logs', __name__)
_pipelines = {}   # id → {stage, progress, logs}

@logs_bp.route('/logs/stream')
def stream():
    count    = min(int(request.args.get('count', 10)), 50)
    mode     = request.args.get('mode', 'random')
    src      = request.args.get('source', 'all')
    sev      = request.args.get('severity', 'all')
    logs     = generate_logs(count, mode, src, sev)
    return jsonify({'logs': logs, 'mode': mode, 'count': len(logs)})

@logs_bp.route('/logs/modes')
def modes():
    return jsonify({'modes': [
        {'id': 'random',        'label': 'Random Mixed',     'description': 'Mix of all simulation types'},
        {'id': 'normal',        'label': 'Normal Traffic',   'description': 'Regular operational logs'},
        {'id': 'ddos',          'label': 'DDoS Attack',      'description': 'Distributed denial of service flood'},
        {'id': 'brute_force',   'label': 'Brute Force',      'description': 'SSH / login credential attacks'},
        {'id': 'sql_injection', 'label': 'SQL Injection',    'description': 'Database injection attacks'},
        {'id': 'malware',       'label': 'Malware Activity', 'description': 'C2 callbacks and malware behaviour'},
        {'id': 'insider_threat','label': 'Insider Threat',   'description': 'Suspicious insider user activity'},
        {'id': 'ransomware',    'label': 'Ransomware',       'description': 'Ransomware encryption and C2'},
        {'id': 'hacking',       'label': 'APT / Hacking',    'description': 'Advanced persistent threat activity'},
    ]})

@logs_bp.route('/logs/sources')
def sources():
    return jsonify({'sources': SOURCES})

@logs_bp.route('/logs/upload', methods=['POST'])
def upload():
    file = request.files.get('file')
    if not file:
        return jsonify({'success': False, 'message': 'No file provided'}), 400

    pipe_id = str(uuid.uuid4())[:12]
    _pipelines[pipe_id] = {'stage': 0, 'started': time.time()}

    # Simulate parsed preview logs
    preview = generate_logs(12, 'random')
    return jsonify({
        'success':        True,
        'file_id':        pipe_id,
        'filename':       file.filename,
        'lines_parsed':   random.randint(500, 12000),
        'anomalies_found':random.randint(2, 60),
        'preview':        preview,
    })

@logs_bp.route('/logs/pipeline/<pipe_id>')
def pipeline_status(pipe_id):
    """Return current pipeline stage for 3D workflow animation."""
    stages = ['collect', 'parse', 'categorise', 'risk_score']
    entry  = _pipelines.get(pipe_id)
    if not entry:
        return jsonify({'stage': 3, 'label': 'risk_score', 'done': True})
    elapsed = time.time() - entry['started']
    stage   = min(int(elapsed / 0.8), 3)   # advance every 0.8s
    return jsonify({
        'stage':    stage,
        'label':    stages[stage],
        'done':     stage >= 3,
        'stages':   stages,
    })
