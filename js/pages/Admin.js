/**
 * INTELLIGENT LOG FORENSIC - ADMIN CONSOLE CONTROLLER
 * System health monitoring, audit trail, batch uploads tracking, and user privilege management
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Users Tab Data
  const users = [
    { id: 'USR-01', name: 'Dr. Evelyn Vance', email: 'e.vance@soc-forensics.internal', role: 'Chief Forensics Officer', status: 'ACTIVE', lastLogin: '2 mins ago' },
    { id: 'USR-02', name: 'Marcus Sterling', email: 'm.sterling@soc-forensics.internal', role: 'Senior Threat Hunter', status: 'ACTIVE', lastLogin: '45 mins ago' },
    { id: 'USR-03', name: 'Sarah Chen', email: 's.chen@soc-forensics.internal', role: 'Security Analyst L2', status: 'ACTIVE', lastLogin: '3 hours ago' },
    { id: 'USR-04', name: 'Auditor External', email: 'audit-read@external.cert', role: 'Read-Only Auditor', status: 'SUSPENDED', lastLogin: '4 days ago' }
  ];

  const userTableBody = document.getElementById('admin-users-table-body');
  if (userTableBody) {
    userTableBody.innerHTML = users.map(u => `
      <tr>
        <td class="forensic-mono">${u.id}</td>
        <td style="font-weight:600;color:var(--text-primary);">${u.name}</td>
        <td class="forensic-mono">${u.email}</td>
        <td><span class="badge badge-indigo">${u.role}</span></td>
        <td><span class="badge ${u.status === 'ACTIVE' ? 'badge-safe' : 'badge-high'}">${u.status}</span></td>
        <td class="forensic-mono">${u.lastLogin}</td>
      </tr>
    `).join('');
  }

  // 2. Uploads Tab Data (Populated dynamically from AppState + static records)
  function renderUploads() {
    const uploadTableBody = document.getElementById('admin-uploads-table-body');
    if (!uploadTableBody) return;

    let batches = [];
    if (window.appState && window.appState.state.batches.length > 0) {
      batches = window.appState.state.batches;
    } else {
      batches = [
        { batchId: 'BATCH-004', fileName: 'nginx_access_prod_dmz.log', entryCount: 1420, criticalCount: 18, timestamp: new Date(Date.now() - 7200000).toISOString() },
        { batchId: 'BATCH-003', fileName: 'auth_audit_kerberos.json', entryCount: 890, criticalCount: 4, timestamp: new Date(Date.now() - 14400000).toISOString() },
        { batchId: 'BATCH-002', fileName: 'firewall_netflow_exfil.csv', entryCount: 3200, criticalCount: 42, timestamp: new Date(Date.now() - 28800000).toISOString() }
      ];
    }

    uploadTableBody.innerHTML = batches.map(b => `
      <tr>
        <td class="forensic-mono" style="color:var(--accent-data);font-weight:600;">${b.batchId}</td>
        <td class="forensic-mono">${b.fileName}</td>
        <td class="forensic-mono">${b.entryCount}</td>
        <td><span class="badge ${b.criticalCount > 0 ? 'badge-critical' : 'badge-safe'}">${b.criticalCount} Flagged</span></td>
        <td class="forensic-mono">${new Date(b.timestamp).toLocaleString()}</td>
        <td><span class="badge badge-cyan">VERIFIED SHA-256</span></td>
      </tr>
    `).join('');
  }

  renderUploads();
  if (window.eventBus) {
    window.eventBus.on('batch:created', () => renderUploads());
  }

  // 3. System Health Telemetry Updates
  function updateHealth() {
    const memEl = document.getElementById('health-memory-val');
    const logsEl = document.getElementById('health-total-processed');
    const engineEl = document.getElementById('health-engine-status');

    if (logsEl && window.appState) {
      logsEl.textContent = `${window.appState.state.totalLogs.toLocaleString()} events`;
    }
    if (memEl) {
      // Simulating live browser heap metric
      const simulatedMem = (45 + Math.random() * 8).toFixed(1);
      memEl.textContent = `${simulatedMem} MB`;
    }
    if (engineEl && window.appState) {
      const active = window.appState.isGeneratorActive();
      engineEl.textContent = active ? 'ONLINE · ThreatEngine Active' : 'PAUSED · Standby Mode';
      engineEl.className = active ? 'badge badge-safe' : 'badge badge-medium';
    }
  }

  setInterval(updateHealth, 2000);
  updateHealth();

  // 4. Audit Log Feed
  const auditLogs = [
    { time: '14:22:01', action: 'EVIDENCE_HASH_VERIFY', detail: 'SHA-256 integrity match confirmed for batch #004', user: 'SYSTEM' },
    { time: '14:18:40', action: 'INCIDENT_ESCALATION', detail: 'Automated correlation created INC-7042 (T1041 Exfiltration)', user: 'ThreatEngine' },
    { time: '13:50:12', action: 'AUTH_SESSION_START', detail: 'Investigator Dr. Evelyn Vance authenticated with MFA', user: 'USR-01' },
    { time: '12:30:45', action: 'RULESET_UPDATE', detail: 'Applied updated MITRE ATT&CK signature vectors', user: 'SYSTEM' },
    { time: '11:15:20', action: 'DATA_INGEST_COMPLETE', detail: 'Parsed 3,200 records with 99.4% field completeness', user: 'SYSTEM' }
  ];

  const auditFeedEl = document.getElementById('admin-audit-feed');
  if (auditFeedEl) {
    auditFeedEl.innerHTML = auditLogs.map(a => `
      <div class="audit-item">
        <div style="display:flex;align-items:center;gap:16px;">
          <span class="forensic-mono" style="color:var(--text-muted);font-size:0.75rem;">${a.time}</span>
          <span class="badge badge-indigo">${a.action}</span>
          <span style="color:var(--text-secondary);">${a.detail}</span>
        </div>
        <span class="forensic-mono" style="color:var(--accent-data);">${a.user}</span>
      </div>
    `).join('');
  }
});
