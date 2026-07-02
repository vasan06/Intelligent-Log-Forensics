# Intelligent Log Forensics

> Application log analysis, operational intelligence, security risk detection,
> MITRE ATT&CK mapping, incident reconstruction, and forensic reporting in one
> lightweight Flask platform.

## Table of Contents

1. [Overview](#overview)
2. [Business Problem](#business-problem)
3. [Solution](#solution)
4. [Core Capabilities](#core-capabilities)
5. [Technology Stack](#technology-stack)
6. [System Architecture](#system-architecture)
7. [Project Structure](#project-structure)
8. [Processing Workflow](#processing-workflow)
9. [Feature Reference](#feature-reference)
10. [Risk Classification](#risk-classification)
11. [MITRE ATT&CK Mapping](#mitre-attck-mapping)
12. [Database Design](#database-design)
13. [Installation](#installation)
14. [PostgreSQL Setup](#postgresql-setup)
15. [Configuration](#configuration)
16. [Running the Application](#running-the-application)
17. [User Guide](#user-guide)
18. [API Reference](#api-reference)
19. [Authentication and Authorization](#authentication-and-authorization)
20. [Testing](#testing)
21. [Operational Guidance](#operational-guidance)
22. [Troubleshooting](#troubleshooting)
23. [Security Considerations](#security-considerations)
24. [Scalability Roadmap](#scalability-roadmap)
25. [Development Guidelines](#development-guidelines)
26. [Known Limitations](#known-limitations)
27. [Glossary](#glossary)

---

## Overview

Intelligent Log Forensics is a web-based investigation platform for processing
application and infrastructure logs. It converts heterogeneous evidence into a
consistent analytical model and presents operational failures, security risks,
MITRE ATT&CK mappings, correlated incidents, and downloadable reports.

The platform is designed for:

- Security analysts investigating suspicious application activity.
- Developers diagnosing API, backend, and frontend failures.
- Operations teams monitoring reliability and response-time degradation.
- Academic teams demonstrating practical log analysis and cyber forensics.
- Small organizations that need focused analysis without operating a full SIEM.

The application uses PostgreSQL as its primary database. SQLite is used only by
the isolated automated test configuration.

## Business Problem

Modern applications produce logs from authentication services, API gateways,
web servers, databases, frontend runtimes, and background workers. These logs
often use different field names and formats. Manual analysis is slow because:

- Important evidence is distributed across large files.
- Timestamps, identities, status codes, and endpoints are inconsistent.
- Operational failures and security events are mixed together.
- Individual events do not explain the complete incident sequence.
- Raw evidence rarely includes remediation guidance.
- Traditional viewers display text but do not interpret its significance.

Enterprise SIEM products solve parts of this problem but may be too expensive,
complex, or infrastructure-heavy for small teams and academic environments.

## Solution

Intelligent Log Forensics provides an end-to-end evidence workflow:

1. Accept CSV, JSON, TXT, and LOG files.
2. Validate the uploaded evidence.
3. Parse records according to their source format.
4. Normalize fields into a common schema.
5. Measure data quality and application health.
6. Extract useful behavioral and operational features.
7. Apply explainable risk detection rules.
8. Map security findings to selected MITRE ATT&CK techniques.
9. Correlate related findings into incident timelines.
10. Display live dashboard analytics through JSON APIs.
11. Generate a downloadable PDF forensic report.

## Core Capabilities

| Capability | Description |
| --- | --- |
| Multi-format ingestion | Processes CSV, JSON, newline JSON, key-value text, and common web access log records. |
| Schema normalization | Maps alternate field names such as `ip`, `client_ip`, `remote_addr`, `path`, `url`, and `route`. |
| Data quality profiling | Measures validity, duplicates, missing timestamps, and missing source addresses. |
| Health assessment | Scores server failures and slow application responses. |
| Explainable detection | Every finding includes a category, severity, score, reason, evidence, and recommendation. |
| Security mapping | Maps applicable findings to MITRE ATT&CK tactics and techniques. |
| Incident correlation | Groups related findings by source identity and risk category. |
| Evidence exploration | Provides searchable and filterable normalized log tables. |
| Live analytics | Uses JSON endpoints and Chart.js without full-page dashboard refreshes. |
| PDF reporting | Produces a portable report with scores, findings, ATT&CK mappings, and actions. |
| Access control | Uses Flask-Login and ownership checks to isolate analyst data. |
| PostgreSQL persistence | Stores users, uploads, evidence, findings, mappings, incidents, and reports. |

## Technology Stack

### Backend

- Python 3.10 or newer
- Flask 3
- Flask-SQLAlchemy
- Flask-Login
- Werkzeug password hashing
- psycopg2 PostgreSQL driver
- python-dotenv
- ReportLab

### Frontend

- Jinja2 server-rendered templates
- Semantic HTML
- Responsive CSS
- JavaScript Fetch API
- Chart.js
- Lucide icons

### Data and Infrastructure

- PostgreSQL 17
- SQLAlchemy ORM
- Local filesystem evidence and report storage
- Python `unittest` test suite

## System Architecture

The application follows a layered modular architecture.

```text
Browser / Analyst Interface
            |
            v
Jinja Page Routes + JSON API Routes
            |
            v
Application Service Layer
            |
            v
Forensic Engine Layer
            |
            v
Repository / SQLAlchemy Layer
            |
            v
PostgreSQL Database + Local Evidence Storage
```

### Frontend Layer

Renders authentication, dashboard, upload, evidence, incident, and report views.
JavaScript requests dashboard metrics from protected API routes and updates charts
without reloading the full page.

### Route Layer

Flask blueprints separate authentication, uploads, dashboards, logs, incidents,
reports, and APIs. Routes validate requests and delegate processing to services.

### Service Layer

Services coordinate complete workflows such as saving an upload, running the
analysis engines, persisting results, preparing dashboard metrics, and producing
PDF reports.

### Engine Layer

Engines contain focused forensic logic:

- Parsing
- Normalization
- Data quality scoring
- Feature extraction
- Rule-based risk detection
- ML-compatible classification interface
- Anomaly detection interface
- MITRE mapping
- Timeline correlation
- Recommendation generation

### Persistence Layer

SQLAlchemy models define the relational data model. Repository modules provide a
location for reusable database access logic. PostgreSQL stores all structured
application state.

### Storage Layer

Uploaded evidence is stored under `instance/uploads`. Generated PDF reports are
stored under `instance/reports`. These runtime files are excluded from Git.

## Project Structure

```text
MAJOR-PROJECT/
|-- app/
|   |-- engines/                 # Parsing and forensic intelligence logic
|   |-- knowledge_base/          # Local MITRE ATT&CK mapping data
|   |-- models/                  # SQLAlchemy entities
|   |-- repositories/            # Reusable database queries
|   |-- routes/                  # Page and JSON API blueprints
|   |-- services/                # Business workflow orchestration
|   |-- static/
|   |   |-- css/                 # Application visual system
|   |   `-- js/                  # Dashboard and upload behavior
|   |-- templates/               # Jinja2 interface templates
|   |-- utils/                   # Validation, security, and response helpers
|   |-- __init__.py              # Flask application factory
|   `-- extensions.py            # Shared Flask extensions
|-- instance/
|   |-- reports/                 # Generated PDF reports
|   `-- uploads/                 # Uploaded evidence files
|-- sample_logs/                 # Demonstration evidence
|-- scripts/
|   `-- setup_postgres.ps1       # PostgreSQL database initializer
|-- tests/                       # Automated application tests
|-- .env.example                 # Configuration template
|-- config.py                    # Runtime configuration
|-- requirements.txt             # Python dependencies
|-- run.py                       # Development entry point
`-- README.md                    # Technical documentation
```

## Processing Workflow

```text
Upload
  -> Extension and size validation
  -> Secure filename generation
  -> File metadata persistence
  -> Format-specific parsing
  -> Common-schema normalization
  -> Data quality analysis
  -> Feature extraction
  -> Explainable risk detection
  -> MITRE ATT&CK mapping
  -> Incident correlation
  -> PostgreSQL transaction commit
  -> Dashboard and evidence presentation
  -> Optional PDF report generation
```

The upload state progresses through:

- `uploaded`: metadata exists and processing has not started.
- `processing`: forensic engines are running.
- `completed`: evidence and analytical results were persisted successfully.
- `failed`: processing stopped and `error_message` contains diagnostic details.

## Feature Reference

### Authentication

The application creates a demonstration analyst during first-time database
initialization when no user exists:

```text
Email: analyst@example.com
Password: analyst123
```

Change or remove this account before any non-development deployment.

### File Upload and Validation

Accepted extensions:

- `.csv`
- `.json`
- `.txt`
- `.log`

The default maximum upload size is 10 MB. Uploaded names are sanitized, and the
stored filename uses a generated UUID to prevent collisions.

### Parsing

The parser supports:

- CSV records with a header row.
- JSON arrays of objects.
- JSON objects containing `logs`, `events`, `records`, or `data` arrays.
- One JSON object per line.
- Common Apache-style access log records.
- Key-value records such as `ip=10.0.0.1 status=401`.
- Timestamped plain-text application messages.

### Normalization

Source fields are converted into this shared structure:

| Canonical field | Example aliases |
| --- | --- |
| `timestamp` | `time`, `datetime`, `date`, `@timestamp`, `created_at` |
| `source_ip` | `ip`, `ip_address`, `client_ip`, `remote_addr`, `host` |
| `user_identifier` | `user`, `user_id`, `username`, `email` |
| `method` | `http_method`, `verb` |
| `endpoint` | `path`, `url`, `route`, `request_uri` |
| `status_code` | `status`, `http_status`, `response_code` |
| `response_time` | `latency`, `duration`, `elapsed`, `response_ms` |
| `event_type` | `event`, `type`, `action` |
| `level` | `severity`, `log_level` |
| `message` | `msg`, `error`, `description`, `detail` |

Response times are normalized to milliseconds. ISO timestamps and common access
log timestamp formats are converted to Python datetimes before persistence.

### Data Quality Score

The score begins at 100 and applies weighted penalties for:

- Invalid records
- Duplicate raw records
- Missing timestamps
- Missing source IP addresses

The score is bounded between 0 and 100. It measures evidence usability, not the
security state of the application.

### Application Health Score

The health score evaluates operational symptoms, particularly:

- HTTP 5xx responses
- Response times at or above 1000 ms

It is intentionally separate from the security risk score. A slow endpoint is
an operational concern and should not automatically receive a MITRE mapping.

### Evidence Explorer

The evidence view displays normalized records with:

- Timestamp
- Source address
- HTTP request or event name
- Status code
- Response time
- Risk assessment

Analysts can search raw evidence and endpoints or filter by status code.

### Incident Timeline

Risk events are grouped by source IP and category. Each incident records:

- Incident title
- Source IP
- Affected user when available
- Start and end times
- Aggregate risk score
- Severity
- Summary
- Chronologically ordered events
- Associated MITRE tactic and technique

### Dashboard

The dashboard displays:

- Total normalized records
- Number of risk events
- Number of correlated incidents
- Average risk score
- Risk category distribution
- MITRE tactic distribution
- Seven-day error trend
- Highest-risk source IP addresses
- Recent upload history

### PDF Reports

The generated report includes:

- Evidence source name
- Log count
- Data quality score
- Application health score
- Risk event count
- Incident count
- Prioritized findings
- MITRE ATT&CK mappings
- Suggested remediation steps

## Risk Classification

Detection is deterministic and explainable. This makes each score reproducible
and suitable for academic evaluation.

| Category | Example signal | Typical action |
| --- | --- | --- |
| Authentication Risk | Repeated HTTP 401 or 403 responses | Rate-limit login, enable MFA, review identity and IP. |
| API Route Risk | Repeated HTTP 404 access from one source | Review probing behavior and block confirmed automation. |
| Security Risk | Explicit XSS, SQL injection, traversal, or unauthorized access indicator | Preserve evidence and investigate immediately. |
| Operational Risk | HTTP 5xx response | Inspect stack traces, dependencies, and deployments. |
| Performance Risk | Response time of 1000 ms or more | Profile endpoints and inspect downstream latency. |
| Frontend Runtime Risk | JavaScript, hydration, uncaught, or TypeError signal | Reproduce with source maps and improve client telemetry. |
| Warning | Error, critical, or fatal log level | Review context and monitor recurrence. |

### Severity Thresholds

| Score | Severity |
| --- | --- |
| 80-100 | Critical |
| 60-79.9 | High |
| 40-59.9 | Medium |
| Below 40 | Low |

The interfaces in `ml_engine.py` and `anomaly_engine.py` allow trained models or
advanced statistical detectors to be introduced without changing route logic.

## MITRE ATT&CK Mapping

Only security-relevant findings receive ATT&CK mappings.

| Risk category | Tactic | Technique |
| --- | --- | --- |
| Authentication Risk | Credential Access | T1110 - Brute Force |
| API Route Risk | Discovery | T1595 - Active Scanning |
| Security Risk | Initial Access | T1190 - Exploit Public-Facing Application |

Mappings are deliberately conservative. Operational failures, performance
degradation, and frontend runtime errors are not forced into ATT&CK categories.

The local mapping knowledge base is stored at:

```text
app/knowledge_base/mitre_attack_mapping.json
```

## Database Design

PostgreSQL stores the following entities.

### `users`

Stores analyst identities and access roles.

| Column | Purpose |
| --- | --- |
| `id` | Primary key |
| `name` | Display name |
| `email` | Unique login identifier |
| `password_hash` | Werkzeug-generated password hash |
| `role` | `analyst` or `admin` |
| `created_at` | Account creation timestamp |
| `last_login` | Most recent successful login |
| `is_active_account` | Account availability flag |

### `uploaded_files`

Stores evidence metadata, ownership, processing state, and record totals.

### `normalized_logs`

Stores normalized evidence and the original raw record. Indexed fields include
`file_id` and `timestamp` for efficient investigation queries.

### `data_quality_results`

Stores one quality profile per uploaded file, including quality and health scores.

### `risk_events`

Stores categorized findings with scores, severity, reason, evidence, and advice.

### `mitre_mappings`

Stores the optional ATT&CK mapping associated with a security risk event.

### `incidents`

Stores correlated incident summaries and overall risk information.

### `incident_events`

Stores chronological event details associated with an incident.

### `reports`

Stores generated report metadata and filesystem locations.

### Relationships

```text
users 1 ------ * uploaded_files
uploaded_files 1 ------ * normalized_logs
uploaded_files 1 ------ 1 data_quality_results
uploaded_files 1 ------ * risk_events
normalized_logs 1 ------ * risk_events
risk_events 1 ------ 0..1 mitre_mappings
uploaded_files 1 ------ * incidents
incidents 1 ------ * incident_events
uploaded_files 1 ------ * reports
```

Deleting an upload through the ORM is configured to cascade to its normalized
logs, quality result, risk events, incidents, and report records.

## Installation

### Prerequisites

- Windows 10/11, Linux, or macOS
- Python 3.10+
- PostgreSQL 17
- Git
- A modern browser

### Clone and Create an Environment

```powershell
git clone <repository-url>
cd MAJOR-PROJECT
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

For Command Prompt:

```bat
.venv\Scripts\activate.bat
```

For Linux or macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## PostgreSQL Setup

### Automated Windows Setup

PostgreSQL 17 must be installed and its service must be running. Then execute:

```powershell
.\scripts\setup_postgres.ps1 -Password "your-postgresql-password"
```

Optional parameters:

```powershell
.\scripts\setup_postgres.ps1 `
  -Password "your-postgresql-password" `
  -User "postgres" `
  -Database "intelligent_log_forensics" `
  -Port 5432
```

The script:

1. Finds `psql.exe` on `PATH` or under `C:\Program Files\PostgreSQL`.
2. Authenticates against the PostgreSQL server.
3. Creates `intelligent_log_forensics` if it does not exist.
4. Writes the application connection URL to `.env`.
5. Leaves table creation to the Flask application factory.

### Manual PostgreSQL Setup

Open pgAdmin Query Tool or `psql` and run:

```sql
CREATE DATABASE intelligent_log_forensics;
```

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```dotenv
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/intelligent_log_forensics
```

If the password contains reserved URL characters such as `@`, `:`, `/`, or `#`,
URL-encode it. The setup script performs this encoding automatically.

### Verify PostgreSQL

```powershell
Get-Service postgresql*
```

Expected state:

```text
Status   Name
------   ----
Running  postgresql-x64-17
```

The application invokes `db.create_all()` at startup. This creates missing tables
but does not replace a versioned migration strategy for production upgrades.

## Configuration

Configuration is loaded from environment variables and `.env` by `config.py`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FLASK_APP` | No | `run.py` | Flask CLI application entry point |
| `SECRET_KEY` | Yes in production | Development placeholder | Session signing key |
| `DATABASE_URL` | Yes | Local PostgreSQL URL | SQLAlchemy PostgreSQL connection URL |
| `UPLOAD_FOLDER` | No | `instance/uploads` | Uploaded evidence directory |
| `REPORT_FOLDER` | No | `instance/reports` | Generated report directory |
| `MAX_CONTENT_LENGTH` | No | `10485760` | Maximum request size in bytes |

Example:

```dotenv
FLASK_APP=run.py
SECRET_KEY=replace-with-a-long-random-value
DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/intelligent_log_forensics
UPLOAD_FOLDER=instance/uploads
REPORT_FOLDER=instance/reports
MAX_CONTENT_LENGTH=10485760
```

Generate a secure secret key:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Never commit `.env`. It is excluded by `.gitignore`.

## Running the Application

### Development Server

```powershell
python run.py
```

Open:

```text
http://127.0.0.1:5000
```

### Flask CLI

```powershell
$env:FLASK_APP = "run.py"
flask run
```

### Initial Login

```text
Email: analyst@example.com
Password: analyst123
```

### Demonstration Dataset

Upload:

```text
sample_logs/security_incident.csv
```

It contains authentication failures, route probing, backend failures, slow API
responses, a frontend runtime error, and a normal request.

## User Guide

### Analyze Evidence

1. Sign in.
2. Select **Analyze logs**.
3. Drop or browse for a supported file.
4. Select **Start analysis**.
5. Review quality, health, findings, and normalized evidence.

### Filter Evidence

1. Open a completed upload.
2. Enter an IP, endpoint, message, or raw evidence term.
3. Optionally select a status code.
4. Select **Filter**.

### Review Incidents

1. Open an analysis.
2. Select **Incidents**.
3. Review severity, aggregate risk, source, event order, and ATT&CK mappings.

### Generate a Report

1. Open an analysis.
2. Select **Report**.
3. Review the report preview.
4. Select **Download PDF**.

## API Reference

All API endpoints require an authenticated Flask session. Unauthorized requests
are redirected to `/auth/login`. Analysts can access only their own upload IDs;
administrators can access all uploads.

### Dashboard Summary

```http
GET /api/dashboard/summary
```

Response:

```json
{
  "total_logs": 1250,
  "risk_events": 43,
  "incidents": 8,
  "average_risk": 68.4
}
```

### Risk Distribution

```http
GET /api/dashboard/risk-distribution
```

Response:

```json
{
  "Authentication Risk": 12,
  "Operational Risk": 19,
  "Performance Risk": 7
}
```

### MITRE Statistics

```http
GET /api/dashboard/mitre-stats
```

Response:

```json
{
  "Credential Access": 8,
  "Discovery": 4
}
```

### Error Trends

```http
GET /api/dashboard/error-trends
```

Response:

```json
{
  "labels": ["2026-06-26", "2026-06-27", "2026-06-28"],
  "values": [3, 7, 4]
}
```

The production response contains seven daily labels and values.

### Top Risky IP Addresses

```http
GET /api/dashboard/top-risky-ips
```

Response:

```json
[
  {
    "ip": "203.0.113.42",
    "events": 4,
    "score": 82.0
  }
]
```

### Incident Timeline

```http
GET /api/dashboard/timeline/{file_id}
```

Response:

```json
[
  {
    "id": 1,
    "title": "Authentication Risk from 203.0.113.42",
    "severity": "Critical",
    "score": 82.0,
    "start": "2026-07-01T10:00:00",
    "end": "2026-07-01T10:00:13"
  }
]
```

### Upload Status

```http
GET /api/upload/status/{file_id}
```

Response:

```json
{
  "status": "completed",
  "total_records": 13,
  "error": null
}
```

### Filter Logs

```http
GET /api/logs/filter?file_id=1&status=401
```

Query parameters:

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `file_id` | Integer | Yes | Uploaded file identifier |
| `status` | Integer | No | Exact HTTP status code |

Response:

```json
[
  {
    "id": 1,
    "timestamp": "2026-07-01T10:00:00",
    "source_ip": "203.0.113.42",
    "endpoint": "/auth/login",
    "status_code": 401,
    "response_time": 142.0,
    "message": "Invalid password"
  }
]
```

### Incidents

```http
GET /api/incidents/{file_id}
```

Response:

```json
[
  {
    "id": 1,
    "title": "Authentication Risk from 203.0.113.42",
    "severity": "Critical",
    "score": 82.0,
    "summary": "4 related authentication risk event(s) were correlated."
  }
]
```

### Page and Action Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/auth/login` | Authenticate a user |
| `GET` | `/auth/logout` | End the current session |
| `GET` | `/dashboard` | Render the analyst dashboard |
| `GET` | `/admin/dashboard` | Redirect administrators to dashboard |
| `GET`, `POST` | `/upload` | Render intake or process evidence |
| `GET` | `/upload/history` | Show accessible uploads |
| `GET` | `/logs/{file_id}` | Show normalized evidence |
| `GET` | `/incidents/{file_id}` | Show correlated timelines |
| `GET` | `/reports/{file_id}` | Preview report content |
| `POST` | `/reports/generate/{file_id}` | Generate and download a PDF |
| `GET` | `/reports/download/{report_id}` | Download an existing report |

### Error Behavior

- `302`: unauthenticated request redirected to login.
- `403`: authenticated user attempted to access another analyst's data.
- `404`: upload or report does not exist.
- `413`: upload exceeds `MAX_CONTENT_LENGTH`.
- `500`: unexpected parsing, persistence, or report error.

## Authentication and Authorization

Flask-Login manages session authentication. Passwords are never stored directly;
Werkzeug stores salted password hashes.

Authorization rules:

- Analysts can upload files and access their own evidence, incidents, and reports.
- Administrators can access records belonging to all users.
- Ownership is checked before returning page or API data.
- API routes use the same authenticated session as the web interface.

The current project contains role-aware access controls but not a complete admin
user-management interface.

## Testing

Run the complete test suite:

```powershell
python -m unittest discover -s tests -v
```

Run syntax compilation:

```powershell
python -m compileall app tests run.py config.py
```

The tests use an isolated in-memory SQLite database. This prevents test data from
modifying the PostgreSQL development database while retaining SQLAlchemy behavior.

Current automated coverage verifies:

- Initial demonstration user creation
- Successful authentication
- Dashboard rendering
- Multipart evidence upload
- CSV parsing and normalization
- Authentication and operational risk detection
- Incident correlation
- Dashboard summary API output
- Incident API output

For release validation, also perform a PostgreSQL integration smoke test with a
dedicated test database.

## Operational Guidance

### Runtime Directories

Ensure the application process can write to:

```text
instance/uploads
instance/reports
```

### Database Backup

Example PostgreSQL backup:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
  -U postgres `
  -d intelligent_log_forensics `
  -F c `
  -f intelligent_log_forensics.backup
```

Restore into an existing empty database:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" `
  -U postgres `
  -d intelligent_log_forensics `
  --clean `
  intelligent_log_forensics.backup
```

### Evidence Retention

Database records and filesystem evidence must be retained or deleted together.
Removing a database upload record does not automatically erase the original file
or generated PDF from disk. Production deployments should add an audited retention
job with legal and organizational retention periods.

### Logging and Monitoring

For production, forward application logs to a centralized destination and track:

- HTTP error rate
- Upload failure rate
- Processing duration
- Database connection saturation
- Evidence storage utilization
- Authentication failures
- Report generation failures

## Troubleshooting

### PostgreSQL Connection Refused

Check the service:

```powershell
Get-Service postgresql*
Start-Service postgresql-x64-17
```

Confirm the expected port:

```powershell
Get-NetTCPConnection -LocalPort 5432
```

### Password Authentication Failed

Verify the username and password using `psql`:

```powershell
$env:PGPASSWORD = "your-password"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
  -h localhost -p 5432 -U postgres -d postgres -c "SELECT version();"
Remove-Item Env:PGPASSWORD
```

Then rerun:

```powershell
.\scripts\setup_postgres.ps1 -Password "your-password"
```

### Database Does Not Exist

```sql
CREATE DATABASE intelligent_log_forensics;
```

Or use the setup script.

### Password Contains Special Characters

Use the setup script, which URL-encodes the password. If editing `.env` manually,
encode reserved characters before placing the password in `DATABASE_URL`.

### Port 5000 Is Already in Use

```powershell
$env:FLASK_RUN_PORT = 5001
flask run
```

Then open `http://127.0.0.1:5001`.

### Upload Is Rejected

Confirm:

- The extension is CSV, JSON, TXT, or LOG.
- The file is below `MAX_CONTENT_LENGTH`.
- The upload directory is writable.
- CSV files contain a header row.
- JSON content is valid UTF-8 JSON or newline JSON.

### Dashboard Charts Are Empty

- Analyze at least one evidence file.
- Confirm dashboard API requests return HTTP 200.
- Ensure the browser can load Chart.js.
- Check the browser developer console for network errors.

### PDF Generation Fails

- Confirm ReportLab is installed.
- Confirm `instance/reports` is writable.
- Check that the associated upload still exists.
- Review the Flask console for the ReportLab exception.

## Security Considerations

Before deploying beyond local development:

1. Replace the development `SECRET_KEY`.
2. Change or remove the demonstration analyst password.
3. Serve the application only over HTTPS.
4. Add CSRF protection to forms.
5. Apply login rate limiting and account lockout policies.
6. Validate uploaded content using MIME and structural checks, not extension alone.
7. Store evidence outside the publicly served static directory.
8. Restrict filesystem permissions for uploads and reports.
9. Use a dedicated PostgreSQL role with minimum privileges.
10. Rotate database credentials and secrets.
11. Add malware scanning for uploaded evidence where required.
12. Add audit logs for login, upload, report, and administrative actions.
13. Configure secure session cookies.
14. Add security headers through the application or reverse proxy.
15. Establish evidence retention and deletion policies.

Recommended production cookie settings:

```python
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
```

## Scalability Roadmap

### Current Architecture

- Flask application factory
- Jinja2 frontend
- Synchronous processing
- PostgreSQL persistence
- Local filesystem storage
- Pollable JSON APIs

### Recommended Growth Path

#### Background Processing

Move parsing and analysis into Celery or RQ workers. Use Redis as the task broker,
and preserve the existing `processing_status` API for progress updates.

#### Object Storage

Replace local uploads and report storage with S3-compatible object storage. Store
object keys and integrity hashes in PostgreSQL.

#### Database Migrations

Add Flask-Migrate and Alembic before applying schema changes to shared databases.

#### Detection Framework

Introduce versioned detection rules, trained scikit-learn pipelines, feature model
metadata, confidence calibration, and analyst feedback.

#### Near Real-Time Updates

Replace periodic dashboard fetches with Server-Sent Events or WebSockets where
operational requirements justify persistent connections.

#### API Separation

Expose a versioned REST API and move the frontend to a separate client only when
independent deployment or external integration becomes necessary.

#### Enterprise Identity

Add OpenID Connect or SAML, organization tenancy, granular permissions, and audit
logging for regulated environments.

## Development Guidelines

### Adding a Parser

1. Add format detection in `app/engines/parser_engine.py`.
2. Return a list of dictionaries.
3. Preserve the original record in `raw_log` where possible.
4. Add representative fixtures and tests.
5. Confirm malformed records fail safely.

### Adding a Normalized Field Alias

Update `ALIASES` in `app/engines/normalizer_engine.py`. Keep canonical names stable
because database models, templates, and detection rules depend on them.

### Adding a Detection Rule

1. Add the condition and explanation in `rule_engine.py`.
2. Select an appropriate category and score.
3. Add a remediation recommendation.
4. Add MITRE mapping only when the behavior is security-relevant.
5. Add positive and negative tests to prevent false-positive regressions.

### Adding an API Endpoint

1. Place dashboard or evidence JSON routes in `api_routes.py`.
2. Require authentication.
3. Enforce upload ownership.
4. Return stable, documented JSON fields.
5. Add tests for successful, unauthorized, and missing-resource cases.

### Code Quality Expectations

- Keep routes thin and workflows in services.
- Keep forensic decisions in engines.
- Avoid database queries inside templates.
- Preserve raw evidence for explainability.
- Keep operational and security classifications separate.
- Use parameterized ORM queries.
- Add tests proportional to behavioral risk.

## Known Limitations

- Processing is synchronous and can delay large uploads.
- The rule engine is a transparent baseline, not a trained production model.
- Incident grouping currently uses source IP and risk category.
- The selected MITRE knowledge base is intentionally limited.
- The admin route does not yet provide full user administration.
- The dashboard uses periodic API requests rather than streaming updates.
- Runtime evidence uses local filesystem storage.
- `db.create_all()` does not provide versioned schema migrations.
- File validation currently relies primarily on extension and parser behavior.
- Automated tests use SQLite; PostgreSQL integration tests should be added for CI.

## Glossary

| Term | Meaning |
| --- | --- |
| Evidence | A raw or normalized log record used in analysis. |
| Finding | A risk event generated by a detection rule. |
| Incident | A correlated group of related findings. |
| Normalization | Conversion of source-specific fields into a common schema. |
| Data quality score | Measure of evidence completeness and consistency. |
| Health score | Measure of application reliability and performance. |
| Risk score | Numeric estimate of finding importance from 0 to 100. |
| MITRE ATT&CK | Knowledge base of adversary tactics and techniques. |
| Tactic | The adversary's high-level objective. |
| Technique | The method used to achieve an adversary objective. |
| SIEM | Security Information and Event Management platform. |

---

## Project Status

The repository contains a functional academic and small-team MVP. Authentication,
multi-format processing, quality assessment, explainable detection, ATT&CK mapping,
incident correlation, dashboard analytics, and PDF reporting are implemented.

The recommended next production milestones are PostgreSQL integration testing,
Flask-Migrate adoption, CSRF protection, background processing, and strengthened
upload validation.
