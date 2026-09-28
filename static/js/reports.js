/* =========================================================
   REPORTS PAGE
   app/static/js/pages/reports.js
========================================================= */

(function () {
  "use strict";

  function initializeReportsPage() {
    const form = document.getElementById("report-generator-form");
    const button = document.getElementById("generate-report-btn");

    if (!form || !button) {
      return;
    }

    initializeReportTypeSelection();
    initializeReportSubmit(form, button);
  }

  /* =======================================================
     REPORT TYPE SELECTION
  ======================================================= */

  function initializeReportTypeSelection() {
    const options = document.querySelectorAll(".report-type-option");

    if (!options.length) {
      return;
    }

    options.forEach(function (option) {
      const input = option.querySelector('input[type="radio"]');

      if (!input) {
        return;
      }

      input.addEventListener("change", function () {
        updateReportTypeState(options);
      });
    });

    updateReportTypeState(options);
  }

  function updateReportTypeState(options) {
    options.forEach(function (option) {
      const input = option.querySelector('input[type="radio"]');

      if (!input) {
        return;
      }

      option.classList.toggle("is-selected", input.checked);
    });
  }

  /* =======================================================
     FORM SUBMISSION
  ======================================================= */

  function initializeReportSubmit(form, button) {
    let submitting = false;

    form.addEventListener("submit", function (event) {
      if (submitting) {
        event.preventDefault();
        return;
      }

      const fileSelect = document.getElementById("report-file");

      if (!validateReportForm(fileSelect)) {
        event.preventDefault();
        return;
      }

      submitting = true;

      button.classList.add("is-loading");
      button.disabled = true;

      const label = button.querySelector("span");

      if (label) {
        label.textContent = "Generating Report...";
      }
    });
  }

  /* =======================================================
     VALIDATION
  ======================================================= */

  function validateReportForm(fileSelect) {
    const selectedType = document.querySelector(
      'input[name="report_type"]:checked'
    );

    if (!selectedType) {
      showReportMessage(
        "Please select a report type before generating the report.",
        "warning"
      );

      return false;
    }

    if (fileSelect && fileSelect.value === "") {
      /*
       * Empty file selection is intentionally allowed.
       * Backend generates a summary report for all analyzed files.
       */
      return true;
    }

    return true;
  }

  /* =======================================================
     MESSAGE
  ======================================================= */

  function showReportMessage(message, type) {
    const existing = document.querySelector(".report-js-message");

    if (existing) {
      existing.remove();
    }

    const messageEl = document.createElement("div");

    messageEl.className = "alert alert-" + (type || "info") +
      " report-js-message";

    messageEl.textContent = message;

    const form = document.getElementById("report-generator-form");

    if (form) {
      form.parentNode.insertBefore(messageEl, form);
    }

    window.setTimeout(function () {
      if (messageEl && messageEl.parentNode) {
        messageEl.remove();
      }
    }, 4000);
  }

  /* =======================================================
     INITIALIZE
  ======================================================= */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeReportsPage
    );
  } else {
    initializeReportsPage();
  }

})();