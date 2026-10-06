/**
 * frontend/assets/js/ml-analysis.js
 * Multi-Algorithmic Machine Learning Consensus Cockpit
 */

Chart.defaults.font.family = "'Space Grotesk', sans-serif";
Chart.defaults.color       = '#6B6880';

let timelineInst, featureInst, uploadedLogs = null, currentSource = 'stream';
let activeEventId = null, activeFileId = null, latestAnalysisResult = null;

const RUN_MSGS = [
  'Ingesting forensic logs…',
  'Vectorizing textual & IP behavioral features…',
  'Executing Isolation Forest classifier…',
  'Computing Local Outlier Factor densities…',
  'Fitting One-Class Support Vector Machine…',
  'Evaluating Random Forest anomaly estimator…',
  'Executing Temporal Drift & Frequency analysis…',
  'Synthesizing consensus score & SOC rules…'
];

function initMlAnalysis() {
  requireAuth();
  injectNavbar();
  setBreadcrumb([{ href: 'dashboard.html', label: 'Dashboard' }, { href: 'ml-analysis.html', label: 'ML Analysis' }]);
  checkHandoverOnLoad();
}

function switchSource(tab) {
  currentSource = tab;
  document.getElementById('tab-stream')?.classList.toggle('active', tab === 'stream');
  document.getElementById('tab-file')?.classList.toggle('active', tab === 'file');
  document.getElementById('streamConfig').style.display = tab === 'stream' ? 'block' : 'none';
  document.getElementById('fileConfig').style.display   = tab === 'file'   ? 'block' : 'none';
}

function onMlDrop(e) {
  e.preventDefault();
  document.getElementById('mlUploadZone')?.classList.remove('drag');
  onMlFile({ files: [e.dataTransfer.files[0]] });
}

async function onMlFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  document.getElementById('mlUploadLabel').textContent = `Loaded file: ${file.name}`;
  const text = await file.text().catch(() => '');
  uploadedLogs = text.split('\n').filter(Boolean).map((line, i) => ({
    id: String(i),
    timestamp: new Date().toISOString(),
    message: line,
    severity: /critical|fatal/i.test(line) ? 'CRITICAL' : /error|failed/i.test(line) ? 'ERROR' : /warn/i.test(line) ? 'WARN' : 'INFO',
    source: 'uploaded_file',
    ip: (line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/) || ['192.168.1.100'])[0],
  }));
  toast(`Loaded ${uploadedLogs.length} entries from ${file.name}`, 'success');
}

function clearHandover() {
  activeEventId = null;
  activeFileId = null;
  uploadedLogs = null;
  sessionStorage.removeItem('ilf_active_event');
  sessionStorage.removeItem('ilf_event_logs');
  document.getElementById('handoverBanner')?.classList.remove('show');
  switchSource('stream');
  toast('Reset to live stream mode', 'info');
}

async function checkHandoverOnLoad() {
  const params = new URLSearchParams(window.location.search);
  const fileId = params.get('file_id');
  const analysisId = params.get('analysis_id');
  const eventId = params.get('event_id') || analysisId;

  if (fileId) activeFileId = fileId;

  // Check sessionStorage for active event info from log-explorer
  const storedEventStr = sessionStorage.getItem('ilf_active_event');
  if (storedEventStr) {
    try {
      const parsedEvent = JSON.parse(storedEventStr);
      if (parsedEvent.filename) activeFileName = parsedEvent.filename;
      if (parsedEvent.file_id) activeFileId = parsedEvent.file_id;
      if (parsedEvent.analysis_id) activeEventId = parsedEvent.analysis_id;
    } catch (e) {}
  }

  // Check sessionStorage for raw logs passed from log-explorer
  const storedLogs = sessionStorage.getItem('ilf_event_logs');

  if (storedLogs) {
    try {
      uploadedLogs = JSON.parse(storedLogs);
      const bannerText = document.getElementById('handoverText');
      if (bannerText) bannerText.textContent = `Handover active: Analyzing ${uploadedLogs.length} logs from ${activeFileName || ('File #' + (fileId || 'Batch'))}`;
      document.getElementById('handoverBanner')?.classList.add('show');
      runAnalysis();
      return;
    } catch (e) {}
  }

  if (eventId) {
    activeEventId = eventId;
    document.getElementById('handoverBanner')?.classList.add('show');
    const bannerText = document.getElementById('handoverText');
    if (bannerText) bannerText.textContent = `Loading event record #${eventId}…`;
    const res = await Api.getMlEvent(eventId);
    if (res.ok && res.data?.success && res.data?.event) {
      const ev = res.data.event;
      if (ev.raw_logs && ev.raw_logs.length > 0) {
        uploadedLogs = ev.raw_logs;
        if (ev.filename) activeFileName = ev.filename;
        if (bannerText) bannerText.textContent = `Loaded analysis event #${ev.id} (${uploadedLogs.length} logs)`;
        runAnalysis();
      }
    }
  }
}

async function runAnalysis() {
  const overlay  = document.getElementById('runOverlay');
  const msgEl    = document.getElementById('runMsg');
  const progEl   = document.getElementById('runProgress');
  const runBtn   = document.getElementById('runBtn');

  if (overlay) overlay.classList.add('show');
  if (runBtn) runBtn.disabled = true;
  document.getElementById('resultsSection')?.classList.remove('show');

  let step = 0;
  const ticker = setInterval(() => {
    if (msgEl) msgEl.textContent  = RUN_MSGS[step % RUN_MSGS.length];
    if (progEl) progEl.style.width = Math.min((step / RUN_MSGS.length) * 100 + 10, 92) + '%';
    step++;
  }, 320);

  const source  = document.getElementById('cfgSource')?.value || 'all';
  const trange  = document.getElementById('cfgRange')?.value  || '1h';
  const payload = {
    source,
    time_range: trange,
    logs: uploadedLogs || undefined,
    file_id: activeFileId || undefined
  };

  const res = await Api.mlAnalyze(payload);

  clearInterval(ticker);
  if (overlay) overlay.classList.remove('show');
  if (runBtn) runBtn.disabled = false;

  if (!res.ok || !res.data?.success) {
    toast('Ensemble analysis failed — check backend status', 'error');
    return;
  }

  if (progEl) progEl.style.width = '100%';
  latestAnalysisResult = res.data;
  renderResults(res.data);
  toast('Ensemble analysis successfully completed', 'success');
}

function renderResults(d) {
  document.getElementById('resultsSection')?.classList.add('show');
  const reportBtn = document.getElementById('reportBtn');
  if (reportBtn) reportBtn.style.display = 'inline-flex';

  const consensus = d.consensus || {
    master_anomaly_score: d.anomaly_score || 0,
    risk_level: d.risk_level || 'LOW',
    confidence: d.confidence || 0.85,
    algorithm_agreement_pct: 100.0,
    anomaly_count: (d.flagged_entries || []).length,
    total_logs: (d.timeline?.scores || []).length || 50
  };

  // Consensus Score Ring
  const score = consensus.master_anomaly_score;
  const scoreNum = document.getElementById('scoreNum');
  if (scoreNum) scoreNum.textContent = score.toFixed(3);

  const circ = 2 * Math.PI * 58;
  const color = score > 0.75 ? '#DC2626' : score > 0.5 ? '#F59E0B' : '#10B981';
  setTimeout(() => {
    const ring = document.getElementById('scoreRing');
    if (ring) {
      ring.style.strokeDashoffset = circ * (1 - score);
      ring.setAttribute('stroke', color);
    }
  }, 100);

  // Risk & Agreement badges
  const rb = document.getElementById('riskBadge');
  if (rb) {
    const cls = { LOW: 'badge-success', MEDIUM: 'badge-warn', HIGH: 'badge-danger', CRITICAL: 'badge-critical' }[consensus.risk_level] || 'badge-neutral';
    rb.className = 'badge ' + cls;
    rb.textContent = consensus.risk_level + ' RISK';
  }

  document.getElementById('agreementBadge').textContent = `${consensus.algorithm_agreement_pct.toFixed(0)}% Ensemble Agreement`;
  document.getElementById('valConfidence').textContent = `${(consensus.confidence * 100).toFixed(1)}%`;
  document.getElementById('valAnomalies').textContent = consensus.anomaly_count;
  document.getElementById('valTotalLogs').textContent = consensus.total_logs;

  // 5 Algorithm Cards
  const algos = d.all_results || [];
  const algoGrid = document.getElementById('algoGrid');
  if (algoGrid) {
    algoGrid.innerHTML = algos.map(r => `
      <div class="algo-card ${r.is_best ? 'best' : ''}">
        <div>
          ${r.is_best ? '<div class="best-crown"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Highest Confidence</div>' : ''}
          <div class="algo-name">${r.algorithm}</div>
          <div class="algo-note">${r.note || 'Multi-variate statistical anomaly detection'}</div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink-2);margin-bottom:4px;">
            <span>Anomaly Score: <strong>${r.score.toFixed(3)}</strong></span>
            <span>Conf: <strong>${(r.confidence * 100).toFixed(0)}%</strong></span>
          </div>
          <div class="algo-score-row">
            <div class="algo-bar-track">
              <div class="algo-bar-fill" style="width:${Math.min(r.score * 100, 100).toFixed(0)}%"></div>
            </div>
            <div class="algo-score-val">${(r.score * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Dynamic Dataset & Architecture Metadata
  const totalAnalyzed = d.total_analyzed || (consensus && consensus.total_logs) || (uploadedLogs && uploadedLogs.length) || 0;
  const metaCountEl = document.getElementById('metaLogCount');
  if (metaCountEl) metaCountEl.textContent = totalAnalyzed.toLocaleString();

  const metaTitleEl = document.getElementById('metaDatasetTitle');
  if (metaTitleEl) {
    if (activeFileName) {
      metaTitleEl.textContent = `Analyzed File: ${activeFileName}`;
    } else if (activeFileId) {
      metaTitleEl.textContent = `Analyzed Upload ID: ${activeFileId}`;
    } else {
      metaTitleEl.textContent = `Live Forensic Stream (${d.source || 'all'})`;
    }
  }

  const metaBadgeEl = document.getElementById('metaSourceBadge');
  if (metaBadgeEl) {
    metaBadgeEl.textContent = activeFileName ? 'Uploaded Dataset' : (d.source ? `Stream: ${d.source}` : 'Stream Ingestion');
  }

  // SOC Countermeasures & Firewall Rules
  const soc = d.soc_countermeasures || d.countermeasures || {};
  const ips = soc.target_ips || soc.quarantined_ips || [];
  const threatIpBadge = document.getElementById('threatIpBadge');
  if (threatIpBadge) {
    threatIpBadge.textContent = `${ips.length} Hostile IP${ips.length === 1 ? '' : 's'} Identified`;
    threatIpBadge.className = ips.length ? 'badge badge-danger' : 'badge badge-success';
  }

  // Format iptables rules
  let iptablesRules = soc.iptables_rules;
  if (!iptablesRules && soc.firewall_rules) {
    iptablesRules = soc.firewall_rules.map(r => r.iptables).filter(Boolean);
  }
  const iptablesEl = document.getElementById('ruleIptables');
  if (iptablesEl) {
    iptablesEl.textContent = (iptablesRules && iptablesRules.length) 
      ? iptablesRules.join('\n') 
      : '# No hostile IPs detected in current analysis window.';
  }

  // Format Windows Defender rules
  let winDefRules = soc.windows_firewall_rules;
  if (!winDefRules && soc.firewall_rules) {
    winDefRules = soc.firewall_rules.map(r => r.windows_firewall).filter(Boolean);
  }
  const winDefEl = document.getElementById('ruleWinDef');
  if (winDefEl) {
    winDefEl.textContent = (winDefRules && winDefRules.length) 
      ? winDefRules.join('\n') 
      : '# No hostile IPs detected in current analysis window.';
  }

  // Remediation checklist
  const checklistWrap = document.getElementById('socChecklistWrap');
  const checklistEl = document.getElementById('socChecklist');
  if (checklistWrap && checklistEl) {
    const items = soc.action_checklist || [];
    if (items.length > 0) {
      checklistWrap.style.display = 'block';
      checklistEl.innerHTML = items.map(it => `<li>${it}</li>`).join('');
    } else {
      checklistWrap.style.display = 'none';
    }
  }

  // Timeline Chart
  const tl = d.timeline || { labels: [], scores: [] };
  const ctxTimeline = document.getElementById('timelineChart');
  if (ctxTimeline) {
    if (timelineInst) timelineInst.destroy();
    timelineInst = new Chart(ctxTimeline, {
      type: 'line',
      data: {
        labels: tl.labels,
        datasets: [{
          label: 'Consensus Score',
          data: tl.scores,
          borderColor: '#2D2B6B',
          backgroundColor: 'rgba(45,43,107,0.08)',
          tension: 0.35,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 9 }, maxTicksLimit: 6 }, grid: { color: 'rgba(0,0,0,0.04)' } },
          y: { min: 0, max: 1, ticks: { font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
        }
      }
    });
  }

  // Feature Importance Chart
  const fi = d.feature_importance || { labels: [], values: [] };
  const ctxFeature = document.getElementById('featureChart');
  if (ctxFeature) {
    if (featureInst) featureInst.destroy();
    featureInst = new Chart(ctxFeature, {
      type: 'bar',
      data: {
        labels: fi.labels,
        datasets: [{
          data: fi.values,
          backgroundColor: ['#2D2B6B', '#4338CA', '#6366F1', '#F59E0B', '#10B981'],
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { min: 0, max: 1, ticks: { font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
          y: { ticks: { font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  // Flagged Table
  const flagged = d.flagged_entries || [];
  const flaggedTable = document.getElementById('flaggedTable');
  if (flaggedTable) {
    flaggedTable.innerHTML = flagged.length ? flagged.map(log => `
      <tr>
        <td class="t-mono-xs text-muted">${fmtTs(log.timestamp)}</td>
        <td>${sevBadge(log.severity)}</td>
        <td style="color:var(--slate);font-size:var(--text-sm);font-weight:600;">${log.source}</td>
        <td class="t-mono-xs text-muted">${log.ip}</td>
        <td style="font-size:var(--text-sm);">${log.message}</td>
      </tr>
    `).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:24px;">No anomalies flagged in this log window. System healthy.</td></tr>`;
  }

  document.getElementById('resultsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function copyCode(elemId) {
  const text = document.getElementById(elemId)?.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    toast('Rule copied to clipboard', 'success');
  }).catch(() => {
    toast('Failed to copy', 'error');
  });
}

function exportToReport() {
  if (!latestAnalysisResult?.analysis_id) {
    toast('Run an analysis before creating its report.', 'warn');
    return;
  }

  const params = new URLSearchParams({
    source: 'ml',
    activity_id: latestAnalysisResult.analysis_id,
    activity_type: 'ml_run'
  });
  window.location.assign(`/reports?${params.toString()}`);
}
