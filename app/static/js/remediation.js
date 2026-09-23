/* Remediation guidance without fabricated infrastructure data. */
const remediationPhases = [
  {
    phase: "01",
    title: "Contain",
    problem: "Risk events or incidents have been identified in uploaded evidence.",
    action: "Use the related log stream and incident timeline to isolate affected source IPs, users, endpoints, and sessions.",
    verify: "Re-run analysis after containment and confirm that matching risk events no longer recur.",
  },
  {
    phase: "02",
    title: "Correct",
    problem: "The backend may return recommendations on individual risk events.",
    action: "Apply recommendations shown in evidence details or the exported forensic report.",
    verify: "Confirm the same technique or risk category is absent from the refreshed dataset.",
  },
  {
    phase: "03",
    title: "Harden",
    problem: "Architecture relationship data is not currently exposed by the API.",
    action: "Document affected assets from evidence fields before making network, identity, or gateway changes.",
    verify: "Upload post-change logs and compare incident, risk, and quality metrics.",
  },
  {
    phase: "04",
    title: "Report",
    problem: "Users need a defensible record of evidence and reasoning.",
    action: "Generate the forensic PDF from the evidence archive after reviewing findings and MITRE mappings.",
    verify: "Ensure the report contains only backend-returned findings and recommendations.",
  },
];

function renderRemediationPlan() {
  const container = document.getElementById("remediation-phases");
  if (!container) return;
  container.innerHTML = remediationPhases.map((item) => `
    <div class="solution-step">
      <div class="solution-step-index">PHASE ${item.phase}</div>
      <h4>${item.title}</h4>
      <dl>
        <dt>Problem</dt><dd>${item.problem}</dd>
        <dt>Action</dt><dd>${item.action}</dd>
        <dt>Verify</dt><dd>${item.verify}</dd>
      </dl>
    </div>
  `).join("");
}

function renderArchitectureState() {
  const container = document.getElementById("arch-nodes-grid");
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state-inline" style="grid-column:1 / -1;">
      Architecture relationships are not exposed by the current backend API. No infrastructure nodes are rendered because the interface only shows real product data.
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  renderRemediationPlan();
  renderArchitectureState();
});
