/**
 * frontend/assets/js/log-explorer.js
 * Multi-format Log Ingestion & 4-Stage Pipeline Controller
 */

let allLogs = [];
let pipelineTimer = null;
let currentFileId = null;
let currentAnalysisId = null;
let currentFileName = '';

const STAGE_STATUS = ['Uploading…', 'Parsing…', 'Normalizing…', 'Analyzing…', 'Detecting anomalies…', 'Storing records…', 'Finalizing…'];
const STAGE_DONE   = ['Uploaded', 'Parsed', 'Normalized', 'Analyzed', 'Detected', 'Stored', 'Complete'];

function initLogExplorer() {
  requireAuth();
  injectNavbar();
  setBreadcrumb([{ href: 'dashboard.html', label: 'Dashboard' }, { href: 'log-explorer.html', label: 'Log Explorer' }]);
}

function setPipelineUI(stageIndex, status = 'active') {
  for (let i = 0; i < 7; i++) {
    const el = document.getElementById('pl-' + i);
    if (!el) continue;
    el.classList.remove('active', 'done', 'error');
    if (i < stageIndex) {
      el.classList.add('done');
    } else if (i === stageIndex) {
      if (status === 'done') {
        el.classList.add('done');
      } else if (status === 'error') {
        el.classList.add('error');
      } else {
        el.classList.add('active');
      }
    }
  }
}

function runSimulatedPipeline(onFinish) {
  let s = 0;
  setPipelineUI(0, 'active');
  if (pipelineTimer) clearInterval(pipelineTimer);
  pipelineTimer = setInterval(() => {
    s++;
    if (s < 6) {
      setPipelineUI(s, 'active');
    } else if (s === 6) {
      setPipelineUI(6, 'done');
      clearInterval(pipelineTimer);
      if (onFinish) onFinish();
    }
  }, 350);
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
    if (pipelineTimer) clearInterval(pipelineTimer);
    setPipelineUI(0, 'error');
    toast(data?.message || 'Upload failed', 'error');
    setTimeout(() => resetUpload(), 1200);
    return;
  }

  if (pipelineTimer) clearInterval(pipelineTimer);
  for (let i = 0; i < 7; i++) {
    setPipelineUI(i, 'done');
  }

  currentFileId = data.file_id;
  currentAnalysisId = data.analysis_id;
  currentFileName = data.filename;

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

function formatPlainLanguageExplanation(l) {
  const msg = String(l.message || l.event || '').trim();
  const sev = String(l.severity || 'INFO').toUpperCase();
  const src = String(l.source || 'system').toLowerCase();
  const ip = l.ip || '';

  if (l.plain_summary && l.plain_impact && l.plain_action) {
    return {
      summary: l.plain_summary,
      impact: l.plain_impact,
      action: l.plain_action
    };
  }

  const lower = msg.toLowerCase();

  if (lower.includes('select') || lower.includes('union') || lower.includes('drop table') || lower.includes('script') || lower.includes('etc/passwd') || lower.includes('1=1') || lower.includes('jndi:')) {
    return {
      summary: `Web application exploit pattern detected in HTTP request${ip ? ` from ${ip}` : ''}.`,
      impact: 'Adversary is attempting to inject commands or bypass authorization to extract confidential data or compromise the web tier.',
      action: 'Apply immediate WAF parameter blocking, inspect database query audit logs, and verify input sanitization on web endpoints.'
    };
  }

  if (lower.includes('failed password') || lower.includes('authentication failure') || lower.includes('invalid user') || lower.includes('login failed') || lower.includes('brute force')) {
    return {
      summary: `Failed authentication attempt detected on ${src}${ip ? ` from ${ip}` : ''}.`,
      impact: 'Repeated authorization rejections suggest automated credential brute-forcing or dictionary attack.',
      action: 'Enforce fail2ban rate-limiting on source IP, ensure password authentication is disabled in favor of SSH keys, and verify account lockouts.'
    };
  }

  if (lower.includes('sudo') || lower.includes('root') || lower.includes('privilege escalation') || lower.includes('uid=0') || lower.includes('setuid') || lower.includes('privesc')) {
    return {
      summary: 'Elevated or administrative privilege execution requested.',
      impact: 'Privilege escalation grants full administrative control over system resources and security configurations.',
      action: 'Audit caller identity against approved maintenance tickets, inspect /etc/sudoers permissions, and review subsequent command history.'
    };
  }

  if (lower.includes('ransom') || lower.includes('encrypt') || lower.includes('.locked') || lower.includes('shadow copy') || lower.includes('vssadmin')) {
    return {
      summary: 'High-risk automated file encryption or volume manipulation detected.',
      impact: 'Active ransomware execution poses imminent risk of permanent data loss and infrastructure extortion.',
      action: 'IMMEDIATELY isolate host from network interfaces, freeze originating process, and initiate offline immutable backup recovery.'
    };
  }

  if (lower.includes('syn flood') || lower.includes('ddos') || lower.includes('flood') || lower.includes('connection reset') || lower.includes('dropped packets')) {
    return {
      summary: `High-frequency network connection surge detected on ${src}.`,
      impact: 'Adversary may be attempting to exhaust connection tables or map open perimeter ports.',
      action: 'Enable TCP SYN cookies at kernel level, verify edge rate-limiting rules, and drop suspicious CIDR ranges at perimeter router.'
    };
  }

  if (lower.includes('k8s') || lower.includes('container') || lower.includes('namespace') || lower.includes('cgroup') || lower.includes('dockerd')) {
    return {
      summary: 'Container runtime namespace or privilege boundary activity detected.',
      impact: 'Unchecked container privileges can lead to host node compromise and lateral movement across adjacent workloads.',
      action: 'Enforce read-only root filesystems, terminate suspect pod, and apply strict Seccomp / AppArmor security profiles.'
    };
  }

  if (sev === 'CRITICAL' || sev === 'ERROR' || sev === 'HIGH') {
    return {
      summary: `Critical operational or security anomaly recorded by ${src}.`,
      impact: 'Abnormal service behavior or security exception that may disrupt availability or signal active reconnaissance.',
      action: 'Inspect related services, review error trace, and verify host firewall and access control policies.'
    };
  }

  if (sev === 'WARN' || sev === 'WARNING') {
    return {
      summary: `Warning alert indicating unusual parameter or threshold reached on ${src}.`,
      impact: 'Potential early precursor to service failure or unauthorized probing activity.',
      action: 'Check resource utilization metrics, monitor for repeated patterns, and adjust threshold alerting.'
    };
  }

  return {
    summary: `Standard ${src.toUpperCase()} operational event executed normally.`,
    impact: 'Confirms routine service transaction and healthy background operation.',
    action: 'No remediation required. Log retained in database for forensic baseline and audit compliance.'
  };
}

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderTable(logs) {
  document.getElementById('logTable').innerHTML = logs.map(l => {
    const expl = formatPlainLanguageExplanation(l);
    return `
    <tr>
      <td class="t-mono-xs text-muted">${l.line || '-'}</td>
      <td class="t-mono-xs text-muted" style="white-space:nowrap;">${(l.timestamp || '').slice(11, 19) || '-'}</td>
      <td>${sevBadge(l.severity)}</td>
      <td style="color:var(--slate);font-size:var(--text-sm);font-weight:600;">${escapeHtml(l.source)}</td>
      <td class="t-mono-xs text-muted">${escapeHtml(l.ip || '-')}</td>
      <td>
        <div class="plain-lang-card">
          <div class="plain-lang-row"><span class="plain-lang-tag what">What happened</span> <span>${escapeHtml(expl.summary)}</span></div>
          <div class="plain-lang-row"><span class="plain-lang-tag why">Why it matters</span> <span>${escapeHtml(expl.impact)}</span></div>
          <div class="plain-lang-row"><span class="plain-lang-tag action">What to do</span> <span>${escapeHtml(expl.action)}</span></div>
        </div>
        <details class="tech-details" style="margin-top:6px;">
          <summary class="tech-details-toggle">Technical Details</summary>
          <pre class="tech-details-content">${escapeHtml(l.message || JSON.stringify(l))}</pre>
        </details>
      </td>
    </tr>`;
  }).join('');
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
  if (pipelineTimer) clearInterval(pipelineTimer);
  for (let i = 0; i < 7; i++) {
    const el = document.getElementById('pl-' + i);
    if (!el) continue;
    el.classList.remove('active', 'done', 'error');
    const statusEl = el.querySelector('.pipeline-label-status');
    if (statusEl) statusEl.textContent = 'Waiting';
  }
  allLogs = [];
  currentFileId = null;
  currentAnalysisId = null;
  currentFileName = '';
  const logTable = document.getElementById('logTable');
  if (logTable) logTable.innerHTML = '';
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('uploadSection').style.display = 'block';
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';
}
