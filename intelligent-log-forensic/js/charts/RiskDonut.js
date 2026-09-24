/**
 * INTELLIGENT LOG FORENSIC - CUSTOM SVG RISK DONUT
 * High-performance vector donut rendered without heavy external chart libraries
 */

class RiskDonutChart {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.radius = 80;
    this.strokeWidth = 18;
    this.circumference = 2 * Math.PI * this.radius;

    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="svg-donut-wrapper">
        <svg viewBox="0 0 200 200" width="200" height="200" style="transform: rotate(-90deg);">
          <circle cx="100" cy="100" r="${this.radius}" fill="transparent" stroke="#F1F5F9" stroke-width="${this.strokeWidth}" />
          <circle id="donut-segment-safe" cx="100" cy="100" r="${this.radius}" fill="transparent" stroke="#22C55E" stroke-width="${this.strokeWidth}" stroke-dasharray="${this.circumference}" stroke-dashoffset="${this.circumference}" stroke-linecap="round" style="transition: stroke-dashoffset 0.6s ease;" />
          <circle id="donut-segment-medium" cx="100" cy="100" r="${this.radius}" fill="transparent" stroke="#EAB308" stroke-width="${this.strokeWidth}" stroke-dasharray="${this.circumference}" stroke-dashoffset="${this.circumference}" stroke-linecap="round" style="transition: stroke-dashoffset 0.6s ease;" />
          <circle id="donut-segment-high" cx="100" cy="100" r="${this.radius}" fill="transparent" stroke="#F97316" stroke-width="${this.strokeWidth}" stroke-dasharray="${this.circumference}" stroke-dashoffset="${this.circumference}" stroke-linecap="round" style="transition: stroke-dashoffset 0.6s ease;" />
          <circle id="donut-segment-critical" cx="100" cy="100" r="${this.radius}" fill="transparent" stroke="#EF4444" stroke-width="${this.strokeWidth}" stroke-dasharray="${this.circumference}" stroke-dashoffset="${this.circumference}" stroke-linecap="round" style="transition: stroke-dashoffset 0.6s ease;" />
        </svg>
        <div class="svg-donut-center">
          <div id="donut-score-value" class="donut-center-value">0</div>
          <div class="donut-center-label">Risk Index</div>
        </div>
      </div>
      <div class="donut-legend">
        <div class="legend-item">
          <span class="legend-color-dot" style="background:#EF4444;"></span>
          <span id="legend-count-crit">0</span>
          <span>Crit</span>
        </div>
        <div class="legend-item">
          <span class="legend-color-dot" style="background:#F97316;"></span>
          <span id="legend-count-high">0</span>
          <span>High</span>
        </div>
        <div class="legend-item">
          <span class="legend-color-dot" style="background:#EAB308;"></span>
          <span id="legend-count-med">0</span>
          <span>Med</span>
        </div>
        <div class="legend-item">
          <span class="legend-color-dot" style="background:#22C55E;"></span>
          <span id="legend-count-safe">0</span>
          <span>Safe</span>
        </div>
      </div>
    `;

    // Listen to telemetry updates
    if (window.eventBus) {
      window.eventBus.on('stats:updated', (stats) => this.update(stats));
    }

    if (window.appState) {
      this.update(window.appState.getStats());
    }
  }

  update(stats) {
    if (!stats) return;
    const { severityCounts, avgRiskScore } = stats;
    const total = (severityCounts.critical || 0) + (severityCounts.high || 0) + (severityCounts.medium || 0) + (severityCounts.safe || 0);

    const scoreEl = document.getElementById('donut-score-value');
    if (scoreEl) scoreEl.textContent = avgRiskScore || 0;

    const critEl = document.getElementById('legend-count-crit');
    if (critEl) critEl.textContent = severityCounts.critical || 0;
    const highEl = document.getElementById('legend-count-high');
    if (highEl) highEl.textContent = severityCounts.high || 0;
    const medEl = document.getElementById('legend-count-med');
    if (medEl) medEl.textContent = severityCounts.medium || 0;
    const safeEl = document.getElementById('legend-count-safe');
    if (safeEl) safeEl.textContent = severityCounts.safe || 0;

    if (total === 0) return;

    // Calculate segments offsets
    const c = this.circumference;
    const pCrit = (severityCounts.critical || 0) / total;
    const pHigh = (severityCounts.high || 0) / total;
    const pMed = (severityCounts.medium || 0) / total;
    const pSafe = (severityCounts.safe || 0) / total;

    const segCrit = document.getElementById('donut-segment-critical');
    const segHigh = document.getElementById('donut-segment-high');
    const segMed = document.getElementById('donut-segment-medium');
    const segSafe = document.getElementById('donut-segment-safe');

    if (segCrit) segCrit.style.strokeDashoffset = c - (c * pCrit);
    if (segHigh) segHigh.style.strokeDashoffset = c - (c * (pCrit + pHigh));
    if (segMed) segMed.style.strokeDashoffset = c - (c * (pCrit + pHigh + pMed));
    if (segSafe) segSafe.style.strokeDashoffset = c - (c * (pCrit + pHigh + pMed + pSafe));
  }
}

window.RiskDonutChart = RiskDonutChart;
