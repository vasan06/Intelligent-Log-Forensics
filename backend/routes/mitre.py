"""routes/mitre.py — MITRE ATT&CK catalog, mapping, and technique detail"""
import json, os, re
from flask import Blueprint, request, jsonify

mitre_bp = Blueprint('mitre', __name__)

# Load catalog once at startup
_CATALOG_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'mitre_catalog.json')
with open(_CATALOG_PATH, encoding='utf-8') as f:
    _CATALOG = json.load(f)

_TECHNIQUES = {t['id']: t for t in _CATALOG['techniques']}
_TACTICS    = {t['id']: t for t in _CATALOG['tactics']}

@mitre_bp.route('/mitre/tactics')
def tactics():
    return jsonify({'tactics': _CATALOG['tactics']})

@mitre_bp.route('/mitre/catalog')
def catalog():
    q      = (request.args.get('q') or '').lower()
    tactic = request.args.get('tactic') or ''
    sev    = request.args.get('severity') or ''
    page   = max(int(request.args.get('page', 1)), 1)
    limit  = min(int(request.args.get('limit', 20)), 50)

    results = list(_CATALOG['techniques'])

    if q:
        results = [t for t in results if
                   q in t['name'].lower() or q in t['description'].lower()
                   or any(q in p.lower() for p in t.get('log_patterns', []))]
    if tactic:
        results = [t for t in results if t['tactic'] == tactic]
    if sev:
        results = [t for t in results if t['severity'] == sev]

    total  = len(results)
    start  = (page - 1) * limit
    paged  = results[start: start + limit]

    # Attach tactic metadata
    for t in paged:
        t['tactic_info'] = _TACTICS.get(t['tactic'], {})

    return jsonify({'techniques': paged, 'total': total, 'page': page, 'limit': limit})

@mitre_bp.route('/mitre/technique/<tid>')
def technique(tid):
    t = _TECHNIQUES.get(tid)
    if not t:
        return jsonify({'error': 'Technique not found'}), 404
    full = dict(t)
    full['tactic_info'] = _TACTICS.get(t['tactic'], {})
    return jsonify({'technique': full})

@mitre_bp.route('/mitre/map', methods=['POST'])
def map_logs():
    """Map a list of log entries to MITRE techniques by pattern matching."""
    data = request.json or {}
    logs = data.get('logs', [])
    if not logs:
        return jsonify({'matches': [], 'summary': {}})

    matches = []
    tactic_counts = {}

    for log in logs:
        msg_lower = (log.get('message') or '').lower()
        src_lower = (log.get('source')  or '').lower()
        text      = msg_lower + ' ' + src_lower

        for tech in _CATALOG['techniques']:
            patterns = tech.get('log_patterns', [])
            matched  = [p for p in patterns if p.lower() in text]
            if matched:
                tactic_id = tech['tactic']
                tactic_counts[tactic_id] = tactic_counts.get(tactic_id, 0) + 1
                matches.append({
                    'log_id':    log.get('id', '?'),
                    'log_msg':   log.get('message', '')[:100],
                    'technique': tech['id'],
                    'name':      tech['name'],
                    'tactic':    tactic_id,
                    'tactic_name': _TACTICS.get(tactic_id, {}).get('name', ''),
                    'severity':  tech['severity'],
                    'patterns_hit': matched,
                    'mitre_url': tech['mitre_url'],
                })

    # Deduplicate by technique
    seen = {}
    deduped = []
    for m in matches:
        key = m['technique']
        if key not in seen:
            seen[key] = m
            deduped.append(m)

    return jsonify({
        'matches':       deduped,
        'total_matches': len(deduped),
        'tactic_summary': [
            {'tactic': tid, 'name': _TACTICS.get(tid, {}).get('name', tid), 'count': cnt}
            for tid, cnt in sorted(tactic_counts.items(), key=lambda x: -x[1])
        ],
    })
