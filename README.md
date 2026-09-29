# Intelligent Log Forensic (ILF) v2.0

> ML-powered log forensics. MITRE ATT&CK mapping. Real-time threat detection.

---

### Folder structure

Directory structure:
└── vasan06-intelligent-log-forensics/
    ├── README.md
    ├── app.py
    ├── docker-compose.yml
    ├── Dockerfile
    ├── requirements.txt
    ├── start.bat
    ├── start.sh
    ├── todo.txt
    ├── .dockerignore
    ├── .env.example
    ├── backend/
    │   ├── __init__.py
    │   ├── app.py
    │   ├── config.py
    │   ├── database.py
    │   ├── requirements.txt
    │   ├── data/
    │   │   └── mitre_catalog.json
    │   ├── models/
    │   │   ├── __init__.py
    │   │   ├── log_analysis.py
    │   │   ├── report.py
    │   │   ├── session.py
    │   │   ├── uploaded_file.py
    │   │   └── user.py
    │   ├── routes/
    │   │   ├── __init__.py
    │   │   ├── admin.py
    │   │   ├── auth.py
    │   │   ├── dashboard.py
    │   │   ├── logs.py
    │   │   ├── mitre.py
    │   │   ├── ml.py
    │   │   ├── reports.py
    │   │   └── user.py
    │   └── services/
    │       ├── __init__.py
    │       ├── log_simulator.py
    │       ├── ml_service.py
    │       └── otp_service.py
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
    │       ├── css/
    │       │   ├── animations.css
    │       │   ├── components.css
    │       │   ├── global.css
    │       │   ├── navbar.css
    │       │   └── tokens.css
    │       └── js/
    │           ├── api.js
    │           ├── auth-guard.js
    │           ├── navbar.js
    │           └── three/
    │               ├── scene-dashboard.js
    │               ├── scene-explorer.js
    │               └── scene-login.js
    └── instance/
        └── uploads/
            └── 1790188819.854983-sample.txt


## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python -m backend.app
```

Backend runs at **http://localhost:5000**

### 2. Frontend

Open `frontend/landing.html` in any browser (or `frontend/signin.html` to go straight to login).

**Demo login:** `admin@ilf.io` / `ilf2026`

---

## Pages

| Page | File | Description |
|------|------|-------------|
| Landing | `landing.html` | Product page with live demo terminal |
| Login | `signin.html` | Auth with 3D helix scene |
| Signup | `signup.html` | Registration with OTP email verify |
| Forgot PW | `forgot-password.html` | OTP-based password reset |
| Dashboard | `dashboard.html` | KPIs, charts, ML summary ribbon |
| Live Monitor | `live-monitor.html` | 8 simulation modes, start/stop stream |
| Log Explorer | `log-explorer.html` | File upload + 3D pipeline workflow |
| ML Analysis | `ml-analysis.html` | Ensemble (all 4 algos), file/stream |
| MITRE Tracker | `mitre-tracker.html` | Auto-map logs to ATT&CK |
| ATT&CK Catalog | `mitre-catalog.html` | 100+ techniques, search, filter |
| Reports | `reports.html` | PDF report generator |
| Admin | `admin.html` | Users, system health, settings |
| Profile | `profile.html` | Editable profile, activity feed |

---

## API Endpoints (all visible in DevTools → Network)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login → JWT token |
| POST | `/api/auth/signup` | Register → OTP email |
| POST | `/api/auth/verify-otp` | Verify OTP (never in logs) |
| POST | `/api/auth/forgot-password` | Send reset OTP |
| POST | `/api/auth/reset-password` | Reset with OTP |
| GET  | `/api/dashboard/stats` | All dashboard data |
| GET  | `/api/dashboard/ml-summary` | Ensemble ML summary |
| GET  | `/api/logs/stream` | Simulated log stream |
| GET  | `/api/logs/modes` | Simulation mode list |
| POST | `/api/logs/upload` | Upload log file |
| POST | `/api/ml/analyze` | Run ML ensemble |
| GET  | `/api/mitre/catalog` | ATT&CK technique list |
| GET  | `/api/mitre/tactics` | ATT&CK tactic list |
| GET  | `/api/mitre/technique/:id` | Single technique |
| POST | `/api/mitre/map` | Map logs to ATT&CK |
| POST | `/api/reports/generate` | Generate PDF |
| GET  | `/api/admin/stats` | System health |
| GET  | `/api/admin/users` | User list |
| PUT  | `/api/user/profile` | Update profile |

---

## OTP Security

- OTP values are **never** logged, **never** returned in API responses
- OTPs are delivered via email only (SMTP configured in `.env`)
- Dev mode prints OTP to stdout only (not to log files)
- Expiry: 30 minutes
- Max attempts: 5 before lockout

---

## Design System

- **Theme**: Warm professional light (not dark/neon)
- **Primary**: Deep indigo `#2D2B6B`
- **Accent**: Warm amber `#E8903A`
- **Fonts**: DM Sans (display) + Space Grotesk (body) + Fira Code (mono)
- **3D**: Three.js — DNA helix (login), neural threat graph (dashboard), pipeline nodes (explorer)
- **No emoji** — all iconography via inline SVG

---

## SMTP Setup (optional)

Create a `.env` file in `backend/`:
```
ILF_SMTP_HOST=smtp.gmail.com
ILF_SMTP_PORT=587
ILF_SMTP_USER=your@gmail.com
ILF_SMTP_PASS=your-app-password
ILF_SMTP_FROM=noreply@ilf.io
```

Without SMTP, OTPs print to the terminal (dev mode).

---

Built for security analysts — Intelligent Log Forensic 2026
