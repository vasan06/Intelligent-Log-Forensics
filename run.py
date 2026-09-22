"""Flask Entrypoint & Unified Workstation Server.

Running ``python run.py`` starts the unified Flask server which serves both
the modular Plain HTML/CSS/JS frontend UI and the backend REST API on a single port.
"""
import argparse
import os
import sys

from app import create_app

app = create_app()

def main():
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except (OSError, ValueError):
            pass

    parser = argparse.ArgumentParser(description="Boot the Forensic Log Intelligence Workstation.")
    parser.add_argument("--host", default=os.getenv("FLASK_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("FLASK_PORT", "5000")))
    args = parser.parse_args()

    debug = os.getenv("FLASK_DEBUG", "1").lower() not in ("0", "false")

    url = f"http://{args.host}:{args.port}"
    print()
    print("=" * 64)
    print("  INTELLIGENT LOG FORENSICS & MITRE RCA PLATFORM")
    print(f"  Unified Workstation UI & API:  {url}")
    print("  (Both Frontend & Backend served together from this single server)")
    print("=" * 64)
    print()

    app.run(host=args.host, port=args.port, debug=debug, threaded=True)

if __name__ == "__main__":
    main()
