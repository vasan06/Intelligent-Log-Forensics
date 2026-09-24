/**
 * INTELLIGENT LOG FORENSIC - INCIDENTS PAGE CONTROLLER
 * Manages 3D attack path reconstruction, timeline scrubbing, inline row expansions, and investigation modals
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize 3D Attack Path Graph
  const attackGraph = new AttackGraphScene('attack-graph-canvas');

  // Timeline scrubber slider
  const timeScrubber = document.getElementById('attack-time-slider');
  const scrubberLabel = document.getElementById('scrubber-time-label');

  if (timeScrubber) {
    timeScrubber.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (attackGraph) attackGraph.setTimeStep(val);
      if (scrubberLabel) {
        scrubberLabel.textContent = `T + ${(val * 180).toFixed(0)}s (Phase ${Math.min(4, Math.floor(val * 4) + 1)}/4)`;
      }
    });
  }

  // 2. Incident Table Elements & Filters
  const tableBody = document.getElementById('incidents-table-body');
  const searchInput = document.getElementById('incident-search');
  const severityFilter = document.getElementById('incident-severity-filter');
  const modalOverlay = document.getElementById('incident-detail-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  let activeIncidents = [];

  function loadIncidents() {
    if (window.appState && window.appState.state.incidents.length > 0) {
      activeIncidents = [...window.appState.state.incidents];
    } else {
      // Seed default forensic incident if none generated yet
      activeIncidents = [
        {
          id: 'INC-7042',
          title: 'Multi-Stage Ingress & Data Exfiltration Campaign',
          severity: 'critical',
          mitreTechnique: 'T1041',
          confidence: 96,
          status: 'ACTIVE',
          created: new Date(Date.now() - 3600000).toISOString(),
          sourceIp: '185.220.101.5',
          target: '/api/v2/upload',
          rootCause: 'Ingress achieved via CVE exploitation on public search endpoint, followed by credential dumping in LSASS memory space and 847MB exfiltration to external IP.',
          timeline: [
            { timestamp: new Date(Date.now() - 3600000).toISOString(), description: 'Exploitation vector triggered on /api/v1/search (T1190)' },
            { timestamp: new Date(Date.now() - 2400000).toISOString(), description: 'Privilege escalation via sudo bash injection (T1068)' },
            { timestamp: new Date(Date.now() - 1200000).toISOString(), description: 'Credential dump observed targeting /etc/shadow (T1003)' },
            { timestamp: new Date(Date.now() - 300000).toISOString(), description: 'Encrypted exfiltration stream outbound to 185.220.101.5 (T1041)' }
          ]
        },
        {
          id: 'INC-6119',
          title: 'Distributed Authentication Brute Force Spray',
          severity: 'high',
          mitreTechnique: 'T1110',
          confidence: 89,
          status: 'ACTIVE',
          created: new Date(Date.now() - 7200000).toISOString(),
          sourceIp: '203.0.113.195',
          target: '/auth/login',
          rootCause: 'Repeated auth failures exceeding threshold of 45 attempts within 60 seconds.',
          timeline: [
            { timestamp: new Date(Date.now() - 7200000).toISOString(), description: 'Initial spray across administrative usernames (T1110)' }
          ]
        }
      ];
    }

    renderTable();
  }

  function renderTable() {
    if (!tableBody) return;

    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase();
    const filterSev = severityFilter ? severityFilter.value : 'ALL';

    const filtered = activeIncidents.filter(inc => {
      const matchSearch = inc.title.toLowerCase().includes(searchTerm) ||
                          inc.id.toLowerCase().includes(searchTerm) ||
                          inc.mitreTechnique.toLowerCase().includes(searchTerm);
      const matchSev = filterSev === 'ALL' || inc.severity.toLowerCase() === filterSev.toLowerCase();
      return matchSearch && matchSev;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted);">No correlated incidents matching query.</td></tr>`;
      return;
    }

    tableBody.innerHTML = filtered.map(inc => `
      <tr class="incident-main-row" data-id="${inc.id}">
        <td class="forensic-mono" style="color:var(--accent-data);font-weight:600;">${inc.id}</td>
        <td style="font-weight:600;color:var(--text-primary);">${escapeHTML(inc.title)}</td>
        <td><span class="badge ${inc.severity === 'critical' ? 'badge-critical' : 'badge-high'}">${inc.severity.toUpperCase()}</span></td>
        <td class="forensic-mono" style="color:#A5B4FC;">${inc.mitreTechnique}</td>
        <td class="forensic-mono">${inc.confidence}%</td>
        <td><span class="badge badge-indigo">${inc.status}</span></td>
        <td class="forensic-mono">${new Date(inc.created).toLocaleTimeString()}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="toggleExpand('${inc.id}')">Inspect</button>
        </td>
      </tr>
      <tr id="expand-${inc.id}" class="incident-expand-row" style="display:none;">
        <td colspan="8">
          <div class="incident-expand-content">
            <div class="root-cause-card">
              <h4 style="color:var(--accent-data);font-size:0.9rem;margin-bottom:8px;">Root Cause Forensics</h4>
              <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;">${escapeHTML(inc.rootCause || 'Investigative signature matched anomalous threat behavior.')}</p>
              <div style="margin-top:12px;display:flex;gap:12px;">
                <button class="btn btn-primary btn-sm" onclick="openIncidentModal('${inc.id}')">3D Full Forensics</button>
                <button class="btn btn-danger btn-sm" onclick="resolveIncident('${inc.id}')">Mark Resolved</button>
              </div>
            </div>
            <div class="evidence-trail">
              <h4 style="font-size:0.9rem;color:var(--text-primary);margin-bottom:8px;">Attack Timeline Chain</h4>
              ${(inc.timeline || []).map(t => `
                <div class="evidence-step">
                  <div style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">${new Date(t.timestamp).toLocaleTimeString()}</div>
                  <div style="font-size:0.82rem;color:var(--text-secondary);">${escapeHTML(t.description)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Global functions for inline actions
  window.toggleExpand = (id) => {
    const row = document.getElementById(`expand-${id}`);
    if (row) {
      row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }
  };

  window.openIncidentModal = (id) => {
    const inc = activeIncidents.find(i => i.id === id);
    if (!inc || !modalOverlay) return;

    document.getElementById('modal-incident-title').textContent = `${inc.id} — ${inc.title}`;
    document.getElementById('modal-incident-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="root-cause-card">
          <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;">Source Vector</span>
          <div class="forensic-mono" style="font-size:1.1rem;color:#67E8F9;margin-top:4px;">${inc.sourceIp || '185.220.101.5'}</div>
        </div>
        <div class="root-cause-card">
          <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;">Target Asset</span>
          <div class="forensic-mono" style="font-size:1.1rem;color:#F1F5F9;margin-top:4px;">${inc.target || '/api/v1/search'}</div>
        </div>
      </div>
      <div class="root-cause-card" style="margin-bottom:20px;">
        <h4 style="color:var(--accent-data);font-size:0.9rem;margin-bottom:8px;">Threat Telemetry & Root Cause Analysis</h4>
        <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6;">${escapeHTML(inc.rootCause)}</p>
      </div>
      <div class="evidence-trail">
        <h4 style="font-size:0.9rem;color:var(--text-primary);margin-bottom:12px;">Detailed Evidence Chronology</h4>
        ${(inc.timeline || []).map(t => `
          <div class="evidence-step" style="margin-bottom:12px;">
            <div style="font-size:0.75rem;color:var(--accent-data);font-family:var(--font-mono);">${new Date(t.timestamp).toLocaleTimeString()}</div>
            <div style="font-size:0.85rem;color:var(--text-secondary);">${escapeHTML(t.description)}</div>
          </div>
        `).join('')}
      </div>
    `;

    modalOverlay.classList.add('active');
  };

  window.resolveIncident = (id) => {
    const inc = activeIncidents.find(i => i.id === id);
    if (inc) {
      inc.status = 'RESOLVED';
      renderTable();
      if (window.appState) {
        window.appState.saveToStorage();
      }
    }
  };

  if (modalCloseBtn && modalOverlay) {
    modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('active');
    });
  }

  if (searchInput) searchInput.addEventListener('input', renderTable);
  if (severityFilter) severityFilter.addEventListener('change', renderTable);

  if (window.eventBus) {
    window.eventBus.on('incident:created', () => loadIncidents());
    window.eventBus.on('incident:updated', () => loadIncidents());
  }

  loadIncidents();
});

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}
