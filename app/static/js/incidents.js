/* =========================================================
Intelligent Log Forensics — Incident Investigation
Backend-connected incident workspace
========================================================= */

(() => {
"use strict";

let incidents = [];
let activeIncident = null;

const fileId = () => Number(window.FILE_ID || 1);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

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

/* ---------------------------------------------------------
Load incidents from backend
GET /api/v1/incidents/<file_id>
--------------------------------------------------------- */

async function fetchIncidents() {
const id = fileId();
const sidebar = document.getElementById("incidents-sidebar-list");


if (!sidebar) return;

sidebar.innerHTML = `
  <div class="incident-loading">
    <span class="loading-pulse"></span>
    Loading incident intelligence...
  </div>
`;

try {
  const response = await fetch(`/api/v1/incidents/${id}`, {
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`Incident API returned ${response.status}`);
  }

  const data = await response.json();

  incidents = Array.isArray(data)
    ? data
    : Array.isArray(data.incidents)
      ? data.incidents
      : [];

  renderIncidentList();

  if (incidents.length) {
    selectIncident(incidents[0].id);
  } else {
    renderEmptyIncidentState();
  }
} catch (error) {
  console.error("Incident loading failed:", error);

  sidebar.innerHTML = `
    <div class="incident-empty-state">
      <i data-lucide="shield-off"></i>
      <strong>Incident intelligence unavailable</strong>
      <span>
        The backend did not return incident data for
        file #${esc(id)}.
      </span>
      <button class="btn btn-secondary btn-sm" onclick="window.loadIncidents()">
        Retry
      </button>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}


}

/* ---------------------------------------------------------
Incident sidebar
--------------------------------------------------------- */

function renderIncidentList() {
const sidebar = document.getElementById("incidents-sidebar-list");


if (!sidebar) return;

if (!incidents.length) {
  renderEmptyIncidentState();
  return;
}

sidebar.innerHTML = incidents.map((incident, index) => {
  const active = activeIncident && activeIncident.id === incident.id;
  const severity = String(incident.severity || "unknown");

  return `
    <button
      type="button"
      class="incident-selector ${active ? "is-active" : ""}"
      data-incident-id="${esc(incident.id)}"
      onclick="window.selectIncident(${Number(incident.id)})"
    >
      <div class="incident-selector-top">
        <span class="badge ${severityClass(severity)}">
          ${esc(severity.toUpperCase())}
        </span>

        <span class="incident-score">
          ${esc(incident.score ?? "--")}/100
        </span>
      </div>

      <div class="incident-selector-title">
        ${esc(incident.title || `Incident ${index + 1}`)}
      </div>

      <div class="incident-selector-meta">
        <span>
          <i data-lucide="activity"></i>
          ${Array.isArray(incident.events) ? incident.events.length : 0} events
        </span>

        <span>
          <i data-lucide="arrow-up-right"></i>
        </span>
      </div>
    </button>
  `;
}).join("");

if (window.lucide) window.lucide.createIcons();


}

function renderEmptyIncidentState() {
const sidebar = document.getElementById("incidents-sidebar-list");


if (!sidebar) return;

sidebar.innerHTML = `
  <div class="incident-empty-state">
    <i data-lucide="shield-check"></i>
    <strong>No incidents formed</strong>
    <span>
      No correlated attack incidents were returned
      for evidence file #${esc(fileId())}.
    </span>
  </div>
`;

clearWorkspace();

if (window.lucide) window.lucide.createIcons();


}

/* ---------------------------------------------------------
Select active incident
--------------------------------------------------------- */

function selectIncident(incidentId) {
activeIncident =
incidents.find((incident) => Number(incident.id) === Number(incidentId)) ||
incidents[0];


if (!activeIncident) return;

renderIncidentList();
renderIncidentHeader();
renderRcaGraph();
renderEventsTimeline();
renderIncidentMetrics();


}

/* ---------------------------------------------------------
Incident header
--------------------------------------------------------- */

function renderIncidentHeader() {
if (!activeIncident) return;


const severity = String(activeIncident.severity || "unknown");

const badge = document.getElementById("inc-badge-severity");
const idTag = document.getElementById("inc-id-tag");
const title = document.getElementById("inc-title");
const summary = document.getElementById("inc-summary");
const score = document.getElementById("inc-score");

if (badge) {
  badge.textContent = `${severity.toUpperCase()} INCIDENT`;
  badge.className = `badge ${severityClass(severity)}`;
}

if (idTag) {
  idTag.textContent = `INCIDENT #${activeIncident.id ?? "--"}`;
}

if (title) {
  title.textContent =
    activeIncident.title || "Untitled security incident";
}

if (summary) {
  summary.textContent =
    activeIncident.summary ||
    "No incident narrative was returned by the backend.";
}

if (score) {
  score.textContent =
    activeIncident.score != null
      ? `${activeIncident.score}/100`
      : "--";
}


}

/* ---------------------------------------------------------
RCA causal graph
--------------------------------------------------------- */

function renderRcaGraph() {
const container = document.getElementById("rca-nodes-container");


if (!container || !activeIncident) return;

const events = Array.isArray(activeIncident.events)
  ? activeIncident.events
  : [];

const nodes = [
  {
    type: "Incident",
    title: activeIncident.title || "Security Incident",
    desc:
      activeIncident.summary ||
      "Incident summary unavailable.",
    mapping:
      activeIncident.severity ||
      "Severity unavailable"
  },

  ...events.slice(0, 6).map((event, index) => ({
    type: index === 0 ? "Observed" : "Evidence",
    title: event.event_type || `Attack Event ${index + 1}`,
    desc:
      event.description ||
      "Backend returned an event without a narrative description.",
    mapping:
      event.mitre_technique ||
      event.mitre_tactic ||
      "No ATT&CK mapping"
  }))
];

container.innerHTML = nodes.map((node, index) => `
  <div class="rca-node ${index === 0 ? "is-root" : ""}">
    <div class="rca-node-index">
      ${String(index + 1).padStart(2, "0")}
    </div>

    <div class="rca-node-content">
      <span class="badge ${
        index === 0
          ? severityClass(activeIncident.severity)
          : "badge-default"
      }">
        ${esc(node.type)}
      </span>

      <h4>${esc(node.title)}</h4>

      <p>${esc(node.desc)}</p>

      <div class="rca-node-mapping">
        <i data-lucide="crosshair"></i>
        ${esc(node.mapping)}
      </div>
    </div>
  </div>
`).join("");

if (window.lucide) window.lucide.createIcons();


}

/* ---------------------------------------------------------
Chronological event timeline
--------------------------------------------------------- */

function renderEventsTimeline() {
const container = document.getElementById("inc-events-timeline");


if (!container || !activeIncident) return;

const events = Array.isArray(activeIncident.events)
  ? activeIncident.events
  : [];

if (!events.length) {
  container.innerHTML = `
    <div class="timeline-empty">
      <i data-lucide="clock-3"></i>
      <span>No chronological events recorded.</span>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
  return;
}

container.innerHTML = events.map((event, index) => {
  const severity =
    event.severity ||
    activeIncident.severity ||
    "unknown";

  let eventTime = "Time unavailable";

  if (event.event_time) {
    const parsed = new Date(event.event_time);

    if (!Number.isNaN(parsed.getTime())) {
      eventTime = parsed.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    }
  }

  return `
    <article class="attack-timeline-event">
      <div class="timeline-marker ${severityClass(severity)}">
        ${String(index + 1).padStart(2, "0")}
      </div>

      <div class="timeline-event-body">
        <div class="timeline-event-head">
          <div>
            <span class="eyebrow">
              ${esc(event.event_type || "ATTACK STEP")}
            </span>

            <h4>
              ${esc(event.description || "Security event detected")}
            </h4>
          </div>

          <time>
            ${esc(eventTime)}
          </time>
        </div>

        <div class="timeline-event-tags">
          ${
            event.mitre_tactic
              ? `
                <span class="intel-tag mitre">
                  Tactic · ${esc(event.mitre_tactic)}
                </span>
              `
              : ""
          }

          ${
            event.mitre_technique
              ? `
                <span class="intel-tag">
                  Technique · ${esc(event.mitre_technique)}
                </span>
              `
              : ""
          }

          ${
            event.risk_score != null
              ? `
                <span class="intel-tag">
                  Risk · ${esc(event.risk_score)}
                </span>
              `
              : ""
          }
        </div>
      </div>
    </article>
  `;
}).join("");


}

/* ---------------------------------------------------------
Optional incident metric hooks
--------------------------------------------------------- */

function renderIncidentMetrics() {
if (!activeIncident) return;


const events = Array.isArray(activeIncident.events)
  ? activeIncident.events
  : [];

document.querySelectorAll("[data-incident-event-count]")
  .forEach((element) => {
    element.textContent = events.length;
  });

document.querySelectorAll("[data-incident-score]")
  .forEach((element) => {
    element.textContent =
      activeIncident.score != null
        ? activeIncident.score
        : "--";
  });


}

/* ---------------------------------------------------------
Clear workspace
--------------------------------------------------------- */

function clearWorkspace() {
const title = document.getElementById("inc-title");
const summary = document.getElementById("inc-summary");
const score = document.getElementById("inc-score");
const rca = document.getElementById("rca-nodes-container");
const timeline = document.getElementById("inc-events-timeline");


if (title) title.textContent = "No incident selected";
if (summary) {
  summary.textContent =
    "Select an incident when forensic correlation becomes available.";
}
if (score) score.textContent = "--";
if (rca) rca.innerHTML = "";
if (timeline) timeline.innerHTML = "";


}

/* ---------------------------------------------------------
PDF report
--------------------------------------------------------- */

async function downloadReport() {
const id = fileId();


try {
  if (window.showToast) {
    window.showToast("Generating forensic PDF report...", "info");
  }

  const response = await fetch(`/reports/generate/${id}`, {
    method: "POST",
    credentials: "same-origin"
  });

  if (!response.ok) {
    throw new Error(`Report generation failed: ${response.status}`);
  }

  const blob = await response.blob();

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `Forensic_Report_File_${id}.pdf`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  if (window.showToast) {
    window.showToast(
      "Forensic PDF report downloaded",
      "success"
    );
  }
} catch (error) {
  console.error("Report generation failed:", error);

  if (window.showToast) {
    window.showToast(
      "Unable to generate forensic report",
      "error"
    );
  }
}


}

/* ---------------------------------------------------------
Global handlers
--------------------------------------------------------- */

window.selectIncident = selectIncident;
window.downloadReport = downloadReport;
window.loadIncidents = fetchIncidents;

/* ---------------------------------------------------------
Initialisation
--------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
fetchIncidents();
});

})();
