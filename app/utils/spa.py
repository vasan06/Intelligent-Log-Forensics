"""Render the single-page application shell.

In development the entrypoint starts the Vite dev server and page routes
redirect to it (keeping one browser origin and the history-fallback behavior).
In production the compiled bundle is served from Flask's static folder, so the
whole application stays on a single port.
"""
from pathlib import Path

from flask import current_app, redirect, request, send_from_directory


def _spa_root() -> Path:
    return Path(current_app.root_path).parent / "frontend" / "dist"


def render_spa():
    if current_app.config.get("SPA_DEV_REDIRECT"):
        origin = current_app.config.get("FRONTEND_ORIGIN") or ""
        if origin:
            return redirect(f"{origin.rstrip('/')}{request.full_path}")
    return send_from_directory(_spa_root(), "index.html")


def serve_spa_asset(path: str):
    root = _spa_root()
    if path and (root / path).is_file():
        return send_from_directory(root, path)
    return send_from_directory(root, "index.html")
