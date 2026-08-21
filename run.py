"""Development entrypoint.

Running ``python run.py`` (or ``python app.py``) starts the Flask API and, when
available, automatically boots the Vite dev server for the frontend. Production
(e.g. ``gunicorn 'run:app'``) skips the dev server and serves the built SPA from
Flask's static folder.
"""
import argparse
import os
import re
import shutil
import socket
import subprocess
import sys
import time

from app import create_app
from config import BASE_DIR


FRONTEND_DIR = BASE_DIR / "frontend"

# Module-level app so Gunicorn's ``run:app`` keeps working.
app = create_app()

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def _print_frontend(line):
    """Print a Vite log line, tolerating ANSI codes and non-ASCII output."""
    clean = ANSI_RE.sub("", line.rstrip())
    try:
        print(f"[frontend] {clean}", flush=True)
    except UnicodeEncodeError:
        print(f"[frontend] {clean.encode('ascii', 'replace').decode('ascii')}", flush=True)


def _port_open(port, host="127.0.0.1"):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        return sock.connect_ex((host, port)) == 0


def _start_frontend(timeout=150):
    """Spawn the Vite dev server and wait for its URL, or return (None, None)."""
    node = shutil.which("node")
    npm = shutil.which("npm")
    if os.name == "nt" and npm:
        npm_cmd = shutil.which("npm.cmd")
        if npm_cmd:
            npm = npm_cmd
    if not node or not npm:
        print("[frontend] Node.js/npm not found - skipping Vite dev server.")
        return None, None
    if not (FRONTEND_DIR / "package.json").exists():
        print(f"[frontend] {FRONTEND_DIR / 'package.json'} not found - skipping Vite dev server.")
        return None, None
    if not (FRONTEND_DIR / "node_modules").exists():
        print("[frontend] Installing dependencies (first run)...")
        subprocess.run([npm, "install"], cwd=FRONTEND_DIR, check=True)

    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    process = subprocess.Popen(
        [npm, "run", "dev"],
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=creationflags,
    )
    origin = None
    deadline = time.time() + timeout
    while time.time() < deadline:
        line = process.stdout.readline()
        if line:
            clean = ANSI_RE.sub("", line)
            _print_frontend(line)
            match = re.search(r"Local:\s+(https?://[^\s]+)", clean)
            if match:
                origin = match.group(1).rstrip("/")
                break
        elif process.poll() is not None:
            break
    if origin is None:
        # Vite may already have printed readiness; fall back to a port scan.
        for port in range(5173, 5183):
            if _port_open(port):
                origin = f"http://localhost:{port}"
                break
    if origin is None:
        print("[frontend] Could not detect the Vite dev server URL - it may still be starting.")
    return process, origin


def main():
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except (OSError, ValueError):
            pass
    parser = argparse.ArgumentParser(description="Boot the Flask API and frontend.")
    parser.add_argument("--no-frontend", action="store_true", help="Skip the Vite dev server.")
    parser.add_argument("--host", default=os.getenv("FLASK_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("FLASK_PORT", "5000")))
    args = parser.parse_args()

    vite = None
    frontend_origin = None
    auto = os.getenv("AUTO_START_FRONTEND", "true").lower() not in ("false", "0")
    if auto and not args.no_frontend:
        vite, frontend_origin = _start_frontend()
        if vite is not None and frontend_origin:
            app.config["FRONTEND_ORIGIN"] = frontend_origin
            app.config["SPA_DEV_REDIRECT"] = True

    debug = os.getenv("FLASK_DEBUG", "1").lower() not in ("0", "false")

    print()
    print("=" * 64)
    print("  INTELLIGENT LOG FORENSICS")
    if vite is not None and frontend_origin:
        print(f"  UI:   {frontend_origin}")
        print(f"  API:  http://{args.host}:{args.port}/api/v1")
    else:
        print(f"  UI/API: http://{args.host}:{args.port}")
    print("=" * 64)
    try:
        # With the Vite dev server attached, the reloader's child process would
        # re-run main() and spawn a second Vite (and lose FRONTEND_ORIGIN), so the
        # reloader is disabled when the frontend is running.
        app.run(host=args.host, port=args.port, debug=debug,
                use_reloader=debug and vite is None, threaded=True)
    finally:
        if vite is not None:
            print("[frontend] Shutting down Vite dev server...")
            vite.terminate()
            try:
                vite.wait(timeout=5)
            except subprocess.TimeoutExpired:
                vite.kill()


if __name__ == "__main__":
    main()
