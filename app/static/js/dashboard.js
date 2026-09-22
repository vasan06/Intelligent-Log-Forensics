/* Dashboard Overview Vanilla JavaScript */
function fetchOverview() {
  fetch('/api/v1/dashboard/overview')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) return;
      document.getElementById('hero-title').textContent = data.incidents > 0
        ? `${data.incidents} Active Incidents Requiring Investigation`
        : 'System Operating within Normal Forensic Parameters';

      document.getElementById('hero-desc').textContent = `Analyzed ${data.total_logs.toLocaleString()} log records. Identified ${data.risk_events} risk anomalies with health score of ${data.health_score}%.`;

      document.getElementById('stat-health').textContent = `${data.health_score}%`;
      document.getElementById('stat-avg-risk').textContent = data.average_risk ? data.average_risk.toFixed(1) : '0';
      document.getElementById('stat-total-logs').textContent = data.total_logs.toLocaleString();
      document.getElementById('stat-risks').textContent = data.risk_events;
      document.getElementById('stat-quality').textContent = `${data.quality_score}%`;
      renderOverviewSeverity(data.severity_distribution || {});
      renderTelemetryCanvas(data.recent_events || []);

      // Render Incidents List
      const listEl = document.getElementById('incidents-list');
      if (listEl && data.recent_incidents && data.recent_incidents.length > 0) {
        listEl.innerHTML = data.recent_incidents.map((inc) => `
          <a href="/incidents" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-raised); border:1px solid var(--border-subtle); border-radius:var(--r-md); text-decoration:none;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge ${inc.severity.toLowerCase() === 'critical' ? 'badge-critical' : 'badge-high'}">${inc.severity}</span>
                <span style="font-weight:700; color:var(--text-primary); font-size:12.5px;">${inc.title}</span>
              </div>
              <div style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted); margin-top:3px;">Risk Score: ${inc.score}/100</div>
            </div>
            <span style="font-size:11.5px; font-family:var(--font-mono); font-weight:600; color:var(--accent);">Investigate →</span>
          </a>
        `).join('');
      } else if (listEl) {
        listEl.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12px;">No active incidents recorded.</div>`;
      }
    })
    .catch(() => {});

  // Fetch Top IPs
  fetch('/api/v1/dashboard/top-risky-ips?limit=5')
    .then((res) => (res.ok ? res.json() : []))
    .then((ips) => {
      const container = document.getElementById('top-ips-list');
      if (!container) return;
      if (ips.length > 0) {
        container.innerHTML = ips.map((item) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-raised); border:1px solid var(--border-subtle); border-radius:var(--r-md); font-family:var(--font-mono); font-size:11.5px;">
            <div>
              <strong style="color:var(--text-primary); block;">${item.ip}</strong>
              <span style="font-size:10px; color:var(--text-muted);">${item.events} events</span>
            </div>
            <span class="badge ${item.score > 70 ? 'badge-critical' : 'badge-high'}">${item.score} Risk</span>
          </div>
        `).join('');
      } else {
        container.innerHTML = `<div style="text-align:center; padding:12px; color:var(--text-muted); font-size:12px;">No high-risk IPs recorded.</div>`;
      }
    })
    .catch(() => {});
}

function renderOverviewSeverity(counts) {
  const host = document.getElementById('top-ips-list');
  if (!host || host.dataset.loadedIps === 'true') return;
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return;
  host.innerHTML = rows.map(([label, count]) => `
    <div class="bar-row">
      <div class="bar-row-label"><span>${label}</span><strong>${count}</strong></div>
      <div class="bar-track"><span style="width:${Math.max(6, count / Math.max(...rows.map(([, v]) => v)) * 100)}%"></span></div>
    </div>
  `).join('');
}

// Render Telemetry Canvas from backend risk events.
function renderTelemetryCanvas(events) {
  const canvas = document.getElementById('telemetry-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = (canvas.width = canvas.parentElement.clientWidth || 500);
  const height = (canvas.height = 220);

  ctx.clearRect(0, 0, width, height);
  if (!events.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Manrope';
    ctx.fillText('No recent risk events returned by the backend.', 18, height / 2);
    return;
  }
  const lanes = ['Critical', 'High', 'Medium', 'Low'];
  const maxScore = Math.max(...events.map((event) => Number(event.risk_score || 0)), 1);
  events.slice().reverse().forEach((event, index) => {
    const x = 28 + (index / Math.max(events.length - 1, 1)) * (width - 56);
    const lane = Math.max(0, lanes.findIndex((name) => String(event.severity || '').toLowerCase() === name.toLowerCase()));
    const y = 26 + lane * 42;
    const radius = 4 + (Number(event.risk_score || 0) / maxScore) * 8;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = event.severity === 'Critical' ? '#dc2626' : event.severity === 'High' ? '#ea580c' : '#2563eb';
    ctx.fill();
    if (index > 0) {
      const prevX = 28 + ((index - 1) / Math.max(events.length - 1, 1)) * (width - 56);
      ctx.beginPath();
      ctx.moveTo(prevX, y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(148, 163, 184, .35)';
      ctx.stroke();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fetchOverview();
});
