/**
 * frontend/assets/js/dashboard.js
 * Intelligent Log Forensics — SOC Dashboard Controller
 *
 * All dashboard visualisations are populated from authenticated API data.
 * No hard-coded telemetry, incidents, cases, heatmap values, or ML results.
 */

let lineChartInst = null;
let donutChartInst = null;
let barChartInst = null;
let dashboardLoadInFlight = false;

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 500 }
};

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initDashboard() {
  requireAuth();

  injectNavbar();

  setBreadcrumb([
    {
      href: 'dashboard.html',
      label: 'SOC Dashboard'
    }
  ]);

  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family =
      "'Space Grotesk', -apple-system, sans-serif";

    Chart.defaults.color = '#64748B';
  }

  await loadDash();
}


/* =========================================================
   LOAD DASHBOARD
   ========================================================= */

async function loadDash(isSync = false) {
  if (dashboardLoadInFlight) return;
  dashboardLoadInFlight = true;

  const fTitle = document.getElementById('fTitle')?.value.trim() || '';
  const activity = document.getElementById('fActivity');
  const activityId = activity?.value || 'latest';
  const activityType = activity?.selectedOptions?.[0]?.dataset.type || 'baseline';
  const fLogType = document.getElementById('fLogType')?.value || 'all';
  const fSource = document.getElementById('fSource')?.value || 'all';
  const fSev = document.getElementById('fSev')?.value || 'all';

  const params = {};
  if (fTitle) params.title = fTitle;
  if (activityId && activityId !== 'latest' && activityType !== 'all') {
    params.investigation_id = activityId;
    params.investigation_type = activityType;
  } else if (activityType === 'all') {
    params.investigation_type = 'all';
  }
  if (fLogType && fLogType !== 'all') params.activity_type = fLogType;
  if (fSource && fSource !== 'all') params.source = fSource;
  if (fSev && fSev !== 'all') params.severity = fSev;

  const syncBtn = document.getElementById('syncDashBtn');
  if (syncBtn && isSync) {
    syncBtn.classList.add('loading');
    syncBtn.disabled = true;
  }

  try {
    const res = await Api.dashStats(params);

    if (!res || !res.ok || res.data?.success === false) {
      console.error('Dashboard API error:', res);
      renderEmptyDashboard();
      return;
    }

    const data = normalizeDashboardResponse(res.data);
    applyDashData(data);

  } catch (err) {
    console.error('Dashboard loading failed:', err);
    renderEmptyDashboard();
  } finally {
    if (syncBtn && isSync) {
      syncBtn.classList.remove('loading');
      syncBtn.disabled = false;
    }
    dashboardLoadInFlight = false;
  }

}

function resetDashFilters() {
  const fTitle = document.getElementById('fTitle');
  if (fTitle) fTitle.value = '';
  const activity = document.getElementById('fActivity');
  if (activity) activity.value = 'all';
  const fLogType = document.getElementById('fLogType');
  if (fLogType) fLogType.value = 'all';
  const fSource = document.getElementById('fSource');
  if (fSource) fSource.value = 'all';
  const fSev = document.getElementById('fSev');
  if (fSev) fSev.value = 'all';

  loadDash();
}

window.resetDashFilters = resetDashFilters;


/* =========================================================
   NORMALIZE API RESPONSE
   ========================================================= */

function normalizeDashboardResponse(raw) {

  const d = raw?.data || raw || {};

  /*
   * Some backend responses may wrap dashboard data inside
   * "dashboard", "summary", or "result".
   */
  const source =
    d.dashboard ||
    d.summary ||
    d.result ||
    d;

  return {
    total_logs:
      Number(
        source.total_logs ??
        source.log_count ??
        source.logs_count ??
        0
      ),

    threats_detected:
      Number(
        source.threats_detected ??
        source.threat_count ??
        source.anomalies ??
        source.anomaly_count ??
        0
      ),

    unique_sources:
      Number(
        source.unique_sources ??
        source.source_count ??
        source.facilities ??
        0
      ),

    response_time:
      source.response_time ??
      source.avg_response_time ??
      source.processing_latency ??
      null,

    analysis_activity: source.analysis_activity || { count: 0 },
    investigation_activities: Array.isArray(source.investigation_activities)
      ? source.investigation_activities
      : [],

    trend_24h:
      normalizeTrend(
        source.trend_window ??
        source.trend_24h ??
        source.log_trend ??
        source.hourly_trend
      ),

    severity_dist:
      normalizeDistribution(
        source.severity_dist ??
        source.severity_distribution ??
        source.severity
      ),

    top_sources:
      normalizeDistribution(
        source.top_sources ??
        source.source_distribution ??
        source.facility_distribution
      ),

    heatmap:
      source.heatmap ??
      source.activity_heatmap ??
      source.hourly_activity ??
      null,

    ml_consensus:
      source.ml_consensus ??
      source.ml_summary ??
      source.ml ??
      {},

    recent_incidents:
      normalizeArray(
        source.recent_incidents ??
        source.incidents ??
        source.recent_events
      ),

    active_cases:
      normalizeArray(
        source.active_cases ??
        source.cases ??
        source.investigations ??
        source.active_investigations
      )
  };
}


/* =========================================================
   ARRAY NORMALIZATION
   ========================================================= */

function normalizeArray(value) {

  if (Array.isArray(value)) {
    return value;
  }

  /*
   * Handle responses such as:
   *
   * {
   *   items: [...]
   * }
   *
   * {
   *   rows: [...]
   * }
   */
  if (value && Array.isArray(value.items)) {
    return value.items;
  }

  if (value && Array.isArray(value.rows)) {
    return value.rows;
  }

  if (value && Array.isArray(value.results)) {
    return value.results;
  }

  return [];
}


/* =========================================================
   TREND NORMALIZATION
   ========================================================= */

function normalizeTrend(value) {

  if (!value) {
    return {
      labels: [],
      values: []
    };
  }

  /*
   * Backend may already return:
   *
   * {
   *   labels: [...],
   *   values: [...]
   * }
   */

  if (
    Array.isArray(value.labels) &&
    Array.isArray(value.values)
  ) {

    return {
      labels: value.labels.map(label => {

        /*
         * If the label is actually a timestamp,
         * convert it to IST 12-hour format.
         */
        const date = new Date(label);

        if (!Number.isNaN(date.getTime())) {
          return formatISTHour(date);
        }

        return String(label);
      }),

      values: value.values.map(
        v => Number(v) || 0
      )
    };
  }

  /*
   * Backend may return:
   *
   * [
   *   {
   *     timestamp: "...",
   *     count: 10
   *   }
   * ]
   */

  if (Array.isArray(value)) {

    return {

      labels: value.map(item => {

        const timestamp =
          item.timestamp ??
          item.time ??
          item.datetime ??
          item.date ??
          item.label ??
          item.hour;

        /*
         * Try timestamp first.
         */
        if (timestamp) {

          const date =
            new Date(timestamp);

          if (!Number.isNaN(date.getTime())) {
            return formatISTHour(date);
          }
        }

        return String(timestamp ?? '');
      }),

      values: value.map(
        item =>
          Number(
            item.value ??
            item.count ??
            item.total ??
            item.logs ??
            item.events ??
            0
          )
      )
    };
  }

  return {
    labels: [],
    values: []
  };
}


/* =========================================================
   DISTRIBUTION NORMALIZATION
   ========================================================= */

function normalizeDistribution(value) {

  if (!value) {
    return {
      labels: [],
      values: []
    };
  }

  if (
    Array.isArray(value.labels) &&
    Array.isArray(value.values)
  ) {
    return {
      labels: value.labels,
      values: value.values.map(v => Number(v) || 0)
    };
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const keys = Object.keys(value).filter(k => k !== 'labels' && k !== 'values');
    if (keys.length > 0) {
      return {
        labels: keys,
        values: keys.map(k => Number(value[k]) || 0)
      };
    }
  }

  if (Array.isArray(value)) {

    return {
      labels: value.map(
        item =>
          item.label ??
          item.name ??
          item.source ??
          item.severity ??
          ''
      ),

      values: value.map(
        item =>
          Number(
            item.value ??
            item.count ??
            item.total ??
            0
          )
      )
    };
  }

  return {
    labels: [],
    values: []
  };
}


/* =========================================================
   APPLY DASHBOARD DATA
   ========================================================= */

function applyDashData(d) {
  populateInvestigationFilter(d.investigation_activities);

  setText(
    'kv-logs',
    Number(d.total_logs || 0).toLocaleString()
  );

  setText(
    'kv-threats',
    Number(d.threats_detected || 0).toLocaleString()
  );

  setText(
    'kv-sources',
    Number(d.unique_sources || 0).toLocaleString()
  );

  const analysisCount = Number(d.analysis_activity?.count || 0);
  setText('kv-analyses', analysisCount.toLocaleString());

  renderCharts(d);

  renderActivityHeatmap(d.heatmap);

  renderMlRibbon(d.ml_consensus);

  renderIncidents(d.recent_incidents);

  renderCases(d.active_cases);
}


/* =========================================================
   EMPTY DASHBOARD
   ========================================================= */

function renderEmptyDashboard() {

  setText('kv-logs', '0');
  setText('kv-threats', '0');
  setText('kv-sources', '0');
  setText('kv-analyses', '0');

  renderCharts({
    trend_24h: {
      labels: [],
      values: []
    },

    severity_dist: {
      labels: ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'DEBUG'],
      values: [0, 0, 0, 0, 0]
    },

    top_sources: {
      labels: [],
      values: []
    }
  });

  renderActivityHeatmap([]);

  renderMlRibbon({});

  renderIncidents([]);

  renderCases([]);
}


/* =========================================================
   CHARTS
   ========================================================= */

function renderCharts(d) {

  renderLineChart(d.trend_24h);

  renderDonutChart(d.severity_dist);

  renderBarChart(d.top_sources);
}


/* =========================================================
   LINE CHART
   ========================================================= */

function renderLineChart(tr) {

  const canvas =
    document.getElementById('lineChart');

  if (!canvas || typeof Chart === 'undefined') {
    return;
  }

  if (lineChartInst) {
    lineChartInst.destroy();
    lineChartInst = null;
  }

  lineChartInst = new Chart(canvas, {

    type: 'line',

    data: {

      labels: tr?.labels || [],

      datasets: [
        {
          label: 'Log Volume',

          data: tr?.values || [],

          borderColor: '#2563EB',

          backgroundColor:
            'rgba(37,99,235,0.08)',

          fill: true,

          tension: 0.35,

          borderWidth: 2.5,

          pointRadius: 3,

          pointHoverRadius: 6,

          pointBackgroundColor: context =>
            tr?.labels?.length === 17 &&
            context.dataIndex === 8 &&
            Number(context.raw) > 0
              ? '#F97316'
              : '#2563EB',

          pointBorderColor: context =>
            tr?.labels?.length === 17 &&
            context.dataIndex === 8 &&
            Number(context.raw) > 0
              ? '#F97316'
              : '#2563EB'
        }
      ]
    },

    options: {

      ...CHART_DEFAULTS,

      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: () => 'Log activity',
            label: context => `${Number(context.parsed.y || 0).toLocaleString()} logs`,
            footer: items => {
              const index = items[0]?.dataIndex;
              const start = tr?.labels?.[index];
              const end = tr?.labels?.[index + 1];
              return start && end ? `Interval: ${start} - ${end}` : '';
            }
          }
        }
      },

      interaction: {
        mode: 'index',
        intersect: false
      },

      scales: {

        x: {
          grid: {
            display: false
          },

          ticks: {
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            callback: (value, index, ticks) => {
              if (tr?.labels?.length === 17 && index === 8) return 'Now';
              return index % 2 === 0 || index === ticks.length - 1
                ? tr?.labels?.[index] || ''
                : '';
            },
            font: {
              size: 9
            }
          }
        },

        y: {
          beginAtZero: true,

          grid: {
            color:
              'rgba(226,232,240,0.6)'
          },

          ticks: {
            font: {
              size: 10
            }
          }
        }
      }
    }
  });
}


/* =========================================================
   DONUT CHART
   ========================================================= */

function renderDonutChart(sv) {

  const canvas =
    document.getElementById('donutChart');

  if (!canvas || typeof Chart === 'undefined') {
    return;
  }

  if (donutChartInst) {
    donutChartInst.destroy();
    donutChartInst = null;
  }

  const ALL_LEVELS = ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'DEBUG'];
  const SEVERITY_COLORS = {
    INFO: '#2563EB',
    WARN: '#F59E0B',
    WARNING: '#F59E0B',
    ERROR: '#EF4444',
    CRITICAL: '#DC2626',
    DEBUG: '#8B5CF6'
  };
  const DEFAULT_COLORS = ['#2563EB', '#F59E0B', '#EF4444', '#DC2626', '#8B5CF6', '#10B981', '#06B6D4'];

  let rawLabels = sv?.labels && sv.labels.length > 0 ? [...sv.labels] : [...ALL_LEVELS];
  let rawValues = sv?.values && sv.values.length > 0 ? [...sv.values] : Array(rawLabels.length).fill(0);

  const existingMap = {};
  rawLabels.forEach((lbl, idx) => {
    existingMap[String(lbl).toUpperCase()] = Number(rawValues[idx]) || 0;
  });

  // Ensure all 5 levels are represented in order
  const labels = [];
  const values = [];
  ALL_LEVELS.forEach(lvl => {
    labels.push(lvl);
    values.push(existingMap[lvl] || 0);
  });
  // Append any extra labels not in standard 5
  rawLabels.forEach(lbl => {
    const upper = String(lbl).toUpperCase();
    if (!ALL_LEVELS.includes(upper)) {
      labels.push(lbl);
      values.push(existingMap[upper] || 0);
    }
  });

  const bgColors = labels.map((lbl, idx) => {
    const key = String(lbl).toUpperCase().trim();
    return SEVERITY_COLORS[key] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
  });

  donutChartInst = new Chart(canvas, {

    type: 'doughnut',

    data: {

      labels,

      datasets: [
        {
          data: values,

          backgroundColor: bgColors,

          borderWidth: 2,

          borderColor: '#FFFFFF',

          hoverOffset: 8
        }
      ]
    },

    options: {

      ...CHART_DEFAULTS,

      cutout: '68%',

      plugins: {

        legend: {

          position: canvas.parentElement.clientWidth < 430 ? 'bottom' : 'right',

          labels: {
            boxWidth: 12,
            padding: 14,

            font: {
              size: 11,
              weight: '600'
            },

            color: '#334155'
          }
        },

        tooltip: {

          callbacks: {

            label(context) {

              const total =
                context.dataset.data.reduce(
                  (a, b) =>
                    Number(a) + Number(b),
                  0
                );

              const val =
                Number(context.parsed) || 0;

              const pct =
                total > 0
                  ? ((val / total) * 100).toFixed(1)
                  : '0.0';

              return ` ${context.label}: ${val} (${pct}%)`;
            }
          }
        }
      },
      onResize(chart, size) {
        chart.options.plugins.legend.position = size.width < 430 ? 'bottom' : 'right';
      }
    }
  });
}


/* =========================================================
   BAR CHART
   ========================================================= */

function renderBarChart(ts) {

  const canvas =
    document.getElementById('barChart');

  if (!canvas || typeof Chart === 'undefined') {
    return;
  }

  if (barChartInst) {
    barChartInst.destroy();
    barChartInst = null;
  }

  barChartInst = new Chart(canvas, {

    type: 'bar',

    data: {

      labels: ts?.labels || [],

      datasets: [
        {
          label: 'Logs Processed',

          data: ts?.values || [],

          backgroundColor: [
            '#2563EB',
            '#7C3AED',
            '#F59E0B',
            '#EF4444',
            '#10B981'
          ],

          borderRadius: 6,

          borderSkipped: false
        }
      ]
    },

    options: {

      ...CHART_DEFAULTS,

      plugins: {
        legend: {
          display: false
        }
      },

      scales: {

        x: {
          grid: {
            display: false
          },

          ticks: {
            font: {
              size: 10
            }
          }
        },

        y: {

          beginAtZero: true,

          grid: {
            color:
              'rgba(226,232,240,0.6)'
          },

          ticks: {
            font: {
              size: 10
            }
          }
        }
      }
    }
  });
}


/* =========================================================
   24-HOUR ACTIVITY HEATMAP
   ========================================================= */

function renderActivityHeatmap(data) {

  const container =
    document.getElementById('heatmapGrid');

  if (!container) {
    return;
  }

  const items =
    normalizeHeatmap(data);

  if (!items.length) {

    container.innerHTML = `
      <div style="
        grid-column:1/-1;
        padding:25px;
        text-align:center;
        color:var(--ink-3);
        font-size:var(--text-xs);
      ">
        No activity data available
      </div>
    `;

    return;
  }

  const max =
    Math.max(...items.map(it => it.count), 1);

  container.innerHTML =
    items.map((item, index) => {

      const count = item.count;
      const ratio = count / max;

      let level = 0;
      if (count > 0 && ratio <= 0.2) {
        level = 1;
      } else if (ratio <= 0.4) {
        level = 2;
      } else if (ratio <= 0.6) {
        level = 3;
      } else if (ratio <= 0.8) {
        level = 4;
      } else if (count > 0) {
        level = 5;
      }

      const column = index % 4;
      const alignClass = column === 0 ? 'tooltip-align-left' : (column === 3 ? 'tooltip-align-right' : '');
      const shortLabel = formatHeatmapAxisLabel(item.hour);

      return `
        <div class="heatmap-col">

          <div
            class="heatmap-cell heat-${level}"
            tabindex="0"
          >
            <div class="heatmap-tooltip ${alignClass}">
              <div class="tooltip-bucket">${escapeHtml(item.hour)}</div>
              <div class="tooltip-count">${count.toLocaleString()} ${count === 1 ? 'event' : 'events'}</div>
              ${count ? `<div class="tooltip-top">${escapeHtml(item.topEvent)}</div>` : ''}
            </div>
          </div>

          <span class="heatmap-label">
            ${escapeHtml(shortLabel)}
          </span>

        </div>
      `;
    }).join('');
}


function normalizeHeatmap(data) {

  const defaultHours = Array.from({ length: 24 }, (_, index) => {
    const date = new Date();
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() - (23 - index));
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      hour12: true
    }).format(date);
  });

  let hourlyItems;

  // Case 1: Backend returns rich list of objects with hour, count, top_event
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    hourlyItems = defaultHours.map((fallbackHour, idx) => {
      const match = data[idx] || {};
      const count = Number(match.count ?? match.value ?? 0);
      return {
        hour: match.hour || fallbackHour,
        count: count,
        topEvent: match.top_event || match.topEvent || ''
      };
    });
  } else if (Array.isArray(data)) {
    // Case 2: Array of numbers
    hourlyItems = defaultHours.map((hour, idx) => {
      const count = Number(data[idx] || 0);
      return {
        hour,
        count,
        topEvent: ''
      };
    });
  } else if (data && Array.isArray(data.values)) {
    // Case 3: Wrapped in object
    hourlyItems = defaultHours.map((hour, idx) => {
      const count = Number(data.values[idx] || 0);
      return {
        hour,
        count,
        topEvent: ''
      };
    });
  } else {
    hourlyItems = defaultHours.map(hour => ({
      hour,
      count: 0,
      topEvent: 'No recorded activity'
    }));
  }

  return Array.from({ length: 12 }, (_, bucketIndex) => {
    const first = hourlyItems[bucketIndex * 2];
    const second = hourlyItems[bucketIndex * 2 + 1];
    const topEvent = first.count >= second.count ? first.topEvent : second.topEvent;
    return {
      hour: `${first.hour} - ${second.hour}`,
      count: first.count + second.count,
      topEvent: topEvent || ''
    };
  });
}

function formatHeatmapAxisLabel(value) {
  const times = String(value ?? '').match(/\b(\d{1,2})\s*(AM|PM)\b/gi);
  if (!times || times.length < 2) return String(value ?? '');

  const parseTime = time => {
    const match = time.match(/(\d{1,2})\s*(AM|PM)/i);
    return match ? { hour: Number(match[1]), period: match[2].toUpperCase() } : null;
  };
  const start = parseTime(times[0]);
  const end = parseTime(times[1]);
  if (!start || !end) return String(value ?? '');

  const startHour = String(start.hour);
  const endHour = String(end.hour);
  return start.period === end.period
    ? `${startHour}-${endHour} ${end.period}`
    : `${startHour} ${start.period}-${endHour} ${end.period}`;
}


/* =========================================================
   ML RIBBON
   ========================================================= */

function renderMlRibbon(ml) {

  ml = ml || {};

  const score =
    Number(
      ml.score ??
      ml.consensus_score ??
      ml.confidence
    );

  const scoreElement =
    document.getElementById('mlScore');

  if (scoreElement) {

    scoreElement.textContent =
      Number.isFinite(score)
        ? `${(score * 100).toFixed(1)}%`
        : '—';
  }

  setText(
    'mlBest',
    ml.best_algo ??
    ml.best_model ??
    'No ML analysis available'
  );

  const riskBadge =
    document.getElementById('mlRisk');

  if (riskBadge) {

    const risk =
      String(
        ml.risk_level ??
        ml.risk ??
        ''
      ).toUpperCase();

    riskBadge.textContent =
      risk || 'NO DATA';

    let badgeClass = 'badge-neutral';

    if (risk === 'CRITICAL') {
      badgeClass = 'badge-danger';
    } else if (risk === 'HIGH') {
      badgeClass = 'badge-warning';
    } else if (
      risk === 'MEDIUM' ||
      risk === 'LOW'
    ) {
      badgeClass = 'badge-success';
    }

    riskBadge.className =
      `badge ${badgeClass}`;
  }

  const barsContainer =
    document.getElementById('mlAlgoBars');

  if (!barsContainer) {
    return;
  }

  const models =
    normalizeArray(
      ml.models ??
      ml.algorithms ??
      ml.model_scores
    );

  if (!models.length) {

    barsContainer.innerHTML = `
      <div style="
        font-size:12px;
        opacity:.7;
      ">
        No model analysis available
      </div>
    `;

    return;
  }

  barsContainer.innerHTML =
    models.map(model => {

      const name =
        model.name ??
        model.algorithm ??
        model.model ??
        'Model';

      const weight =
        Math.max(
          0,
          Math.min(
            100,
            Number(
              model.weight ??
              model.score ??
              model.confidence ??
              0
            )
          )
        );

      return `
        <div class="ml-algo-item">

          <div class="ml-algo-name">
            ${escapeHtml(name)}
          </div>

          <div class="ml-algo-track">

            <div
              class="ml-algo-fill"
              style="width:${weight}%"
            ></div>

          </div>

        </div>
      `;
    }).join('');
}


/* =========================================================
   INCIDENT TABLE
   ========================================================= */

function getPlainLanguageIncident(msg, sev, src, ip) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('select') || m.includes('union') || m.includes('drop table') || m.includes('script') || m.includes('1=1') || m.includes('jndi:')) {
    return {
      summary: `Web injection exploit vector detected on ${src}.`,
      impact: 'Adversary targeting web endpoints to compromise database or execute remote code.',
      action: 'Enforce perimeter WAF filtering and verify query parameterization.'
    };
  }
  if (m.includes('failed password') || m.includes('authentication') || m.includes('invalid user') || m.includes('login failed') || m.includes('brute force')) {
    return {
      summary: `Authentication breach attempt detected on ${src}.`,
      impact: 'Repeated credential rejection indicating dictionary or brute-force attack.',
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
    impact: 'Deviation from expected baseline requiring operational triage.',
    action: 'Review correlated telemetry and verify service configuration integrity.'
  };
}

function renderIncidents(incidents) {

  const tbody =
    document.getElementById('incidentTable');

  if (!tbody) {
    return;
  }

  incidents =
    normalizeArray(incidents);

  if (!incidents.length) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          style="
            text-align:center;
            padding:30px;
            color:var(--ink-3);
          "
        >
          No security incidents recorded.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    incidents.slice(0, 8).map(inc => {

      const severity =
        String(
          inc.severity ??
          inc.sev ??
          'INFO'
        ).toUpperCase();

      const source =
        inc.source ??
        inc.facility ??
        inc.log_source ??
        '—';

      const message =
        inc.message ??
        inc.event_message ??
        inc.description ??
        inc.details ??
        '—';

      const score =
        Number(
          inc.anomaly_score ??
          inc.anomaly_confidence ??
          inc.confidence ??
          0
        );

      const timestamp =
        inc.timestamp ??
        inc.created_at ??
        inc.time ??
        '—';

      const ip = inc.ip || '';
      const expl = getPlainLanguageIncident(message, severity, source, ip);

      return `
        <tr>

          <td
            class="t-mono-xs text-muted"
            style="white-space:nowrap;"
          >
            ${escapeHtml(formatTimestamp(timestamp))}
          </td>

          <td>
            ${sevBadge(severity)}
          </td>

          <td>
            <span
              class="badge badge-neutral"
              style="
                font-family:var(--font-mono);
                font-size:11px;
              "
            >
              ${escapeHtml(source)}
            </span>
          </td>

          <td style="max-width:360px;">
            <div class="plain-lang-card" style="margin-bottom:4px;">
              <div class="plain-lang-row"><span class="plain-lang-tag what">What happened</span> <span>${escapeHtml(expl.summary)}</span></div>
              <div class="plain-lang-row"><span class="plain-lang-tag why">Why it matters</span> <span>${escapeHtml(expl.impact)}</span></div>
              <div class="plain-lang-row"><span class="plain-lang-tag action">What to do</span> <span>${escapeHtml(expl.action)}</span></div>
            </div>
            <details class="tech-details">
              <summary class="tech-details-toggle">Technical Details</summary>
              <pre class="tech-details-content">${escapeHtml(message)}</pre>
            </details>
          </td>

          <td>
            ${renderConfidence(score)}
          </td>

          <td>
            <div style="display:flex;gap:4px;">
              <a
                href="log-explorer.html"
                class="btn btn-sm btn-ghost"
              >
                Inspect
              </a>

              <a
                href="mitre-tracker.html"
                class="btn btn-sm btn-outline"
              >
                ATT&CK
              </a>
            </div>
          </td>

        </tr>
      `;
    }).join('');
}


/* =========================================================
   ACTIVE CASES
   ========================================================= */

function renderCases(cases) {

  const tbody =
    document.getElementById('caseTable');

  if (!tbody) {
    return;
  }

  /*
   * IMPORTANT:
   *
   * active_cases is expected to be an ARRAY.
   * If the backend sends:
   *
   * {
   *   active_cases: [...]
   * }
   *
   * normalizeArray() handles the normal array.
   *
   * If it sends:
   *
   * {
   *   active_cases: {
   *      items: [...]
   *   }
   * }
   *
   * it also handles that.
   */

  cases =
    normalizeArray(cases);

  if (!cases.length) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          style="
            text-align:center;
            padding:30px;
            color:var(--ink-3);
          "
        >
          No active investigation cases for the current user.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    cases.map(c => {

      const id =
        c.id ??
        c.case_id ??
        c.caseId ??
        '—';

      const title =
        c.title ??
        c.investigation_title ??
        c.name ??
        c.description ??
        'Untitled Investigation';

      const severity =
        String(
          c.severity ??
          c.sev ??
          'INFO'
        ).toUpperCase();

      const status =
        c.status ??
        c.case_status ??
        'Open';

      const assignee =
        c.assignee ??
        c.assigned_to ??
        c.owner ??
        'Unassigned';

      const lastActive =
        c.last_active ??
        c.updated_at ??
        c.updatedAt ??
        c.created_at ??
        c.age ??
        '—';

      return `
        <tr>

          <td>
            <span
              class="t-mono-xs font-700"
              style="color:var(--brand-primary);"
            >
              ${escapeHtml(id)}
            </span>
          </td>

          <td
            style="
              font-weight:600;
              color:var(--ink-0);
            "
          >
            ${escapeHtml(title)}
          </td>

          <td>
            ${sevBadge(severity)}
          </td>

          <td>
            ${statusBadge(status)}
          </td>

          <td
            style="
              font-size:var(--text-xs);
              color:var(--ink-2);
            "
          >
            ${escapeHtml(assignee)}
          </td>

          <td
            class="t-mono-xs text-muted"
          >
            ${escapeHtml(formatTimestamp(lastActive))}
          </td>

        </tr>
      `;
    }).join('');
}


/* =========================================================
   STATUS BADGE
   ========================================================= */

function statusBadge(status) {

  const normalized =
    String(status || 'Open')
      .toLowerCase();

  let badge = 'badge-warning';

  if (
    normalized.includes('contain') ||
    normalized.includes('resolved') ||
    normalized.includes('closed') ||
    normalized.includes('complete')
  ) {
    badge = 'badge-success';

  } else if (
    normalized.includes('critical') ||
    normalized.includes('escalat')
  ) {
    badge = 'badge-danger';

  } else if (
    normalized.includes('open') ||
    normalized.includes('investigat') ||
    normalized.includes('triag')
  ) {
    badge = 'badge-warning';
  }

  return `
    <span class="badge ${badge}">
      ${escapeHtml(status)}
    </span>
  `;
}


/* =========================================================
   CONFIDENCE
   ========================================================= */

function renderConfidence(score) {

  const normalized =
    Math.max(
      0,
      Math.min(1, Number(score) || 0)
    );

  const percent =
    Math.round(normalized * 100);

  const barColor =
    percent >= 80
      ? '#EF4444'
      : percent >= 50
        ? '#F59E0B'
        : '#10B981';

  return `
    <div
      style="
        display:flex;
        align-items:center;
        gap:6px;
      "
    >

      <div
        style="
          flex:1;
          max-width:60px;
          height:5px;
          background:var(--surface-3);
          border-radius:3px;
          overflow:hidden;
        "
      >
        <div
          style="
            height:100%;
            width:${percent}%;
            background:${barColor};
          "
        ></div>
      </div>

      <span
        style="
          font-family:var(--font-mono);
          font-size:11px;
          font-weight:600;
        "
      >
        ${percent}%
      </span>

    </div>
  `;
}


/* =========================================================
   HELPERS
   ========================================================= */

function setText(id, value) {

  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function populateInvestigationFilter(activities) {
  const select = document.getElementById('fActivity');
  if (!select) return;

  const selectedValue = select.value || 'latest';
  const options = [];
  const allActivity = document.createElement('option');
  allActivity.value = 'all';
  allActivity.dataset.type = 'all';
  allActivity.textContent = 'All Activity (From Beginning)';
  const baseline = document.createElement('option');
  baseline.value = 'latest';
  baseline.dataset.type = 'baseline';
  baseline.textContent = 'Latest Security Telemetry (Consensus Baseline)';
  options.push(allActivity, baseline);

  for (const activity of activities) {
    if (!activity?.id || !activity?.type || !activity?.label) continue;
    const option = document.createElement('option');
    option.value = String(activity.id);
    option.dataset.type = String(activity.type);
    option.textContent = String(activity.label);
    options.push(option);
  }

  select.replaceChildren(...options);
  select.value = options.some(option => option.value === selectedValue)
    ? selectedValue
    : 'latest';
}

function formatResponseTime(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return `${number.toFixed(0)}ms`;
}


function formatTimestamp(value) {

  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (!Number.isNaN(date.getTime())) {

    return date.toLocaleString(
      undefined,
      {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }
    );
  }

  return String(value);
}

function formatISTHour(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function escapeHtml(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* =========================================================
   FILTER / REFRESH
   ========================================================= */

window.loadDash = loadDash;


/* =========================================================
   START AND KEEP USER-SCOPED TELEMETRY FRESH
   ========================================================= */

window.addEventListener(
  'DOMContentLoaded',
  async () => {
    await initDashboard();
  }
);
