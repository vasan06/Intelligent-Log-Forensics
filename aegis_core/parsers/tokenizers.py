import csv
from dataclasses import asdict, dataclass
import io
import json
from pathlib import Path
import re
from typing import Any

from aegis_core.parsers.sanitizers import (
    extract_http_verb,
    normalize_temporal_epoch,
    validate_http_status,
    validate_ip_address,
)


@dataclass
class NormalizedSignal:
    observed_epoch: str | None
    origin_address: str | None
    actor_identifier: str | None
    resource_target: str | None
    action_verb: str | None
    response_code: int | None
    signal_classification: str
    log_excerpt: str | None
    payload_blob: str

    def to_tuple(self, vault_id: int) -> tuple:
        return (
            vault_id,
            self.observed_epoch,
            self.origin_address,
            self.actor_identifier,
            self.resource_target,
            self.action_verb,
            self.response_code,
            self.signal_classification,
            self.log_excerpt,
            self.payload_blob,
        )


COMBINED_LOG_REGEX = re.compile(
    r'^(?P<ip>\S+)\s+\S+\s+(?P<actor>\S+)\s+\[(?P<time>[^\]]+)\]\s+'
    r'"(?P<verb>[A-Z]+)\s+(?P<path>[^\s"]+)[^"]*"\s+(?P<status>\d{3})\s+(?P<bytes>\S+)'
)

KEY_VALUE_REGEX = re.compile(r'(\w+)=(?:"([^"]*)"|(\S+))')


def classify_signal(text_blob: str, status_code: int | None) -> str:
    blob_lower = text_blob.lower()
    
    exploit_markers = (
        "sqlmap", "union select", "../", "..\\", "cmd=", "powershell",
        "<script", "exec(", "etc/passwd", "system32", "0x90", "base64_decode"
    )
    if any(m in blob_lower for m in exploit_markers):
        return "ExploitVector"
        
    auth_markers = (
        "failed password", "authentication failure", "invalid credentials",
        "access denied", "logon failure", "bad password", "auth failed"
    )
    if any(m in blob_lower for m in auth_markers):
        return "AuthAnomaly"
        
    if status_code and status_code >= 500:
        return "ServerFault"
    if status_code in (401, 403):
        return "ClientDenied"
        
    return "RoutineTelemetry"


class LogStreamTokenizer:
    @classmethod
    def parse_stream(cls, raw_bytes: bytes, file_name: str) -> list[NormalizedSignal]:
        text_content = raw_bytes.decode("utf-8", errors="replace")
        ext = Path(file_name).suffix.lower()

        if ext == ".csv":
            return cls._tokenize_csv(text_content)
        elif ext in (".json", ".jsonl"):
            return cls._tokenize_json(text_content)
        else:
            return cls._tokenize_unstructured(text_content)

    @classmethod
    def _tokenize_csv(cls, text: str) -> list[NormalizedSignal]:
        signals: list[NormalizedSignal] = []
        stream = io.StringIO(text)
        try:
            reader = csv.DictReader(stream)
            for row in reader:
                if not row or not any(row.values()):
                    continue
                signals.append(cls._normalize_dict_record(row))
        except Exception:
            return cls._tokenize_unstructured(text)
        return signals

    @classmethod
    def _tokenize_json(cls, text: str) -> list[NormalizedSignal]:
        signals: list[NormalizedSignal] = []
        cleaned = text.strip()
        
        if "\n" in cleaned and not (cleaned.startswith("[") and cleaned.endswith("]")):
            for line in cleaned.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    if isinstance(obj, dict):
                        signals.append(cls._normalize_dict_record(obj))
                except json.JSONDecodeError:
                    continue
            if signals:
                return signals

        try:
            payload = json.loads(cleaned)
            if isinstance(payload, list):
                for item in payload:
                    if isinstance(item, dict):
                        signals.append(cls._normalize_dict_record(item))
            elif isinstance(payload, dict):
                candidates = payload.get("events") or payload.get("logs") or payload.get("records") or [payload]
                if isinstance(candidates, list):
                    for item in candidates:
                        if isinstance(item, dict):
                            signals.append(cls._normalize_dict_record(item))
                        else:
                            signals.append(cls._normalize_plain_record(str(item)))
        except json.JSONDecodeError:
            return cls._tokenize_unstructured(text)
            
        return signals

    @classmethod
    def _tokenize_unstructured(cls, text: str) -> list[NormalizedSignal]:
        signals: list[NormalizedSignal] = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue

            clf_match = COMBINED_LOG_REGEX.match(line)
            if clf_match:
                d = clf_match.groupdict()
                status = validate_http_status(d.get("status"))
                actor = d.get("actor") if d.get("actor") != "-" else None
                signals.append(
                    NormalizedSignal(
                        observed_epoch=normalize_temporal_epoch(d.get("time")),
                        origin_address=validate_ip_address(d.get("ip")),
                        actor_identifier=actor,
                        resource_target=d.get("path"),
                        action_verb=d.get("verb"),
                        response_code=status,
                        signal_classification=classify_signal(line, status),
                        log_excerpt=line,
                        payload_blob=json.dumps(d),
                    )
                )
                continue

            kv_pairs = KEY_VALUE_REGEX.findall(line)
            if len(kv_pairs) >= 3:
                kv_dict = {k.lower(): (v1 or v2) for k, v1, v2 in kv_pairs}
                signals.append(cls._normalize_dict_record(kv_dict, raw_line=line))
                continue

            signals.append(cls._normalize_plain_record(line))

        return signals

    @classmethod
    def _normalize_dict_record(cls, row: dict[str, Any], raw_line: str | None = None) -> NormalizedSignal:
        flattened = " ".join(f"{k}:{v}" for k, v in row.items())
        raw_dump = raw_line or json.dumps(row, default=str)
        
        ip_token = cls._pick_first(row, ["source_ip", "src_ip", "client_ip", "remote_addr", "ip", "origin"])
        origin_ip = validate_ip_address(ip_token) or validate_ip_address(flattened)
        
        actor = cls._pick_first(row, ["user", "username", "account", "actor", "login", "identity"])
        if actor and actor in ("-", "null", "none"):
            actor = None
            
        target = cls._pick_first(row, ["endpoint", "path", "uri", "url", "route", "target"])
        
        verb = cls._pick_first(row, ["method", "http_method", "action", "verb"])
        verb = extract_http_verb(verb) or extract_http_verb(flattened)
        
        status_token = cls._pick_first(row, ["status", "status_code", "code", "http_status", "response_code"])
        status = validate_http_status(status_token) or validate_http_status(None, contextual_text=flattened)
        
        epoch_token = cls._pick_first(row, ["timestamp", "time", "date", "@timestamp", "epoch", "datetime"])
        epoch = normalize_temporal_epoch(epoch_token) or normalize_temporal_epoch(flattened)
        
        excerpt = cls._pick_first(row, ["message", "msg", "log", "description", "event", "detail"]) or flattened
        
        classification = classify_signal(f"{excerpt} {raw_dump}", status)

        return NormalizedSignal(
            observed_epoch=epoch,
            origin_address=origin_ip,
            actor_identifier=actor,
            resource_target=target,
            action_verb=verb,
            response_code=status,
            signal_classification=classification,
            log_excerpt=excerpt,
            payload_blob=raw_dump,
        )

    @classmethod
    def _normalize_plain_record(cls, line: str) -> NormalizedSignal:
        ip = validate_ip_address(line)
        verb = extract_http_verb(line)
        status = validate_http_status(None, contextual_text=line)
        epoch = normalize_temporal_epoch(line)
        classification = classify_signal(line, status)

        return NormalizedSignal(
            observed_epoch=epoch,
            origin_address=ip,
            actor_identifier=None,
            resource_target=None,
            action_verb=verb,
            response_code=status,
            signal_classification=classification,
            log_excerpt=line,
            payload_blob=json.dumps({"line": line}),
        )

    @staticmethod
    def _pick_first(record: dict[str, Any], candidates: list[str]) -> Any | None:
        lowered = {k.lower(): v for k, v in record.items()}
        for key in candidates:
            if key in lowered and lowered[key] not in (None, ""):
                return str(lowered[key]).strip()
        return None
