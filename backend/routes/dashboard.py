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
# HELPERS
# =========================================================

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
            "labels": [
                f"{h:02d}:00"
                for h in range(24)
            ],
            "INFO": [0] * 24,
            "WARN": [0] * 24,
            "ERROR": [0] * 24,
            "CRITICAL": [0] * 24,
            "DEBUG": [0] * 24,
        },

        "trend_24h": {
            "labels": [
                f"{h:02d}:00"
                for h in range(24)
            ],
            "values": [0] * 24,
        },

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

        "recent_cases": [],
        "recent_incidents": [],
        "active_cases": [],
    }


# =========================================================
# BUILD DASHBOARD
# =========================================================

def _build_dashboard(rows):

    data = _empty_dashboard()

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

    activity = [
        [0] * 12
        for _ in range(7)
    ]

    total_logs = 0
    anomalies = 0

    response_times = []

    recent_cases = []
    recent_incidents = []

    seen_files = set()

    # -----------------------------------------------------
    # PROCESS EVERY ANALYSIS
    # -----------------------------------------------------

    for row in rows:

        results = row.get("results") or {}

        if not isinstance(results, dict):
            results = {}

        source_type = str(
            results.get("source") or "upload"
        ).lower()

        # -------------------------------------------------
        # TOTAL LOGS
        # -------------------------------------------------

        total_logs += int(
            _as_number(
                _analysis_value(
                    results,
                    "total_logs",
                    "lines_parsed",
                    "log_count",
                    default=0,
                )
            )
        )

        # -------------------------------------------------
        # THREATS / ANOMALIES
        # -------------------------------------------------

        anomalies += int(
            _as_number(
                _analysis_value(
                    results,
                    "anomalies",
                    "anomalies_found",
                    "anomaly_count",
                    "flagged_count",
                    "threat_count",
                    default=0,
                )
            )
        )

        # -------------------------------------------------
        # RESPONSE TIME
        # -------------------------------------------------

        avg_response = _analysis_value(
            results,
            "avg_response_ms",
            "average_response_ms",
            default=None,
        )

        if avg_response is not None:
            response_times.append(
                _as_number(avg_response)
            )

        # -------------------------------------------------
        # SEVERITY
        # -------------------------------------------------

        severity_data = results.get("severity")

        if isinstance(severity_data, dict):

            for level in (
                "INFO",
                "WARN",
                "ERROR",
                "CRITICAL",
                "DEBUG",
            ):

                severity[level] += int(
                    _as_number(
                        severity_data.get(level, 0)
                    )
                )

        # -------------------------------------------------
        # SOURCES
        # -------------------------------------------------

        source_data = results.get("top_sources")

        if isinstance(source_data, dict):

            for source, count in source_data.items():

                sources[str(source)] += int(
                    _as_number(count)
                )

        # -------------------------------------------------
        # HOURLY LOG VOLUME
        # -------------------------------------------------

        volume = results.get("log_volume")

        if isinstance(volume, dict):

            for level in hourly:

                values = volume.get(level) or []

                for hour, value in enumerate(
                    values[:24]
                ):

                    hourly[level][hour] += int(
                        _as_number(value)
                    )

        # -------------------------------------------------
        # ACTIVITY MATRIX
        # -------------------------------------------------

        activity_data = results.get("activity")

        if isinstance(activity_data, dict):

            matrix = activity_data.get("data") or []

            for day_index, values in enumerate(
                matrix[:7]
            ):

                for hour_index, value in enumerate(
                    values[:12]
                ):

                    activity[day_index][hour_index] += int(
                        _as_number(value)
                    )

        # -------------------------------------------------
        # ANALYSIS CREATED TIME
        # -------------------------------------------------

        created_at = row.get("created_at")

        if created_at:

            if created_at.tzinfo is None:
                created_at = created_at.replace(
                    tzinfo=datetime.timezone.utc
                )

            day_index = created_at.weekday()
            block_index = min(
                created_at.hour // 2,
                11
            )

            activity[day_index][block_index] += 1

        # -------------------------------------------------
        # UPLOADED FILE CASES
        # -------------------------------------------------

        fid = str(
            row.get("file_id") or ""
        )

        fname = (
            row.get("filename")
            or "Uploaded Log"
        )

        status = (
            row.get("status")
            or "completed"
        )

        if (
            source_type == "upload"
            and fid
            and fid not in seen_files
            and len(recent_cases) < 6
        ):

            seen_files.add(fid)

            recent_cases.append({
                "file_id": fid,
                "analysis_id": str(
                    row.get("analysis_id") or ""
                ),
                "filename": fname,
                "status": status,
                "total_logs": _analysis_value(
                    results,
                    "total_logs",
                    "lines_parsed",
                    default=0,
                ),
                "anomalies": _analysis_value(
                    results,
                    "anomalies",
                    "anomalies_found",
                    default=0,
                ),
                "created_at": (
                    created_at.isoformat()
                    if created_at
                    else ""
                ),
                "db_location": (
                    row.get("db_location")
                    or f"db://users/uploads/{fid}"
                ),
            })

        # -------------------------------------------------
        # ML INCIDENTS
        # -------------------------------------------------

        ml = (
            results.get("ml")
            or results.get("ml_analysis")
            or {}
        )

        if not isinstance(ml, dict):
            ml = {}

        flagged = (
            ml.get("flagged_entries")
            or []
        )

        for fl in flagged:

            if len(recent_incidents) >= 15:
                break

            recent_incidents.append({
                "timestamp": (
                    fl.get("timestamp")
                    or (
                        created_at.isoformat()
                        if created_at
                        else ""
                    )
                ),
                "source": (
                    fl.get("source")
                    or "system"
                ),
                "severity": (
                    fl.get("severity")
                    or "ERROR"
                ),
                "message": (
                    fl.get("message")
                    or "Anomaly detected"
                ),
                "anomaly_score": (
                    fl.get("anomaly_score")
                    or 0.85
                ),
                "ip": (
                    fl.get("ip")
                    or "-"
                ),
                "file_id": fid,
            })

        # -------------------------------------------------
        # LIVE STREAM INCIDENTS
        # -------------------------------------------------

        if source_type == "live_stream":

            live_logs = results.get("logs") or []

            for log in live_logs:

                log_severity = str(
                    log.get("severity", "INFO")
                ).upper()

                # Live CRITICAL events become incidents.
                if (
                    log_severity in (
                        "CRITICAL",
                        "ERROR",
                    )
                    and len(recent_incidents) < 15
                ):

                    recent_incidents.append({
                        "timestamp": (
                            log.get("timestamp")
                            or (
                                created_at.isoformat()
                                if created_at
                                else ""
                            )
                        ),
                        "source": (
                            log.get("source")
                            or "live"
                        ),
                        "severity": log_severity,
                        "message": (
                            log.get("message")
                            or "Live security event"
                        ),
                        "anomaly_score": (
                            0.95
                            if log_severity == "CRITICAL"
                            else 0.80
                        ),
                        "ip": (
                            log.get("ip")
                            or "-"
                        ),
                        "file_id": None,
                        "analysis_id": str(
                            row.get("analysis_id")
                            or ""
                        ),
                    })

    # =====================================================
    # FINAL CALCULATIONS
    # =====================================================

    levels = [
        "INFO",
        "WARN",
        "ERROR",
        "CRITICAL",
        "DEBUG",
    ]

    trend_values = []

    for hour in range(24):

        total_hour = sum(
            hourly[level][hour]
            for level in levels
        )

        trend_values.append(total_hour)

    # -----------------------------------------------------
    # KPI
    # -----------------------------------------------------

    data["kpis"]["total_logs"] = total_logs
    data["kpis"]["anomalies"] = anomalies
    data["kpis"]["active_sources"] = len(sources)

    if response_times:

        data["kpis"]["avg_response_ms"] = round(
            sum(response_times)
            / len(response_times),
            2,
        )

    # -----------------------------------------------------
    # COMPATIBILITY WITH dashboard.js
    # -----------------------------------------------------

    data["total_logs"] = total_logs
    data["threats_detected"] = anomalies
    data["unique_sources"] = len(sources)

    # -----------------------------------------------------
    # SEVERITY
    # -----------------------------------------------------

    data["severity_dist"]["values"] = [
        severity[level]
        for level in levels
    ]

    # -----------------------------------------------------
    # VOLUME
    # -----------------------------------------------------

    data["log_volume"] = {
        "labels": [
            f"{h:02d}:00"
            for h in range(24)
        ],
        **hourly,
    }

    data["trend_24h"] = {
        "labels": [
            f"{h:02d}:00"
            for h in range(24)
        ],
        "values": trend_values,
    }

    # -----------------------------------------------------
    # TOP SOURCES
    # -----------------------------------------------------

    top = sources.most_common(8)

    data["top_sources"] = {
        "labels": [
            item[0]
            for item in top
        ],
        "values": [
            item[1]
            for item in top
        ],
    }

    # -----------------------------------------------------
    # CASES / INCIDENTS
    # -----------------------------------------------------

    data["recent_cases"] = recent_cases
    data["active_cases"] = recent_cases
    data["recent_incidents"] = recent_incidents

    return data


# =========================================================
# DASHBOARD STATS
# =========================================================

@dash_bp.route("/dashboard/stats")
def stats():

    user_id = get_authenticated_user_id()

    if not user_id:

        return jsonify({
            "success": False,
            "message": "Authentication required",
        }), 401

    # IMPORTANT:
    #
    # Query log_analyses directly.
    #
    # This includes:
    #
    #   uploaded logs
    #   live streams
    #   simulations
    #
    # even when file_id is NULL.

    with get_db() as db:

        result = db.execute(
            select(
                log_analyses.c.id.label(
                    "analysis_id"
                ),

                log_analyses.c.user_id,

                log_analyses.c.file_id,

                log_analyses.c.status,

                log_analyses.c.results,

                log_analyses.c.created_at,

                uploaded_files.c.id.label(
                    "uploaded_file_id"
                ),

                uploaded_files.c.filename,

                uploaded_files.c.db_location,
            )
            .select_from(
                log_analyses.outerjoin(
                    uploaded_files,
                    uploaded_files.c.id
                    == log_analyses.c.file_id,
                )
            )
            .where(
                log_analyses.c.user_id
                == str(user_id)
            )
            .order_by(
                log_analyses.c.created_at.desc()
            )
        )

        rows = result.mappings().all()

    return jsonify({
        "success": True,
        "scope": "user",
        "data": _build_dashboard(rows),
    })


# =========================================================
# ML SUMMARY
# =========================================================

@dash_bp.route("/dashboard/ml-summary")
def ml_summary():

    user_id = get_authenticated_user_id()

    if not user_id:

        return jsonify({
            "success": False,
            "message": "Authentication required",
        }), 401

    with get_db() as db:

        result = db.execute(
            select(
                log_analyses.c.results,
                log_analyses.c.created_at,
            )
            .where(
                log_analyses.c.user_id
                == str(user_id)
            )
            .order_by(
                log_analyses.c.created_at.desc()
            )
            .limit(1)
        )

        row = result.mappings().first()

    if not row:

        return jsonify({
            "success": True,
            "scope": "user",
            "anomaly_score": 0,
            "risk_level": "LOW",
            "best_algorithm": "No analysis yet",
            "flagged_count": 0,
            "all_scores": [],
        })

    results = row["results"] or {}

    if not isinstance(results, dict):
        results = {}

    ml = (
        results.get("ml")
        or results.get("ml_analysis")
        or results
    )

    if not isinstance(ml, dict):
        ml = {}

    all_results = (
        ml.get("all_results")
        or ml.get("algorithms")
        or []
    )

    if not isinstance(all_results, list):
        all_results = []

    normalized = []

    for item in all_results:

        if not isinstance(item, dict):
            continue

        normalized.append({
            "algorithm": item.get(
                "algorithm",
                "Unknown"
            ),
            "score": _as_number(
                item.get("score", 0)
            ),
            "is_best": bool(
                item.get("is_best", False)
            ),
        })

    return jsonify({
        "success": True,
        "scope": "user",

        "anomaly_score": _as_number(
            ml.get(
                "anomaly_score",
                results.get(
                    "anomaly_score",
                    0
                ),
            )
        ),

        "risk_level": ml.get(
            "risk_level",
            results.get(
                "risk_level",
                "LOW"
            ),
        ),

        "best_algorithm": ml.get(
            "best_algorithm",
            results.get(
                "best_algorithm",
                "Unknown"
            ),
        ),

        "flagged_count": int(
            _as_number(
                ml.get(
                    "flagged_count",
                    results.get(
                        "flagged_count",
                        0
                    ),
                )
            )
        ),

        "all_scores": normalized,
    })