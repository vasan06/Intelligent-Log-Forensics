# Intelligent Log Forensics

Self-hosted Flask/PostgreSQL log forensics with explainable rules, a three-model PyOD anomaly ensemble,
MITRE ATT&CK mapping, incident correlation, analyst feedback, live in-memory generation, SSE dashboard
updates, SHA-256 evidence integrity, and reproducible reporting.

The final implementation follows the examiner-corrected plan: **raw parameterized SQL through psycopg2
repositories, no ORM, and no CICIDS2017/network-flow data**.

## What the system does

- Accepts CSV, JSON, TXT, and LOG application evidence.
- Calculates SHA-256 before parsing and deletes successful temporary uploads.
- Normalizes timestamp, source IP, user, method, route, status, latency, event, level, and message.
- Extracts the runtime/training feature schema:
  `failed_login_count`, `status_code`, `route_frequency`, `response_time`, `error_frequency`,
  `request_rate`, `user_id`, and `ip_frequency`.
- Runs explainable rules plus PyOD Isolation Forest, One-Class SVM, and LOF.
- Combines normalized scores with `pyod.models.combination.average`; training-time bounds and threshold
  are persisted in the model artifact.
- Classifies every risk with one of 16 taxonomy slugs, a reason, remediation, and optional MITRE mapping.
- Correlates incident timelines and publishes committed events over Server-Sent Events.
- Uses deterministic Faker identities/IPs in normal, scan, bruteforce, and breach generator modes,
  without writing generated logs to disk.
- Records confirmed/false-positive labels and versioned retraining behavior.
- Exposes all database-backed UI values through `/api/v1/...` calls.

## Architecture

```text
Browser / generator
        |
Flask routes and services
        |
parse -> normalize -> shared features -> rules + PyOD ensemble
        |                              |
        +------ taxonomy / MITRE ------+
                       |
             correlation / trust
                       |
     psycopg2 repositories (parameterized SQL)
                       |
                  PostgreSQL
                       |
             JSON API + SSE -> UI
```

Detailed diagrams: [docs/architecture_diagrams.md](docs/architecture_diagrams.md).
Database design: [docs/database_design.md](docs/database_design.md).

## Repository layout

```text
app/
  engines/          parsing, normalization, features, rules, ML, MITRE, correlation
  services/         upload/live pipeline, generator, SSE broker, trust and reports
  repositories/     psycopg2 raw-SQL boundary
  knowledge_base/   16-entry taxonomy and MITRE knowledge
  routes/           Flask pages and /api/v1 JSON/SSE endpoints
  templates/        static labels plus API loading targets
database/
  schema.sql indexes.sql seed.sql migrations/
instance/
  uploads/ models/ reports/     # ignored runtime state
scripts/
  generate_training_data.py evaluate_models.py retrain_model.py
  run_migrations.py validate_migrations.py
  generate_report_artifacts.py build_final_report.py
docs/
  phase_XX_validation.txt architecture/database docs, artifacts, final Word report
tests/
  PostgreSQL integration and focused unit/static tests
```

## Requirements

- Python 3.12
- PostgreSQL 14+ (validated with PostgreSQL 16)
- Optional: Docker Desktop/Engine with Compose
- No paid API, subscription, or hosted service

Create `.env` from `.env.example`; replace every placeholder. Secrets must remain only in `.env` or
deployment environment variables.

```powershell
Copy-Item .env.example .env
python -m pip install -r requirements.txt
python scripts/run_migrations.py
python run.py
```

Demo session login created on an empty database:

```text
Email: analyst@example.com
Password: analyst123
```

This credential is for the local academic demonstration only.

## Docker Compose

Set these variables in `.env`: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `SECRET_KEY`,
`JWT_SECRET_KEY`, and the optional settings shown in `.env.example`.

```powershell
docker compose up --build
```

The app is available at `http://localhost:5000`. PostgreSQL, uploads, models, and reports use named
volumes. Successful upload artifacts self-delete; retained failure evidence is cleaned after the configured
retention period. One threaded Gunicorn worker is intentional because generator/SSE state is process-local.

## Training and evaluation

Generate labeled rows directly from the runtime generator schema:

```powershell
python scripts/generate_training_data.py --samples-per-mode 250
python scripts/evaluate_models.py
```

The evaluator uses a stratified 70/30 held-out split. It reports precision, recall, F1, false-positive rate,
and detection time for the shared-feature rule baseline, each model, and the PyOD average ensemble.

Latest reproducible controlled-set results:

| Model | Precision | Recall | F1 | FPR |
|---|---:|---:|---:|---:|
| Rules | 1.000 | 1.000 | 1.000 | 0.000 |
| Isolation Forest | 0.939 | 0.907 | 0.923 | 0.178 |
| One-Class SVM | 0.964 | 1.000 | 0.982 | 0.111 |
| LOF | 0.971 | 1.000 | 0.985 | 0.089 |
| Combined | 0.954 | 1.000 | 0.976 | 0.144 |

These numbers describe a controlled synthetic generator and **must not be presented as production accuracy**.

## Analyst feedback

```http
POST /api/v1/risk-events/{id}/label
Content-Type: application/json

{"label":"confirmed"}
```

Then retrain:

```powershell
python scripts/retrain_model.py
```

Artifacts are versioned under ignored `instance/models/`; label-count/F1 history is stored in PostgreSQL.
Additional labels are analyzed honestly and are not promised to improve F1 monotonically.

## Principal APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/login` | Cookie JWT login |
| POST | `/api/v1/auth/refresh` | Refresh access cookie |
| GET | `/api/v1/auth/me` | Session analyst data |
| GET | `/api/v1/uploads` | Evidence history |
| GET | `/api/v1/uploads/{id}` | Quality, risks, trust, and metadata |
| GET | `/api/v1/logs/filter` | Filtered normalized logs |
| GET | `/api/v1/incidents/{id}` | Correlated timelines |
| POST | `/api/v1/generator/start` | Start normal/scan/bruteforce/breach mode |
| POST | `/api/v1/generator/stop` | Stop background generator |
| GET | `/api/v1/stream/live` | SSE committed risk stream |
| POST | `/api/v1/risk-events/{id}/label` | Analyst feedback |
| GET | `/api/v1/model/labels-vs-f1` | Retraining behavior series |

Flask-Login remains functional for browser pages. JWT access and refresh values are HttpOnly SameSite
cookies; refresh uses CSRF protection. Auth/generator controls are rate-limited and CORS is same-origin.

## Tests and validation

```powershell
python -m unittest discover -s tests -v
python -m compileall -q app tests scripts run.py config.py
python scripts/validate_migrations.py
```

Application integration tests create a uniquely named PostgreSQL database, apply migrations, isolate each
test, and drop only that test database. They never use SQLite.

Each phase has a plain-text evidence record under `docs/phase_XX_validation.txt`. The records include
features, logic, commands, results, cross-checks, and any limitations.

## Final report

Regenerate every evaluation figure and diagram, then the Word document:

```powershell
python scripts/generate_report_artifacts.py
python scripts/build_final_report.py
```

Output: `docs/Intelligent_Log_Forensics_Final_Report.docx`.
Complete the student/institution/guide placeholders and institution-specific signatures before submission.

## Important limitations

- Synthetic modes are not a substitute for anonymized real application evidence.
- Generator ground truth simulates analyst labels.
- MITRE mappings are investigation hypotheses, not proof of attacker intent.
- Process-local SSE/generator state requires one application process; horizontal scale needs an external bus.
- The model artifact is runtime state and must be generated or retrained on a fresh deployment.
