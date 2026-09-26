# Intelligent Log Forensics

A professional security analytics platform for log-based threat detection, forensic investigation and incident response.

## Features

- **Log Analysis** — Parse Apache, Nginx, Syslog, Auth, JSON, CSV and custom log formats
- **Threat Detection** — Behavioral signature scanning for injection, brute force, scanning, C2
- **ML Anomaly Engine** — Ensemble: Isolation Forest + Local Outlier Factor + One-Class SVM
- **MITRE ATT&CK Mapping** — Every detection mapped to ATT&CK tactics and techniques
- **Incident Management** — Auto-created incidents with full investigation workflow
- **Forensic Reports** — PDF report generation with evidence, timelines and MITRE maps
- **Live Simulator** — Synthetic attack event generator for pipeline testing
- **Admin Console** — User management, audit logging, system monitoring
- **3D Visualization** — Interactive Three.js pipeline model on the landing page
- **SMTP Password Reset** — Secure token-based password reset via email

## Quick Start with Docker

bash
# Clone / extract the project
cd intelligent-log-forensics

# Copy and edit environment variables
cp .env.example .env
# Edit .env with your settings

# Build and start
docker-compose up --build

# Open http://localhost:5000
# Default admin: admin@ilf.security / ILFAdmin2026!


## Local Development

bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy env
cp .env.example .env

python app.py
# Open http://localhost:5000


## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ilf.security | ILFAdmin2026! |

**Change these immediately in production via the `.env` file.**

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ILF_SECRET_KEY` | Flask session secret | dev key |
| `ILF_TOKEN_KEY` | JWT signing key | dev key |
| `ILF_ADMIN_EMAIL` | Default admin email | admin@ilf.security |
| `ILF_ADMIN_PASSWORD` | Default admin password | ILFAdmin2026! |
| `ILF_SECURE_COOKIES` | HTTPS-only cookies | false |
| `ILF_DB_PATH` | SQLite database path | instance/ilf.db |
| `SMTP_HOST` | SMTP server host | smtp.gmail.com |
| `SMTP_PORT` | SMTP server port | 587 |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password/app key | — |
| `SMTP_FROM` | From email address | noreply@ilf.security |

## Supported Log Formats

- Apache/Nginx Combined Access Log
- Linux Auth Log (syslog, auth.log)
- JSON Events (one object per line)
- JSONL streams
- CSV with standard fields
- Plain text log lines

## Architecture


app.py                          Flask entry point
aegis_core/
  __init__.py                   App factory
  config.py                     Settings
  persistence/
    schema.sql                  SQLite schema (8 tables)
    engine.py                   DB connection manager
  security/
    identity.py                 Auth, sessions, decorators
  analytics/
    signatures.py               Behavioral rule engine
    anomaly.py                  ML ensemble (IF + LOF + SVM)
    correlator.py               Event correlation + incident creation
    mitre_matrix.py             ATT&CK technique definitions
    trust_engine.py             Log quality scoring
  parsers/
    tokenizers.py               Multi-format log parser
    sanitizers.py               Field extractors/validators
  dossiers/
    generator.py                PDF report generator
  web/
    routes_auth.py              /login /register /logout /forgot-password /reset-password
    routes_app.py               /dashboard /upload /analyze /mitre /ml-analysis etc.
    routes_admin.py             /admin/* routes
    routes_api.py               /api/* REST endpoints
static/
  css/
    tokens.css                  Design tokens
    base.css                    Layout system
    components.css              UI components
    animations.css              Animations + transitions
  js/
    app.js                      Core JS (toasts, sidebar, counters)
    landing3d.js                Three.js 3D visualization engine
templates/
  base.html                     Base HTML template
  app_shell.html                Authenticated shell with sidebar
  index.html                    Landing page with 3D scene
  auth/                         Login, register, forgot/reset password
  app/                          Dashboard, upload, analyze, MITRE, ML, reports, etc.
  admin/                        Admin dashboard, users, audit log, incidents


## Technology Stack

- **Backend**: Python 3.12, Flask 3.0
- **ML**: scikit-learn (Isolation Forest, LOF, One-Class SVM), NumPy
- **Database**: SQLite (WAL mode, foreign keys)
- **Reports**: ReportLab PDF
- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework)
- **3D**: Three.js r128
- **Container**: Docker + Docker Compose

## Security Notes

- Passwords hashed with Werkzeug (PBKDF2-SHA256)
- Session tokens: HMAC-SHA256 signed, 8-hour expiry
- Password reset: SHA-256 hashed tokens, 1-hour expiry, single-use
- Role-based access: backend-enforced (admin/analyst)
- SQL: parameterized queries only, no string interpolation
- File uploads: extension allowlist, size limit (100MB)
- CSRF: Flask session-based protection
- Cookies: HttpOnly, SameSite=Lax, optional Secure flag
