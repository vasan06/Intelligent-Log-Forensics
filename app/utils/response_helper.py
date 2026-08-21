from flask import jsonify


def success(data=None, **extra):
    return jsonify({"ok": True, "data": data, **extra})

