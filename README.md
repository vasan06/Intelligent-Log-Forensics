# Intelligent Log Forensic

Intelligent Log Forensic (ILF) is a web application for collecting and exploring infrastructure logs, detecting unusual activity with machine-learning analysis, mapping findings to MITRE ATT&CK, and preparing forensic reports.

This repository contains a Flask API and static, multi-page frontend. The authenticated pages share a navigation shell; browser-supported prefetching and cross-document transitions make navigation feel faster while retaining standard links, deep links, and browser history.

## Capabilities

- Upload and inspect log files, and run sample or simulated log streams.
- Large uploads are processed by a persistent background worker in batches; the default request limit is 64 MiB.
- Analyse log events using the configured anomaly-detection models.
- Browse MITRE ATT&CK tactics and techniques and view event mappings.
- Review dashboard metrics, reports, account activity, and profile settings.
- Manage users and inspect platform activity through the administrator page.
- Export account data and generate downloadable forensic reports.

The exact algorithms and behavior are implemented in `backend/services/ml_service.py`; the frontend describes and presents the currently configured models.

### Large log uploads

The Log Explorer and ML Analysis upload controls use the same background job pipeline. In Docker Compose, the `upload-worker` service consumes persisted jobs, so a worker restart re-queues interrupted jobs. For local `start.bat`/`start.sh` usage, processing runs in the Flask process. Results retain aggregate counts and ensemble findings; the Log Explorer fetches records in pages rather than rendering the entire upload. Set `ILF_MAX_UPLOAD_BYTES` to change the Flask request limit and configure any reverse proxy to allow at least the same size.

## Technology

| Area | Technologies |
| --- | --- |
| Frontend | HTML, CSS, browser JavaScript |
| API | Python, Flask, Flask-CORS |
| Persistence | PostgreSQL, SQLAlchemy, psycopg |
| Authentication | JWT, bcrypt, HTTP cookies, browser token mirror |
| Analysis and reports | scikit-learn, NumPy, ReportLab |

## Repository structure

```text
.
├── backend/
│   ├── app.py                    Flask app factory, API registration, and page routes
│   ├── config.py                 Environment-backed configuration
│   ├── database.py               SQLAlchemy engine, sessions, and schema setup
│   ├── upload_worker.py          Durable background upload-job worker
│   ├── __init__.py
│   ├── data/
│   │   └── mitre_catalog.json    MITRE ATT&CK catalog data
│   ├── models/                   SQLAlchemy persistence models and package exports
│   │   ├── log_analysis.py       Analysis records
│   │   ├── report.py             Report records
│   │   ├── session.py            Refresh/authentication sessions
│   │   ├── upload_job.py         Persistent upload-job state
│   │   ├── uploaded_file.py      Uploaded log metadata/content
│   │   └── user.py               User accounts and roles
│   ├── routes/                   Flask API blueprints and package exports
│   │   ├── admin.py              Administrator operations
│   │   ├── auth.py               Signup, login, refresh, logout, and password recovery
│   │   ├── dashboard.py          Dashboard metrics and ML summary
│   │   ├── logs.py               Log stream, upload, simulation, and pipeline
│   │   ├── mitre.py              ATT&CK catalog, tactics, and event mapping
│   │   ├── ml.py                 Model listing, analysis, and event lookup
│   │   ├── reports.py            Report generation, history, and download
│   │   └── user.py               Profile, password, and data export
│   └── services/                 Reusable application services
│       ├── log_simulator.py      Sample telemetry generation
│       ├── ml_service.py         Analysis and anomaly detection
│       ├── upload_processing.py  Batched upload parsing and analysis
│       └── otp_service.py        One-time-code and email support
├── frontend/
│   ├── admin.html
│   ├── dashboard.html
│   ├── forgot-password.html
│   ├── landing.html
│   ├── live-monitor.html
│   ├── log-explorer.html
│   ├── mitre-catalog.html
│   ├── mitre-tracker.html
│   ├── ml-analysis.html
│   ├── profile.html
│   ├── reports.html
│   ├── signin.html
│   ├── signup.html
│   └── assets/
│       ├── css/                  tokens, global, components, animations, navbar,
│       │                         and per-page styles for the pages above
│       └── js/                   api, auth-guard, navbar, and page scripts for
│                                 admin, dashboard, landing, live-monitor,
│                                 log-explorer, mitre-catalog, mitre-tracker,
│                                 ml-analysis, profile, reports, signin, and signup
├── API_TESTINGS/
│   └── ILF.postman_collection.json  Postman request collection
├── .env.example                  Environment-variable template (placeholders only)
├── .dockerignore
├── .gitignore
├── Dockerfile                    Container image definition
├── docker-compose.yml            Local PostgreSQL and web service definitions
├── requirements.txt              Python dependencies
├── start.bat                     Windows launch helper
├── start.sh                      macOS/Linux launch helper
└── todo.txt
```

Create a local `.env` from `.env.example`; it is deliberately not listed in the tree because it can contain private configuration. Runtime files may be created under `instance/`; they are not application source.

## Pages

Flask serves the frontend pages at these paths:

| Path | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/login` or `/signin` | Sign in |
| `/signup` | Create an account |
| `/forgot-password` | Password recovery |
| `/dashboard` | Dashboard overview |
| `/live-monitor` | Live and simulated log monitor |
| `/log-explorer` | Upload and inspect log data |
| `/ml-analysis` | Run and review model analysis |
| `/mitre-tracker` | View mapped findings and tactics |
| `/mitre-catalog` | Browse the ATT&CK catalog |
| `/reports` | Generate and review reports |
| `/profile` | Account settings and exports |
| `/admin` | Administrator tools |

Direct `*.html` requests are supported by Flask and redirected to the corresponding page path when a matching frontend file exists.

## Local development

### Prerequisites

- Python 3.10 or later
- PostgreSQL available to the application
- Git (to clone the repository)

Create a database and a dedicated application role in PostgreSQL. For example, from `psql` as a database administrator:

```sql
CREATE ROLE ilf_user LOGIN PASSWORD 'your database password';
CREATE DATABASE ilf_db OWNER ilf_user;
```

Use the same database name, role, and password in your local `.env` configuration.

### 1. Install Python dependencies

Run from the repository root:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

On macOS or Linux, activate the environment with:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```
### Docker commands

Rebuild after code changes

Use:

docker compose down
docker compose build
docker compose up -d

If you want a completely fresh database/container environment:

docker compose down -v
docker compose build --no-cache
docker compose up -d

Be careful with -v: it removes Docker volumes, so PostgreSQL data stored in those volumes can be deleted.

Recommended ILF workflow
git pull
docker compose down
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f

If the container fails, don't start changing files randomly. Run:

docker compose ps
docker compose logs --tail=100

### 2. Configure the application

Copy `.env.example` to `.env` and replace each indicated value with your own local configuration. Do not commit `.env` or put real passwords, tokens, or signing secrets in documentation.

The application reads these settings in `backend/config.py`:

| Variable | Purpose |
| --- | --- |
| `ILF_JWT_SECRET` | Required key for signing JWTs; use a long, randomly generated value |
| `ILF_JWT_ALGORITHM` | JWT algorithm; defaults to `HS256` |
| `ILF_JWT_ACCESS_EXPIRES` | Access-token lifetime in seconds |
| `ILF_JWT_REFRESH_EXPIRES` | Refresh-token lifetime in seconds |
| `ILF_DB_HOST`, `ILF_DB_PORT` | PostgreSQL host and port |
| `ILF_DB_NAME`, `ILF_DB_USER`, `ILF_DB_PASSWORD` | PostgreSQL database and connection credentials |
| `ILF_DATABASE_URL` | Optional full SQLAlchemy connection URL; takes precedence over the individual database fields |
| `ILF_ADMIN_EMAIL`, `ILF_ADMIN_PASSWORD` | Initial administrator configuration; set both to values you control |
| `ILF_COOKIE_SECURE` | Set to `true` when serving over HTTPS |
| `ILF_CORS_ORIGINS` | Comma-separated list of permitted browser origins |
| `ILF_SMTP_HOST`, `ILF_SMTP_PORT`, `ILF_SMTP_USER`, `ILF_SMTP_PASS`, `ILF_SMTP_FROM` | Optional email delivery configuration |
| `ILF_OTP_LENGTH`, `ILF_OTP_EXPIRY_SECONDS` | One-time-code length and lifetime |
| `ILF_LOG_LEVEL` | Application log level |

`backend/config.py` loads `.env` from the repository root. Database credentials must point to a PostgreSQL database that the application can reach. Schema initialization is attempted at startup; check `/api/health` if the database is unavailable.

### 3. Start the application

From the repository root, with the virtual environment active and `.env` configured:

```powershell
python -m backend.app
```

Open `http://localhost:5000/`. The Flask development server uses port `5000`; the entry point currently enables debug mode and should not be exposed directly to the public internet.

The `start.bat` and `start.sh` helpers are also present. They install dependencies and launch the server; for repeat development use, the virtual-environment steps above provide more control.

## API reference

All API routes are prefixed with `/api`. JSON endpoints accept or return JSON unless noted. Authenticated requests use the access token through the `Authorization: Bearer <token>` header and/or the configured authentication cookies; the browser API client sends credentials. Administrator routes require an administrator account. The health check is public.

### Health

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Application and database health status; returns `503` when the database is unavailable |

### Authentication

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Register a user |
| `POST` | `/api/auth/login` | Authenticate and establish a session |
| `POST` | `/api/auth/refresh` | Refresh the access token |
| `POST` | `/api/auth/logout` | Sign out the current session |
| `POST` | `/api/auth/logout-all` | Revoke the current user's sessions |
| `POST` | `/api/auth/forgot-password` | Begin password recovery |
| `POST` | `/api/auth/verify-otp` | Verify a one-time code |
| `POST` | `/api/auth/reset-password` | Set a new password after code verification |

### Dashboard and logs

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/dashboard/stats` | Dashboard metrics |
| `GET` | `/api/dashboard/ml-summary` | Dashboard analysis summary |
| `GET` | `/api/logs/stream` | Retrieve a log stream; supports `count`, `mode`, `source`, and `severity` query parameters |
| `GET` | `/api/logs/modes` | List available simulation modes |
| `GET` | `/api/logs/sources` | List available log sources |
| `POST` | `/api/logs/upload` | Upload log data as multipart form data |
| `POST` | `/api/logs/simulation` | Create a simulation |
| `GET` | `/api/logs/demo-sample/<sample_type>` | Retrieve a named demo sample |
| `GET` | `/api/logs/pipeline/<pipe_id>` | Check the status of a log-processing pipeline |

### Machine learning and MITRE ATT&CK

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/ml/algorithms` | List configured analysis algorithms |
| `POST` | `/api/ml/analyze` | Analyse supplied or previously ingested log events |
| `GET` | `/api/ml/load-event/<event_id>` | Load an event for analysis |
| `GET` | `/api/mitre/tactics` | List ATT&CK tactics |
| `GET` | `/api/mitre/catalog` | Search and page through techniques; supports `q`, `tactic`, `severity`, `page`, and `limit` |
| `GET` | `/api/mitre/technique/<tid>` | Retrieve technique details |
| `POST` | `/api/mitre/map` | Map supplied log events to ATT&CK techniques |
| `GET` | `/api/mitre/user-latest` | Retrieve the latest user mappings |

### Reports and user account

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/reports/activities` | Retrieve report activity |
| `POST` | `/api/reports/preview` | Preview a report |
| `POST` | `/api/reports/generate` | Generate a report; response is a downloadable file |
| `GET` | `/api/reports/download/<report_id>` | Download a generated report |
| `GET` | `/api/reports/history` | List report history |
| `GET` | `/api/user/profile` | Retrieve the current profile |
| `PUT` | `/api/user/profile` | Update the current profile |
| `PUT` | `/api/user/password` | Update the current password |
| `GET` | `/api/user/export` | Export account data |
| `GET` | `/api/user/export-pdf` | Export account data as PDF |

### Administrator

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/admin/stats` | Administrator dashboard metrics |
| `GET` | `/api/admin/users` | List users |
| `POST` | `/api/admin/users` | Create a user |
| `PUT` | `/api/admin/users/<uid>` | Update a user |
| `DELETE` | `/api/admin/users/<uid>` | Delete a user |
| `GET` | `/api/admin/logs` | Search platform logs; supports `q`, `severity`, `user_id`, `source`, and `limit` |
| `GET` | `/api/admin/users/<uid>/activity` | View a user's activity |

For the implemented request details and response schemas, see the corresponding blueprint under `backend/routes/`. `API_TESTINGS/ILF.postman_collection.json` provides a starting point for manual API exploration; set the collection's local URL and authentication values for your environment.

## Frontend implementation notes

- `frontend/assets/js/api.js` centralizes API calls, token refresh, and file downloads.
- `frontend/assets/js/auth-guard.js` provides authentication checks and shared UI helpers.
- `frontend/assets/js/navbar.js` injects the authenticated navigation and mobile drawer. It prefetches a same-origin destination when a user points to, focuses, or touches its link.
- `frontend/assets/css/navbar.css` defines the authenticated navigation and progressive cross-document view transitions on supported browsers.
- `frontend/assets/css/global.css` provides shared layout, components, and responsive breakpoints; page-specific styles live alongside it under `frontend/assets/css/`.
- Page-specific scripts and styles share the page names (for example `dashboard.html`, `assets/js/dashboard.js`, and `assets/css/dashboard.css`).

Navigation remains standard multi-page navigation for reliable refreshes, direct links, and browser history. Prefetch and view-transition support are progressive enhancements; browsers that do not support them continue to use normal links.

## Container Deployment & Data Persistence

`Dockerfile` and `docker-compose.yml` provide a fully persistent containerized stack.

### Data Persistence Architecture
- **Persistent Volume:** PostgreSQL data is permanently stored in the Docker named volume `ilf_pgdata` mounted at `/var/lib/postgresql/data`. User accounts, sessions, forensic log analyses, and generated reports persist across restarts and rebuilds.
- **Admin User Auto-Seeding:** On startup, the database migration and seeding routine automatically creates or updates the administrator account using the environment variables `ADMIN_EMAIL` and `ADMIN_PASSWORD` (default: `admin@ilf.local` / `admin123`). The password is automatically hashed with bcrypt and granted the verified `Admin` role.

### Running with Docker Compose
```bash
# Build and launch the container stack (PostgreSQL + Web API)
docker compose up --build -d

# View service logs
docker compose logs -f web

# Verify service health
curl http://localhost:5000/api/health

# Stop the stack
docker compose down
```

### Running Locally without Docker
```bash
# Install dependencies
pip install -r requirements.txt

# Start the application
python -m backend.app
```

## Tests and maintenance

The repository does not currently define a test directory or a dedicated test command. Python dependencies are listed in `requirements.txt`; page behavior can be checked in a browser, and API availability can be checked at `/api/health`.

## License

No license file is currently included in this repository. Contact the project maintainer for reuse and distribution terms.
