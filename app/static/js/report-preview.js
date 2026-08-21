const reportPage = document.getElementById("reportPage");
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
fetch(`/api/v1/uploads/${reportPage.dataset.fileId}`).then(r => r.json()).then(data => {
  document.getElementById("reportFile").textContent = data.file_name;
  document.getElementById("reportLogs").textContent = data.total_records;
  document.getElementById("reportQuality").textContent = Math.round(data.quality?.quality_score || 0);
  document.getElementById("reportHealth").textContent = Math.round(data.quality?.health_score || 0);
  document.getElementById("reportIncidents").textContent = data.incident_count;
  document.getElementById("executiveSummary").textContent = `The analysis identified ${data.risk_count} risk event(s) across ${data.total_records} normalized log records. ${data.incident_count} incident timeline(s) were reconstructed for investigation.`;
  document.getElementById("reportFindings").innerHTML = data.risks.length ? data.risks.map(risk => `<div class="finding"><span class="severity ${esc(risk.severity.toLowerCase())}">${esc(risk.severity)}</span><div><strong>${esc(risk.risk_category)} · ${Math.round(risk.risk_score)}/100</strong><p>${esc(risk.reason)}</p>${risk.mitre_mapping ? `<span class="mitre-tag">${esc(risk.mitre_mapping.tactic)} · ${esc(risk.mitre_mapping.technique_id)} ${esc(risk.mitre_mapping.technique_name)}</span>` : ""}<p class="recommendation"><b>Suggested action:</b> ${esc(risk.recommendation)}</p></div></div>`).join("") : '<p>No prioritized findings were detected.</p>';
}).catch(console.error);
