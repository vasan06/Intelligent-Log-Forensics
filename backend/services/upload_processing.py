"""Background processing for uploaded log files."""

import datetime
import io
import json
import logging
import os
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from json import JSONDecoder

from sqlalchemy import select, update

from backend.database import get_db
from backend.models.log_analysis import log_analyses
from backend.models.upload_job import upload_jobs
from backend.models.uploaded_file import uploaded_files
from backend.services.ml_service import run_ensemble


_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="log-upload")
_MAX_BATCH_SIZE = 2000
_MAX_FLAGGED_RECORDS = 100


def submit_upload_job(job_id):
    if os.getenv("ILF_INLINE_UPLOAD_WORKER", "true").lower() == "true":
        _executor.submit(process_upload_job, job_id)


def iter_log_batches(content, filename, batch_size=_MAX_BATCH_SIZE):
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1", errors="replace")

    if filename.lower().endswith((".json", ".jsonl", ".ndjson")):
        yield from _iter_json_batches(text, batch_size)
        return

    from backend.routes.logs import parse_log_content

    parser = parse_log_content
    lines = io.StringIO(text)
    batch = []
    line_offset = 0
    for line in lines:
        batch.append(line)
        if len(batch) >= batch_size:
            logs, _, _ = parser("".join(batch).encode("utf-8"), "uploaded.log")
            for log in logs:
                log["line"] += line_offset
            if logs:
                yield logs
            line_offset += len(batch)
            batch = []
    if batch:
        logs, _, _ = parser("".join(batch).encode("utf-8"), "uploaded.log")
        for log in logs:
            log["line"] += line_offset
        if logs:
            yield logs


def _iter_json_batches(text, batch_size):
    decoder = JSONDecoder()
    if text.lstrip().startswith("["):
        position = text.index("[") + 1
    else:
        array_match = re.search(r'"(?:logs|events)"\s*:\s*\[', text)
        if array_match:
            position = array_match.end()
        else:
            try:
                value = json.loads(text)
            except json.JSONDecodeError as exc:
                yield from _iter_json_lines(text, batch_size, exc)
                return
            if isinstance(value, dict):
                value = value.get("logs") or value.get("events") or [value]
            yield from _normalize_json_batches(value if isinstance(value, list) else [], batch_size)
            return

    batch = []
    record_number = 0
    while position < len(text):
        while position < len(text) and (text[position].isspace() or text[position] == ","):
            position += 1
        if position >= len(text) or text[position] == "]":
            break
        try:
            item, position = decoder.raw_decode(text, position)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON upload near character {exc.pos}") from exc
        if isinstance(item, dict):
            record_number += 1
            entry = _normalize_json_entry(item, record_number)
            batch.append(entry)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def _iter_json_lines(text, batch_size, parse_error):
    batch = []
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON upload: {exc.msg}") from parse_error
        if isinstance(item, dict):
            batch.append(_normalize_json_entry(item, line_number))
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def _normalize_json_batches(items, batch_size):
    batch = []
    for index, item in enumerate(items, 1):
        if isinstance(item, dict):
            batch.append(_normalize_json_entry(item, index))
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def _normalize_json_entry(item, line_number):
    severity = _normalize_severity(item.get("level") or item.get("severity"))
    return {
        "line": line_number,
        "timestamp": str(item.get("timestamp") or datetime.datetime.now(datetime.timezone.utc).isoformat()),
        "severity": severity,
        "source": str(item.get("source") or item.get("service") or item.get("app") or "json-app"),
        "ip": str(item.get("ip") or item.get("client_ip") or "-"),
        "pid": str(item.get("pid") or "-"),
        "message": str(item.get("message") or item.get("msg") or json.dumps(item)),
    }


def _normalize_severity(value):
    severity = str(value or "INFO").strip().upper()
    if severity in ("INFO", "WARN", "ERROR", "CRITICAL", "DEBUG"):
        return severity
    if "WARN" in severity:
        return "WARN"
    if "CRIT" in severity or severity in ("FATAL", "EMERG", "ALERT"):
        return "CRITICAL"
    if "ERR" in severity:
        return "ERROR"
    return "INFO"


def process_upload_job(job_id):
    try:
        with get_db() as db:
            claimed = db.execute(
                update(upload_jobs).where(
                    upload_jobs.c.id == job_id,
                    upload_jobs.c.status == "queued",
                ).values(status="processing", stage="parsing")
            )
            if claimed.rowcount != 1:
                return
            job = db.execute(select(upload_jobs).where(upload_jobs.c.id == job_id)).mappings().first()
            if not job:
                return
            file_row = db.execute(
                select(uploaded_files.c.filename, uploaded_files.c.content_data)
                .where(uploaded_files.c.id == job["file_id"])
            ).mappings().first()

        if not file_row or file_row["content_data"] is None:
            raise RuntimeError("Uploaded file data is unavailable.")

        total = 0
        severity = Counter()
        sources = Counter()
        preview = []
        flagged = []
        flagged_total = 0
        model_totals = Counter()
        confidence_totals = Counter()
        feature_totals = Counter()
        timeline = []
        score_total = 0.0
        confidence_total = 0.0
        agreement_total = 0.0
        countermeasure_ips = set()
        threat_types = set()
        iptables = set()
        windows_rules = set()
        nftables = set()
        input_content = file_row["content_data"]

        for batch in iter_log_batches(input_content, file_row["filename"]):
            result = run_ensemble(batch, source="upload")
            batch_count = len(batch)
            total += batch_count
            severity.update(_normalize_severity(log.get("severity")) for log in batch)
            sources.update(str(log.get("source", "unknown")).lower() for log in batch)
            if len(preview) < 100:
                preview.extend(batch[:100 - len(preview)])

            consensus = result.get("consensus", {})
            score_total += float(consensus.get("master_anomaly_score", 0)) * batch_count
            confidence_total += float(consensus.get("confidence", 0)) * batch_count
            agreement_total += float(consensus.get("algorithm_agreement_pct", 0)) * batch_count
            for item in result.get("all_results", []):
                model_totals[item["algorithm"]] += float(item.get("score", 0)) * batch_count
                confidence_totals[item["algorithm"]] += float(item.get("confidence", 0)) * batch_count
            for label, value in zip(
                result.get("feature_importance", {}).get("labels", []),
                result.get("feature_importance", {}).get("values", []),
            ):
                feature_totals[label] += float(value) * batch_count
            timeline.extend(result.get("timeline", {}).get("scores", []))

            flagged.extend(result.get("flagged_entries", []))
            flagged_total += len(result.get("flagged_entries", []))
            flagged = sorted(flagged, key=lambda entry: entry.get("anomaly_score", 0), reverse=True)[:_MAX_FLAGGED_RECORDS]
            measures = result.get("countermeasures", {})
            if len(countermeasure_ips) < 1000:
                countermeasure_ips.update(measures.get("target_ips", [])[:1000 - len(countermeasure_ips)])
            threat_types.update(measures.get("threat_types", []))
            if len(iptables) < 6:
                iptables.update(measures.get("iptables_rules", [])[:6 - len(iptables)])
            if len(windows_rules) < 6:
                windows_rules.update(measures.get("windows_firewall_rules", [])[:6 - len(windows_rules)])
            if len(nftables) < 6:
                nftables.update(measures.get("nftables_rules", [])[:6 - len(nftables)])

            with get_db() as db:
                db.execute(
                    update(upload_jobs).where(upload_jobs.c.id == job_id)
                    .values(stage="analyzing", processed_records=total, updated_at=datetime.datetime.now(datetime.timezone.utc))
                )

        if not total:
            raise ValueError("Could not parse any log records from the uploaded file.")

        mean_score = score_total / total
        mean_confidence = confidence_total / total
        risk = "CRITICAL" if mean_score >= 0.78 else "HIGH" if mean_score >= 0.58 else "MEDIUM" if mean_score >= 0.38 else "LOW"
        all_results = []
        for name, score in model_totals.items():
            all_results.append({
                "algorithm": name,
                "score": round(score / total, 4),
                "confidence": round(confidence_totals[name] / total, 3),
                "note": "Batch-averaged ensemble result across all uploaded records.",
                "consensus_weight": "",
            })
        ml_result = {
            "success": True,
            "source": "upload",
            "total_analyzed": total,
            "consensus": {
                "master_anomaly_score": round(mean_score, 4),
                "anomaly_score": round(mean_score, 4),
                "risk_level": risk,
                "confidence": round(mean_confidence, 3),
                "algorithm_agreement_pct": round(agreement_total / total, 1),
                "anomaly_count": flagged_total,
                "total_logs": total,
            },
            "consensus_score": round(mean_score, 4),
            "anomaly_score": round(mean_score, 4),
            "confidence": round(mean_confidence, 3),
            "risk_level": risk,
            "all_results": all_results,
            "best_algorithm": "Batch-averaged multi-model ensemble",
            "flagged_entries": flagged,
            "feature_importance": {
                "labels": list(feature_totals),
                "values": [round(feature_totals[key] / total, 3) for key in feature_totals],
            },
            "timeline": {"labels": [f"Batch {i + 1}" for i in range(len(timeline))], "scores": timeline},
            "countermeasures": {
                "target_ips": list(countermeasure_ips)[:1000],
                "threat_types": list(threat_types),
                "iptables_rules": list(iptables)[:6],
                "windows_firewall_rules": list(windows_rules)[:6],
                "nftables_rules": list(nftables)[:6],
                "firewall_rules": [],
                "action_checklist": ["Review flagged records and validate proposed host blocks before applying."],
                "quarantined_ips": list(countermeasure_ips)[:10],
            },
        }
        results_payload = {
            "source": "upload",
            "records_embedded": False,
            "filename": file_row["filename"],
            "total_logs": total,
            "lines_parsed": total,
            "anomalies": flagged_total,
            "anomalies_found": flagged_total,
            "severity": dict(severity),
            "top_sources": dict(sources),
            "ml": ml_result,
            "ml_analysis": ml_result,
            "preview": preview,
        }

        with get_db() as db:
            db.execute(
                update(log_analyses).where(log_analyses.c.id == job["analysis_id"])
                .values(status="completed", results=results_payload)
            )
            db.execute(
                update(uploaded_files).where(uploaded_files.c.id == job["file_id"])
                .values(status="analyzed")
            )
            db.execute(
                update(upload_jobs).where(upload_jobs.c.id == job_id)
                .values(status="completed", stage="complete", processed_records=total)
            )
    except Exception as exc:
        logging.exception("Upload processing failed for job %s", job_id)
        with get_db() as db:
            db.execute(
                update(upload_jobs).where(upload_jobs.c.id == job_id)
                .values(status="failed", stage="failed", error=str(exc))
            )
            job = db.execute(select(upload_jobs).where(upload_jobs.c.id == job_id)).mappings().first()
            if job:
                db.execute(
                    update(log_analyses).where(log_analyses.c.id == job["analysis_id"])
                    .values(status="failed", results={"error": str(exc)})
                )
                db.execute(
                    update(uploaded_files).where(uploaded_files.c.id == job["file_id"])
                    .values(status="failed")
                )
