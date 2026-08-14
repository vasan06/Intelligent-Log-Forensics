const palette = ["#16d9e7", "#8b6cff", "#ff5d73", "#f0b94b", "#3e8cff", "#49d49d"];
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
const chartDefaults = {
  plugins: { legend: { display: false } },
  responsive: true,
  maintainAspectRatio: false
};

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json();
}

function doughnut(canvas, data, emptyId) {
  const labels = Object.keys(data);
  document.getElementById(emptyId).hidden = labels.length > 0;
  canvas.hidden = labels.length === 0;
  if (!labels.length) return;
  new Chart(canvas, {
    type: "doughnut",
    data: { labels, datasets: [{ data: Object.values(data), backgroundColor: palette, borderWidth: 0 }] },
    options: { ...chartDefaults, cutout: "68%", onClick: (_event, active, chart) => {
      const dataset = chart.data.datasets[0];
      dataset.backgroundColor = dataset._originalColors || [...dataset.backgroundColor];
      dataset._originalColors = [...dataset.backgroundColor];
      if (active.length) dataset.backgroundColor = dataset._originalColors.map((color, index) => index === active[0].index ? color : `${color}33`);
      chart.update();
    }, plugins: { legend: { position: "right", labels: { boxWidth: 10, usePointStyle: true } } } }
  });
}

async function loadDashboard() {
  const [summary, risks, sources, mitre, trend, ips] = await Promise.all([
    getJSON("/api/v1/dashboard/summary"),
    getJSON("/api/v1/dashboard/risk-distribution"),
    getJSON("/api/v1/dashboard/log-sources"),
    getJSON("/api/v1/dashboard/mitre-stats"),
    getJSON("/api/v1/dashboard/error-trends"),
    getJSON("/api/v1/dashboard/top-risky-ips")
  ]);
  document.getElementById("totalLogs").textContent = summary.total_logs.toLocaleString();
  document.getElementById("riskEvents").textContent = summary.risk_events.toLocaleString();
  document.getElementById("incidentCount").textContent = summary.incidents.toLocaleString();
  document.getElementById("averageRisk").textContent = summary.average_risk;
  doughnut(document.getElementById("riskChart"), risks, "riskEmpty");
  doughnut(document.getElementById("sourceChart"), sources, "sourceEmpty");
  doughnut(document.getElementById("mitreChart"), mitre, "mitreEmpty");
  new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: { labels: trend.labels.map(value => value.slice(5)), datasets: [{ data: trend.values, borderColor: "#16d9e7", backgroundColor: "rgba(22,217,231,.1)", fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: "#8b6cff" }] },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }
  });
  const list = document.getElementById("riskyIps");
  if (ips.length) list.innerHTML = ips.map((item, index) => `<div><b>${index + 1}</b><span><strong>${item.ip}</strong><small>${item.events} events</small></span><em>${item.score}</em></div>`).join("");
  const uploads = await getJSON("/api/v1/uploads?limit=6");
  document.getElementById("recentUploads").innerHTML = uploads.length ? uploads.map(item => `<tr><td><strong>${escapeHTML(item.file_name)}</strong><small>${escapeHTML(item.file_type.toUpperCase())} · ${(item.file_size/1024).toFixed(1)} KB</small></td><td><span class="status ${escapeHTML(item.processing_status)}">${escapeHTML(item.processing_status)}</span></td><td>${item.total_records}</td><td>${new Date(item.upload_time).toLocaleString()}</td><td><a class="icon-button" href="/logs/${item.id}">Open</a></td></tr>`).join("") : '<tr><td colspan="5" class="table-empty">No evidence analyzed yet.</td></tr>';
}

loadDashboard().catch(console.error);

const liveSource = new EventSource("/api/v1/stream/live");
liveSource.addEventListener("risk", event => {
  const risk = JSON.parse(event.data);
  const feed = document.getElementById("liveIncidentFeed");
  if (feed.querySelector(".empty-copy")) feed.innerHTML = "";
  const row = document.createElement("div");
  const label = document.createElement("strong"); label.textContent = `${risk.severity}: ${risk.category}`;
  const detail = document.createElement("small"); detail.textContent = `${risk.source_ip || "unknown source"} · score ${risk.score}`;
  row.append(label, detail); feed.prepend(row);
  while (feed.children.length > 12) feed.lastElementChild.remove();
  getJSON("/api/v1/dashboard/summary").then(summary => {
    document.getElementById("totalLogs").textContent = summary.total_logs.toLocaleString();
    document.getElementById("riskEvents").textContent = summary.risk_events.toLocaleString();
    document.getElementById("incidentCount").textContent = summary.incidents.toLocaleString();
    document.getElementById("averageRisk").textContent = summary.average_risk;
  }).catch(console.error);
});
