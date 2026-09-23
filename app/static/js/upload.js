/* Upload & SIEM stream controls */
function fetchGeneratorStatus() {
  fetch('/api/v1/generator/status')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) return;
      const badge = document.getElementById('gen-status-badge');
      const stopBtn = document.getElementById('btn-stop-gen');

      if (badge) {
        badge.textContent = data.running ? `ACTIVE (${data.mode.toUpperCase()})` : 'READY';
        badge.className = data.running ? 'badge badge-ok' : 'badge badge-default';
      }

      if (stopBtn) {
        stopBtn.style.display = data.running ? 'block' : 'none';
      }
    })
    .catch(() => {});
}

function startGenerator(mode) {
  fetch('/api/v1/generator/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && window.showToast) window.showToast(`Started SIEM stream in ${mode} mode`, 'ok');
      fetchGeneratorStatus();
    });
}

function stopGenerator() {
  fetch('/api/v1/generator/stop', { method: 'POST' })
    .then((res) => (res.ok ? res.json() : null))
    .then(() => {
      if (window.showToast) window.showToast('Stopped SIEM stream', 'info');
      fetchGeneratorStatus();
    });
}

document.addEventListener('DOMContentLoaded', () => {
  fetchGeneratorStatus();
});
