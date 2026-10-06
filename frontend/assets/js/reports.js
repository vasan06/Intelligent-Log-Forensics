requireAuth();
injectNavbar();
setBreadcrumb([{href:'dashboard.html',label:'Dashboard'},{href:'reports.html',label:'Reports'}]);

Chart.defaults.font.family = "'Space Grotesk', sans-serif";
Chart.defaults.color       = '#6B6880';

let activitiesList = [];
let previewChart = null;

async function loadActivities() {
  const sel = document.getElementById('activitySelect');
  const res = await Api.reportActivities();
  if (res.ok && res.data?.activities) {
    activitiesList = res.data.activities;
    sel.innerHTML = '<option value="latest">Latest Security Telemetry (Consensus Baseline)</option>';
    activitiesList.forEach(act => {
      const opt = document.createElement('option');
      opt.value = act.id;
      opt.dataset.type = act.type;
      opt.textContent = act.label;
      sel.appendChild(opt);
    });
  }
}

function getReportPlainLanguageExplanation(msg, sev, src, ip) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('select') || m.includes('union') || m.includes('drop table') || m.includes('script') || m.includes('1=1') || m.includes('jndi:')) {
    return {
      summary: `Web application injection attempt detected on ${src}${ip ? ` from ${ip}` : ''}.`,
      impact: 'Adversary targeting backend database execution and session compromise.',
      action: 'Deploy WAF signature blocking and audit parameter prepared statements.'
    };
  }
  if (m.includes('failed password') || m.includes('authentication') || m.includes('invalid user') || m.includes('login failed') || m.includes('brute force')) {
    return {
      summary: `Authentication failure detected on ${src}${ip ? ` from ${ip}` : ''}.`,
      impact: 'Repeated authentication rejections indicating password spraying or brute force.',
      action: 'Rate-limit IP at perimeter firewall, enforce SSH key authentication, and audit account lockouts.'
    };
  }
  if (m.includes('sudo') || m.includes('root') || m.includes('privilege') || m.includes('privesc')) {
    return {
      summary: 'Administrative privilege elevation event detected.',
      impact: 'Root-level commands grant full access to security policies and kernel subsystems.',
      action: 'Audit session operator against authorized change requests and inspect command audit trail.'
    };
  }
  if (m.includes('ransom') || m.includes('encrypt') || m.includes('shadow copy')) {
    return {
      summary: 'Malicious file encryption or ransomware signature detected.',
      impact: 'Imminent threat of host extortion and irreversible data destruction.',
      action: 'Isolate host from local network immediately and initiate offline snapshot restoration.'
    };
  }
  return {
    summary: `${sev} security event flagged by ${src.toUpperCase()} telemetry.`,
    impact: 'Deviation from expected baseline requiring forensic triage.',
    action: 'Review correlated telemetry and verify service configuration integrity.'
  };
}

function getSelectedActivityParams() {
  const sel = document.getElementById('activitySelect');
  const val = sel.value;
  if (val === 'latest') return { type: 'overall' };
  const opt = sel.options[sel.selectedIndex];
  return {
    activity_id: val,
    activity_type: opt ? opt.dataset.type : 'ml_run'
  };
}

function getSelectedActivityPayload() {
  return getSelectedActivityParams();
}

async function generatePreview(paramsOverride = null) {
  const btn = document.getElementById('btnPreview');
  const originalLabel = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Analyzing…';

  try {
    const params = paramsOverride || getSelectedActivityParams();
    const res = await Api.reportPreview(params);
    if (!res.ok || !res.data?.success) {
      toast(res.data?.message || 'Failed to generate report preview', 'error');
      return;
    }

    renderPreview(res.data);
    toast('Report preview updated', 'success');
  } catch (error) {
    console.error('Report preview failed:', error);
    toast('Report preview failed. Check the server response and try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
}

function renderPreview(data) {
  document.getElementById('previewEmpty').style.display = 'none';
  const c = document.getElementById('previewContent');
  c.style.display = 'block';

  const r = data.report || {};
  const s = r.summary || {};
  const ml = r.ml_results || [];
  const soc = r.soc_countermeasures || {};

  const riskBadge = {
    LOW: 'badge-success',
    MEDIUM: 'badge-warn',
    HIGH: 'badge-danger',
    CRITICAL: 'badge-critical'
  }[s.risk_level] || 'badge-neutral';

  c.innerHTML = `
    <!-- KPI Row -->
    <div class="kpi-row">
      <div class="card" style="padding:var(--sp-4);">
        <div style="font-size:11px;color:var(--ink-3);font-weight:600;text-transform:uppercase;">Investigated Volume</div>
        <div style="font-size:1.6rem;font-weight:800;color:var(--ink-0);margin-top:4px;">${Number(s.total_logs||0).toLocaleString()} <span style="font-size:12px;font-weight:500;color:var(--ink-3);">logs</span></div>
      </div>
      <div class="card" style="padding:var(--sp-4);">
        <div style="font-size:11px;color:var(--ink-3);font-weight:600;text-transform:uppercase;">Flagged Anomalies</div>
        <div style="font-size:1.6rem;font-weight:800;color:#DC2626;margin-top:4px;">${Number(s.anomalies||0).toLocaleString()} <span style="font-size:12px;font-weight:500;color:var(--ink-3);">deviations</span></div>
      </div>
      <div class="card" style="padding:var(--sp-4);">
        <div style="font-size:11px;color:var(--ink-3);font-weight:600;text-transform:uppercase;">Consensus Score</div>
        <div style="font-size:1.6rem;font-weight:800;color:var(--brand-primary);margin-top:4px;">${Number(s.anomaly_score||0).toFixed(3)}</div>
      </div>
      <div class="card" style="padding:var(--sp-4);">
        <div style="font-size:11px;color:var(--ink-3);font-weight:600;text-transform:uppercase;">Consensus Risk Level</div>
        <div style="margin-top:8px;"><span class="badge ${riskBadge}" style="font-size:13px;padding:6px 14px;">${s.risk_level} RISK</span></div>
      </div>
    </div>

    <!-- Executive Findings -->
    <div class="card mb-6" style="padding:var(--sp-6);">
      <div class="section-label">Executive Forensic Findings</div>
      <p style="font-size:var(--text-sm);color:var(--ink-1);line-height:1.7;margin-bottom:var(--sp-4);">
        Audit targeting <strong>${r.activity_label || 'Current Activity'}</strong> completed with an ensemble agreement rating of
        <strong>${s.agreement_pct ? s.agreement_pct.toFixed(0) : 100}%</strong>.
        The consensus engine classified the telemetry as <strong>${s.risk_level} Risk</strong> based on cross-validation across Isolation Forest,
        Local Outlier Factor, One-Class SVM, Random Forest, and Temporal Frequency analysis.
      </p>

      <!-- Algorithm Score Breakdown -->
      <div class="grid-2" style="gap:var(--sp-5);align-items:center;margin-top:var(--sp-4);">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--ink-1);margin-bottom:8px;">Model Anomaly Distribution</div>
          <div style="height:180px;"><canvas id="previewScoreChart"></canvas></div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--ink-1);margin-bottom:8px;">Classifiers Evaluated</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${ml.map(m => `
              <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface-1);padding:8px 12px;border-radius:var(--r-md);font-size:12px;">
                <span style="font-weight:600;color:var(--ink-0);">${m.algorithm}</span>
                <span style="font-family:var(--font-mono);font-weight:700;color:var(--brand-primary);">${Number(m.score).toFixed(3)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- SOC Countermeasures -->
    <div class="card mb-6" style="padding:var(--sp-6);background:#F8FAFC;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <h3 style="font-size:1.1rem;font-weight:700;margin:0;color:var(--ink-0);">Automated SOC Containment Rules</h3>
      </div>
      <p style="font-size:var(--text-xs);color:var(--ink-2);margin-bottom:var(--sp-3);">
        Synthesized rules ready for deployment into edge routers and host firewalls.
      </p>
      <div class="grid-2" style="gap:var(--sp-4);">
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--ink-1);">iptables (Linux Perimeter)</div>
          <div class="soc-box"><pre style="margin:0;white-space:pre-wrap;">${(soc.iptables_rules || ['# No threat IPs detected.']).join('\n')}</pre></div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--ink-1);">Windows Defender (PowerShell)</div>
          <div class="soc-box"><pre style="margin:0;white-space:pre-wrap;">${(soc.windows_firewall_rules || ['# No threat IPs detected.']).join('\n')}</pre></div>
        </div>
      </div>
    </div>

    <!-- Forensic Feature Weights & Timeline -->
    ${(r.feature_importance?.labels?.length || r.timeline?.labels?.length) ? `
      <div class="grid-2 mb-6" style="gap:var(--sp-4);">
        ${r.feature_importance?.labels?.length ? `
          <div class="card" style="padding:var(--sp-5);">
            <div style="font-size:12px;font-weight:700;color:var(--ink-1);margin-bottom:8px;">Forensic Signal Weights</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${r.feature_importance.labels.slice(0, 6).map((lbl, idx) => `
                <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface-1);padding:6px 10px;border-radius:var(--r-md);font-size:11px;">
                  <span style="font-weight:600;color:var(--ink-0);">${lbl}</span>
                  <span style="font-family:var(--font-mono);font-weight:700;color:var(--brand-primary);">${Number(r.feature_importance.values[idx] || 0).toFixed(3)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${r.timeline?.labels?.length ? `
          <div class="card" style="padding:var(--sp-5);">
            <div style="font-size:12px;font-weight:700;color:var(--ink-1);margin-bottom:8px;">Chronological Anomaly Progression</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${r.timeline.labels.slice(0, 6).map((lbl, idx) => `
                <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface-1);padding:6px 10px;border-radius:var(--r-md);font-size:11px;">
                  <span style="font-weight:600;color:var(--ink-0);">${lbl}</span>
                  <span style="font-family:var(--font-mono);font-weight:700;color:${Number(r.timeline.scores[idx] || 0) > 0.6 ? '#DC2626' : 'var(--brand-primary)'};">${Number(r.timeline.scores[idx] || 0).toFixed(3)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    ` : ''}

    <!-- Evidence Sample -->
    ${(r.flagged_entries || []).length ? `
      <div class="card mb-6">
        <div style="padding:var(--sp-5) var(--sp-5) 0;">
          <div class="section-label">Top Flagged Incident Evidence</div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Time</th><th>Severity</th><th>Source</th><th>IP</th><th>Forensic Analysis &amp; Plain-Language Explanation</th></tr></thead>
            <tbody>
              ${r.flagged_entries.map(x => {
                const expl = getReportPlainLanguageExplanation(x.message, x.severity, x.source, x.ip);
                return `
                <tr>
                  <td class="t-mono-xs text-muted" style="white-space:nowrap;">${fmtTs(x.timestamp)}</td>
                  <td>${sevBadge(x.severity)}</td>
                  <td style="font-size:var(--text-sm);font-weight:600;">${x.source}</td>
                  <td class="t-mono-xs text-muted">${x.ip || '-'}</td>
                  <td>
                    <div class="plain-lang-card">
                      <div class="plain-lang-row"><span class="plain-lang-tag what">What happened</span> <span>${expl.summary}</span></div>
                      <div class="plain-lang-row"><span class="plain-lang-tag why">Why it matters</span> <span>${expl.impact}</span></div>
                      <div class="plain-lang-row"><span class="plain-lang-tag action">What to do</span> <span>${expl.action}</span></div>
                    </div>
                    <details class="tech-details" style="margin-top:6px;">
                      <summary class="tech-details-toggle">Technical Details</summary>
                      <pre class="tech-details-content">${x.message}</pre>
                    </details>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;

  // Render score chart
  const ctx = document.getElementById('previewScoreChart');
  if (ctx && ml.length) {
    if (previewChart) previewChart.destroy();
    previewChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ml.map(m => m.algorithm.replace(' Anomaly Classifier', '').replace(' & Frequency Analyzer', '')),
        datasets: [{
          data: ml.map(m => m.score),
          backgroundColor: ['#2D2B6B', '#4338CA', '#6366F1', '#F59E0B', '#10B981'],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 9 } }, grid: { display: false } },
          y: { min: 0, max: 1, ticks: { font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
        }
      }
    });
  }

  c.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function downloadPdfBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

async function getBlobErrorMessage(blob) {
  if (!blob || !blob.type.includes('json')) return '';
  try {
    const data = JSON.parse(await blob.text());
    return data.message || data.error || '';
  } catch (error) {
    console.warn('Could not read PDF error response:', error);
    return '';
  }
}

async function downloadPdf() {
  const btn = document.getElementById('btnDownload');
  const originalLabel = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Generating PDF…';

  try {
    const res = await Api.generateReport(getSelectedActivityPayload());
    if (!res.ok || !res.blob || res.blob.size === 0) {
      const detail = await getBlobErrorMessage(res.blob);
      throw new Error(detail || `PDF generation failed${res.status ? ` (HTTP ${res.status})` : ''}.`);
    }
    if (res.blob.type && !res.blob.type.includes('pdf')) {
      const detail = await getBlobErrorMessage(res.blob);
      throw new Error(detail || 'The server response was not a PDF file.');
    }

    downloadPdfBlob(res.blob, `ILF_Forensic_Report_${Date.now()}.pdf`);
    toast('PDF report saved and archived in PostgreSQL', 'success');
    await loadHistory();
  } catch (error) {
    console.error('PDF report generation failed:', error);
    toast(error.message || 'PDF generation failed. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
}

async function downloadExistingReport(id) {
  try {
    const res = await Api.downloadReport(id);
    if (!res.ok || !res.blob || res.blob.size === 0) {
      const detail = await getBlobErrorMessage(res.blob);
      throw new Error(detail || `Failed to download archived report${res.status ? ` (HTTP ${res.status})` : ''}.`);
    }
    if (res.blob.type && !res.blob.type.includes('pdf')) {
      const detail = await getBlobErrorMessage(res.blob);
      throw new Error(detail || 'The server response was not a PDF file.');
    }

    downloadPdfBlob(res.blob, `ILF_Report_${id.slice(0, 8)}.pdf`);
  } catch (error) {
    console.error('Archived PDF download failed:', error);
    toast(error.message || 'Failed to download archived report.', 'error');
  }
}

async function loadHistory() {
  const tbody = document.getElementById('historyTable');
  const res = await Api.reportHistory();
  if (res.ok && res.data?.reports) {
    const list = res.data.reports;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:24px;">No reports generated yet. Click "Download PDF" to archive your first report.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(r => `
      <tr>
        <td class="t-mono-xs" style="font-weight:600;color:var(--brand-primary);">${r.id.slice(0, 8)}…</td>
        <td style="font-size:var(--text-sm);text-transform:capitalize;">${(r.type || 'executive').replace('_', ' ')}</td>
        <td class="t-mono-xs text-muted">${r.db_location || `db://reports/${r.id}`}</td>
        <td class="t-mono-xs text-muted">${fmtTs(r.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="downloadExistingReport('${r.id}')">Download</button>
        </td>
      </tr>
    `).join('');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const activityId = params.get('activity_id') || params.get('analysis_id');
  const activityType = params.get('activity_type') || 'ml_run';

  loadActivities().then(() => {
    if (!activityId || params.get('source') !== 'ml') return;

    const selector = document.getElementById('activitySelect');
    if (selector && Array.from(selector.options).some(option => option.value === activityId)) {
      selector.value = activityId;
    }
    return generatePreview({ activity_id: activityId, activity_type: activityType });
  }).catch(error => {
    console.error('Failed to initialize report activities:', error);
    toast('Could not load report activities.', 'error');
  });
  loadHistory();
});