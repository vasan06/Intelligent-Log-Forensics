/**
 * frontend/assets/js/log-explorer.js
 * Multi-format Log Ingestion & 4-Stage Pipeline Controller
 */

let allLogs = [];
let pipelineTimer = null;
let currentFileId = null;
let currentAnalysisId = null;
let currentFileName = '';

const STAGE_STATUS = ['Collecting…', 'Parsing…', 'Categorising…', 'Scoring risk…'];
const STAGE_DONE   = ['Collected', 'Parsed', 'Categorised', 'Scored'];

function initLogExplorer() {
  requireAuth();
  injectNavbar();
  setBreadcrumb([{ href: 'dashboard.html', label: 'Dashboard' }, { href: 'log-explorer.html', label: 'Log Explorer' }]);
}

function setPipelineUI(stageIndex, done = false) {
  for (let i = 0; i <= 3; i++) {
    const el = document.getElementById('pl-' + i);
    if (!el) continue;
    const statusEl = el.querySelector('.pipeline-label-status');
    el.classList.remove('active', 'done');
    if (i < stageIndex) {
      el.classList.add('done');
      statusEl.textContent = STAGE_DONE[i];
    } else if (i === stageIndex) {
      el.classList.add(done ? 'done' : 'active');
      statusEl.textContent = done ? STAGE_DONE[i] : STAGE_STATUS[i];
    } else {
      statusEl.textContent = 'Waiting';
    }
  }
}

function runSimulatedPipeline(onFinish) {
  let s = 0;
  setPipelineUI(0, false);
  const interval = setInterval(() => {
    s++;
    if (s <= 3) {
      setPipelineUI(s, false);
    } else {
      clearInterval(interval);
      setPipelineUI(3, true);
      if (onFinish) onFinish();
    }
  }, 450);
}

function onDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.add('drag-active');
}

function onDragLeave() {
  document.getElementById('uploadZone').classList.remove('drag-active');
}

function onDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag-active');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFile(e.dataTransfer.files[0]);
  }
}

async function handleFile(file) {
  if (!file) return;
  document.getElementById('uploadSection').style.display = 'none';

  runSimulatedPipeline();

  const fd = new FormData();
  fd.append('file', file);

  const res = await Api.uploadLog(fd);
  const data = res?.data;

  if (!res?.ok || !data?.success) {
    toast(data?.message || 'Upload failed', 'error');
    resetUpload();
    return;
  }

  currentFileId = data.file_id;
  currentAnalysisId = data.analysis_id;
  currentFileName = data.filename;

  setPipelineUI(3, true);

  animateCount(document.getElementById('res-lines'), data.lines_parsed);
  animateCount(document.getElementById('res-anomalies'), data.anomalies_found);
  document.getElementById('res-risk').textContent = data.risk_level || 'LOW';
  document.getElementById('res-loc').textContent = data.db_location || `db://users/uploads/${data.file_id}`;
  document.getElementById('res-loc').title = data.db_location || '';

  allLogs = (data.logs && data.logs.length > 0) ? data.logs : (data.preview || []);
  renderTable(allLogs);
  document.getElementById('resultsSection').style.display = 'block';
  toast(`Stored in PostgreSQL & analyzed ${data.lines_parsed.toLocaleString()} lines from ${file.name}`, 'success');
}

async function loadDemoSample(sampleType) {
  toast('Loading ' + sampleType.replace('_', ' ') + ' sample…', 'info');
  try {
    const res = await fetch('/api/logs/demo-sample/' + sampleType);
    const data = await res.json();
    if (!res.ok || !data.success) {
      toast('Failed to load sample', 'error');
      return;
    }
    const blob = new Blob([data.raw_text], { type: 'text/plain' });
    const file = new File([blob], data.filename, { type: 'text/plain' });
    handleFile(file);
  } catch (err) {
    toast('Error loading demo sample', 'error');
  }
}

function goToMlAnalysis() {
  if (currentAnalysisId || currentFileId) {
    sessionStorage.setItem('ilf_active_event', JSON.stringify({
      file_id: currentFileId,
      analysis_id: currentAnalysisId,
      filename: currentFileName
    }));
    window.location.href = 'ml-analysis.html?file_id=' + encodeURIComponent(currentFileId || '') + '&analysis_id=' + encodeURIComponent(currentAnalysisId || '');
  } else {
    window.location.href = 'ml-analysis.html';
  }
}

function renderTable(logs) {
  document.getElementById('logTable').innerHTML = logs.map(l => `
    <tr>
      <td class="t-mono-xs text-muted">${l.line || '-'}</td>
      <td class="t-mono-xs text-muted">${(l.timestamp || '').slice(11, 19)}</td>
      <td>${sevBadge(l.severity)}</td>
      <td style="color:var(--slate);font-size:var(--text-sm);font-weight:600;">${l.source}</td>
      <td class="t-mono-xs text-muted">${l.ip || '-'}</td>
      <td class="t-mono-xs text-muted">${l.pid || '-'}</td>
      <td style="font-size:var(--text-sm);font-family:var(--font-mono);">${l.message}</td>
    </tr>`).join('');
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const sev = document.getElementById('sevFilter').value;
  renderTable(allLogs.filter(l =>
    (sev === 'all' || l.severity === sev) &&
    (!q || String(l.message).toLowerCase().includes(q) || String(l.source).toLowerCase().includes(q) || String(l.ip).includes(q))
  ));
}

function resetUpload() {
  setPipelineUI(0, false);
  for (let i = 0; i <= 3; i++) {
    const el = document.getElementById('pl-' + i);
    if (!el) continue;
    el.classList.remove('active', 'done');
    el.querySelector('.pipeline-label-status').textContent = 'Waiting';
  }
  allLogs = [];
  currentFileId = null;
  currentAnalysisId = null;
  document.getElementById('logTable').innerHTML = '';
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('uploadSection').style.display = 'block';
  document.getElementById('fileInput').value = '';
}
