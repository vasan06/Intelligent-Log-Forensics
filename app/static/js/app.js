/* Global Application Workstation Scripts */
(function () {
  // Theme Toggle Handler
  window.toggleTheme = function () {
    const current = document.documentElement.dataset.theme || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("lf-theme", next);
  };

  // Toast System
  window.showToast = function (message, kind = "info") {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${kind}`;
    toast.innerHTML = `
      <span style="font-weight:700; color:${kind === 'error' ? 'var(--critical)' : kind === 'success' || kind === 'ok' ? 'var(--ok)' : 'var(--accent)'}">●</span>
      <span style="flex:1;">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.2s ease";
      setTimeout(() => toast.remove(), 200);
    }, 4000);
  };

  // Digital Clock
  function updateClock() {
    const clockTime = document.getElementById("clock-time");
    const clockDate = document.getElementById("clock-date");
    if (clockTime && clockDate) {
      const now = new Date();
      clockTime.textContent = now.toLocaleTimeString("en-GB");
      clockDate.textContent = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }

  // Session User Metadata Fetch
  function fetchUserSession() {
    fetch("/api/v1/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => {
        if (!user) return;
        document.querySelectorAll(".user-initial").forEach((el) => (el.textContent = user.name.charAt(0).toUpperCase()));
        document.querySelectorAll(".user-name").forEach((el) => (el.textContent = user.name));
        document.querySelectorAll(".user-role").forEach((el) => (el.textContent = user.role.toUpperCase()));
      })
      .catch(() => {});
  }

  // Live SSE Stream Listener
  function initLiveStream() {
    if (!window.EventSource) return;
    try {
      const sse = new EventSource("/api/v1/stream/live");
      sse.addEventListener("risk", (e) => {
        try {
          const data = JSON.parse(e.data);
          showToast(`Live Threat Signal: ${data.category || 'Anomaly'} · Score ${data.score}`, data.severity === 'critical' ? 'error' : 'info');
        } catch (_) {}
      });
    } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateClock();
    setInterval(updateClock, 1000);
    fetchUserSession();
    initLiveStream();
  });
})();

