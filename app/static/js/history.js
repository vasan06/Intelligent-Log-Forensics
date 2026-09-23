/* ============================================================
   Evidence Archive History
   Backend-connected history workstation
   ============================================================ */

(function () {
  "use strict";

  const API_URL = "/api/v1/uploads?limit=100";

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return esc(value);
    }

    return date.toLocaleString();
  }

  function getStatusClass(status) {
    const normalized = String(status || "").toLowerCase();

    if (
      normalized.includes("complete") ||
      normalized.includes("success") ||
      normalized.includes("processed")
    ) {
      return "badge-ok";
    }

    if (
      normalized.includes("fail") ||
      normalized.includes("error")
    ) {
      return "badge-critical";
    }

    if (
      normalized.includes("process") ||
      normalized.includes("pending") ||
      normalized.includes("queue")
    ) {
      return "badge-high";
    }

    return "badge-default";
  }

  function getTrustScore(upload) {
    const score = upload?.forensic_trust?.score;

    if (score === null || score === undefined || score === "") {
      return "—";
    }

    return `${Number(score).toFixed(1)}%`;
  }

  function renderEmpty(message) {
    const tbody = document.getElementById("history-tbody");

    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">
          ${esc(message)}
        </td>
      </tr>
    `;
  }

  function renderLoading() {
    const tbody = document.getElementById("history-tbody");

    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">
          <span style="display:inline-flex; align-items:center; gap:8px;">
            <i data-lucide="loader-circle" style="width:14px;"></i>
            Loading evidence archives...
          </span>
        </td>
      </tr>
    `;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function renderRows(uploads) {
    const tbody = document.getElementById("history-tbody");

    if (!tbody) return;

    if (!Array.isArray(uploads) || uploads.length === 0) {
      renderEmpty(
        "No evidence archives yet. Upload a dataset to start an investigation trail."
      );
      return;
    }

    tbody.innerHTML = uploads.map((upload) => {
      const id = Number(upload.id || 0);
      const status = upload.processing_status || "unknown";
      const riskCount = Number(upload.risk_count || 0);
      const incidentCount = Number(upload.incident_count || 0);
      const totalRecords = Number(upload.total_records || 0);

      return `
        <tr
          class="history-row"
          data-file-id="${id}"
          onclick="openEvidenceArchive(${id})"
          style="cursor:pointer;"
        >
          <td
            style="
              font-family:var(--font-mono);
              color:var(--text-muted);
              font-weight:700;
            "
          >
            #${id}
          </td>

          <td>
            <div
              style="
                display:flex;
                flex-direction:column;
                gap:3px;
              "
            >
              <strong
                style="
                  font-family:var(--font-mono);
                  color:var(--text-primary);
                  font-size:12px;
                "
              >
                ${esc(upload.file_name || "Unnamed file")}
              </strong>

              ${
                upload.file_type
                  ? `
                    <span
                      style="
                        font-family:var(--font-mono);
                        font-size:10px;
                        color:var(--text-muted);
                        text-transform:uppercase;
                      "
                    >
                      ${esc(upload.file_type)}
                    </span>
                  `
                  : ""
              }
            </div>
          </td>

          <td
            style="
              font-family:var(--font-mono);
              font-weight:700;
            "
          >
            ${formatNumber(totalRecords)}
          </td>

          <td>
            <span class="badge ${getStatusClass(status)}">
              ${esc(String(status).toUpperCase())}
            </span>
          </td>

          <td
            style="
              font-family:var(--font-mono);
              font-weight:800;
              color:var(--high);
            "
          >
            ${formatNumber(riskCount)}
          </td>

          <td
            style="
              font-family:var(--font-mono);
              font-weight:800;
              color:var(--mitre);
            "
          >
            ${formatNumber(incidentCount)}
          </td>

          <td
            style="
              font-family:var(--font-mono);
              font-weight:800;
              color:var(--accent);
            "
          >
            ${getTrustScore(upload)}
          </td>

          <td>
            <a
              href="/logs/${id}"
              class="btn btn-ghost btn-sm"
              style="font-family:var(--font-mono);"
              onclick="event.stopPropagation();"
            >
              Explore →
            </a>
          </td>
        </tr>
      `;
    }).join("");

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  async function fetchHistory() {
    renderLoading();

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`History request failed: ${response.status}`);
      }

      const data = await response.json();

      /*
       * Backend normally returns an array.
       * Keep this defensive in case the API wraps it.
       */
      const uploads = Array.isArray(data)
        ? data
        : Array.isArray(data.uploads)
          ? data.uploads
          : Array.isArray(data.items)
            ? data.items
            : [];

      renderRows(uploads);

    } catch (error) {
      console.error("[History] Failed to load evidence archives:", error);

      renderEmpty(
        "Evidence archive unavailable. Check authentication and backend connectivity, then retry."
      );
    }
  }

  window.openEvidenceArchive = function (fileId) {
    const id = Number(fileId);

    if (!Number.isFinite(id) || id <= 0) {
      return;
    }

    window.location.href = `/logs/${id}`;
  };

  document.addEventListener("DOMContentLoaded", () => {
    fetchHistory();
  });

})();