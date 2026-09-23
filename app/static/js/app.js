/* ==========================================================================
Intelligent Log Forensics
Global Workstation Runtime
File: app/static/js/app.js
--------------------------

Responsibilities:

* Theme persistence
* Global toast notifications
* Workstation clock
* Authenticated user metadata
* Live SSE threat stream
* Global Lucide icon refresh
* Small shared UI utilities

Keep page-specific API logic inside its own JS file.
========================================================================== */

(function () {
"use strict";

/* ------------------------------------------------------------------------
Configuration
------------------------------------------------------------------------ */

const CONFIG = {
themeKey: "lf-theme",
userEndpoint: "/api/v1/auth/me",
liveStreamEndpoint: "/api/v1/stream/live",
toastDuration: 4200,
clockInterval: 1000,
};

/* ------------------------------------------------------------------------
Theme
------------------------------------------------------------------------ */

function getStoredTheme() {
const saved = localStorage.getItem(CONFIG.themeKey);


if (saved === "dark" || saved === "light") {
  return saved;
}

return window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";


}

function applyTheme(theme) {
const normalized = theme === "dark" ? "dark" : "light";


document.documentElement.dataset.theme = normalized;
localStorage.setItem(CONFIG.themeKey, normalized);

updateThemeControls(normalized);


}

function updateThemeControls(theme) {
document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
const icon = button.querySelector("[data-lucide]");


  if (icon) {
    icon.setAttribute(
      "data-lucide",
      theme === "dark" ? "sun" : "moon"
    );
  }

  button.setAttribute(
    "aria-label",
    theme === "dark"
      ? "Switch to light theme"
      : "Switch to dark theme"
  );

  button.setAttribute(
    "title",
    theme === "dark"
      ? "Switch to light theme"
      : "Switch to dark theme"
  );
});

refreshIcons();


}

window.toggleTheme = function () {
const current =
document.documentElement.dataset.theme ||
getStoredTheme();


applyTheme(current === "dark" ? "light" : "dark");


};

/* ------------------------------------------------------------------------
Toast Notification System
------------------------------------------------------------------------ */

function getToastContainer() {
let container = document.querySelector(".toast-container");


if (!container) {
  container = document.createElement("div");
  container.className = "toast-container";
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-atomic", "false");

  document.body.appendChild(container);
}

return container;


}

function escapeHTML(value) {
const div = document.createElement("div");
div.textContent = value == null ? "" : String(value);
return div.innerHTML;
}

window.showToast = function (message, kind = "info") {
const container = getToastContainer();


const allowedKinds = [
  "info",
  "success",
  "ok",
  "warning",
  "error",
  "critical",
];

const toastKind = allowedKinds.includes(kind)
  ? kind
  : "info";

const iconMap = {
  success: "check-circle-2",
  ok: "check-circle-2",
  warning: "triangle-alert",
  error: "circle-x",
  critical: "shield-alert",
  info: "info",
};

const toast = document.createElement("div");

toast.className = `toast toast-${toastKind}`;
toast.setAttribute("role", "status");

toast.innerHTML = `
  <span class="toast-icon" aria-hidden="true">
    <i data-lucide="${iconMap[toastKind]}"></i>
  </span>
  <span class="toast-message">${escapeHTML(message)}</span>
  <button
    type="button"
    class="toast-close"
    aria-label="Dismiss notification"
    title="Dismiss"
  >
    <i data-lucide="x"></i>
  </button>
`;

container.appendChild(toast);
refreshIcons();

const close = () => {
  if (toast.dataset.closing === "true") return;

  toast.dataset.closing = "true";
  toast.classList.add("toast-closing");

  setTimeout(() => {
    toast.remove();

    if (!container.children.length) {
      container.remove();
    }
  }, 220);
};

toast
  .querySelector(".toast-close")
  ?.addEventListener("click", close);

setTimeout(close, CONFIG.toastDuration);


};

/* ------------------------------------------------------------------------
Workstation Clock
------------------------------------------------------------------------ */

function updateClock() {
const clockTime = document.getElementById("clock-time");
const clockDate = document.getElementById("clock-date");


if (!clockTime && !clockDate) {
  return;
}

const now = new Date();

if (clockTime) {
  clockTime.textContent = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

if (clockDate) {
  clockDate.textContent = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


}

/* ------------------------------------------------------------------------
User Session
------------------------------------------------------------------------ */

async function fetchUserSession() {
try {
const response = await fetch(CONFIG.userEndpoint, {
method: "GET",
credentials: "same-origin",
headers: {
Accept: "application/json",
},
});


  if (!response.ok) {
    return;
  }

  const user = await response.json();

  if (!user || typeof user !== "object") {
    return;
  }

  const name =
    user.name ||
    user.full_name ||
    user.username ||
    "User";

  const role = user.role || "user";

  document.querySelectorAll(".user-initial").forEach((element) => {
    element.textContent = name
      .trim()
      .charAt(0)
      .toUpperCase() || "U";
  });

  document.querySelectorAll(".user-name").forEach((element) => {
    element.textContent = name;
  });

  document.querySelectorAll(".user-role").forEach((element) => {
    element.textContent = String(role).toUpperCase();
  });

  document.documentElement.dataset.userRole = String(role).toLowerCase();
} catch (_) {
  // Session endpoint failure should never break the workstation UI.
}


}

/* ------------------------------------------------------------------------
Live Security Event Stream
------------------------------------------------------------------------ */

let liveStream = null;

function initLiveStream() {
if (!window.EventSource) {
return;
}


if (!document.body) {
  return;
}

try {
  liveStream = new EventSource(
    CONFIG.liveStreamEndpoint,
    {
      withCredentials: true,
    }
  );

  liveStream.addEventListener("risk", (event) => {
    try {
      const data = JSON.parse(event.data || "{}");

      const category =
        data.category ||
        data.type ||
        "Anomaly";

      const score =
        data.score !== undefined &&
        data.score !== null
          ? ` · Score ${data.score}`
          : "";

      const severity =
        String(data.severity || "").toLowerCase();

      const kind =
        severity === "critical" ||
        severity === "high"
          ? "error"
          : severity === "medium"
            ? "warning"
            : "info";

      window.showToast(
        `Live Threat Signal: ${category}${score}`,
        kind
      );

      window.dispatchEvent(
        new CustomEvent("lf:risk", {
          detail: data,
        })
      );
    } catch (_) {
      // Ignore malformed SSE payloads.
    }
  });

  liveStream.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data || "{}");

      window.dispatchEvent(
        new CustomEvent("lf:stream-event", {
          detail: data,
        })
      );
    } catch (_) {
      // Non-JSON stream messages are intentionally ignored.
    }
  });

  liveStream.onerror = () => {
    /*
     * EventSource automatically retries.
     * Do not show an error toast here because temporary
     * network reconnects are normal for long-lived SSE streams.
     */
  };
} catch (_) {
  liveStream = null;
}


}

/* ------------------------------------------------------------------------
Lucide Icons
------------------------------------------------------------------------ */

function refreshIcons() {
if (
window.lucide &&
typeof window.lucide.createIcons === "function"
) {
window.lucide.createIcons();
}
}

window.refreshIcons = refreshIcons;

/* ------------------------------------------------------------------------
Shared UI Helpers
------------------------------------------------------------------------ */

window.lf = window.lf || {};

window.lf.escapeHTML = escapeHTML;

window.lf.formatNumber = function (value) {
const number = Number(value);


if (!Number.isFinite(number)) {
  return "0";
}

return number.toLocaleString();


};

window.lf.formatPercent = function (value, decimals = 0) {
const number = Number(value);


if (!Number.isFinite(number)) {
  return "--";
}

return `${number.toFixed(decimals)}%`;


};

window.lf.debounce = function (callback, delay = 250) {
let timer;


return function (...args) {
  clearTimeout(timer);

  timer = setTimeout(() => {
    callback.apply(this, args);
  }, delay);
};


};

window.lf.safeJSON = function (value, fallback = null) {
try {
return JSON.parse(value);
} catch (_) {
return fallback;
}
};

/* ------------------------------------------------------------------------
Global Keyboard Behavior
------------------------------------------------------------------------ */

function initKeyboardBehavior() {
document.addEventListener("keydown", (event) => {
if (event.key === "Escape") {
document
.querySelectorAll(".toast")
.forEach((toast) => {
toast.remove();
});
}
});
}

/* ------------------------------------------------------------------------
Theme Toggle Delegation
------------------------------------------------------------------------ */

function initThemeControls() {
document.addEventListener("click", (event) => {
const toggle = event.target.closest("[data-theme-toggle]");


  if (!toggle) {
    return;
  }

  event.preventDefault();
  window.toggleTheme();
});


}

/* ------------------------------------------------------------------------
Application Bootstrap
------------------------------------------------------------------------ */

function init() {
applyTheme(
document.documentElement.dataset.theme ||
getStoredTheme()
);


updateClock();

window.setInterval(
  updateClock,
  CONFIG.clockInterval
);

fetchUserSession();
initLiveStream();
initKeyboardBehavior();
initThemeControls();

requestAnimationFrame(refreshIcons);

/*
 * Notify page-specific modules that the global runtime
 * is ready. Existing JS files can listen without depending
 * on initialization order.
 */
window.dispatchEvent(
  new CustomEvent("lf:ready")
);


}

if (document.readyState === "loading") {
document.addEventListener(
"DOMContentLoaded",
init,
{ once: true }
);
} else {
init();
}

})();
