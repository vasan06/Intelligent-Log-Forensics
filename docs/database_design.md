# Final Database Design

## Persistence contract

PostgreSQL is accessed exclusively through `psycopg2` repository functions using `%s` parameters.
There is no ORM or SQLAlchemy dependency. Migrations are numbered SQL files and recorded atomically in
`schema_migrations`. Foreign keys use cascading deletion only for evidence-owned child records.

## Tables

| Table | Purpose | Primary/important constraints |
|---|---|---|
| `schema_migrations` | Applied migration ledger | migration filename primary key |
| `users` | Analyst identity and Flask/JWT login | unique email; hashed password; active flag |
| `uploaded_files` | One uploaded or memory-generated evidence batch | owner FK; status/counts; SHA-256 `content_hash` |
| `normalized_logs` | Canonical application-log schema | evidence FK; timestamp/source/status/latency indexes |
| `data_quality_results` | Completeness, duplication, quality, and health | one-to-one unique evidence FK |
| `risk_events` | Explainable rule/ML detections and analyst feedback | evidence/log/reviewer FKs; non-null taxonomy slug; source/source-status checks |
| `mitre_mappings` | ATT&CK tactic/technique evidence | unique one-to-one risk-event FK |
| `incidents` | Correlated source/category timelines | evidence FK; score/severity/time range |
| `incident_events` | Ordered evidence within an incident | incident FK; event time/description/MITRE text |
| `reports` | Generated PDF audit records | evidence and generating-user FKs |
| `model_retraining_runs` | Version, label count, F1, and JSON metrics | append-only timestamped run history |

## Migration sequence

1. `001_initial.sql` creates the core evidence graph and indexes.
2. `002_add_feedback.sql` adds rule/ML source tags, upload/generated source status, taxonomy/feedback fields,
   and retraining history.
3. `003_add_file_hash.sql` adds indexed SHA-256 integrity storage.
4. `004_enforce_attack_taxonomy.sql` backfills legacy names/slugs and enforces non-null taxonomy tagging.

## Security and integrity

- Values are always passed separately from SQL text; no user-controlled value is string-interpolated.
- Ownership checks occur before evidence APIs, reports, labels, and timeline access.
- Uploaded bytes are SHA-256 hashed before parsing. Successful temporary files are deleted.
- Risk events retain source, reason, evidence excerpt, recommendation, attack type, and review provenance.
- Application transactions roll back all derived rows together on processing failure.
