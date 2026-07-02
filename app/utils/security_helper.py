from flask import abort
from flask_login import current_user


def require_owner(upload):
    if current_user.role != "admin" and upload.user_id != current_user.id:
        abort(403)
    return upload
