"""routes/user.py — User profile get/update"""
from flask import Blueprint, request, jsonify

user_bp = Blueprint('user', __name__)

_PROFILE = {'id':'u1','name':'Admin User','email':'admin@ilf.io','role':'Admin','avatar':'AU'}

@user_bp.route('/user/profile')
def get_profile():
    return jsonify({'user': _PROFILE})

@user_bp.route('/user/profile', methods=['PUT'])
def update_profile():
    data = request.json or {}
    for k in ('name','email'):
        if k in data:
            _PROFILE[k] = data[k]
    initials = ''.join(w[0] for w in _PROFILE['name'].split())[:2].upper()
    _PROFILE['avatar'] = initials
    return jsonify({'success': True, 'user': _PROFILE})
