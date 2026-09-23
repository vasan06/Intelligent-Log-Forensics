# Intelligent Log Forensics — v2

A self-hosted cybersecurity SIEM/forensics platform for analysts. Upload log evidence, run ML-powered anomaly detection, map to MITRE ATT&CK, and generate forensic PDF reports.

## Architecture


React SPA (Vite + TypeScript)
    ↓  HttpOnly JWT cookies + CSRF
Flask API (/api/v1/*)
    ↓
Services → Engines → Repositories
    ↓
PostgreSQL  +  PyOD ML models  +  SSE event stream


## Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18, TypeScript, Vite, Recharts 3 |
| Backend   | Python 3.12, Flask, Flask-JWT-Extended |
| Database  | PostgreSQL (psycopg2) |
| ML        | PyOD (IForest, OCSVM, LOF ensemble) |
| PDF       | ReportLab |
| Container | Docker Compose |

## Code maintainability

git switch -c <branch-name>
git pull origin master/branch
git add .
git commit -m "message"
git pull origin main
docker compose up -d --build

## Quick start

bash
cp .env.example .env          # fill in values
docker compose up --build


App available at http://localhost:5000 by default.

## DB Execution comments:
docker compose exec db psql -U postgres -d intelligent_log_forensics

eg:

SELECT id, name, email, created_at
FROM users
WHERE id = 6;


## Environment variables

| Variable | Required | Description |
|---------|---------|-------------|
| DATABASE_URL | ✅ | PostgreSQL connection string |
| SECRET_KEY | ✅ | Flask secret key |
| JWT_SECRET_KEY | ✅ | JWT signing key |
| UPLOAD_FOLDER | ✅ | Path for uploaded evidence files |
| REPORT_FOLDER | ✅ | Path for generated PDF reports |
| MODEL_FOLDER | ✅ | Path for trained ML models |
| MAX_CONTENT_LENGTH | | Max upload bytes (default 100MB) |
| UPLOAD_RETENTION_HOURS | | Evidence retention (default 72h) |
| GENERATOR_INTERVAL_SECONDS | | Feed interval (default 2s) |
| APP_ORIGIN | | Frontend origin URL |
| COOKIE_SECURE | | Set true in production (HTTPS) |

## Default credentials (demo)

Email: `analyst@example.com`  
Password: `Analyst123!`

Change these before any real deployment.

## Frontend development

bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # Production build → dist/
npm run type-check


## Security notes

- All mutations require CSRF token (X-CSRF-TOKEN header from cookie)
- Access tokens expire in 15 minutes; refresh tokens in 7 days
- Rate limiting on auth endpoints (10/min) and uploads (30/min)
- Analyst users can only access their own evidence
- Admin users have access to all evidence and system stats
- COOKIE_SECURE must be `true` in production behind HTTPS

## Design system

The v2 UI uses:
 **Manrope** — primary sans-serif interface font
- **JetBrains Mono** — monospace for IDs, hashes, timestamps, code
- Dark slate palette (`#0d1117` base, `#388bfd` accent)
- CSS custom properties throughout — easily themed
