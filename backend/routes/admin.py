"""routes/admin.py — Admin panel: users, system health"""
import random
from flask import Blueprint, request, jsonify

admin_bp = Blueprint('admin', __name__)

_USERS = [
    {'id':'u1','name':'Admin User','email':'admin@ilf.io','role':'Admin','status':'active','avatar':'AU'},
    {'id':'u2','name':'Arjun Sharma','email':'arjun@ilf.io','role':'Analyst','status':'active','avatar':'AS'},
    {'id':'u3','name':'Priya Menon','email':'priya@ilf.io','role':'Viewer','status':'inactive','avatar':'PM'},
]

@admin_bp.route('/admin/stats')
def stats():
    return jsonify({
        'system_health':    'operational',
        'uptime_hours':     random.randint(200, 9999),
        'storage_used_gb':  round(random.uniform(12, 78), 1),
        'storage_total_gb': 100,
        'active_sessions':  random.randint(1, 14),
        'api_calls_today':  random.randint(1200, 12000),
        'logs_today':       random.randint(80000, 250000),
    })

@admin_bp.route('/admin/users')
def users():
    return jsonify({'users': _USERS, 'total': len(_USERS)})

@admin_bp.route('/admin/users/<uid>', methods=['PUT'])
def update_user(uid):
    data = request.json or {}
    for u in _USERS:
        if u['id'] == uid:
            u.update({k: v for k, v in data.items() if k in ('role','status','name')})
            return jsonify({'success': True, 'user': u})
    return jsonify({'success': False, 'message': 'User not found'}), 404
