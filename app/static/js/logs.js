const page = document.getElementById("evidencePage");
const fileId = page.dataset.fileId;
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
async function loadAnalysis() {
  const data = await fetch(`/api/v1/uploads/${fileId}`).then(r => r.json());
  document.getElementById("evidenceName").textContent = data.file_name;
  document.getElementById("evidenceMeta").textContent = `${data.total_records} records · analyzed ${new Date(data.upload_time).toLocaleString()}`;
  const quality = data.quality || {quality_score:0, health_score:0};
  document.getElementById("qualityScore").textContent = quality.quality_score;
  document.getElementById("healthScore").textContent = quality.health_score;
  document.getElementById("qualityMeter").style.width = `${quality.quality_score}%`;
  document.getElementById("healthMeter").style.width = `${quality.health_score}%`;
  document.getElementById("riskCount").textContent = data.risk_count;
  document.getElementById("incidentCount").textContent = `${data.incident_count} correlated incidents`;
  document.getElementById("trustScore").textContent = data.forensic_trust.score;
}
async function loadLogs() {
  const form = document.getElementById("logFilters");
  const query = new URLSearchParams(new FormData(form)); query.set("file_id", fileId);
  const data = await fetch(`/api/v1/logs/filter?${query}`).then(r => r.json());
  const select = document.getElementById("sourceSelect");
  if (select.options.length === 1) Object.keys(data.source_counts).forEach(source => select.add(new Option(source, source)));
  document.getElementById("sourcePivot").innerHTML = Object.entries(data.source_counts).map(([source,count]) => `<span class="source-badge">${esc(source)} · ${count}</span>`).join("");
  document.getElementById("logRows").innerHTML = data.logs.length ? data.logs.map(log => `<tr><td class="mono">${esc(log.timestamp ? new Date(log.timestamp).toLocaleString() : "Unknown")}</td><td><span class="source-badge">${esc(log.log_source_type)}</span></td><td class="mono">${esc(log.source_ip || "—")}</td><td><strong>${esc(`${log.method || ""} ${log.endpoint || log.event_type || "Log event"}`.trim())}</strong><small>${esc(log.message || "")}</small></td><td>${esc(log.status_code || "—")}</td><td>${log.response_time == null ? "—" : `${Math.round(log.response_time)} ms`}</td><td>${log.risk ? `<span class="severity ${esc(log.risk.severity.toLowerCase())}">${esc(log.risk.severity)}</span><small>${esc(log.risk.risk_category)}</small>` : '<span class="severity safe">Observed</span>'}</td></tr>`).join("") : '<tr><td colspan="7" class="table-empty">No records match the current pivot.</td></tr>';
}
document.getElementById("logFilters").addEventListener("submit", event => { event.preventDefault(); loadLogs(); });
Promise.all([loadAnalysis(), loadLogs()]).catch(console.error);
