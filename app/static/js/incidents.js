/* Incidents & RCA Reasoning Vanilla JavaScript */
let incidents = [];
let activeIncident = null;

function fetchIncidents() {
  const fileId = window.FILE_ID || 1;
  fetch(`/api/v1/incidents/${fileId}`)
    .then((res) => (res.ok ? res.json() : { incidents: [] }))
    .then((data) => {
      incidents = data.incidents || [];
      const sidebar = document.getElementById('incidents-sidebar-list');

      if (!sidebar) return;
      if (incidents.length === 0) {
        sidebar.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12px;">No incidents formed for file #${fileId}.</div>`;
        return;
      }

      sidebar.innerHTML = incidents.map((inc) => `
        <div onclick="selectIncident(${inc.id})" style="padding:10px 12px; background:var(--bg-raised); border:1px solid var(--border-subtle); border-radius:var(--r-md); cursor:pointer; display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="badge ${inc.severity.toLowerCase() === 'critical' ? 'badge-critical' : 'badge-high'}">${inc.severity}</span>
            <span style="font-size:10.5px; font-family:var(--font-mono); color:var(--text-muted);">Score ${inc.score}</span>
          </div>
          <strong style="font-size:12px; color:var(--text-primary); margin-top:2px;">${inc.title}</strong>
        </div>
      `).join('');

      selectIncident(incidents[0].id);
    })
    .catch(() => {});
}

function selectIncident(incId) {
  activeIncident = incidents.find((i) => i.id === incId) || incidents[0];
  if (!activeIncident) return;

  document.getElementById('inc-badge-severity').textContent = `${activeIncident.severity.toUpperCase()} INCIDENT`;
  document.getElementById('inc-id-tag').textContent = `INCIDENT #${activeIncident.id || '01'}`;
  document.getElementById('inc-title').textContent = activeIncident.title;
  document.getElementById('inc-summary').textContent = activeIncident.summary;
  document.getElementById('inc-score').textContent = `${activeIncident.score}/100`;

  renderRcaGraph();
  renderEventsTimeline();
}

function renderRcaGraph() {
  const container = document.getElementById('rca-nodes-container');
  if (!container || !activeIncident) return;

  const eventNodes = (activeIncident.events || []).slice(0, 4).map((event, index) => ({
    type: index === 0 ? 'Observed' : 'Evidence',
    title: event.event_type || `Event ${index + 1}`,
    desc: event.description || 'Backend returned an event without a narrative description.',
    mitre: event.mitre_technique || event.mitre_tactic || 'No ATT&CK mapping',
  }));
  const nodes = [
    { type: 'Incident', title: activeIncident.title, desc: activeIncident.summary || 'Incident summary is unavailable.', mitre: activeIncident.severity },
    ...eventNodes,
  ];

  container.innerHTML = nodes.map((n, i) => `
    <div class="rca-node ${i === 0 ? 'is-root' : ''}">
      <div>
        <span class="badge ${i === 0 ? 'badge-critical' : 'badge-default'}" style="font-size:9.5px;">${n.type}</span>
        <h4 style="font-size:11.5px; font-weight:700; color:var(--text-primary); margin-top:4px;">${n.title}</h4>
        <p style="font-size:10.5px; color:var(--text-muted); margin-top:2px; line-height:1.3;">${n.desc}</p>
      </div>
      <div style="font-family:var(--font-mono); font-size:10px; color:var(--accent); font-weight:700; border-top:1px solid var(--border-subtle); padding-top:4px; margin-top:4px;">
        ${n.mitre}
      </div>
    </div>
  `).join('');
}

function renderEventsTimeline() {
  const container = document.getElementById('inc-events-timeline');
  if (!container || !activeIncident) return;

  if (activeIncident.events.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12px;">No timeline events recorded.</div>`;
    return;
  }

  container.innerHTML = activeIncident.events.map((e, idx) => `
    <div style="display:flex; gap:12px; align-items:flex-start; padding:10px; background:var(--bg-raised); border-radius:var(--r-md); border:1px solid var(--border-subtle);">
      <span style="font-family:var(--font-mono); font-weight:700; color:var(--accent); font-size:12px;">0${idx + 1}.</span>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; font-size:12px;">
          <strong style="color:var(--text-primary);">${e.event_type || 'Attack Step'}</strong>
          <span style="font-family:var(--font-mono); color:var(--text-muted); font-size:11px;">${e.event_time ? new Date(e.event_time).toLocaleTimeString() : '—'}</span>
        </div>
        <p style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">${e.description}</p>
        <div style="display:flex; gap:12px; font-family:var(--font-mono); font-size:10.5px; margin-top:4px;">
          ${e.mitre_tactic ? `<span style="color:var(--mitre); font-weight:600;">Tactic: ${e.mitre_tactic}</span>` : ''}
          ${e.mitre_technique ? `<span style="color:var(--accent); font-weight:600;">Technique: ${e.mitre_technique}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function downloadReport() {
  const fileId = window.FILE_ID || 1;
  fetch(`/reports/generate/${fileId}`, { method: 'POST' })
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Forensic_Report_File_${fileId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Downloaded Forensic PDF Report', 'ok');
    })
    .catch(() => {
      if (window.showToast) window.showToast('Report generation failed', 'error');
    });
}

document.addEventListener('DOMContentLoaded', () => {
  fetchIncidents();
});
