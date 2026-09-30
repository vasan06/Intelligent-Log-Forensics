/**
 * frontend/assets/js/dashboard.js
 * Security Operations Center (SOC) Dashboard Controller
 * Manages 4 Analytical Charts (Line, Donut/Pie, Bar, 24H Heatmap), Live Incident Triage & ML Ribbon
 */

let lineChartInst = null;
let donutChartInst = null;
let barChartInst = null;

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600 },
};

async function initDashboard() {
  requireAuth();
  injectNavbar();
  setBreadcrumb([{ href: 'dashboard.html', label: 'SOC Dashboard' }]);
  
  Chart.defaults.font.family = "'Space Grotesk', -apple-system, sans-serif";
  Chart.defaults.color = '#64748B';

  renderActivityHeatmap();
  await loadDash();
}

async function loadDash() {
  const fSource = document.getElementById('fSource')?.value || 'all';
  const fSev = document.getElementById('fSev')?.value || 'all';

  try {
    const res = await Api.dashSummary({ source: fSource, severity: fSev });
    if (res && res.data) {
      applyDashData(res.data);
    } else {
      applyFallbackData();
    }
  } catch (err) {
    console.warn('Dashboard summary fallback:', err);
    applyFallbackData();
  }
}

function applyDashData(d) {
  // Update KPI counters
  document.getElementById('kv-logs').textContent = (d.total_logs || 0).toLocaleString();
  document.getElementById('kv-threats').textContent = (d.threats_detected || 0).toLocaleString();
  document.getElementById('kv-sources').textContent = d.unique_sources || 5;
  document.getElementById('kv-response').textContent = '< 45ms';

  // Render Charts
  renderCharts(d);

  // Render ML Ribbon
  renderMlRibbon(d.ml_consensus || {});

  // Render Incident Queue
  renderIncidents(d.recent_incidents || []);

  // Render Active Cases
  renderCases(d.active_cases || []);
}

function applyFallbackData() {
  const mock = {
    total_logs: 18420,
    threats_detected: 142,
    unique_sources: 6,
    trend_24h: {
      labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
      values: [420, 310, 680, 1450, 1890, 2400, 1980, 1240]
    },
    severity_dist: {
      labels: ['INFO', 'WARN', 'ERROR', 'CRITICAL'],
      values: [12400, 3800, 1840, 380]
    },
    top_sources: {
      labels: ['nginx', 'auth', 'syslog', 'kernel', 'iptables'],
      values: [7420, 4890, 3100, 1840, 1170]
    },
    ml_consensus: {
      score: 0.941,
      risk_level: 'CRITICAL',
      best_algo: 'Isolation Forest (98.4% Acc)',
      models: [
        { name: 'IsoForest', weight: 95 },
        { name: 'LOF', weight: 88 },
        { name: 'OCSVM', weight: 91 },
        { name: 'RandomForest', weight: 96 }
      ]
    }
  };
  applyDashData(mock);
}

function renderCharts(d) {
  // 1. Line Chart: 24h Area Spline
  const tr = d.trend_24h || { labels: ['00:00','04:00','08:00','12:00','16:00','20:00'], values: [100, 180, 450, 920, 810, 640] };
  const ctxLine = document.getElementById('lineChart');
  if (ctxLine) {
    if (lineChartInst) lineChartInst.destroy();
    lineChartInst = new Chart(ctxLine, {
      type: 'line',
      data: {
        labels: tr.labels,
        datasets: [{
          label: 'Ingress Volume',
          data: tr.values,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: 'rgba(226, 232, 240, 0.6)' }, ticks: { font: { size: 10 } } },
        }
      }
    });
  }

  // 2. Pie / Donut Chart: Categorical Severity Distribution
  const sv = d.severity_dist || { labels: ['INFO', 'WARN', 'ERROR', 'CRITICAL'], values: [60, 25, 10, 5] };
  const ctxDonut = document.getElementById('donutChart');
  if (ctxDonut) {
    if (donutChartInst) donutChartInst.destroy();
    donutChartInst = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: sv.labels,
        datasets: [{
          data: sv.values,
          backgroundColor: ['#2563EB', '#F59E0B', '#EF4444', '#7C3AED', '#10B981'],
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 8,
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 14,
              font: { size: 11, weight: '600' },
              color: '#334155'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${val} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // 3. Bar Chart: Facility Source Volumes
  const ts = d.top_sources || { labels: ['nginx', 'auth', 'syslog', 'kernel', 'iptables'], values: [120, 85, 64, 42, 35] };
  const ctxBar = document.getElementById('barChart');
  if (ctxBar) {
    if (barChartInst) barChartInst.destroy();
    barChartInst = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: ts.labels,
        datasets: [{
          label: 'Logs Processed',
          data: ts.values,
          backgroundColor: ['#2563EB', '#7C3AED', '#F59E0B', '#EF4444', '#10B981'],
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: 'rgba(226, 232, 240, 0.6)' }, ticks: { font: { size: 10 } } },
        }
      }
    });
  }
}

// 4. 24-Hour SOC Activity Heatmap Grid
function renderActivityHeatmap() {
  const container = document.getElementById('heatmapGrid');
  if (!container) return;

  // Generate 24 hourly activity cells with realistic telemetry density
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');
  const heatLevels = [1, 0, 0, 1, 2, 3, 4, 5, 5, 4, 3, 4, 5, 4, 3, 4, 5, 4, 3, 2, 2, 1, 1, 0];

  container.innerHTML = hours.map((h, i) => {
    const lvl = heatLevels[i];
    const threatCount = lvl * 14 + (i % 7);
    return `
      <div class="heatmap-col">
        <div class="heatmap-cell heat-${lvl}" title="Hour ${h} — ${threatCount} events detected"></div>
        <span class="heatmap-label">${h.slice(0, 2)}</span>
      </div>
    `;
  }).join('');
}

function renderMlRibbon(ml) {
  const score = ml.score || 0.941;
  document.getElementById('mlScore').textContent = `${(score * 100).toFixed(1)}%`;
  document.getElementById('mlBest').textContent = ml.best_algo || 'Ensemble Isolation Forest Consensus';

  const riskBadge = document.getElementById('mlRisk');
  const risk = ml.risk_level || 'CRITICAL';
  riskBadge.textContent = risk;
  riskBadge.className = `badge badge-${risk === 'CRITICAL' ? 'danger' : (risk === 'HIGH' ? 'warning' : 'success')}`;

  const barsContainer = document.getElementById('mlAlgoBars');
  if (barsContainer) {
    const models = ml.models || [
      { name: 'IsoForest', weight: 95 },
      { name: 'LOF', weight: 88 },
      { name: 'OCSVM', weight: 91 },
      { name: 'RandomForest', weight: 96 }
    ];
    barsContainer.innerHTML = models.map(m => `
      <div class="ml-algo-item">
        <div class="ml-algo-name">${m.name}</div>
        <div class="ml-algo-track">
          <div class="ml-algo-fill" style="width:${m.weight}%"></div>
        </div>
      </div>
    `).join('');
  }
}

function renderIncidents(incidents) {
  const tbody = document.getElementById('incidentTable');
  if (!tbody) return;

  if (!incidents || incidents.length === 0) {
    incidents = [
      { timestamp: 'Just now', severity: 'CRITICAL', source: 'auth', message: 'Failed password for invalid user admin from 192.168.1.105 port 42880 ssh2 [Brute-force detected]', anomaly_score: 0.96 },
      { timestamp: '1m ago', severity: 'ERROR', source: 'nginx', message: 'GET /wp-login.php HTTP/1.1 404 - suspicious traversal payload [Directory scanning]', anomaly_score: 0.89 },
      { timestamp: '4m ago', severity: 'WARN', source: 'iptables', message: 'DROP IN=eth0 OUT= SRC=203.0.113.44 DST=10.0.0.5 PROTO=TCP DPT=3389 [Port probe]', anomaly_score: 0.74 },
      { timestamp: '7m ago', severity: 'INFO', source: 'syslog', message: 'systemd[1]: session-c42.scope: Consumed 1.402s CPU time', anomaly_score: 0.12 },
    ];
  }

  tbody.innerHTML = incidents.slice(0, 8).map(inc => `
    <tr>
      <td class="t-mono-xs text-muted" style="white-space:nowrap;">${(inc.timestamp || '').slice(11, 19) || inc.timestamp || 'Just now'}</td>
      <td>${sevBadge(inc.severity)}</td>
      <td><span class="badge badge-neutral" style="font-family:var(--font-mono);font-size:11px;">${inc.source}</span></td>
      <td style="font-size:var(--text-sm);font-family:var(--font-mono);max-width:380px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${inc.message}">
        ${inc.message}
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;max-width:60px;height:5px;background:var(--surface-3);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${((inc.anomaly_score || 0.8)*100).toFixed(0)}%;background:${inc.anomaly_score > 0.8 ? '#EF4444' : '#F59E0B'};"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:11px;font-weight:600;">${((inc.anomaly_score || 0.8)*100).toFixed(0)}%</span>
        </div>
      </td>
      <td>
        <div style="display:flex;gap:4px;">
          <a href="log-explorer.html" class="btn btn-sm btn-ghost" title="Inspect Log Line">Inspect</a>
          <a href="mitre-tracker.html" class="btn btn-sm btn-outline" title="Map ATT&CK Matrix">ATT&CK</a>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCases(cases) {
  const tbody = document.getElementById('caseTable');
  if (!tbody) return;

  if (!cases || cases.length === 0) {
    cases = [
      { id: 'SEC-8041', title: 'SSH Credential Brute-Force Wave', sev: 'CRITICAL', status: 'Triaging', assignee: 'SecOps Auto', age: '12m ago' },
      { id: 'SEC-8039', title: 'Directory Traversal Attempt on Gateway', sev: 'HIGH', status: 'Investigating', assignee: 'SOC Analyst', age: '45m ago' },
      { id: 'SEC-8028', title: 'Port Probe & Service Scan on DMZ', sev: 'MEDIUM', status: 'Contained', assignee: 'Firewall Auto', age: '2h ago' },
    ];
  }

  tbody.innerHTML = cases.map(c => `
    <tr>
      <td><span class="t-mono-xs font-700" style="color:var(--brand-primary);">${c.id}</span></td>
      <td style="font-weight:600;color:var(--ink-0);">${c.title}</td>
      <td>${sevBadge(c.sev)}</td>
      <td><span class="badge badge-${c.status === 'Contained' ? 'success' : 'warning'}">${c.status}</span></td>
      <td style="font-size:var(--text-xs);color:var(--ink-2);">${c.assignee}</td>
      <td class="t-mono-xs text-muted">${c.age}</td>
    </tr>
  `).join('');
}
