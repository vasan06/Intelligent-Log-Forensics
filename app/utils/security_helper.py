from flask import abort
from flask_jwt_extended import get_current_user


def require_owner(upload):
    user = get_current_user()
    if user.role != "admin" and upload.user_id != user.id:
        abort(403)
    return upload
