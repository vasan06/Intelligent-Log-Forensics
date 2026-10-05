"""
routes/dashboard.py
Authenticated, user-scoped dashboard statistics.

Dashboard statistics include:
    - Uploaded log analyses
    - Live monitor stream batches
    - Persisted simulations

All records are read from log_analyses.
"""

import datetime
from collections import Counter

import jwt
from flask import Blueprint, jsonify, request
from sqlalchemy import select

from backend import config
from backend.database import get_db
from backend.models.log_analysis import log_analyses
from backend.models.uploaded_file import uploaded_files
from backend.models.user import users


dash_bp = Blueprint("dashboard", __name__)


# =========================================================
# AUTHENTICATION
# =========================================================

def get_authenticated_user_id():
    """Return the authenticated user's ID from the Bearer token."""

    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        return None

    token = authorization[7:].strip()

    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            config.JWT_SECRET_KEY,
            algorithms=[config.JWT_ALGORITHM],
        )

        if payload.get("type") != "access":
            return None

        user_id = payload.get("sub")

        if not user_id:
            return None

        with get_db() as db:
            exists = db.execute(
                select(users.c.id).where(
                    users.c.id == str(user_id),
                    users.c.verified.is_(True),
                )
            ).first()

        return str(user_id) if exists else None

    except (
        jwt.ExpiredSignatureError,
        jwt.InvalidTokenError,
    ):
        return None


# =========================================================
# =========================================================
# TIMEZONE & HELPERS
# =========================================================

IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))

HOURLY_LABELS_12H = [
    datetime.time(h, 0).strftime("%I:00 %p")
    for h in range(24)
]


def parse_to_ist(ts_val):
    """Parse any datetime/string timestamp and return in Indian Standard Time (IST)."""
    if not ts_val:
        return None
    if isinstance(ts_val, datetime.datetime):
        if ts_val.tzinfo is None:
            ts_val = ts_val.replace(tzinfo=datetime.timezone.utc)
        return ts_val.astimezone(IST)
    try:
        ts_str = str(ts_val).strip().replace("Z", "+00:00")
        dt = datetime.datetime.fromisoformat(ts_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.astimezone(IST)
    except Exception:
        return None


def _parse_filter_range(start_date, start_time, end_date, end_time):
    """Parse user-provided date/time strings into IST datetime bounds."""
    start_dt = None
    end_dt = None

    if start_date:
        try:
            parts = [int(p) for p in start_date.strip().split("-")]
            h, m = (0, 0)
            if start_time:
                t_parts = [int(p) for p in start_time.strip().split(":")]
                h, m = t_parts[0], t_parts[1]
            start_dt = datetime.datetime(parts[0], parts[1], parts[2], h, m, 0, tzinfo=IST)
        except Exception:
            start_dt = None

    if end_date:
        try:
            parts = [int(p) for p in end_date.strip().split("-")]
            h, m, s = (23, 59, 59)
            if end_time:
                t_parts = [int(p) for p in end_time.strip().split(":")]
                h, m = t_parts[0], t_parts[1]
                s = 0
            end_dt = datetime.datetime(parts[0], parts[1], parts[2], h, m, s, tzinfo=IST)
        except Exception:
            end_dt = None

    return start_dt, end_dt


def _as_number(value, default=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _analysis_value(results, *keys, default=0):
    if not isinstance(results, dict):
        return default

    for key in keys:
        if key in results and results[key] is not None:
            return results[key]

    return default


def _get_latest_ml_analysis(user_id):
    """Fetch the user's latest analysis record that actually contains ML output."""
    with get_db() as db:
        result = db.execute(
            select(
                log_analyses.c.id,
                log_analyses.c.results,
                log_analyses.c.created_at,
            )
            .where(
                log_analyses.c.user_id == str(user_id)
            )
            .order_by(
                log_analyses.c.created_at.desc()
            )
        )
        analyses = result.mappings().all()

    for a in analyses:
        res = a.get("results") or {}
        ml = res.get("ml") or res.get("ml_analysis")
        if isinstance(ml, dict) and (ml.get("consensus") or ml.get("anomaly_score") is not None or ml.get("all_results")):
            consensus = ml.get("consensus") or {}
            score = float(consensus.get("master_anomaly_score", ml.get("anomaly_score", 0.0)))
            risk = str(consensus.get("risk_level", ml.get("risk_level", "LOW"))).upper()
            confidence = float(consensus.get("confidence", ml.get("confidence", 0.85)))
            best_algo = str(ml.get("best_algorithm", "Master Multi-Model Ensemble"))
            all_algos = ml.get("all_results") or ml.get("algorithms") or []
            return {
                "score": score,
                "consensus_score": score,
                "anomaly_score": score,
                "risk_level": risk,
                "risk": risk,
                "confidence": confidence,
                "best_algo": best_algo,
                "best_model": best_algo,
                "algorithms": all_algos,
                "models": all_algos,
                "all_results": all_algos,
                "flagged_count": len(ml.get("flagged_entries", [])),
                "analysis_id": str(a["id"]),
            }
    return None


def _empty_dashboard():
    return {
        "kpis": {
            "total_logs": 0,
            "anomalies": 0,
            "active_sources": 0,
            "avg_response_ms": 0,
        },

        "total_logs": 0,
        "threats_detected": 0,
        "unique_sources": 0,

        "log_volume": {
            "labels": HOURLY_LABELS_12H,
            "INFO": [0] * 24,
            "WARN": [0] * 24,
            "ERROR": [0] * 24,
            "CRITICAL": [0] * 24,
            "DEBUG": [0] * 24,
        },

        "trend_24h": {
            "labels": HOURLY_LABELS_12H,
            "values": [0] * 24,
        },

        "heatmap": [0] * 24,

        "severity_dist": {
            "labels": [
                "INFO",
                "WARN",
                "ERROR",
                "CRITICAL",
                "DEBUG",
            ],
            "values": [0, 0, 0, 0, 0],
        },

        "top_sources": {
            "labels": [],
            "values": [],
        },

        "activity": {
            "days": [
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
                "Sun",
            ],
            "hours": [
                f"{h:02d}h"
                for h in range(0, 24, 2)
            ],
            "data": [
                [0] * 12
                for _ in range(7)
            ],
        },

        "ml_consensus": None,
        "ml_summary": None,

        "recent_cases": [],
        "recent_incidents": [],
        "active_cases": [],
    }


# =========================================================
# BUILD DASHBOARD
# =========================================================

def _build_dashboard(rows, filters=None, latest_ml=None):

    data = _empty_dashboard()

    filters = filters or {}
    start_filter, end_filter = filters.get("start_dt"), filters.get("end_dt")
    src_filter = str(filters.get("source") or "all").strip().lower()
    sev_filter = str(filters.get("severity") or "all").strip().upper()
    is_sev_filtered = bool(sev_filter and sev_filter not in ("ALL", "*"))
    is_src_filtered = bool(src_filter and src_filter not in ("all", "*"))
    has_filter = bool(start_filter or end_filter or is_src_filtered or is_sev_filtered)

    severity = Counter()
    sources = Counter()

    hourly = {
        level: [0] * 24
        for level in (
            "INFO",
            "WARN",
            "ERROR",
            "CRITICAL",
            "DEBUG",
        )
    }

    heatmap_counts = [0] * 24

    activity = [
        [0] * 12
        for _ in range(7)
    ]

    total_logs = 0
    anomalies = 0
    response_times = []

    recent_cases = []
    recent_incidents = []

    # -----------------------------------------------------
    # DEDUPLICATE RECORDS (Authoritative Source of Truth)
    # -----------------------------------------------------
    # 1. For uploaded files: keep only the latest analysis for each distinct file_id
    # 2. For simulations: keep distinct analyses where source == "simulation" or not file_id.
    #    Skip legacy ephemeral stream batches (stream_batch == True).
    deduped_rows = []
    seen_file_ids = set()

    for row in rows:
        fid = row.get("file_id")
        results = row.get("results") or {}
        if not isinstance(results, dict):
            results = {}

        # Ignore legacy ephemeral stream batches
        if results.get("stream_batch") is True and results.get("source") == "live_stream":
            continue

        if fid:
            fid_str = str(fid)
            if fid_str in seen_file_ids:
                continue
            seen_file_ids.add(fid_str)
            deduped_rows.append(row)
        else:
            deduped_rows.append(row)

    # -----------------------------------------------------
    # PROCESS EVERY DEDUPLICATED RECORD
    # -----------------------------------------------------

    for row in deduped_rows:
        results = row.get("results") or {}
        if not isinstance(results, dict):
            results = {}

        source_type = str(results.get("source") or "upload").lower()
        row_created_ist = parse_to_ist(row.get("created_at"))
        fid = str(row.get("file_id") or "")
        fname = row.get("filename") or "Uploaded Log"
        status = row.get("status") or "completed"

        avg_resp = _analysis_value(results, "avg_response_ms", "average_response_ms", default=None)
        if avg_resp is not None:
            response_times.append(_as_number(avg_resp))

        raw_logs = results.get("logs") or results.get("preview") or []

        if raw_logs and isinstance(raw_logs, list):
            matched_logs = []
            for log in raw_logs:
                if not isinstance(log, dict):
                    continue

                # 1. Event timestamp (preferred), falling back to row created_at
                ev_ts = parse_to_ist(log.get("timestamp")) or row_created_ist
                if start_filter and ev_ts and ev_ts < start_filter:
                    continue
                if end_filter and ev_ts and ev_ts > end_filter:
                    continue

                # 2. Source filter
                l_src = str(log.get("source") or "system").lower()
                if is_src_filtered and l_src != src_filter:
                    continue

                # 3. Severity filter
                l_sev = str(log.get("severity") or "INFO").upper()
                if is_sev_filtered and l_sev != sev_filter:
                    continue

                matched_logs.append((log, ev_ts, l_src, l_sev))

            if has_filter and not matched_logs:
                continue

            for log, ev_ts, l_src, l_sev in matched_logs:
                total_logs += 1
                sources[l_src] += 1
                sev_key = l_sev if l_sev in severity else "INFO"
                severity[sev_key] += 1

                # Threats
                is_anomaly = bool(
                    l_sev in ("CRITICAL", "ERROR")
                    or _as_number(log.get("anomaly_score", 0)) > 0.5
                )
                if is_anomaly:
                    anomalies += 1

                # IST hourly bucketing
                if ev_ts:
                    h = ev_ts.hour
                    h_level = l_sev if l_sev in hourly else "INFO"
                    hourly[h_level][h] += 1
                    heatmap_counts[h] += 1

                    day_idx = ev_ts.weekday()
                    blk_idx = min(h // 2, 11)
                    activity[day_idx][blk_idx] += 1

                # Incidents
                if l_sev in ("CRITICAL", "ERROR") and len(recent_incidents) < 15:
                    recent_incidents.append({
                        "timestamp": log.get("timestamp") or (ev_ts.isoformat() if ev_ts else ""),
                        "source": l_src,
                        "severity": l_sev,
                        "message": str(log.get("message") or "Security alert"),
                        "anomaly_score": _as_number(log.get("anomaly_score", 0.85)),
                        "ip": str(log.get("ip") or "-"),
                        "file_id": fid if fid else None,
                        "analysis_id": str(row.get("analysis_id") or ""),
                    })

        else:
            # Fallback when individual log list is not available in results
            if start_filter and row_created_ist and row_created_ist < start_filter:
                continue
            if end_filter and row_created_ist and row_created_ist > end_filter:
                continue

            r_src = str(results.get("source") or "upload").lower()
            if is_src_filtered and r_src != src_filter:
                continue

            r_total = int(_as_number(_analysis_value(results, "total_logs", "lines_parsed", default=0)))
            r_anom = int(_as_number(_analysis_value(results, "anomalies", "anomalies_found", default=0)))

            total_logs += r_total
            anomalies += r_anom
            sources[r_src] += r_total

            sev_dict = results.get("severity") or {}
            for lvl in ("INFO", "WARN", "ERROR", "CRITICAL", "DEBUG"):
                if sev_filter != "all" and lvl != sev_filter:
                    continue
                cnt = int(_as_number(sev_dict.get(lvl, 0)))
                severity[lvl] += cnt

            if row_created_ist:
                h = row_created_ist.hour
                heatmap_counts[h] += r_total
                activity[row_created_ist.weekday()][min(h // 2, 11)] += 1

        # Track recent case (uploaded file)
        if source_type == "upload" and fid and len(recent_cases) < 6:
            recent_cases.append({
                "file_id": fid,
                "analysis_id": str(row.get("analysis_id") or ""),
                "filename": fname,
                "status": status,
                "total_logs": _analysis_value(results, "total_logs", "lines_parsed", default=0),
                "anomalies": _analysis_value(results, "anomalies", "anomalies_found", default=0),
                "created_at": row_created_ist.isoformat() if row_created_ist else "",
                "db_location": row.get("db_location") or f"db://users/uploads/{fid}",
            })

    # =====================================================
    # FINAL CALCULATIONS & RESPONSE PAYLOAD
    # =====================================================

    levels = ["INFO", "WARN", "ERROR", "CRITICAL", "DEBUG"]

    trend_values = [
        sum(hourly[level][hour] for level in levels)
        for hour in range(24)
    ]

    data["kpis"]["total_logs"] = total_logs
    data["kpis"]["anomalies"] = anomalies
    data["kpis"]["active_sources"] = len(sources)

    if response_times:
        data["kpis"]["avg_response_ms"] = round(
            sum(response_times) / len(response_times),
            2,
        )

    data["total_logs"] = total_logs
    data["threats_detected"] = anomalies
    data["unique_sources"] = len(sources)

    data["severity_dist"]["values"] = [
        severity[level]
        for level in levels
    ]

    data["log_volume"] = {
        "labels": HOURLY_LABELS_12H,
        **hourly,
    }

    data["trend_24h"] = {
        "labels": HOURLY_LABELS_12H,
        "values": trend_values,
    }

    # 24-hour IST activity heatmap
    data["heatmap"] = heatmap_counts
    data["activity_heatmap"] = heatmap_counts
    data["hourly_activity"] = heatmap_counts

    top = sources.most_common(8)
    data["top_sources"] = {
        "labels": [item[0] for item in top],
        "values": [item[1] for item in top],
    }

    data["recent_cases"] = recent_cases
    data["active_cases"] = recent_cases
    data["recent_incidents"] = recent_incidents

    # Dynamic ML consensus result
    data["ml_consensus"] = latest_ml
    data["ml_summary"] = latest_ml

    return data


# =========================================================
# DASHBOARD STATS ROUTE
# =========================================================

@dash_bp.route("/dashboard/stats")
def stats():

    user_id = get_authenticated_user_id()

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Authentication required",
        }), 401

    start_date = request.args.get("start_date")
    start_time = request.args.get("start_time")
    end_date = request.args.get("end_date")
    end_time = request.args.get("end_time")
    source = request.args.get("source", "all")
    severity = request.args.get("severity", "all")

    start_dt, end_dt = _parse_filter_range(start_date, start_time, end_date, end_time)

    filters = {
        "start_dt": start_dt,
        "end_dt": end_dt,
        "source": source,
        "severity": severity,
    }

    with get_db() as db:
        result = db.execute(
            select(
                log_analyses.c.id.label("analysis_id"),
                log_analyses.c.user_id,
                log_analyses.c.file_id,
                log_analyses.c.status,
                log_analyses.c.results,
                log_analyses.c.created_at,
                uploaded_files.c.id.label("uploaded_file_id"),
                uploaded_files.c.filename,
                uploaded_files.c.db_location,
            )
            .select_from(
                log_analyses.outerjoin(
                    uploaded_files,
                    uploaded_files.c.id == log_analyses.c.file_id,
                )
            )
            .where(
                log_analyses.c.user_id == str(user_id)
            )
            .order_by(
                log_analyses.c.created_at.desc()
            )
        )

        rows = result.mappings().all()

    latest_ml = _get_latest_ml_analysis(user_id)
    dash_data = _build_dashboard(rows, filters=filters, latest_ml=latest_ml)

    return jsonify({
        "success": True,
        "scope": "user",
        "data": dash_data,
    })


# =========================================================
# ML SUMMARY ROUTE
# =========================================================

@dash_bp.route("/dashboard/ml-summary")
def ml_summary():

    user_id = get_authenticated_user_id()

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Authentication required",
        }), 401

    ml_info = _get_latest_ml_analysis(user_id)

    if not ml_info:
        return jsonify({
            "success": True,
            "scope": "user",
            "anomaly_score": 0,
            "risk_level": "LOW",
            "best_algorithm": "No ML analysis available",
            "flagged_count": 0,
            "all_scores": [],
        })

    return jsonify({
        "success": True,
        "scope": "user",
        "anomaly_score": ml_info.get("anomaly_score", 0),
        "risk_level": ml_info.get("risk_level", "LOW"),
        "best_algorithm": ml_info.get("best_algo", "Master Multi-Model Ensemble"),
        "flagged_count": ml_info.get("flagged_count", 0),
        "all_scores": ml_info.get("all_results", []),
    })