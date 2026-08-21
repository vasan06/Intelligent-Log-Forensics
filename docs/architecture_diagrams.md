# Intelligent Log Forensics — Final Architecture Diagrams

These diagrams describe the final raw-SQL, repository-layer implementation.

## System Flow Diagram

```mermaid
flowchart LR
  A[Analyst browser] -->|Upload CSV/JSON/TXT/LOG| B[Flask routes]
  A -->|Start/stop mode| G[LiveTrigger background thread]
  G --> H[LogGenerator core]
  H --> P[Shared process_records pipeline]
  B --> U[Upload service: SHA-256 + temporary audit file]
  U --> N[Parser + normalizer]
  N --> P
  P --> F[Shared feature engine]
  F --> R[Explainable rule engine]
  F --> M[PyOD IF + OCSVM + LOF ensemble]
  R --> T[16-entry taxonomy + MITRE mapping]
  M --> T
  T --> C[Incident correlation + trust score]
  C --> Q[psycopg2 repositories / parameterized SQL]
  Q --> D[(PostgreSQL)]
  D --> API[/REST API v1/]
  Q --> SSE[/SSE event broker/]
  API --> A
  SSE --> A
  H -. offline labeled rows .-> E[Evaluation/retraining scripts]
  E --> V[(Versioned model artifacts)]
  V --> M
```

## DFD Level 0 — Context

```mermaid
flowchart LR
  Analyst[Analyst] -->|Credentials, evidence, labels, generator controls| System((Intelligent Log Forensics System))
  System -->|Dashboards, detections, incidents, reports, live events| Analyst
  System <-->|Structured evidence, feedback, metrics| PostgreSQL[(PostgreSQL)]
  System <-->|Versioned ensemble artifacts| Models[(Model Store)]
```

## DFD Level 1 — Major Processes

```mermaid
flowchart TB
  A[Analyst] --> P1((1. Authenticate))
  A --> P2((2. Ingest Evidence))
  A --> P5((5. Review and Label))
  A --> P6((6. Query Dashboard/Reports))
  P1 <--> D1[(Users)]
  P2 --> P3((3. Normalize and Detect))
  P3 <--> D2[(Logs/Risks/Taxonomy)]
  P3 --> P4((4. Correlate and Map))
  P4 <--> D3[(Incidents/MITRE)]
  P5 <--> D2
  P5 --> D4[(Retraining Runs/Models)]
  D1 --> P6
  D2 --> P6
  D3 --> P6
  P6 --> A
```

## DFD Level 2 — Evidence Processing

```mermaid
flowchart LR
  I[Uploaded bytes or generated records] --> H[2.1 Hash and source-tag]
  H --> P[2.2 Parse in memory]
  P --> N[2.3 Normalize schema]
  N --> Q[2.4 Assess data quality]
  N --> F[2.5 Extract shared features]
  F --> RE[2.6 Rules]
  F --> ML[2.7 PyOD ensemble]
  RE --> X[2.8 Explain and classify]
  ML --> X
  X --> MITRE[2.9 MITRE mapping]
  MITRE --> CORR[2.10 Incident correlation]
  CORR --> TX[2.11 Atomic repository transaction]
  TX --> DB[(PostgreSQL)]
  TX --> EVT[2.12 Post-commit SSE publish]
```

## Entity–Relationship Diagram

```mermaid
erDiagram
  USERS ||--o{ UPLOADED_FILES : owns
  USERS ||--o{ RISK_EVENTS : reviews
  USERS ||--o{ REPORTS : generates
  UPLOADED_FILES ||--o{ NORMALIZED_LOGS : contains
  UPLOADED_FILES ||--|| DATA_QUALITY_RESULTS : has
  UPLOADED_FILES ||--o{ RISK_EVENTS : produces
  NORMALIZED_LOGS ||--o{ RISK_EVENTS : triggers
  RISK_EVENTS ||--o| MITRE_MAPPINGS : maps
  UPLOADED_FILES ||--o{ INCIDENTS : correlates
  INCIDENTS ||--o{ INCIDENT_EVENTS : contains
  UPLOADED_FILES ||--o{ REPORTS : documents

  USERS { bigint id PK string email UK string password_hash string role }
  UPLOADED_FILES { bigint id PK bigint user_id FK string content_hash string processing_status }
  NORMALIZED_LOGS { bigint id PK bigint file_id FK timestamp timestamp string source_ip int status_code }
  DATA_QUALITY_RESULTS { bigint id PK bigint file_id FK float quality_score float health_score }
  RISK_EVENTS { bigint id PK bigint file_id FK bigint log_id FK string attack_type string source string analyst_label }
  MITRE_MAPPINGS { bigint id PK bigint risk_event_id FK string technique_id string tactic }
  INCIDENTS { bigint id PK bigint file_id FK float overall_risk_score string severity }
  INCIDENT_EVENTS { bigint id PK bigint incident_id FK timestamp event_time string description }
  REPORTS { bigint id PK bigint file_id FK bigint generated_by FK string report_path }
```
