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

async function loadDash() {
  const fSource = document.getElementById('fSource')?.value || 'all';
  const fSev = document.getElementById('fSev')?.value || 'all';
  const fStartDate = document.getElementById('fStartDate')?.value || '';
  const fStartTime = document.getElementById('fStartTime')?.value || '';
  const fEndDate = document.getElementById('fEndDate')?.value || '';
  const fEndTime = document.getElementById('fEndTime')?.value || '';

  const params = {};
  if (fSource && fSource !== 'all') params.source = fSource;
  if (fSev && fSev !== 'all') params.severity = fSev;
  if (fStartDate) params.start_date = fStartDate;
  if (fStartTime) params.start_time = fStartTime;
  if (fEndDate) params.end_date = fEndDate;
  if (fEndTime) params.end_time = fEndTime;

  try {
    const res = await Api.dashStats(params);

    if (!res || !res.ok) {
      console.error('Dashboard API error:', res);
      renderEmptyDashboard();
      return;
    }

    const data = normalizeDashboardResponse(res.data);
    applyDashData(data);

  } catch (err) {
    console.error('Dashboard loading failed:', err);
    renderEmptyDashboard();
  }
}

function onTimeRangeChange() {
  const tr = document.getElementById('fTimeRange')?.value || 'all';
  const wrap = document.getElementById('customDateWrap');
  const now = new Date();

  const toYMD = d => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const toHM = d => {
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (tr === 'custom') {
    if (wrap) wrap.style.display = 'inline-flex';
    return;
  }

  if (wrap) wrap.style.display = 'none';

  const startEl = document.getElementById('fStartDate');
  const startTimeEl = document.getElementById('fStartTime');
  const endEl = document.getElementById('fEndDate');
  const endTimeEl = document.getElementById('fEndTime');

  if (tr === 'today') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    if (startEl) startEl.value = toYMD(startOfToday);
    if (startTimeEl) startTimeEl.value = '00:00';
    if (endEl) endEl.value = toYMD(now);
    if (endTimeEl) endTimeEl.value = toHM(now);
  } else if (tr === '24h') {
    const d24 = new Date(now.getTime() - 24 * 3600 * 1000);
    if (startEl) startEl.value = toYMD(d24);
    if (startTimeEl) startTimeEl.value = toHM(d24);
    if (endEl) endEl.value = toYMD(now);
    if (endTimeEl) endTimeEl.value = toHM(now);
  } else if (tr === '7d') {
    const d7 = new Date(now.getTime() - 7 * 86400 * 1000);
    if (startEl) startEl.value = toYMD(d7);
    if (startTimeEl) startTimeEl.value = '00:00';
    if (endEl) endEl.value = toYMD(now);
    if (endTimeEl) endTimeEl.value = toHM(now);
  } else if (tr === '30d') {
    const d30 = new Date(now.getTime() - 30 * 86400 * 1000);
    if (startEl) startEl.value = toYMD(d30);
    if (startTimeEl) startTimeEl.value = '00:00';
    if (endEl) endEl.value = toYMD(now);
    if (endTimeEl) endTimeEl.value = toHM(now);
  } else { // 'all'
    if (startEl) startEl.value = '';
    if (startTimeEl) startTimeEl.value = '';
    if (endEl) endEl.value = '';
    if (endTimeEl) endTimeEl.value = '';
  }

  loadDash();
}

window.onTimeRangeChange = onTimeRangeChange;

function resetDashFilters() {
  const tr = document.getElementById('fTimeRange');
  if (tr) tr.value = 'all';
  const wrap = document.getElementById('customDateWrap');
  if (wrap) wrap.style.display = 'none';

  if (document.getElementById('fStartDate')) document.getElementById('fStartDate').value = '';
  if (document.getElementById('fStartTime')) document.getElementById('fStartTime').value = '';
  if (document.getElementById('fEndDate')) document.getElementById('fEndDate').value = '';
  if (document.getElementById('fEndTime')) document.getElementById('fEndTime').value = '';
  if (document.getElementById('fSource')) document.getElementById('fSource').value = 'all';
  if (document.getElementById('fSev')) document.getElementById('fSev').value = 'all';
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

    trend_24h:
      normalizeTrend(
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

  setText(
    'kv-response',
    formatResponseTime(d.response_time)
  );

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
  setText('kv-response', '—');

  renderCharts({
    trend_24h: {
      labels: [],
      values: []
    },

    severity_dist: {
      labels: [],
      values: []
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

          pointHoverRadius: 6
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

  const labels = sv?.labels || [];
  const values = sv?.values || [];

  donutChartInst = new Chart(canvas, {

    type: 'doughnut',

    data: {

      labels,

      datasets: [
        {
          data: values,

          backgroundColor: [
            '#2563EB',
            '#F59E0B',
            '#EF4444',
            '#7C3AED',
            '#10B981'
          ],

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

          position: 'right',

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

 const hours =
  Array.from(
    { length: 24 },
    (_, i) => {

      const suffix =
        i >= 12 ? 'PM' : 'AM';

      const hour12 =
        i % 12 || 12;

      return `${hour12} ${suffix}`;
    }
  );

  const values =
    normalizeHeatmap(data);

  if (!values.length) {

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
    Math.max(...values, 1);

  container.innerHTML =
    hours.map((hour, index) => {

      const count =
        Number(values[index] || 0);

      const ratio =
        count / max;

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

      return `
        <div class="heatmap-col">

          <div
            class="heatmap-cell heat-${level}"
            title="${hour} — ${count.toLocaleString()} events"
          ></div>

          <span class="heatmap-label">
            ${hour}
          </span>

        </div>
      `;
    }).join('');
}


function normalizeHeatmap(data) {

  if (!data) {
    return [];
  }

  /*
   * Case 1:
   *
   * Backend directly returns:
   *
   * [12, 0, 4, 8, ...]
   */

  if (Array.isArray(data)) {

    /*
     * Already a 24-hour array.
     */
    if (
      data.length === 24 &&
      data.every(v =>
        typeof v === 'number' ||
        !Number.isNaN(Number(v))
      )
    ) {
      return data.map(
        v => Number(v) || 0
      );
    }

    /*
     * Backend returns hourly objects.
     */
    const result = Array(24).fill(0);

    data.forEach(item => {

      let hour = null;

      /*
       * If backend gives an actual timestamp,
       * convert it to IST first.
       */
      const timestamp =
        item.timestamp ??
        item.datetime ??
        item.time ??
        item.created_at ??
        item.createdAt;

      if (timestamp) {

        const date =
          new Date(timestamp);

        if (!Number.isNaN(date.getTime())) {

          const parts =
            new Intl.DateTimeFormat('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: 'numeric',
              hour12: false
            }).formatToParts(date);

          const hourPart =
            parts.find(
              p => p.type === 'hour'
            );

          if (hourPart) {
            hour = Number(hourPart.value);
          }
        }
      }

      /*
       * Otherwise use backend hour field.
       */
      if (hour === null) {

        hour =
          Number(
            item.hour ??
            item.hour_index ??
            item.hour_of_day
          );
      }

      if (
        Number.isFinite(hour) &&
        hour >= 0 &&
        hour < 24
      ) {

        result[hour] += Number(
          item.count ??
          item.value ??
          item.events ??
          item.total ??
          0
        );
      }
    });

    return result;
  }

  /*
   * Case 2:
   *
   * {
   *   values: [...]
   * }
   */

  if (Array.isArray(data.values)) {

    return data.values.map(
      value => Number(value) || 0
    );
  }

  return [];
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
          No incidents detected for the current user.
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
        inc.payload ??
        inc.description ??
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

          <td
            style="
              font-size:var(--text-sm);
              font-family:var(--font-mono);
              max-width:380px;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
            "
            title="${escapeHtml(message)}"
          >
            ${escapeHtml(message)}
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
   AUTO REFRESH
   ========================================================= */

let dashboardRefreshTimer = null;

function startDashboardRefresh() {

  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer);
  }

  dashboardRefreshTimer =
    setInterval(
      () => loadDash(),
      30000
    );
}

window.addEventListener(
  'beforeunload',
  () => {
    if (dashboardRefreshTimer) {
      clearInterval(dashboardRefreshTimer);
    }
  }
);


/* =========================================================
   START
   ========================================================= */

window.addEventListener(
  'DOMContentLoaded',
  async () => {

    await initDashboard();

    startDashboardRefresh();
  }
);