const palette = ["#16d9e7", "#8b6cff", "#ff5d73", "#f0b94b", "#3e8cff", "#49d49d"];
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
    options: { ...chartDefaults, cutout: "68%", plugins: { legend: { position: "right", labels: { boxWidth: 10, usePointStyle: true } } } }
  });
}

async function loadDashboard() {
  const [summary, risks, sources, mitre, trend, ips] = await Promise.all([
    getJSON("/api/dashboard/summary"),
    getJSON("/api/dashboard/risk-distribution"),
    getJSON("/api/dashboard/log-sources"),
    getJSON("/api/dashboard/mitre-stats"),
    getJSON("/api/dashboard/error-trends"),
    getJSON("/api/dashboard/top-risky-ips")
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
}

loadDashboard().catch(console.error);
