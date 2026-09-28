from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class MitreTechnique:
    technique_id: str
    name: str
    tactic: str
    description: str
    indicators: str
    remediation: str


MITRE_TECHNIQUES: dict[str, MitreTechnique] = {
    "T1110": MitreTechnique(
        technique_id="T1110",
        name="Brute Force",
        tactic="Credential Access",
        description="Adversaries try many passwords to gain access to accounts without proper knowledge.",
        indicators="High-frequency authentication failures, clustered account probes, rapid retry cycles.",
        remediation="Enable MFA, account lockout policies, rate limiting, and block offending IPs.",
    ),
    "T1190": MitreTechnique(
        technique_id="T1190",
        name="Exploit Public-Facing Application",
        tactic="Initial Access",
        description="Adversaries exploit weaknesses in internet-facing services to gain access.",
        indicators="Server error spikes, SQL injection patterns, path traversal, malformed headers.",
        remediation="Deploy WAF, patch dependencies, isolate public-facing services.",
    ),
    "T1046": MitreTechnique(
        technique_id="T1046",
        name="Network Service Discovery",
        tactic="Discovery",
        description="Adversaries scan for services to identify attack opportunities.",
        indicators="Anomalous request spread across endpoints, port probing, directory brute-forcing.",
        remediation="Network ACLs, rate limiting, obscure non-essential services.",
    ),
    "T1059": MitreTechnique(
        technique_id="T1059",
        name="Command and Scripting Interpreter",
        tactic="Execution",
        description="Adversaries abuse system interpreters to execute commands.",
        indicators="Shell invocations (cmd, powershell, /bin/sh), pipe sequences, escape characters.",
        remediation="Restrict process privileges, application allowlisting, enforce SELinux/AppArmor.",
    ),
    "T1078": MitreTechnique(
        technique_id="T1078",
        name="Valid Accounts",
        tactic="Defense Evasion",
        description="Adversaries use compromised credentials to evade detection.",
        indicators="Privileged access after sustained failures, geographically anomalous logins.",
        remediation="Revoke sessions, force credential resets, audit credential usage.",
    ),
    "T1499": MitreTechnique(
        technique_id="T1499",
        name="Endpoint Denial of Service",
        tactic="Impact",
        description="Adversaries perform DoS attacks to degrade or block availability.",
        indicators="Connection flooding, resource exhaustion, HTTP connection holds.",
        remediation="DDoS protection, layer-7 challenge tokens, blackhole offending IP blocks.",
    ),
    "T1071": MitreTechnique(
        technique_id="T1071",
        name="Application Layer Protocol",
        tactic="Command and Control",
        description="Adversaries communicate using application layer protocols to evade detection.",
        indicators="Unusual outbound HTTP/S traffic, beaconing patterns, encoded payloads.",
        remediation="Monitor outbound traffic, proxy all HTTP/S, detect beaconing patterns.",
    ),
    "T1083": MitreTechnique(
        technique_id="T1083",
        name="File and Directory Discovery",
        tactic="Discovery",
        description="Adversaries enumerate files and directories to locate sensitive data.",
        indicators="Recursive directory traversal, access to sensitive paths, mass file reads.",
        remediation="Least-privilege file access, audit file access logs, honeypot files.",
    ),
    "T1055": MitreTechnique(
        technique_id="T1055",
        name="Process Injection",
        tactic="Privilege Escalation",
        description="Adversaries inject code into running processes to escalate privileges.",
        indicators="Unusual process spawning, memory injection patterns, process hollowing.",
        remediation="EDR solutions, process integrity monitoring, restrict injection APIs.",
    ),
    "T1005": MitreTechnique(
        technique_id="T1005",
        name="Data from Local System",
        tactic="Collection",
        description="Adversaries collect sensitive data from local file systems.",
        indicators="Large file reads, access to credential stores, sensitive directory traversal.",
        remediation="DLP solutions, monitor sensitive file access, encrypt sensitive data at rest.",
    ),
}

# Backward compat alias
MITRE_ENTERPRISE_TAXONOMY = MITRE_TECHNIQUES


def lookup_technique(technique_id: str | None) -> Optional[MitreTechnique]:
    if not technique_id:
        return None
    t = MITRE_TECHNIQUES.get(technique_id.strip().upper())
    if t:
        # Add backward compat attributes
        return t
    return None


def get_all_tactics() -> list[str]:
    return sorted(set(t.tactic for t in MITRE_TECHNIQUES.values()))
