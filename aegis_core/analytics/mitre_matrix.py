from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class MitreTacticSpec:
    technique_id: str
    technique_label: str
    tactic_domain: str
    behavioral_markers: str
    remediation_playbook: str


MITRE_ENTERPRISE_TAXONOMY: dict[str, MitreTacticSpec] = {
    "T1110": MitreTacticSpec(
        technique_id="T1110",
        technique_label="Brute Force Authentication",
        tactic_domain="Credential Access",
        behavioral_markers="High-frequency authentication rejections, clustered account probes, and rapid retry cycles.",
        remediation_playbook="Activate progressive rate limits, enforce MFA, trigger account lockouts, and blacklist offending subnet origins.",
    ),
    "T1190": MitreTacticSpec(
        technique_id="T1190",
        technique_label="Exploit Public-Facing Application",
        tactic_domain="Initial Access",
        behavioral_markers="Server-side fault spikes, structured traversal syntax, SQL injection payloads, and malformed header vectors.",
        remediation_playbook="Deploy WAF blocking signatures, patch vulnerable web service dependencies, and isolate public listener ingress.",
    ),
    "T1046": MitreTacticSpec(
        technique_id="T1046",
        technique_label="Network Service Discovery",
        tactic_domain="Discovery",
        behavioral_markers="Anomalous request dispersion across varied endpoints, directory brute forcing, and port reconnaissance.",
        remediation_playbook="Apply strict egress network ACLs, obfuscate routing interfaces, and throttle exploratory probes.",
    ),
    "T1059": MitreTacticSpec(
        technique_id="T1059",
        technique_label="Command & Scripting Execution",
        tactic_domain="Execution",
        behavioral_markers="System binary invocation parameters (cmd, powershell, /bin/sh), shell escape characters, and pipe sequences.",
        remediation_playbook="Restrict daemon process privileges, execute with least privilege, and enforce app locker/SELinux profiles.",
    ),
    "T1078": MitreTacticSpec(
        technique_id="T1078",
        technique_label="Valid Account Hijacking",
        tactic_domain="Defense Evasion",
        behavioral_markers="Privileged session establishment following sustained failure events, or geographically anomalous access origins.",
        remediation_playbook="Revoke session tokens immediately, force credential regeneration, and conduct credential compromise audit.",
    ),
    "T1499": MitreTacticSpec(
        technique_id="T1499",
        technique_label="Endpoint Denial of Service",
        tactic_domain="Impact",
        behavioral_markers="Volumetric connection flooding, resource exhaustion vectors, and unmitigated HTTP connection holds.",
        remediation_playbook="Engage upstream DDoS protection, implement layer-7 challenge tokens, and dynamically blackhole offending IP blocks.",
    ),
}


def lookup_technique(technique_id: str | None) -> Optional[MitreTacticSpec]:
    if not technique_id:
        return None
    return MITRE_ENTERPRISE_TAXONOMY.get(technique_id.strip().upper())
