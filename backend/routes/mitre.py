"""routes/mitre.py — MITRE ATT&CK catalog, mapping, and technique detail"""
import json, os, re, jwt
from sqlalchemy import select
from backend import config
from backend.database import get_db
from backend.models.log_analysis import log_analyses
from flask import Blueprint, request, jsonify

mitre_bp = Blueprint('mitre', __name__)

# Load catalog once at startup
_CATALOG_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'mitre_catalog.json')
with open(_CATALOG_PATH, encoding='utf-8') as f:
    _CATALOG = json.load(f)

_TECHNIQUES = {t['id']: t for t in _CATALOG['techniques']}
_TACTICS    = {t['id']: t for t in _CATALOG['tactics']}

REMEDIATIONS = {
    "T1190": "Apply security patches immediately; place web application firewall (WAF) in front of vulnerable endpoints; enforce input validation and parameterized SQL queries; disable unnecessary HTTP methods.",
    "T1078": "Enforce Multi-Factor Authentication (MFA); audit active sessions and revoke compromised credentials; rotate service account passwords; implement least privilege access control.",
    "T1566": "Isolate recipient workstation from network; block sender domain on email gateway; revoke active session tokens; run endpoint malware scan on recipient device.",
    "T1133": "Restrict VPN/RDP access to approved IP ranges; mandate hardware token MFA; enforce session timeouts; isolate external jump hosts in dedicated DMZ.",
    "T1059": "Restrict command-line / PowerShell script execution policy to signed scripts; enable script block logging (EID 4104); quarantine originating process.",
    "T1110": "Enforce account lockout policies after repeated failures; implement IP-based rate limiting on login routes; mandate CAPTCHA / multi-factor verification.",
    "T1486": "Immediately isolate affected host from LAN/VLAN to prevent encryption spread; do not reboot; capture memory snapshot; restore systems from immutable offline backups.",
    "T1048": "Terminate active outbound network connections on firewall; block anomalous egress ports; inspect data payload for sensitive DLP markers; rotate credentials.",
    "T1070": "Forward syslog/auditd events in real-time to an immutable, write-only SIEM; restrict local administrator ability to clear Windows Security Event Log.",
    "T1068": "Deploy operating system and kernel security patches; disable unprivileged user namespaces and suid binaries; restrict root access.",
    "T1021": "Disable RDP/SMB on public-facing interfaces; enforce Network Level Authentication (NLA); restrict inter-subnet remote administrative traffic.",
    "T1046": "Block scanning source IP on perimeter firewall; drop unauthorized TCP SYN packets; review exposed services and close unneeded listening ports.",
    "T1498": "Enable anti-DDoS scrubbing; configure rate-limiting in web server / reverse proxy (nginx limit_req); blackhole attacking IP subnets at upstream router.",
    "T1505": "Inspect web server directories for unauthorized PHP/JSP/ASPX files; check file modification timestamps against version control; restrict script execution in upload directories."
}
DEFAULT_REMEDIATION = "Isolate affected endpoint, collect forensic volatile memory snapshot, review active network connections, and rotate associated authentication credentials."

ATTACK_NARRATIVES = {
    "T1190": {
        "step1": "Attacker scans public IP/ports (80/443), identifies unpatched input fields, and submits crafted SQLi/JNDI/SSRF payloads.",
        "step2": "The backend framework processes raw unsanitized input, executing the payload directly in the application runtime process.",
        "step3": "Attacker exfiltrates database tables, uploads an interactive web shell, and establishes remote command foothold.",
        "scenario_case": "Log4Shell (CVE-2021-44228) & Equifax Apache Struts RCE: Exploitation of string parsing in headers to trigger arbitrary remote code execution.",
        "remediation_solution": "Place WAF in blocking mode, enforce parameterized database queries, and quarantine web service PID.",
        "remediation_command": "sudo iptables -I INPUT -p tcp --dport 443 -m string --algo bm --string \"UNION SELECT\" -j DROP\nnginx -s reload"
    },
    "T1078": {
        "step1": "Attacker acquires valid username and password credentials through phishing, dark web credential dumps, or default vendor logins.",
        "step2": "Adversary logs in through authentic VPN, SSH, or cloud management consoles during off-peak hours, evading perimeter firewalls.",
        "step3": "Using legitimate account permissions, adversary queries sensitive customer databases and creates secondary persistence accounts.",
        "scenario_case": "Colonial Pipeline VPN Breach: Single-factor compromised password used to access corporate network, causing major operational disruption.",
        "remediation_solution": "Immediately revoke all active user sessions, rotate credentials, revoke API tokens, and enforce hardware MFA.",
        "remediation_command": "aws iam revoke-security-tokens --user-name compromised-admin\nGet-ADUser -Identity \"compromised_user\" | Disable-ADAccount"
    },
    "T1566": {
        "step1": "Victim receives a spearphishing email with an urgent invoice pretext containing an embedded malicious macro or weaponized PDF attachment.",
        "step2": "Victim opens the attachment; an automated background script invokes hidden PowerShell or cmd.exe processes in memory.",
        "step3": "Script downloads Cobalt Strike beacon or info-stealer, harvesting browser sessions, credentials, and local documents.",
        "scenario_case": "Emotet / TrickBot Infection Waves: Password-protected ZIP archives containing weaponized Office documents delivering banking trojans.",
        "remediation_solution": "Quarantine victim workstation, block sender domain on email gateway, and revoke compromised user session tokens.",
        "remediation_command": "Disable-NetAdapter -Name \"Ethernet*\" -Confirm:$false\nSearch-Mailbox -Identity \"All\" -SearchQuery 'Subject:\"Urgent Invoice\"' -DeleteContent -Force"
    },
    "T1133": {
        "step1": "Attacker maps internet-facing remote services (RDP 3389, SSH 22, Citrix, Pulse Secure VPN) exposed directly to the public web.",
        "step2": "Adversary executes high-concurrency credential spraying or exploits unpatched SSL VPN gateway vulnerabilities.",
        "step3": "Attacker establishes encrypted tunnel into enterprise DMZ, pivoting laterally toward internal domain controllers.",
        "scenario_case": "Pulse Secure / Citrix Gateway VPN Zero-Day: Remote unauthenticated path traversal exploited to harvest session cookies and bypass gateway MFA.",
        "remediation_solution": "Block scanning source IP on edge firewall, disable direct RDP to internet, mandate VPN MFA, and restrict source subnets.",
        "remediation_command": "sudo ufw deny from 185.220.101.5 to any proto tcp\nfail2ban-client set sshd banip 185.220.101.5"
    },
    "T1059": {
        "step1": "Attacker drops an obfuscated PowerShell, Bash, or Python script onto disk or passes encoded strings to the command line.",
        "step2": "Attacker invokes 'powershell.exe -ExecutionPolicy Bypass -NoProfile -EncodedCommand', running instructions purely in RAM.",
        "step3": "In-memory script injects shellcode into svchost.exe, evading file-based antivirus and establishing persistent reverse C2 connection.",
        "scenario_case": "SolarWinds SUNBURST & Cobalt Strike In-Memory Beacons: Executing encoded in-memory scripts to perform internal network reconnaissance.",
        "remediation_solution": "Enforce PowerShell ConstrainedLanguageMode, enable script block logging (Event ID 4104), and terminate offending process tree.",
        "remediation_command": "Set-ExecutionPolicy -ExecutionPolicy Restricted -Scope LocalMachine -Force\nStop-Process -Id 4812 -Force"
    },
    "T1110": {
        "step1": "Attacker deploys automated brute-force tools (Hydra, Medusa) cycling common passwords against exposed SSH or web authentication endpoints.",
        "step2": "Web server logs record hundreds of failed authentication attempts within seconds ('Failed password for invalid user').",
        "step3": "A single valid password match is obtained, allowing attacker to log in with shell access and proceed with local privilege escalation.",
        "scenario_case": "Mirai & FritzFrog Botnets: Mass distributed SSH password spraying against Linux servers running default root or administrator passwords.",
        "remediation_solution": "Enforce account lockouts after 5 consecutive failures, configure fail2ban dynamic IP bans, and disable password-based SSH.",
        "remediation_command": "sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set\nsudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 -j DROP"
    },
    "T1486": {
        "step1": "Adversary distributes ransomware binary across enterprise network shares or Active Directory Group Policy Objects (GPO).",
        "step2": "Ransomware terminates database services and runs 'vssadmin delete shadows /all /quiet' to eliminate Volume Shadow Copy backups.",
        "step3": "Process encrypts documents and databases using AES-256 / RSA-4096, renames extensions to .locked, and drops ransom notes on desktops.",
        "scenario_case": "LockBit 3.0 & WannaCry Outbreaks: High-speed multithreaded file encryption disabling hypervisor hosts and extorting organizations.",
        "remediation_solution": "Immediately disconnect host from network (do NOT reboot). Capture memory dump and restore systems from offline immutable backups.",
        "remediation_command": "Disable-NetAdapter -Name \"Ethernet*\" -Confirm:$false\nGet-Service -Name \"VolumeShadowCopy\" | Start-Service"
    },
    "T1048": {
        "step1": "Attacker aggregates sensitive intellectual property and customer databases into encrypted 7z/tar archives.",
        "step2": "Adversary opens non-standard egress channels (DNS tunneling, ICMP payload streams, or encrypted POST requests to external VPS).",
        "step3": "Confidential data flows out past perimeter inspection without triggering standard email or web filtering alerts.",
        "scenario_case": "Lapsus$ Extortion: Double-extortion exfiltration of source code and proprietary keys before notifying victims of the breach.",
        "remediation_solution": "Blackhole destination IP address on edge routers, reset egress gateway NAT, and alert on anomalous egress traffic spikes.",
        "remediation_command": "sudo route add -host 198.51.100.45 reject\nsudo iptables -A OUTPUT -d 198.51.100.45 -j REJECT"
    },
    "T1070": {
        "step1": "Attacker attains root or local administrator privileges on the target server.",
        "step2": "Adversary issues 'wevtutil cl Security' or 'rm -rf /var/log/*' to delete authentication logs, syslog trails, and command histories.",
        "step3": "Forensic timeline reconstruction is blinded, impeding incident responders from discovering the entry point or exfiltration scope.",
        "scenario_case": "APT29 Nobelium Counter-Forensics: Clearing Windows Event Log 1102 and applying timestomping techniques to obscure intrusion artifacts.",
        "remediation_solution": "Stream logs in real-time to an append-only remote SIEM, enforce write-once permissions on /var/log, and alert on log clearance events.",
        "remediation_command": "sudo chattr +a /var/log/auth.log\nwevtutil sl Security /e:true /rt:false"
    },
    "T1068": {
        "step1": "Attacker establishes an unprivileged initial shell as a restricted service account (e.g. www-data).",
        "step2": "Adversary compiles and runs a local privilege escalation exploit targeting unpatched kernel vulnerabilities or SUID binaries.",
        "step3": "Kernel thread executes with root UID 0 permissions, elevating the attacker to unrestricted machine control.",
        "scenario_case": "PwnKit (CVE-2021-4034) & Dirty Pipe (CVE-2022-0847): Local privilege escalation exploiting polkit pkexec to gain immediate root shells.",
        "remediation_solution": "Patch operating system kernel immediately, strip SUID bits from unnecessary binaries, and enable SELinux / AppArmor.",
        "remediation_command": "sudo setenforce 1\nchmod -s /usr/local/bin/legacy_wrapper"
    }
}

@mitre_bp.route('/mitre/tactics')
def tactics():
    return jsonify({'tactics': _CATALOG['tactics']})

@mitre_bp.route('/mitre/catalog')
def catalog():
    q      = (request.args.get('q') or '').lower()
    tactic = request.args.get('tactic') or ''
    sev    = request.args.get('severity') or ''
    page   = max(int(request.args.get('page', 1)), 1)
    limit  = min(int(request.args.get('limit', 20)), 50)

    results = list(_CATALOG['techniques'])

    if q:
        results = [t for t in results if
                   q in t['name'].lower() or q in t['description'].lower()
                   or any(q in p.lower() for p in t.get('log_patterns', []))]
    if tactic:
        results = [t for t in results if t['tactic'] == tactic]
    if sev:
        results = [t for t in results if t['severity'] == sev]

    total  = len(results)
    start  = (page - 1) * limit
    paged  = results[start: start + limit]

    # Attach tactic metadata, step-by-step walkthrough, scenarios & remediation
    for t in paged:
        tid = t['id']
        t['tactic_info'] = _TACTICS.get(t['tactic'], {})
        narr = ATTACK_NARRATIVES.get(tid, {
            'step1': f"Attacker targets host surfaces looking for attack paths via {t['name']}.",
            'step2': f"Adversary triggers unauthorized execution or abuses permissions.",
            'step3': f"Internal network assets, memory tokens, or data streams are compromised.",
            'scenario_case': t.get('examples', ['Real-world adversary campaign'])[0] if t.get('examples') else 'Enterprise threat intrusion.',
            'remediation_solution': REMEDIATIONS.get(tid, DEFAULT_REMEDIATION),
            'remediation_command': 'sudo iptables -A INPUT -s <OFFENDING_IP> -j DROP'
        })
        t['step1'] = narr['step1']
        t['step2'] = narr['step2']
        t['step3'] = narr['step3']
        t['scenario_case'] = narr['scenario_case']
        t['remediation'] = narr['remediation_solution']
        t['remediation_command'] = narr['remediation_command']

    return jsonify({'techniques': paged, 'total': total, 'page': page, 'limit': limit})

@mitre_bp.route('/mitre/technique/<tid>')
def technique(tid):
    t = _TECHNIQUES.get(tid)
    if not t:
        return jsonify({'error': 'Technique not found'}), 404
    full = dict(t)
    full['tactic_info'] = _TACTICS.get(t['tactic'], {})
    narr = ATTACK_NARRATIVES.get(tid, {
        'step1': f"Attacker targets host surfaces looking for attack paths via {t['name']}.",
        'step2': f"Adversary triggers unauthorized execution or abuses permissions.",
        'step3': f"Internal network assets, memory tokens, or data streams are compromised.",
        'scenario_case': t.get('examples', ['Real-world adversary campaign'])[0] if t.get('examples') else 'Enterprise threat intrusion.',
        'remediation_solution': REMEDIATIONS.get(tid, DEFAULT_REMEDIATION),
        'remediation_command': 'sudo iptables -A INPUT -s <OFFENDING_IP> -j DROP'
    })
    full['step1'] = narr['step1']
    full['step2'] = narr['step2']
    full['step3'] = narr['step3']
    full['scenario_case'] = narr['scenario_case']
    full['remediation'] = narr['remediation_solution']
    full['remediation_command'] = narr['remediation_command']
    return jsonify({'technique': full})

@mitre_bp.route('/mitre/map', methods=['POST'])
def map_logs():
    """Map a list of log entries to MITRE techniques by pattern matching."""
    data = request.json or {}
    logs = data.get('logs', [])
    if not logs:
        return jsonify({'matches': [], 'summary': {}})

    matches = []
    tactic_counts = {}

    for log in logs:
        msg_lower = (log.get('message') or '').lower()
        src_lower = (log.get('source')  or '').lower()
        text      = msg_lower + ' ' + src_lower

        for tech in _CATALOG['techniques']:
            patterns = tech.get('log_patterns', [])
            matched  = [p for p in patterns if p.lower() in text]
            if matched:
                tactic_id = tech['tactic']
                tactic_counts[tactic_id] = tactic_counts.get(tactic_id, 0) + 1
                tid = tech['id']
                matches.append({
                    'log_id':    log.get('id', '?'),
                    'log_msg':   log.get('message', '')[:100],
                    'technique': tid,
                    'name':      tech['name'],
                    'tactic':    tactic_id,
                    'tactic_name': _TACTICS.get(tactic_id, {}).get('name', ''),
                    'severity':  tech['severity'],
                    'patterns_hit': matched,
                    'mitre_url': tech['mitre_url'],
                    'remediation': REMEDIATIONS.get(tid, tech.get('remediation', DEFAULT_REMEDIATION)),
                })

    # Deduplicate by technique
    seen = {}
    deduped = []
    for m in matches:
        key = m['technique']
        if key not in seen:
            seen[key] = m
            deduped.append(m)

    return jsonify({
        'matches':       deduped,
        'total_matches': len(deduped),
        'tactic_summary': [
            {'tactic': tid, 'name': _TACTICS.get(tid, {}).get('name', tid), 'count': cnt}
            for tid, cnt in sorted(tactic_counts.items(), key=lambda x: -x[1])
        ],
    })


@mitre_bp.route('/mitre/user-latest')
def user_latest():
    auth = request.headers.get('Authorization','')
    if not auth.startswith('Bearer '): return jsonify({'success':False,'message':'Authentication required'}),401
    try:
        payload = jwt.decode(auth[7:].strip(), config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        if payload.get('type') != 'access': raise ValueError()
        uid = str(payload.get('sub'))
    except (jwt.InvalidTokenError, ValueError):
        return jsonify({'success':False,'message':'Authentication required'}),401
    with get_db() as db:
        row = db.execute(select(log_analyses.c.id, log_analyses.c.results).where(log_analyses.c.user_id==uid).order_by(log_analyses.c.created_at.desc()).limit(1)).mappings().first()
    logs = ((row['results'] or {}).get('logs', []) if row else [])
    if not logs: return jsonify({'success':True,'matches':[],'total_matches':0,'tactic_summary':[],'message':'No retained log events in the latest analysis.'})
    data = map_logs_internal(logs)
    return jsonify({'success':True,**data})

def map_logs_internal(logs):
    matches=[]; tactic_counts={}
    for log in logs:
        text=((log.get('message') or '')+' '+(log.get('source') or '')).lower()
        for tech in _CATALOG['techniques']:
            hit=[p for p in tech.get('log_patterns',[]) if p.lower() in text]
            if hit:
                tid=tech['tactic']; tactic_counts[tid]=tactic_counts.get(tid,0)+1
                tech_id = tech['id']
                matches.append({
                    'log_id':log.get('id','?'),
                    'log_msg':(log.get('message') or '')[:100],
                    'technique':tech_id,
                    'name':tech['name'],
                    'tactic':tid,
                    'tactic_name':_TACTICS.get(tid,{}).get('name',''),
                    'severity':tech['severity'],
                    'patterns_hit':hit,
                    'mitre_url':tech['mitre_url'],
                    'remediation': REMEDIATIONS.get(tech_id, tech.get('remediation', DEFAULT_REMEDIATION)),
                })
    seen=set(); deduped=[]
    for m in matches:
        if m['technique'] not in seen: seen.add(m['technique']); deduped.append(m)
    return {'matches':deduped,'total_matches':len(deduped),'tactic_summary':[{'tactic':k,'name':_TACTICS.get(k,{}).get('name',k),'count':v} for k,v in sorted(tactic_counts.items(),key=lambda x:-x[1])]}
