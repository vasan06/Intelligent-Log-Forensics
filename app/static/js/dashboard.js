/* ==========================================================================
Intelligent Log Forensics
Dashboard Intelligence Runtime
File: app/static/js/dashboard.js

Responsibilities:

* Dashboard overview telemetry
* Incident priority cards
* Risky IP intelligence
* Severity distribution
* Canvas-based event telemetry
* Refresh / resize handling
* Graceful API failure states

Backend endpoints are intentionally unchanged.
========================================================================== */

(function () {
"use strict";

const API = {
overview: "/api/v1/dashboard/overview",
riskyIps: "/api/v1/dashboard/top-risky-ips?limit=5",
};

let latestEvents = [];
let overviewRequest = null;

/* ------------------------------------------------------------------------
DOM helpers
------------------------------------------------------------------------ */

function $(id) {
return document.getElementById(id);
}

function escapeHTML(value) {
if (window.lf && typeof window.lf.escapeHTML === "function") {
return window.lf.escapeHTML(value);
}


const div = document.createElement("div");
div.textContent = value == null ? "" : String(value);
return div.innerHTML;


}

function formatNumber(value) {
const number = Number(value);


return Number.isFinite(number)
  ? number.toLocaleString()
  : "0";


}

function formatScore(value) {
const number = Number(value);


return Number.isFinite(number)
  ? number.toFixed(1)
  : "0.0";


}

function normalizeSeverity(value) {
return String(value || "low").trim().toLowerCase();
}

function severityClass(value) {
const severity = normalizeSeverity(value);


if (severity === "critical") {
  return "badge-critical";
}

if (severity === "high") {
  return "badge-high";
}

if (severity === "medium") {
  return "badge-medium";
}

if (severity === "low") {
  return "badge-ok";
}

return "badge-default";


}

function setLoading(element, message) {
if (!element) return;


element.innerHTML = `
  <div class="dashboard-state dashboard-state-loading">
    <span class="dashboard-state-spinner" aria-hidden="true"></span>
    <span>${escapeHTML(message)}</span>
  </div>
`;


}

function setEmpty(element, message) {
if (!element) return;


element.innerHTML = `
  <div class="dashboard-state dashboard-state-empty">
    <span>${escapeHTML(message)}</span>
  </div>
`;


}

function setError(element, message) {
if (!element) return;


element.innerHTML = `
  <div class="dashboard-state dashboard-state-error">
    <span>${escapeHTML(message)}</span>
  </div>
`;


}

/* ------------------------------------------------------------------------
Overview API
------------------------------------------------------------------------ */

async function requestOverview() {
if (overviewRequest) {
overviewRequest.abort();
}


overviewRequest = new AbortController();

const response = await fetch(API.overview, {
  method: "GET",
  credentials: "same-origin",
  headers: {
    Accept: "application/json",
  },
  signal: overviewRequest.signal,
  cache: "no-store",
});

if (!response.ok) {
  throw new Error(`Overview request failed: ${response.status}`);
}

return response.json();


}

async function requestRiskyIps() {
const response = await fetch(API.riskyIps, {
method: "GET",
credentials: "same-origin",
headers: {
Accept: "application/json",
},
cache: "no-store",
});


if (!response.ok) {
  throw new Error(`Risky IP request failed: ${response.status}`);
}

return response.json();


}

/* ------------------------------------------------------------------------
Hero + Metrics
------------------------------------------------------------------------ */

function renderOverviewMetrics(data) {
const incidents = Number(data.incidents || 0);
const totalLogs = Number(data.total_logs || 0);
const riskEvents = Number(data.risk_events || 0);
const healthScore = Number(data.health_score || 0);
const qualityScore = Number(data.quality_score || 0);
const averageRisk = Number(data.average_risk || 0);


const title = $("hero-title");
const description = $("hero-desc");

if (title) {
  title.textContent =
    incidents > 0
      ? `${formatNumber(incidents)} Active ${
          incidents === 1 ? "Incident" : "Incidents"
        } Requiring Investigation`
      : "System Operating within Normal Forensic Parameters";
}

if (description) {
  description.textContent =
    `Analyzed ${formatNumber(totalLogs)} log records. ` +
    `Identified ${formatNumber(riskEvents)} risk anomalies ` +
    `with health score of ${formatScore(healthScore)}%.`;
}

const health = $("stat-health");
const avgRisk = $("stat-avg-risk");
const logs = $("stat-total-logs");
const risks = $("stat-risks");
const quality = $("stat-quality");

if (health) {
  health.textContent = `${formatScore(healthScore)}%`;
}

if (avgRisk) {
  avgRisk.textContent = formatScore(averageRisk);
}

if (logs) {
  logs.textContent = formatNumber(totalLogs);
}

if (risks) {
  risks.textContent = formatNumber(riskEvents);
}

if (quality) {
  quality.textContent = `${formatScore(qualityScore)}%`;
}


}

/* ------------------------------------------------------------------------
Incident Priority Cards
------------------------------------------------------------------------ */

function renderIncidents(incidents) {
const container = $("incidents-list");


if (!container) return;

if (!Array.isArray(incidents) || !incidents.length) {
  setEmpty(
    container,
    "No active incidents recorded."
  );
  return;
}

container.innerHTML = incidents
  .map((incident) => {
    const severity = normalizeSeverity(
      incident.severity
    );

    const title =
      incident.title ||
      incident.name ||
      "Untitled Investigation";

    const score =
      Number.isFinite(Number(incident.score))
        ? Number(incident.score)
        : 0;

    return `
      <a
        href="/incidents"
        class="dashboard-incident-card"
        aria-label="Investigate ${escapeHTML(title)}"
      >
        <div class="dashboard-incident-main">
          <div class="dashboard-incident-heading">
            <span class="badge ${severityClass(severity)}">
              ${escapeHTML(severity.toUpperCase())}
            </span>

            <span class="dashboard-incident-title">
              ${escapeHTML(title)}
            </span>
          </div>

          <div class="dashboard-incident-meta">
            <span>RISK SCORE</span>
            <strong>${formatScore(score)}/100</strong>
          </div>
        </div>

        <span class="dashboard-incident-action">
          Investigate
          <i data-lucide="arrow-up-right"></i>
        </span>
      </a>
    `;
  })
  .join("");

refreshIcons();


}

/* ------------------------------------------------------------------------
Risky IP Intelligence
------------------------------------------------------------------------ */

function renderRiskyIps(ips) {
const container = $("top-ips-list");


if (!container) return;

if (!Array.isArray(ips) || !ips.length) {
  setEmpty(
    container,
    "No high-risk IPs recorded."
  );
  return;
}

container.innerHTML = ips
  .map((item) => {
    const ip = item.ip || "Unknown source";
    const events = Number(item.events || 0);
    const score = Number(item.score || 0);

    const badge =
      score >= 90
        ? "badge-critical"
        : score >= 70
          ? "badge-high"
          : "badge-medium";

    return `
      <div class="dashboard-ip-card">
        <div class="dashboard-ip-identity">
          <div class="dashboard-ip-icon">
            <i data-lucide="globe-2"></i>
          </div>

          <div>
            <strong class="dashboard-ip-address">
              ${escapeHTML(ip)}
            </strong>

            <span class="dashboard-ip-events">
              ${formatNumber(events)}
              ${events === 1 ? "event" : "events"}
            </span>
          </div>
        </div>

        <span class="badge ${badge}">
          ${formatScore(score)}
        </span>
      </div>
    `;
  })
  .join("");

refreshIcons();


}

/* ------------------------------------------------------------------------
Severity Distribution
------------------------------------------------------------------------ */

function renderOverviewSeverity(counts) {
const container = $("top-ips-list");


/*
 * The backend overview includes severity_distribution.
 * The dedicated sidebar is already used for risky IPs, so the
 * distribution is rendered into a lightweight secondary panel
 * only when one exists in the page.
 */
const dedicatedHost =
  $("severity-distribution") ||
  $("overview-severity");

if (!dedicatedHost) {
  return;
}

const rows = Object.entries(counts || {})
  .map(([label, count]) => [
    label,
    Number(count) || 0,
  ])
  .filter(([, count]) => count > 0)
  .sort((a, b) => b[1] - a[1]);

if (!rows.length) {
  setEmpty(
    dedicatedHost,
    "No severity distribution available."
  );
  return;
}

const maximum = Math.max(
  ...rows.map(([, value]) => value),
  1
);

dedicatedHost.innerHTML = rows
  .map(([label, count]) => {
    const percentage =
      Math.max(
        5,
        Math.round((count / maximum) * 100)
      );

    return `
      <div class="bar-row">
        <div class="bar-row-label">
          <span>${escapeHTML(label)}</span>
          <strong>${formatNumber(count)}</strong>
        </div>

        <div
          class="bar-track"
          role="progressbar"
          aria-valuenow="${count}"
          aria-valuemin="0"
          aria-valuemax="${maximum}"
          aria-label="${escapeHTML(label)} severity"
        >
          <span style="width:${percentage}%"></span>
        </div>
      </div>
    `;
  })
  .join("");


}

/* ------------------------------------------------------------------------
Telemetry Canvas
------------------------------------------------------------------------ */

function getCanvasContext() {
const canvas = $("telemetry-canvas");


if (!canvas) {
  return null;
}

const context = canvas.getContext("2d");

if (!context) {
  return null;
}

return {
  canvas,
  context,
};


}

function resizeCanvas(canvas) {
const rect =
canvas.parentElement?.getBoundingClientRect();


const width =
  Math.max(
    Math.floor(rect?.width || canvas.clientWidth || 520),
    320
  );

const height = 220;

const pixelRatio =
  Math.min(window.devicePixelRatio || 1, 2);

canvas.width = width * pixelRatio;
canvas.height = height * pixelRatio;

canvas.style.height = `${height}px`;

const ctx = canvas.getContext("2d");

if (!ctx) {
  return null;
}

ctx.setTransform(
  pixelRatio,
  0,
  0,
  pixelRatio,
  0,
  0
);

return {
  width,
  height,
  ctx,
};


}

function drawCanvasGrid(ctx, width, height) {
ctx.save();


ctx.strokeStyle = "rgba(148, 163, 184, 0.10)";
ctx.lineWidth = 1;

const horizontalLines = 4;

for (let i = 0; i <= horizontalLines; i++) {
  const y =
    22 +
    (i / horizontalLines) *
      (height - 44);

  ctx.beginPath();
  ctx.moveTo(18, y);
  ctx.lineTo(width - 18, y);
  ctx.stroke();
}

const verticalLines = 6;

for (let i = 0; i <= verticalLines; i++) {
  const x =
    18 +
    (i / verticalLines) *
      (width - 36);

  ctx.beginPath();
  ctx.moveTo(x, 18);
  ctx.lineTo(x, height - 18);
  ctx.stroke();
}

ctx.restore();


}

function severityLane(severity) {
switch (normalizeSeverity(severity)) {
case "critical":
return 0;


  case "high":
    return 1;

  case "medium":
    return 2;

  case "low":
    return 3;

  default:
    return 2;
}


}

function severityColor(severity) {
/*
* Canvas rendering uses explicit colors because canvas does not
* inherit CSS custom properties reliably across themes.
*/
switch (normalizeSeverity(severity)) {
case "critical":
return "#ef4444";


  case "high":
    return "#f97316";

  case "medium":
    return "#3b82f6";

  case "low":
    return "#22c55e";

  default:
    return "#94a3b8";
}


}

function renderTelemetryCanvas(events) {
const target = getCanvasContext();


if (!target) {
  return;
}

const resized = resizeCanvas(target.canvas);

if (!resized) {
  return;
}

const {
  width,
  height,
  ctx,
} = resized;

ctx.clearRect(0, 0, width, height);

drawCanvasGrid(
  ctx,
  width,
  height
);

const eventList = Array.isArray(events)
  ? events
      .filter(Boolean)
      .slice(-40)
  : [];

if (!eventList.length) {
  ctx.save();

  ctx.fillStyle = "#94a3b8";
  ctx.font =
    "500 12px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    "No recent risk events returned by the backend.",
    width / 2,
    height / 2
  );

  ctx.restore();

  return;
}

const lanes = 4;
const top = 28;
const bottom = height - 28;
const laneGap =
  (bottom - top) /
  Math.max(lanes - 1, 1);

const points = [];

const maxScore = Math.max(
  ...eventList.map((event) =>
    Number(event.risk_score || 0)
  ),
  1
);

eventList.forEach((event, index) => {
  const progress =
    eventList.length === 1
      ? 0.5
      : index /
        (eventList.length - 1);

  const x =
    28 +
    progress *
      (width - 56);

  const lane =
    severityLane(event.severity);

  const y =
    top +
    lane * laneGap;

  const score =
    Math.max(
      0,
      Number(event.risk_score || 0)
    );

  const radius =
    4 +
    Math.min(
      8,
      (score / maxScore) * 8
    );

  points.push({
    x,
    y,
    radius,
    severity: event.severity,
  });
});

/* Connecting intelligence path */
ctx.save();

ctx.beginPath();

points.forEach((point, index) => {
  if (index === 0) {
    ctx.moveTo(point.x, point.y);
  } else {
    const previous = points[index - 1];

    const controlX =
      (previous.x + point.x) / 2;

    ctx.bezierCurveTo(
      controlX,
      previous.y,
      controlX,
      point.y,
      point.x,
      point.y
    );
  }
});

ctx.strokeStyle =
  "rgba(148, 163, 184, 0.34)";

ctx.lineWidth = 1.5;
ctx.stroke();
ctx.restore();

/* Event nodes */
points.forEach((point) => {
  const color =
    severityColor(point.severity);

  ctx.save();

  ctx.beginPath();
  ctx.arc(
    point.x,
    point.y,
    point.radius + 5,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    color.replace(
      ")",
      ", 0.12)"
    );

  /*
   * If the color is hex, use a generic translucent
   * shadow instead of manipulating the hex value.
   */
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(
    point.x,
    point.y,
    point.radius,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
});

/* Lane labels */
ctx.save();

ctx.font =
  "600 9px 'IBM Plex Mono', monospace";

ctx.textAlign = "left";
ctx.textBaseline = "middle";

["CRITICAL", "HIGH", "MEDIUM", "LOW"]
  .forEach((label, index) => {
    const y =
      top +
      index * laneGap;

    ctx.fillStyle =
      "rgba(148, 163, 184, 0.72)";

    ctx.fillText(
      label,
      22,
      y - 12
    );
  });

ctx.restore();


}

/* ------------------------------------------------------------------------
Main Refresh
------------------------------------------------------------------------ */

async function fetchOverview(options = {}) {
const silent =
options.silent === true;


const incidentsEl =
  $("incidents-list");

const ipsEl =
  $("top-ips-list");

if (!silent) {
  setLoading(
    incidentsEl,
    "Loading investigation priorities..."
  );

  setLoading(
    ipsEl,
    "Loading risky IP intelligence..."
  );
}

try {
  const [
    overview,
    riskyIps,
  ] = await Promise.all([
    requestOverview(),
    requestRiskyIps(),
  ]);

  if (!overview) {
    throw new Error(
      "Empty overview response"
    );
  }

  renderOverviewMetrics(
    overview
  );

  latestEvents =
    Array.isArray(
      overview.recent_events
    )
      ? overview.recent_events
      : [];

  renderIncidents(
    overview.recent_incidents || []
  );

  renderRiskyIps(
    Array.isArray(riskyIps)
      ? riskyIps
      : []
  );

  renderOverviewSeverity(
    overview.severity_distribution || {}
  );

  renderTelemetryCanvas(
    latestEvents
  );

  window.dispatchEvent(
    new CustomEvent(
      "lf:dashboard-updated",
      {
        detail: {
          overview,
          riskyIps,
        },
      }
    )
  );
} catch (error) {
  if (
    error?.name ===
    "AbortError"
  ) {
    return;
  }

  console.error(
    "Dashboard telemetry error:",
    error
  );

  setError(
    incidentsEl,
    "Unable to load incident telemetry."
  );

  setError(
    ipsEl,
    "Unable to load risky IP intelligence."
  );

  const title =
    $("hero-title");

  const description =
    $("hero-desc");

  if (title) {
    title.textContent =
      "Telemetry temporarily unavailable";
  }

  if (description) {
    description.textContent =
      "The dashboard could not retrieve the latest forensic overview. Retry when the backend is available.";
  }

  if (!silent && window.showToast) {
    window.showToast(
      "Dashboard telemetry could not be refreshed.",
      "error"
    );
  }
}


}

/* ------------------------------------------------------------------------
Refresh Button
------------------------------------------------------------------------ */

function initRefreshControl() {
const buttons =
document.querySelectorAll(
'[onclick="fetchOverview()"]'
);


buttons.forEach((button) => {
  button.removeAttribute("onclick");

  button.addEventListener(
    "click",
    async () => {
      const originalHTML =
        button.innerHTML;

      button.disabled = true;
      button.setAttribute(
        "aria-busy",
        "true"
      );

      button.innerHTML = `
        <i data-lucide="loader-circle"></i>
        Refreshing
      `;

      refreshIcons();

      try {
        await fetchOverview();
      } finally {
        button.disabled = false;
        button.removeAttribute(
          "aria-busy"
        );
        button.innerHTML =
          originalHTML;

        refreshIcons();
      }
    }
  );
});


}

/* ------------------------------------------------------------------------
Live Stream Integration
------------------------------------------------------------------------ */

function initLiveUpdates() {
window.addEventListener(
"lf:risk",
() => {
/*
* Do not immediately hammer the overview endpoint for every
* individual SSE event. Schedule one refresh instead.
*/
scheduleRefresh();
}
);
}

let refreshTimer = null;

function scheduleRefresh() {
clearTimeout(refreshTimer);


refreshTimer = setTimeout(
  () => {
    fetchOverview({
      silent: true,
    });
  },
  1200
);


}

/* ------------------------------------------------------------------------
Window Resize
------------------------------------------------------------------------ */

function initCanvasResize() {
let resizeTimer;


window.addEventListener(
  "resize",
  () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(
      () => {
        renderTelemetryCanvas(
          latestEvents
        );
      },
      120
    );
  },
  {
    passive: true,
  }
);


}

/* ------------------------------------------------------------------------
Icon refresh
------------------------------------------------------------------------ */

function refreshIcons() {
if (
window.refreshIcons &&
typeof window.refreshIcons ===
"function"
) {
window.refreshIcons();
return;
}


if (
  window.lucide &&
  typeof window.lucide.createIcons ===
    "function"
) {
  window.lucide.createIcons();
}


}

/* ------------------------------------------------------------------------
Bootstrap
------------------------------------------------------------------------ */

function init() {
initRefreshControl();
initLiveUpdates();
initCanvasResize();


fetchOverview();


}

window.fetchOverview =
fetchOverview;

if (
document.readyState ===
"loading"
) {
document.addEventListener(
"DOMContentLoaded",
init,
{ once: true }
);
} else {
init();
}

})();
