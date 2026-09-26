from collections import Counter
from dataclasses import dataclass
from typing import Any


@dataclass
class RuleFinding:
    threat_domain: str
    urgency_level: str
    rule_score: int
    technique_id: str | None
    rationale: str
    confidence: int


class BehavioralSignatureScanner:
    EXPLOIT_PATTERNS = {
        "sql_injection": ("sqlmap", "union select", "order by", "information_schema", "' or '1'='1", "-- -"),
        "path_traversal": ("../", "..\\", "/etc/passwd", "win.ini", "boot.ini"),
        "command_injection": ("cmd=", "powershell", "/bin/sh", "/bin/bash", "whoami", "wget ", "curl "),
        "code_execution": ("eval(", "exec(", "base64_decode", "<script", "onload="),
    }

    @classmethod
    def evaluate_record(cls, record: dict[str, Any], origin_frequency: int) -> RuleFinding | None:
        blob = f"{record.get('log_excerpt') or ''} {record.get('payload_blob') or ''}".lower()
        classification = record.get("signal_classification") or ""
        code = record.get("response_code")

        # 1. Critical Exploit Payloads
        for category, patterns in cls.EXPLOIT_PATTERNS.items():
            matched = [p for p in patterns if p in blob]
            if matched:
                return RuleFinding(
                    threat_domain="Exploit Payload",
                    urgency_level="Critical",
                    rule_score=94,
                    technique_id="T1190" if category in ("sql_injection", "path_traversal") else "T1059",
                    rationale=f"Hostile payload signature detected matching {category} indicators: {', '.join(matched[:2])}.",
                    confidence=92,
                )

        # 2. Authentication Abuse (Credential Access)
        if classification == "AuthAnomaly" or (code in (401, 403) and "password" in blob):
            return RuleFinding(
                threat_domain="Credential Abuse",
                urgency_level="High",
                rule_score=80,
                technique_id="T1110",
                rationale="Authentication rejection sequence recorded indicating potential credential stuffing or brute-force probe.",
                confidence=85,
            )

        # 3. High Volume Reconnaissance (Network Discovery)
        if origin_frequency >= 10:
            return RuleFinding(
                threat_domain="Reconnaissance Scan",
                urgency_level="High",
                rule_score=78,
                technique_id="T1046",
                rationale=f"Excessive telemetry density originating from single address ({origin_frequency} operations).",
                confidence=80,
            )

        # 4. Server Instability / Application Faults
        if code and code >= 500:
            return RuleFinding(
                threat_domain="Service Instability",
                urgency_level="Elevated",
                rule_score=60,
                technique_id="T1190",
                rationale=f"Internal application fault (HTTP {code}) observed, signaling backend exception or server probing.",
                confidence=70,
            )

        # 5. Access Policy Violations
        if code in (401, 403):
            return RuleFinding(
                threat_domain="Access Violation",
                urgency_level="Elevated",
                rule_score=52,
                technique_id="T1078",
                rationale=f"Client access denied (HTTP {code}) on restricted endpoint.",
                confidence=65,
            )

        return None
