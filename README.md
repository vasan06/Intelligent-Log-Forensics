# Intelligent Log Forensics (ILF)

**Intelligent Log Forensics (ILF)** is a web-based log investigation platform designed to help users ingest and explore infrastructure logs, examine suspicious activity with machine-learning-assisted analysis, relate findings to the MITRE ATT&CK knowledge base, and generate forensic reports.

- **Live Application:** https://intelligent-log-forensics.onrender.com
- **Source Repository:** https://github.com/vasan06/Intelligent-Log-Forensics
- **Security Policy:** [SECURITY.md](SECURITY.md)
- **License:** [MIT License](LICENSE)

> **Important:** ILF analysis and ATT&CK mappings are investigation aids, not proof of compromise. Always validate findings against the original evidence. Use only logs and data you are authorized to access.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Investigation Workflow](#investigation-workflow)
- [Technology Stack](#technology-stack)
- [Application Pages](#application-pages)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Local Setup](#local-setup)
- [Configuration](#configuration)
- [Docker Deployment](#docker-deployment)
- [API Overview](#api-overview)
- [Security and Privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [License and Acknowledgements](#license-and-acknowledgements)

## Overview

Security, infrastructure, and application logs can contain large volumes of events that are difficult to investigate manually. ILF brings log ingestion, exploration, machine-learning-assisted analysis, MITRE ATT&CK context, and report generation into one web application.

The project uses a Python Flask backend and a multi-page frontend built with HTML, CSS, and JavaScript. SQLAlchemy provides database access, while the configured database connection determines where application data is stored. PostgreSQL is included in the Docker Compose deployment configuration.

ILF is designed to support learning, demonstrations, and analyst-assisted investigation. It does not independently establish whether an event is malicious or attribute an incident to a specific actor.

## Key Features

### 1. Log Ingestion and Exploration

- Upload supported log data for investigation.
- Explore ingested records through the log exploration interface.
- Inspect event information and available fields.
- Use supported simulated log streams for demonstrations and testing.
- Track processing for supported upload workflows.

### 2. Machine-Learning-Assisted Analysis

- Run the analysis methods implemented in the backend.
- Review model-generated findings through the analysis interface.
- Examine configured algorithms and analysis results.
- Use findings to prioritize further investigation.

Machine-learning output may contain false positives or false negatives. Findings should be validated against the underlying log evidence.

### 3. MITRE ATT&CK Integration

- Browse the locally available MITRE ATT&CK catalogue.
- Review relevant tactics and techniques.
- Examine technique context associated with application findings.
- Use mappings to guide security investigation and triage.

ATT&CK mappings provide context, not definitive proof that a technique was used. MITRE ATT&CK is maintained by The MITRE Corporation; this project is not affiliated with or endorsed by MITRE.

### 4. Dashboard and Reporting

- Review dashboard summaries and available activity information.
- Generate forensic reports through supported workflows.
- Access report history where available.
- Download generated reports for documentation and further review.

### 5. User Accounts and Administration

- Register and authenticate user accounts.
- Access account and profile management features.
- Use supported password-recovery functionality when correctly configured.
- Restrict administrative operations to authorized administrators.

### 6. Background Processing

- Process supported uploads through the application's processing services.
- Use the background upload worker configured for Docker Compose deployments.

## Investigation Workflow

A typical investigation follows this workflow:

1. **Access the application** using an appropriately configured account.
2. **Ingest logs** by uploading authorized data or selecting a supported demonstration stream.
3. **Explore records** to understand available timestamps, sources, event details, and severity information.
4. **Run analysis** and review the generated findings.
5. **Review ATT&CK context** to identify potentially relevant tactics and techniques.
6. **Validate findings** against original logs and surrounding events.
7. **Generate a report** to document findings for further investigation or review.

Results depend on input quality, supported formats, available fields, model configuration, and runtime settings.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Python, Flask, Flask-CORS |
| Database access | SQLAlchemy |
| Database | PostgreSQL in the supplied Docker Compose configuration |
| Authentication | JWT, bcrypt, HTTP cookies |
| Machine learning | scikit-learn, NumPy |
| Report generation | ReportLab |
| Application server | Gunicorn |
| Containerization | Docker, Docker Compose |
| API testing | Postman collection |
| Automated testing support | pytest dependency |

Dependencies are declared in the root `requirements.txt` and `backend/requirements.txt`.

## Application Pages

The application includes the following user-facing routes:

| Route | Purpose |
|---|---|
| `/` | Public landing page |
| `/login` | Sign-in page |
| `/signin` | Sign-in page alias, if enabled by the application |
| `/signup` | Account registration |
| `/forgot-password` | Password recovery |
| `/dashboard` | Dashboard overview |
| `/live-monitor` | Live or simulated log monitoring |
| `/log-explorer` | Log ingestion and exploration |
| `/ml-analysis` | Machine-learning-assisted analysis |
| `/mitre-tracker` | Review mapped findings |
| `/mitre-catalog` | Browse the ATT&CK catalogue |
| `/reports` | Report generation and review |
| `/history` | Available activity history |
| `/profile` | Profile and account settings |
| `/admin` | Administrative tools |

Actual route availability and access permissions are determined by the current backend implementation.

## Architecture

```text
User Browser
     |
     | HTML, CSS, JavaScript
     v
Flask Application
(backend/app.py)
     |
     +-- Authentication and User Routes
     +-- Dashboard and Log Routes
     +-- ML Analysis Routes
     +-- MITRE ATT&CK Routes
     +-- Reporting Routes
     +-- Administration Routes
     |
     v
Backend Services
     |
     +-- Log Simulation
     +-- Upload Processing
     +-- ML Analysis
     +-- OTP / Email Support
     |
     v
SQLAlchemy Database Layer
     |
     v
Configured Database
(PostgreSQL in Docker Compose)
```

The Docker Compose setup also defines a background upload worker and a PostgreSQL service with persistent storage.

## Repository Structure

The following tree represents the project's tracked application structure. Generated files, local virtual environments, and runtime data are not included.

```text
Intelligent-Log-Forensics/
├── .dockerignore
├── .env.example
├── .gitignore
├── .vscode/
│   └── settings.json
├── API_TESTINGS/
│   └── ILF.postman_collection.json
├── Dockerfile
├── docker-compose.yml
├── LICENSE
├── README.md
├── SECURITY.md
├── requirements.txt
├── start.bat
├── start.sh
├── backend/
│   ├── __init__.py
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── upload_worker.py
│   ├── data/
│   │   └── mitre_catalog.json
│   ├── models/
│   │   ├── __init__.py
│   │   ├── log_analysis.py
│   │   ├── report.py
│   │   ├── session.py
│   │   ├── upload_job.py
│   │   ├── uploaded_file.py
│   │   └── user.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   ├── history.py
│   │   ├── logs.py
│   │   ├── mitre.py
│   │   ├── ml.py
│   │   ├── reports.py
│   │   └── user.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── log_simulator.py
│   │   ├── ml_service.py
│   │   ├── otp_service.py
│   │   └── upload_processing.py
│   └── requirements.txt
└── frontend/
    ├── admin.html
    ├── dashboard.html
    ├── forgot-password.html
    ├── history.html
    ├── landing.html
    ├── live-monitor.html
    ├── log-explorer.html
    ├── mitre-catalog.html
    ├── mitre-tracker.html
    ├── ml-analysis.html
    ├── profile.html
    ├── reports.html
    ├── signin.html
    ├── signup.html
    └── assets/
        ├── favicon.svg
        ├── css/
        │   ├── animations.css
        │   ├── components.css
        │   ├── dashboard.css
        │   ├── forgot-password.css
        │   ├── global.css
        │   ├── history.css
        │   ├── landing.css
        │   ├── live-monitor.css
        │   ├── log-explorer.css
        │   ├── mitre-catalog.css
        │   ├── mitre-tracker.css
        │   ├── ml-analysis.css
        │   ├── navbar.css
        │   ├── profile.css
        │   ├── reports.css
        │   ├── signin.css
        │   ├── signup.css
        │   └── tokens.css
        └── js/
            ├── admin.js
            ├── api.js
            ├── auth-guard.js
            ├── dashboard.js
            ├── history.js
            ├── landing.js
            ├── live-monitor.js
            ├── log-explorer.js
            ├── mitre-catalog.js
            ├── mitre-tracker.js
            ├── ml-analysis.js
            ├── navbar.js
            ├── page-session.js
            ├── profile.js
            ├── reports.js
            ├── signin.js
            ├── signup.js
            └── table-pagination.js
```

### Important Files

| File or Directory | Responsibility |
|---|---|
| `backend/app.py` | Flask application setup, route registration, and frontend serving |
| `backend/config.py` | Environment-based application configuration |
| `backend/database.py` | SQLAlchemy engine, database sessions, connectivity, and schema initialization |
| `backend/models/` | Database model definitions |
| `backend/routes/` | API endpoints grouped by feature |
| `backend/services/` | Log processing, ML analysis, simulation, and OTP services |
| `backend/data/mitre_catalog.json` | Local ATT&CK catalogue data |
| `frontend/` | HTML application pages |
| `frontend/assets/css/` | Stylesheets |
| `frontend/assets/js/` | Browser-side JavaScript |
| `API_TESTINGS/` | Postman API testing collection |
| `Dockerfile` | Container image build instructions |
| `docker-compose.yml` | Multi-service container configuration |
| `.env.example` | Environment configuration template |
| `SECURITY.md` | Security policy and vulnerability reporting |
| `LICENSE` | MIT License terms |

## Local Setup

### Prerequisites

- Python 3.10 or newer; the Docker image uses Python 3.12.
- Git, if cloning the repository.
- A database compatible with the configured SQLAlchemy connection. PostgreSQL is included in the Docker Compose setup.

### 1. Clone the Repository

```bash
git clone https://github.com/vasan06/Intelligent-Log-Forensics.git
cd Intelligent-Log-Forensics
```

### 2. Create a Virtual Environment

**Windows PowerShell**

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

**macOS / Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

### 3. Configure the Environment

Copy `.env.example` to `.env` and configure the values required by `backend/config.py` and the database initialization code.

At minimum, configure a secure JWT signing secret, database connection details, and strong administrator credentials appropriate for your environment.

**Never commit `.env`, real credentials, access tokens, database dumps, or sensitive logs. Do not use example or default credentials in a publicly accessible deployment.**

### 4. Start the Application

With the virtual environment activated and environment configuration complete:

```bash
python -m backend.app
```

Open the application at:

**http://localhost:5000/**

The application currently starts Flask in debug mode through its development entry point. Do not expose this development server directly to the public internet. Use a properly configured production WSGI server and deployment configuration for production use.

## Configuration

Configuration is managed by `backend/config.py`. Common configuration options include:

| Variable | Purpose |
|---|---|
| `ILF_JWT_SECRET` | JWT signing secret |
| `ILF_JWT_ALGORITHM` | JWT signing algorithm |
| `ILF_JWT_ACCESS_EXPIRES` | Access-token lifetime |
| `ILF_JWT_REFRESH_EXPIRES` | Refresh-token lifetime |
| `ILF_DB_HOST` | Database host |
| `ILF_DB_PORT` | Database port |
| `ILF_DB_NAME` | Database name |
| `ILF_DB_USER` | Database username |
| `ILF_DB_PASSWORD` | Database password |
| `ILF_DATABASE_URL` / `DATABASE_URL` | Full database connection URL, if supported by the active configuration |
| `ILF_ADMIN_EMAIL` | Configured administrator email |
| `ILF_ADMIN_PASSWORD` | Configured administrator password |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Additional administrator seed variables used by database initialization |
| `ILF_COOKIE_SECURE` | Secure-cookie setting for HTTPS deployments |
| `ILF_CORS_ORIGINS` | Allowed browser origins |
| `ILF_SMTP_HOST` | SMTP server host |
| `ILF_SMTP_PORT` | SMTP server port |
| `ILF_SMTP_USER` / `ILF_SMTP_PASS` | SMTP authentication settings |
| `ILF_SMTP_FROM` | Sender address for configured email delivery |
| `ILF_OTP_LENGTH` | One-time-code length |
| `ILF_OTP_EXPIRY_SECONDS` | One-time-code expiry period |
| `ILF_LOG_LEVEL` | Application logging level |
| `ILF_MAX_UPLOAD_BYTES` | Upload/request size limit in bytes |

The exact variables recognized by a given checkout are determined by the code and `.env.example`. Unrecognized variables do not automatically configure application behavior.

Keep secrets in local environment configuration or the hosting platform's secret manager. Never publish their values in this README.

## Docker Deployment

The repository provides a `Dockerfile` and `docker-compose.yml` for container-based deployment. The Compose configuration includes the web application, PostgreSQL, and the background upload worker.

After creating and configuring `.env`, run:

```bash
docker compose up --build -d
docker compose ps
```

To inspect service logs:

```bash
docker compose logs --tail=100
```

The configured PostgreSQL service uses a named volume for persistent data. Avoid `docker compose down -v` unless you intentionally want to remove volumes and understand the data-loss implications. Back up important data before maintenance.

For public deployments, configure secrets securely, enable HTTPS, restrict database access, and review the administrator initialization behavior before exposing the application.

## API Overview

API routes are grouped under `/api`. The table below describes the main functional areas; exact paths, request schemas, response formats, and authorization requirements are defined in the source under `backend/routes/`.

| API Area | Purpose |
|---|---|
| Health | Application and database connectivity checks |
| Authentication | Registration, sign-in, token/session operations, and password recovery |
| Dashboard | Dashboard summaries and statistics |
| Logs | Log ingestion, exploration, simulation, and processing |
| ML Analysis | Machine-learning-assisted analysis operations |
| MITRE ATT&CK | Catalogue access, technique details, and mappings |
| Reports | Report generation, retrieval, and downloads |
| User | Profile and account-related operations |
| Administration | Authorized administrative functions |

The Postman collection is available at `API_TESTINGS/ILF.postman_collection.json`. Configure its base URL and authentication values for your own environment before running requests.

Do not commit collections containing real tokens, credentials, private user data, or production log samples.

## Security and Privacy

Security is essential when working with log data and forensic reports.

- Use a unique, high-entropy JWT signing secret.
- Replace all example and default credentials with strong, unique values.
- Keep `.env` and private data out of version control.
- Use HTTPS for publicly accessible deployments.
- Enable secure cookies when the application is served over HTTPS.
- Restrict CORS to trusted origins.
- Limit database network access and use appropriate database credentials.
- Keep dependencies and the host/container environment updated.
- Restrict administrative privileges to authorized users.
- Treat uploaded logs, generated reports, and exports as potentially sensitive.
- Process only data you are authorized to collect and retain.
- Back up persistent data securely and verify restoration procedures.
- Never expose Flask's development debugger to the public internet.

### Reporting a Vulnerability

Please follow the reporting instructions in [SECURITY.md](SECURITY.md). Do not publish exploit details, credentials, sensitive logs, or private user data in a public issue. Provide enough non-sensitive information to help the maintainers understand and reproduce the issue safely.

## Troubleshooting

| Problem | Recommended Checks |
|---|---|
| Application fails to start | Confirm the virtual environment is active, dependencies are installed, and configuration is valid. |
| Database connection fails | Verify the database is running and the configured URL, host, port, database name, username, and password are correct. |
| Authentication returns `401` | Check the session or token, authentication headers/cookies, and account status. |
| API request returns `400` or `422` | Inspect the response body and compare the submitted fields and content type with the route implementation. |
| Upload fails | Check supported input formats, file size limits, database availability, and worker logs where applicable. |
| Upload returns `413` | Check application upload limits and any reverse-proxy or hosting-platform request-size limits. |
| Password-recovery email is not delivered | Verify SMTP configuration, sender settings, and provider delivery restrictions. |
| Docker services are unhealthy | Run `docker compose ps` and `docker compose logs --tail=100`; check environment configuration and database readiness. |
| Report download fails | Confirm generation completed and the authenticated account has permission to access the report. |

Before sharing troubleshooting information, remove credentials, tokens, sensitive log content, and private user data.

## Limitations

- Analysis quality depends on log format, data quality, available fields, and configured models.
- Machine-learning results can contain false positives and false negatives.
- ATT&CK mappings are contextual references and require human validation.
- Unsupported or malformed log inputs may fail or produce incomplete results.
- Email-based account recovery requires valid email-delivery configuration.
- Runtime behavior depends on environment configuration, database availability, and deployment settings.
- A successful local run or health check does not prove that every feature has passed end-to-end testing.

## Contributing

Contributions, bug reports, and documentation improvements are welcome.

1. Review the existing implementation before making changes.
2. Keep changes focused and document relevant configuration impacts.
3. Test the affected functionality before submitting a pull request.
4. Do not include credentials, private data, or sensitive log samples.
5. Describe the purpose of the change and the validation performed.
6. Report security-sensitive issues using the process documented in [SECURITY.md](SECURITY.md), rather than a public issue.

## License and Acknowledgements

ILF is distributed under the [MIT License](LICENSE). Refer to the `LICENSE` file for the complete licence terms.

The project uses MITRE ATT&CK catalogue data for investigation context. MITRE ATT&CK is maintained by The MITRE Corporation; inclusion of ATT&CK references does not imply endorsement.

Third-party libraries and components remain subject to their respective licences.
