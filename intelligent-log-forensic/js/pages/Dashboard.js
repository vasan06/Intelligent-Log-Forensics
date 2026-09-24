/**
 * INTELLIGENT LOG FORENSIC - DASHBOARD PAGE CONTROLLER
 * Orchestrates live telemetry, KPI animations, charts, table feed, and 3D visualizers
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Top Right 3D Visualizer (Floating Server Model)
  if (document.getElementById('dashboard-server-canvas')) {
    new ExplodedServerScene('dashboard-server-canvas', {
      exploded: true,
      interactive: true
    });
  }

  // 2. Initialize Charts & Tables
  const severityChart = new SeverityBarChart('severity-bar-canvas');
  const riskDonut = new RiskDonutChart('risk-donut-container');
  const liveFeed = new LiveFeedTable('live-log-table-body');

  // 3. Connect Live Generator Controls
  const toggleBtn = document.getElementById('generator-toggle-btn');
  const statusIndicator = document.getElementById('generator-pulse-dot');
  const statusText = document.getElementById('generator-status-text');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isRunning = window.liveGenerator.toggle();
      updateGeneratorUI(isRunning);
    });
  }

  function updateGeneratorUI(isRunning) {
    if (toggleBtn) {
      toggleBtn.textContent = isRunning ? 'Pause Feed' : 'Resume Feed';
      toggleBtn.className = isRunning ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
    }
    if (statusIndicator) {
      if (isRunning) {
        statusIndicator.classList.remove('paused');
      } else {
        statusIndicator.classList.add('paused');
      }
    }
    if (statusText) {
      statusText.textContent = isRunning ? 'Live · Generating Multi-Vector Threats' : 'Generator Paused';
    }
  }

  // 4. KPI Counters with smooth numeric roll
  function animateValue(id, start, end, duration = 600) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (start === end) {
      obj.textContent = end.toLocaleString();
      return;
    }
    const range = end - start;
    const minTimer = 50;
    let stepTime = Math.abs(Math.floor(duration / range));
    stepTime = Math.max(stepTime, minTimer);
    const startTime = new Date().getTime();
    const endTime = startTime + duration;

    function run() {
      const now = new Date().getTime();
      const remaining = Math.max((endTime - now) / duration, 0);
      const value = Math.round(end - (remaining * range));
      obj.textContent = value.toLocaleString();
      if (value !== end) {
        requestAnimationFrame(run);
      }
    }
    requestAnimationFrame(run);
  }

  // 5. Update KPI Display from AppState
  let prevStats = { totalLogs: 0, riskEvents: 0, activeIncidents: 0, avgRiskScore: 0 };

  function renderKPIs(stats) {
    animateValue('kpi-total-logs', prevStats.totalLogs, stats.totalLogs);
    animateValue('kpi-risk-events', prevStats.riskEvents, stats.riskEvents);
    animateValue('kpi-active-incidents', prevStats.activeIncidents, stats.activeIncidents);
    animateValue('kpi-avg-risk', prevStats.avgRiskScore, stats.avgRiskScore);
    prevStats = { ...stats };
  }

  // 6. Recent Incidents List Handler
  const incidentsListContainer = document.getElementById('recent-incidents-container');

  function renderIncidentsList() {
    if (!incidentsListContainer || !window.appState) return;
    const incidents = window.appState.state.incidents.slice(0, 5);

    if (incidents.length === 0) {
      incidentsListContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No critical incidents flagged yet. Telemetry running...
        </div>
      `;
      return;
    }

    incidentsListContainer.innerHTML = incidents.map(inc => `
      <div class="incident-mini-card" onclick="window.location.href='incidents.html'">
        <div>
          <div class="incident-mini-title">${escapeHTML(inc.title)}</div>
          <div class="incident-mini-meta">
            <span>${inc.id}</span>
            <span>·</span>
            <span style="color: #67E8F9;">${inc.mitreTechnique}</span>
            <span>·</span>
            <span>${new Date(inc.created).toLocaleTimeString()}</span>
          </div>
        </div>
        <span class="badge ${inc.severity === 'critical' ? 'badge-critical' : 'badge-high'}">
          ${inc.severity.toUpperCase()}
        </span>
      </div>
    `).join('');
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  // Listen to state changes
  if (window.eventBus) {
    window.eventBus.on('stats:updated', (stats) => renderKPIs(stats));
    window.eventBus.on('incident:created', () => renderIncidentsList());
    window.eventBus.on('incident:updated', () => renderIncidentsList());
  }

  // Initial load
  if (window.appState) {
    renderKPIs(window.appState.getStats());
    renderIncidentsList();
  }

  // Start live generator automatically
  if (window.liveGenerator) {
    window.liveGenerator.start();
    updateGeneratorUI(true);
  }
});
