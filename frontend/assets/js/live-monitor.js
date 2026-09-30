/**
 * frontend/assets/js/live-monitor.js
 * Live Telemetry Streaming & Attack Scenario Simulator
 */

const MODES = [
  { id: 'random',        label: 'Random Traffic',      dot: '#6B6880', danger: false },
  { id: 'normal',        label: 'Normal Baseline',     dot: '#10B981', danger: false },
  { id: 'ddos',          label: 'DDoS Volumetric',     dot: '#DC2626', danger: true },
  { id: 'brute_force',   label: 'Brute Force Auth',    dot: '#F59E0B', danger: true },
  { id: 'sql_injection', label: 'SQL Injection',       dot: '#D97706', danger: true },
  { id: 'malware',       label: 'Malware / C2',        dot: '#9333EA', danger: true },
  { id: 'insider_threat',label: 'Insider Exfil',       dot: '#2563EB', danger: true },
  { id: 'ransomware',    label: 'Ransomware Encrypt',  dot: '#DC2626', danger: true },
  { id: 'hacking',       label: 'APT Infiltration',    dot: '#4338CA', danger: true },
];

const SPEED_LABELS = ['Fast (400ms)', 'Quick (800ms)', 'Normal (1.5s)', 'Slow (2.5s)', 'Crawl (4.5s)'];
const SPEED_MS     = [400, 800, 1500, 2500, 4500];

let activeMode = 'random', streaming = false, streamInterval, totalCapture = 0;
const counts = { INFO: 0, WARN: 0, ERROR: 0, CRITICAL: 0 };
let capturedLogBuffer = [];

function initLiveMonitor() {
  requireAuth();
  injectNavbar();
  setBreadcrumb([{ href: 'dashboard.html', label: 'Dashboard' }, { href: 'live-monitor.html', label: 'Live Monitor' }]);

  const listEl = document.getElementById('modeList');
  if (listEl) {
    listEl.innerHTML = MODES.map(m =>
      `<button class="mode-btn ${m.id === 'random' ? 'active' : ''} ${m.danger ? 'danger-mode' : ''}" id="mb-${m.id}" onclick="setMode('${m.id}')">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="mode-dot" style="background:${m.dot};"></span>
          <span>${m.label}</span>
        </div>
        ${m.danger ? '<span class="badge badge-danger" style="font-size:10px;padding:1px 6px;">THREAT</span>' : ''}
      </button>`
    ).join('');
  }
}

function setMode(id) {
  activeMode = id;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mb-' + id)?.classList.add('active');
  const found = MODES.find(m => m.id === id);
  if (document.getElementById('currentMode')) document.getElementById('currentMode').textContent = 'Scenario: ' + (found?.label || id);
  if (document.getElementById('activeModeName')) document.getElementById('activeModeName').textContent = found?.label || id;
  if (document.getElementById('vectorBadge')) {
    const vb = document.getElementById('vectorBadge');
    vb.className = found?.danger ? 'badge badge-danger' : 'badge badge-success';
    vb.textContent = found?.danger ? 'THREAT ACTIVE' : 'NORMAL';
  }
  toast(`Switched to scenario: ${found?.label || id}`, 'info');
}

function updateSpeed(v) {
  document.getElementById('speedLabel').textContent = SPEED_LABELS[v - 1];
  if (streaming) {
    clearInterval(streamInterval);
    startInterval();
  }
}

function toggleStream() {
  if (streaming) stopStream(); else startStream();
}

function startStream() {
  streaming = true;
  document.getElementById('streamBtn').className   = 'start-btn running';
  document.getElementById('btnLabel').textContent  = 'Stop Stream';
  document.getElementById('btnIcon').innerHTML     = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  document.getElementById('liveDot').className     = 'status-dot live';
  document.getElementById('liveLabel').textContent = 'Ingesting Live';
  document.getElementById('liveLabel').className   = 'live-label active';
  document.getElementById('emptyMsg')?.remove();
  startInterval();
  toast('Live log stream connected', 'success');
}

function stopStream() {
  streaming = false;
  clearInterval(streamInterval);
  document.getElementById('streamBtn').className   = 'start-btn';
  document.getElementById('btnLabel').textContent  = 'Start Stream';
  document.getElementById('btnIcon').innerHTML     = '<polygon points="5 3 19 12 5 21 5 3"/>';
  document.getElementById('liveDot').className     = 'status-dot idle';
  document.getElementById('liveLabel').textContent = 'Stopped';
  document.getElementById('liveLabel').className   = 'live-label';
  toast('Stream paused', 'warn');
}

function startInterval() {
  const ms = SPEED_MS[document.getElementById('speedSlider').value - 1];
  streamInterval = setInterval(fetchBatch, ms);
  fetchBatch();
}

async function fetchBatch() {
  const src = document.getElementById('filterSrc').value;
  const sev = document.getElementById('filterSev').value;
  const res = await Api.streamLogs({ mode: activeMode, source: src, severity: sev, count: Math.floor(Math.random() * 4) + 2 });
  if (!res.ok || !res.data?.logs) return;
  appendLogs(res.data.logs);
}

function appendLogs(logs) {
  const terminal = document.getElementById('terminal');
  if (!terminal) return;

  logs.forEach(log => {
    totalCapture++;
    capturedLogBuffer.push(log);
    const sev = log.severity || 'INFO';

    if (counts[sev] !== undefined) {
      counts[sev]++;
      const el = document.getElementById('sc-' + (sev === 'CRITICAL' ? 'CRIT' : sev));
      if (el) el.textContent = counts[sev];
    }

    const row = document.createElement('div');
    row.className = `log-row row-${sev}`;
    row.innerHTML = `
      <span class="t-mono-xs text-muted">${fmtTs(log.timestamp)}</span>
      <span>${sevBadge(sev)}</span>
      <span class="t-mono-xs" style="color:var(--slate);font-weight:600;">${log.source}</span>
      <span class="t-mono-xs text-muted">${log.ip}</span>
      <span style="font-size:12px;color:var(--ink-0);">${log.message}</span>
    `;
    terminal.appendChild(row);
  });

  // Maintain recent buffer
  const rows = terminal.querySelectorAll('.log-row');
  if (rows.length > 500) {
    for (let i = 0; i < rows.length - 500; i++) rows[i].remove();
  }
  terminal.scrollTop = terminal.scrollHeight;
  document.getElementById('captureCount').textContent = totalCapture.toLocaleString() + ' logs captured';
  document.getElementById('bufSize').textContent = capturedLogBuffer.length + ' entries';
}

function clearLogs() {
  const t = document.getElementById('terminal');
  if (t) t.innerHTML = '';
  totalCapture = 0;
  capturedLogBuffer = [];
  Object.keys(counts).forEach(k => {
    counts[k] = 0;
    const el = document.getElementById('sc-' + (k === 'CRITICAL' ? 'CRIT' : k));
    if (el) el.textContent = '0';
  });
  document.getElementById('captureCount').textContent = '0 logs captured';
  document.getElementById('bufSize').textContent = '0 entries';
  toast('Buffer cleared', 'info');
}

async function persistActiveSimulation() {
  if (!capturedLogBuffer.length) {
    toast('Capture at least a few logs before saving simulation', 'warn');
    return;
  }
  const modeObj = MODES.find(m => m.id === activeMode);
  const scenarioName = modeObj ? modeObj.label : activeMode;

  const res = await Api.saveSimulation({
    scenario_name: scenarioName,
    mode: activeMode,
    logs: [...capturedLogBuffer]
  });

  if (res.ok && res.data?.success) {
    toast(`Simulation "${scenarioName}" (${capturedLogBuffer.length} logs) archived in PostgreSQL`, 'success');
  } else {
    toast('Failed to save simulation to DB', 'error');
  }
}

function sendToMlAnalysis() {
  if (!capturedLogBuffer.length) {
    toast('Capture logs first before sending to ML', 'warn');
    return;
  }
  const logsToAnalyze = [...capturedLogBuffer];
  sessionStorage.setItem('ilf_event_logs', JSON.stringify(logsToAnalyze));
  window.location.href = 'ml-analysis.html?source=stream';
}
