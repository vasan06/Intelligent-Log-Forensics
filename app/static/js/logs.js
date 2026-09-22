/* Log Stream Explorer Vanilla JavaScript */
let currentLogs = [];
let activeLog = null;
let payloadView = 'normalized';

function fetchLogs() {
  const fileId = window.FILE_ID || 1;
  const q = document.getElementById('log-query')?.value || '';
  const source = document.getElementById('log-source')?.value || '';

  const params = new URLSearchParams({ file_id: fileId });
  if (q) params.set('q', q);
  if (source) params.set('source_type', source);

  fetch(`/api/v1/logs/filter?${params.toString()}`)
    .then((res) => (res.ok ? res.json() : { logs: [], source_counts: {} }))
    .then((data) => {
      currentLogs = data.logs || [];
      renderLogAnalytics(currentLogs, data.source_counts || {});
      const tbody = document.getElementById('logs-tbody');
      const badge = document.getElementById('log-count-badge');
      if (badge) badge.textContent = `Displaying ${currentLogs.length} events`;

      // Populate source select options if empty
      const select = document.getElementById('log-source');
      if (select && select.options.length <= 1 && data.source_counts) {
        Object.keys(data.source_counts).forEach((src) => {
          const opt = document.createElement('option');
          opt.value = src;
          opt.textContent = `${src.toUpperCase()} (${data.source_counts[src]})`;
          select.appendChild(opt);
        });
      }

      if (!tbody) return;
      if (currentLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No matching evidence. Adjust the time, source, or text filter to widen the investigation.</td></tr>`;
        return;
      }

      tbody.innerHTML = currentLogs.map((log) => `
        <tr onclick="selectLog(${log.id})">
          <td style="font-family:var(--font-mono); font-size:11px;">${log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</td>
          <td><span class="badge badge-default">${log.log_source_type || 'SYS'}</span></td>
          <td style="font-family:var(--font-mono); font-weight:700; color:var(--text-primary);">${log.method ? log.method + ' ' : ''}${log.event_type || 'LOG'}</td>
          <td style="font-family:var(--font-mono); font-size:11.5px;" class="truncate">${log.endpoint || log.source_ip || log.message}</td>
          <td><span class="badge ${log.status_code >= 400 ? 'badge-critical' : 'badge-ok'}">${log.status_code || 200}</span></td>
          <td>${log.risk ? `<span class="badge badge-critical">${log.risk.risk_category}</span>` : '—'}</td>
        </tr>
      `).join('');
    })
    .catch(() => {});
}

function renderLogAnalytics(logs, sourceCounts) {
  renderVolumeChart(logs);
  renderDistribution('source-distribution', sourceCounts);
  const severityCounts = logs.reduce((acc, log) => {
    const key = log.risk?.severity || (log.status_code >= 400 ? 'Error' : 'Normal');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  renderDistribution('severity-distribution', severityCounts);
}

function renderVolumeChart(logs) {
  const canvas = document.getElementById('event-volume-chart');
  const meta = document.getElementById('volume-meta');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.clientWidth || 640;
  const height = canvas.height = 150;
  ctx.clearRect(0, 0, width, height);
  if (!logs.length) {
    if (meta) meta.textContent = 'No events in scope';
    ctx.fillStyle = getCss('--text-muted');
    ctx.font = '12px Manrope';
    ctx.fillText('No events available for this filter.', 18, 76);
    return;
  }
  const buckets = new Map();
  logs.forEach((log) => {
    const d = log.timestamp ? new Date(log.timestamp) : null;
    const key = d && !Number.isNaN(d.valueOf()) ? d.toISOString().slice(0, 13) + ':00' : 'Unknown';
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  const points = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...points.map(([, v]) => v), 1);
  const pad = 18;
  const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  ctx.strokeStyle = getCss('--border-subtle');
  ctx.beginPath();
  ctx.moveTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.stroke();
  ctx.strokeStyle = getCss('--accent');
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach(([, value], index) => {
    const x = pad + step * index;
    const y = height - pad - (value / max) * (height - pad * 2);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  points.forEach(([, value], index) => {
    const x = pad + step * index;
    const y = height - pad - (value / max) * (height - pad * 2);
    ctx.fillStyle = getCss('--accent');
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  if (meta) meta.textContent = `${logs.length} events / ${points.length} time buckets`;
}

function renderDistribution(id, counts) {
  const el = document.getElementById(id);
  if (!el) return;
  const rows = Object.entries(counts || {}).filter(([label]) => label).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state-inline">No distribution data returned for this filter.</div>`;
    return;
  }
  const max = Math.max(...rows.map(([, value]) => value), 1);
  el.innerHTML = rows.map(([label, value]) => `
    <div class="bar-row">
      <div class="bar-row-label"><span>${label}</span><strong>${value}</strong></div>
      <div class="bar-track"><span style="width:${Math.max(4, (value / max) * 100)}%"></span></div>
    </div>
  `).join('');
}

function getCss(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function selectLog(logId) {
  activeLog = currentLogs.find((l) => l.id === logId);
  if (!activeLog) return;

  const panel = document.getElementById('evidence-panel');
  if (panel) panel.style.display = 'flex';

  document.getElementById('panel-event-type').textContent = activeLog.event_type || `Log Event #${activeLog.id}`;
  renderPayload();

  const riskBox = document.getElementById('panel-risk-box');
  if (activeLog.risk && riskBox) {
    riskBox.style.display = 'flex';
    document.getElementById('panel-risk-severity').textContent = activeLog.risk.severity;
    document.getElementById('panel-risk-cat').textContent = activeLog.risk.risk_category;

    document.getElementById('btn-label-confirm').onclick = () => labelRisk(activeLog.risk.id, 'confirmed');
    document.getElementById('btn-label-fp').onclick = () => labelRisk(activeLog.risk.id, 'false_positive');
  } else if (riskBox) {
    riskBox.style.display = 'none';
  }
}

function setPayloadView(mode) {
  payloadView = mode;
  document.getElementById('btn-mode-normalized').style.background = mode === 'normalized' ? 'var(--bg-surface)' : 'transparent';
  document.getElementById('btn-mode-normalized').style.color = mode === 'normalized' ? 'var(--accent)' : 'var(--text-muted)';
  document.getElementById('btn-mode-raw').style.background = mode === 'raw' ? 'var(--bg-surface)' : 'transparent';
  document.getElementById('btn-mode-raw').style.color = mode === 'raw' ? 'var(--accent)' : 'var(--text-muted)';
  renderPayload();
}

function renderPayload() {
  const pre = document.getElementById('panel-payload');
  if (!pre || !activeLog) return;
  if (payloadView === 'normalized') {
    pre.textContent = JSON.stringify(activeLog, null, 2);
  } else {
    pre.textContent = activeLog.message;
  }
}

function labelRisk(riskId, label) {
  fetch(`/api/v1/risk-events/${riskId}/label`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && window.showToast) window.showToast(`Label updated to ${label}`, 'ok');
      fetchLogs();
    });
}

function closeEvidencePanel() {
  const panel = document.getElementById('evidence-panel');
  if (panel) panel.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  fetchLogs();
});
