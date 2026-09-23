/* =========================================================
Intelligent Log Forensics — Evidence Explorer
Backend-connected log stream + evidence workstation
========================================================= */

(() => {
"use strict";

let currentLogs = [];
let activeLog = null;
let payloadView = "normalized";
let sourceOptionsLoaded = false;

const getFileId = () => Number(window.FILE_ID || 1);


const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

const getCss = (name) =>
getComputedStyle(document.documentElement)
.getPropertyValue(name)
.trim();

const severityClass = (severity) => {
switch (String(severity || "").toLowerCase()) {
case "critical":
return "badge-critical";
case "high":
return "badge-high";
case "medium":
return "badge-medium";
case "low":
return "badge-low";
default:
return "badge-default";
}
};

const formatTime = (value) => {
if (!value) return "—";


const date = new Date(value);

if (Number.isNaN(date.getTime())) {
  return String(value);
}

return date.toLocaleTimeString("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});


};

const formatDateTime = (value) => {
if (!value) return "—";


const date = new Date(value);

if (Number.isNaN(date.getTime())) {
  return String(value);
}

return date.toLocaleString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});


};

/* =========================================================
FETCH LOGS
Existing backend:
GET /api/v1/logs/filter
========================================================= */

async function fetchLogs() {
const fileId = getFileId();


const queryInput = document.getElementById("log-query");
const sourceInput = document.getElementById("log-source");

const query = queryInput?.value?.trim() || "";
const source = sourceInput?.value || "";

const params = new URLSearchParams({
  file_id: fileId
});

if (query) {
  params.set("q", query);
}

if (source) {
  params.set("source_type", source);
}

const tbody = document.getElementById("logs-tbody");
const countBadge = document.getElementById("log-count-badge");

if (tbody) {
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-row">
        <div class="table-loading">
          <span class="loading-pulse"></span>
          Querying forensic evidence...
        </div>
      </td>
    </tr>
  `;
}

try {
  const response = await fetch(
    `/api/v1/logs/filter?${params.toString()}`,
    {
      credentials: "same-origin"
    }
  );

  if (!response.ok) {
    throw new Error(`Log API returned ${response.status}`);
  }

  const data = await response.json();

  currentLogs = Array.isArray(data.logs)
    ? data.logs
    : [];

  const sourceCounts = data.source_counts || {};

  renderSourceOptions(sourceCounts);
  renderLogTable();
  renderLogAnalytics(currentLogs, sourceCounts);

} catch (error) {
  console.error("Log stream loading failed:", error);

  currentLogs = [];

  if (countBadge) {
    countBadge.textContent = "Evidence stream unavailable";
  }

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">
          <div class="table-error">
            <i data-lucide="triangle-alert"></i>
            <strong>Unable to load evidence stream</strong>
            <span>
              Check authentication and backend connectivity.
            </span>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              onclick="window.fetchLogs()"
            >
              Retry
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}


}

/* =========================================================
SOURCE FILTER
========================================================= */

function renderSourceOptions(sourceCounts) {
const select = document.getElementById("log-source");


if (!select || sourceOptionsLoaded) {
  return;
}

const sources = Object.entries(sourceCounts || {})
  .filter(([source]) => source)
  .sort(([a], [b]) => a.localeCompare(b));

sources.forEach(([source, count]) => {
  const option = document.createElement("option");

  option.value = source;
  option.textContent =
    `${String(source).toUpperCase()} (${count})`;

  select.appendChild(option);
});

sourceOptionsLoaded = true;


}

/* =========================================================
LOG TABLE
========================================================= */

function renderLogTable() {
const tbody = document.getElementById("logs-tbody");
const badge = document.getElementById("log-count-badge");


if (!tbody) return;

if (badge) {
  badge.textContent =
    `Displaying ${currentLogs.length.toLocaleString()} events`;
}

if (!currentLogs.length) {
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-row">
        <div class="table-empty-state">
          <i data-lucide="search-x"></i>
          <strong>No matching evidence</strong>
          <span>
            Adjust the search or source filter to widen the investigation.
          </span>
        </div>
      </td>
    </tr>
  `;

  if (window.lucide) window.lucide.createIcons();
  return;
}

tbody.innerHTML = currentLogs.map((log, index) => {
  const risk = log.risk;
  const status = Number(log.status_code);

  const statusLabel =
    Number.isFinite(status) ? status : "—";

  const statusClass =
    Number.isFinite(status) && status >= 400
      ? "badge-critical"
      : "badge-ok";

  const eventName =
    log.event_type ||
    log.method ||
    "LOG EVENT";

  const endpoint =
    log.endpoint ||
    log.source_ip ||
    log.message ||
    "—";

  return `
    <tr
      class="log-row ${activeLog?.id === log.id ? "is-selected" : ""}"
      data-log-id="${esc(log.id)}"
      onclick="window.selectLog(${Number(log.id)})"
    >
      <td>
        <div class="log-time">
          <strong>${esc(formatTime(log.timestamp))}</strong>
          <small>${esc(formatDateTime(log.timestamp))}</small>
        </div>
      </td>

      <td>
        <span class="badge badge-default">
          ${esc(
            String(log.log_source_type || "SYS").toUpperCase()
          )}
        </span>
      </td>

      <td>
        <div class="log-event-cell">
          ${
            log.method
              ? `<span class="method-tag">${esc(log.method)}</span>`
              : ""
          }

          <strong>${esc(eventName)}</strong>
        </div>
      </td>

      <td>
        <span class="log-endpoint" title="${esc(endpoint)}">
          ${esc(endpoint)}
        </span>
      </td>

      <td>
        <span class="badge ${statusClass}">
          ${esc(statusLabel)}
        </span>
      </td>

      <td>
        ${
          risk
            ? `
              <span class="badge ${severityClass(risk.severity)}">
                ${esc(
                  risk.risk_category ||
                  risk.severity ||
                  "RISK"
                )}
              </span>
            `
            : `
              <span class="risk-none">
                No signal
              </span>
            `
        }
      </td>
    </tr>
  `;
}).join("");

if (window.lucide) {
  window.lucide.createIcons();
}


}

/* =========================================================
ANALYTICS
========================================================= */

function renderLogAnalytics(logs, sourceCounts) {
renderVolumeChart(logs);
renderDistribution(
"source-distribution",
sourceCounts
);


const severityCounts = logs.reduce(
  (result, log) => {
    const severity =
      log.risk?.severity ||
      (Number(log.status_code) >= 400
        ? "Error"
        : "Normal");

    result[severity] =
      (result[severity] || 0) + 1;

    return result;
  },
  {}
);

renderDistribution(
  "severity-distribution",
  severityCounts
);


}

/* =========================================================
EVENT VOLUME CHART
========================================================= */

function renderVolumeChart(logs) {
const canvas =
document.getElementById("event-volume-chart");


const meta =
  document.getElementById("volume-meta");

if (!canvas) return;

const ctx = canvas.getContext("2d");

if (!ctx) return;

const width =
  canvas.clientWidth ||
  canvas.parentElement?.clientWidth ||
  640;

const height = 150;

const ratio =
  window.devicePixelRatio || 1;

canvas.width = width * ratio;
canvas.height = height * ratio;
canvas.style.height = `${height}px`;

ctx.setTransform(
  ratio,
  0,
  0,
  ratio,
  0,
  0
);

ctx.clearRect(0, 0, width, height);

if (!logs.length) {
  if (meta) {
    meta.textContent = "No events in scope";
  }

  ctx.fillStyle =
    getCss("--text-muted") || "#94a3b8";

  ctx.font = "12px sans-serif";

  ctx.fillText(
    "No events available for this filter.",
    18,
    height / 2
  );

  return;
}

const buckets = new Map();

logs.forEach((log) => {
  if (!log.timestamp) return;

  const date = new Date(log.timestamp);

  if (Number.isNaN(date.getTime())) return;

  const key =
    `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")} ${String(
      date.getHours()
    ).padStart(2, "0")}:00`;

  buckets.set(
    key,
    (buckets.get(key) || 0) + 1
  );
});

const points =
  Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b));

if (!points.length) {
  if (meta) {
    meta.textContent = `${logs.length} events`;
  }
  return;
}

const max =
  Math.max(
    ...points.map(([, value]) => value),
    1
  );

const padding = 20;

const chartWidth =
  width - padding * 2;

const chartHeight =
  height - padding * 2;

/* Baseline */

ctx.strokeStyle =
  getCss("--border-subtle") ||
  "rgba(148,163,184,.25)";

ctx.lineWidth = 1;

ctx.beginPath();

ctx.moveTo(
  padding,
  height - padding
);

ctx.lineTo(
  width - padding,
  height - padding
);

ctx.stroke();

/* Grid */

for (let i = 1; i <= 3; i++) {
  const y =
    padding +
    (chartHeight / 4) * i;

  ctx.strokeStyle =
    getCss("--border-subtle") ||
    "rgba(148,163,184,.15)";

  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
}

const step =
  points.length > 1
    ? chartWidth / (points.length - 1)
    : 0;

const coordinates = points.map(
  ([, value], index) => {
    const x =
      padding + step * index;

    const y =
      height -
      padding -
      (value / max) * chartHeight;

    return { x, y, value };
  }
);

/* Area */

if (coordinates.length > 1) {
  const gradient =
    ctx.createLinearGradient(
      0,
      padding,
      0,
      height
    );

  gradient.addColorStop(
    0,
    "rgba(37,99,235,.22)"
  );

  gradient.addColorStop(
    1,
    "rgba(37,99,235,0)"
  );

  ctx.beginPath();

  coordinates.forEach(
    ({ x, y }, index) => {
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  );

  ctx.lineTo(
    coordinates.at(-1).x,
    height - padding
  );

  ctx.lineTo(
    coordinates[0].x,
    height - padding
  );

  ctx.closePath();

  ctx.fillStyle = gradient;
  ctx.fill();
}

/* Line */

ctx.beginPath();

coordinates.forEach(
  ({ x, y }, index) => {
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
);

ctx.strokeStyle =
  getCss("--accent") || "#2563eb";

ctx.lineWidth = 2;

ctx.stroke();

/* Points */

coordinates.forEach(
  ({ x, y }) => {
    ctx.beginPath();

    ctx.arc(
      x,
      y,
      3,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      getCss("--accent") || "#2563eb";

    ctx.fill();
  }
);

if (meta) {
  meta.textContent =
    `${logs.length.toLocaleString()} events · ${points.length} time buckets`;
}


}

/* =========================================================
DISTRIBUTION BARS
========================================================= */

function renderDistribution(id, counts) {
const element =
document.getElementById(id);


if (!element) return;

const rows =
  Object.entries(counts || {})
    .filter(
      ([label, value]) =>
        label && Number(value) > 0
    )
    .sort(
      (a, b) =>
        Number(b[1]) - Number(a[1])
    )
    .slice(0, 6);

if (!rows.length) {
  element.innerHTML = `
    <div class="empty-state-inline">
      No distribution data returned.
    </div>
  `;
  return;
}

const max =
  Math.max(
    ...rows.map(([, value]) =>
      Number(value)
    ),
    1
  );

element.innerHTML = rows.map(
  ([label, value]) => {
    const percentage =
      Math.max(
        4,
        (Number(value) / max) * 100
      );

    return `
      <div class="bar-row">
        <div class="bar-row-label">
          <span>${esc(label)}</span>
          <strong>${Number(value).toLocaleString()}</strong>
        </div>

        <div
          class="bar-track"
          role="progressbar"
          aria-valuenow="${Number(value)}"
          aria-valuemin="0"
          aria-valuemax="${max}"
        >
          <span
            style="width:${percentage}%"
          ></span>
        </div>
      </div>
    `;
  }
).join("");


}

/* =========================================================
SELECT LOG
========================================================= */

function selectLog(logId) {
activeLog =
currentLogs.find(
(log) =>
Number(log.id) === Number(logId)
);


if (!activeLog) return;

renderLogTable();
renderEvidencePanel();


}

/* =========================================================
EVIDENCE PANEL
========================================================= */

function renderEvidencePanel() {
if (!activeLog) return;


const panel =
  document.getElementById("evidence-panel");

if (panel) {
  panel.style.display = "flex";
}

const eventType =
  document.getElementById(
    "panel-event-type"
  );

if (eventType) {
  eventType.textContent =
    activeLog.event_type ||
    activeLog.method ||
    `Log Event #${activeLog.id}`;
}

renderPayload();
renderRiskPanel();


}

/* =========================================================
PAYLOAD VIEW
========================================================= */

function setPayloadView(mode) {
if (
mode !== "normalized" &&
mode !== "raw"
) {
return;
}


payloadView = mode;

const normalizedButton =
  document.getElementById(
    "btn-mode-normalized"
  );

const rawButton =
  document.getElementById(
    "btn-mode-raw"
  );

if (normalizedButton) {
  normalizedButton.style.background =
    mode === "normalized"
      ? "var(--bg-surface)"
      : "transparent";

  normalizedButton.style.color =
    mode === "normalized"
      ? "var(--accent)"
      : "var(--text-muted)";
}

if (rawButton) {
  rawButton.style.background =
    mode === "raw"
      ? "var(--bg-surface)"
      : "transparent";

  rawButton.style.color =
    mode === "raw"
      ? "var(--accent)"
      : "var(--text-muted)";
}

renderPayload();


}

function renderPayload() {
const pre =
document.getElementById(
"panel-payload"
);


if (!pre || !activeLog) return;

if (payloadView === "normalized") {
  pre.textContent =
    JSON.stringify(
      activeLog,
      null,
      2
    );
  return;
}

pre.textContent =
  activeLog.message ||
  activeLog.raw_payload ||
  "No raw payload returned by backend.";


}

/* =========================================================
RISK PANEL
========================================================= */

function renderRiskPanel() {
const riskBox =
document.getElementById(
"panel-risk-box"
);


if (!riskBox) return;

const risk = activeLog?.risk;

if (!risk) {
  riskBox.style.display = "none";
  return;
}

riskBox.style.display = "flex";

const severity =
  document.getElementById(
    "panel-risk-severity"
  );

const category =
  document.getElementById(
    "panel-risk-cat"
  );

if (severity) {
  severity.textContent =
    String(
      risk.severity ||
      "UNKNOWN"
    ).toUpperCase();

  severity.className =
    `badge ${severityClass(risk.severity)}`;
}

if (category) {
  category.textContent =
    risk.risk_category ||
    "Risk category unavailable";
}

const confirm =
  document.getElementById(
    "btn-label-confirm"
  );

const falsePositive =
  document.getElementById(
    "btn-label-fp"
  );

if (confirm) {
  confirm.onclick = () =>
    labelRisk(
      risk.id,
      "confirmed"
    );
}

if (falsePositive) {
  falsePositive.onclick = () =>
    labelRisk(
      risk.id,
      "false_positive"
    );
}


}

/* =========================================================
RISK LABEL
Existing backend:
POST /api/v1/risk-events/<id>/label
========================================================= */

async function labelRisk(riskId, label) {
if (!riskId) {
if (window.showToast) {
window.showToast(
"Risk event identifier is missing",
"error"
);
}
return;
}


try {
  const response = await fetch(
    `/api/v1/risk-events/${riskId}/label`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({ label })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Risk label API returned ${response.status}`
    );
  }

  const data =
    await response.json();

  if (window.showToast) {
    window.showToast(
      `Risk label updated to ${label}`,
      "success"
    );
  }

  /*
   * Refresh backend data so the evidence
   * panel reflects the saved state.
   */
  await fetchLogs();

  if (activeLog) {
    const refreshed =
      currentLogs.find(
        (log) =>
          Number(log.id) ===
          Number(activeLog.id)
      );

    if (refreshed) {
      activeLog = refreshed;
      renderEvidencePanel();
    }
  }

  return data;

} catch (error) {
  console.error(
    "Risk label update failed:",
    error
  );

  if (window.showToast) {
    window.showToast(
      "Unable to update risk label",
      "error"
    );
  }
}


}

/* =========================================================
CLOSE EVIDENCE PANEL
========================================================= */

function closeEvidencePanel() {
const panel =
document.getElementById(
"evidence-panel"
);


if (panel) {
  panel.style.display = "none";
}

activeLog = null;
renderLogTable();


}

/* =========================================================
RESPONSIVE CHART
========================================================= */

let resizeTimer = null;

window.addEventListener(
"resize",
() => {
clearTimeout(resizeTimer);


  resizeTimer = setTimeout(() => {
    renderVolumeChart(
      currentLogs
    );
  }, 120);
}


);

/* =========================================================
EXPOSE REQUIRED HTML HANDLERS
========================================================= */

window.fetchLogs = fetchLogs;
window.selectLog = selectLog;
window.setPayloadView = setPayloadView;
window.closeEvidencePanel =
closeEvidencePanel;
window.labelRisk = labelRisk;

/* =========================================================
INITIALISE
========================================================= */

document.addEventListener(
"DOMContentLoaded",
() => {
fetchLogs();
}
);

})();
