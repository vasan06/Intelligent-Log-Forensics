avascript
/* =========================================================
   INCIDENT MANAGEMENT
   Intelligent Log Forensics
========================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", initializeIncidents);

  function initializeIncidents() {
    initializeIncidentRows();
    initializeFilters();
    initializeKeyboardNavigation();
  }


  /* -------------------------------------------------------
     INCIDENT ROWS
  ------------------------------------------------------- */

  function initializeIncidentRows() {
    const rows = document.querySelectorAll(".incident-row");

    rows.forEach((row) => {
      if (row.dataset.animationDelay) {
        row.style.animationDelay = `${row.dataset.animationDelay}s`;
      }

      const titleLink = row.querySelector(".incident-title-link");
      const viewButton = row.querySelector(".incident-view-btn");

      if (!titleLink && !viewButton) {
        return;
      }

      row.addEventListener("click", function (event) {
        /*
         * Do not interfere with normal links/buttons.
         */
        if (
          event.target.closest("a") ||
          event.target.closest("button") ||
          event.target.closest("select") ||
          event.target.closest("input")
        ) {
          return;
        }

        if (titleLink) {
          titleLink.click();
        }
      });

      row.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        if (
          event.target.closest("a") ||
          event.target.closest("button") ||
          event.target.closest("select") ||
          event.target.closest("input")
        ) {
          return;
        }

        event.preventDefault();

        if (titleLink) {
          titleLink.click();
        }
      });

      /*
       * Make the row keyboard accessible.
       */
      row.setAttribute("tabindex", "0");
      row.setAttribute("role", "link");
    });
  }


  /* -------------------------------------------------------
     FILTERS
  ------------------------------------------------------- */

  function initializeFilters() {
    const form = document.querySelector(".incidents-filter-form");

    if (!form) {
      return;
    }

    const statusSelect = form.querySelector(
      'select[name="status"]'
    );

    const severitySelect = form.querySelector(
      'select[name="severity"]'
    );

    /*
     * Prevent accidental duplicate submissions.
     */
    let submitting = false;

    form.addEventListener("submit", function () {
      if (submitting) {
        return;
      }

      submitting = true;

      if (statusSelect) {
        statusSelect.disabled = false;
      }

      if (severitySelect) {
        severitySelect.disabled = false;
      }
    });

    /*
     * Show a subtle loading state when a filter changes.
     */
    [statusSelect, severitySelect].forEach((select) => {
      if (!select) {
        return;
      }

      select.addEventListener("change", function () {
        if (submitting) {
          return;
        }

        const card = document.querySelector(
          ".incidents-filter-card"
        );

        if (card) {
          card.classList.add("is-filtering");
        }

        form.requestSubmit();
      });
    });
  }


  /* -------------------------------------------------------
     KEYBOARD NAVIGATION
  ------------------------------------------------------- */

  function initializeKeyboardNavigation() {
    document.addEventListener("keydown", function (event) {
      /*
       * Escape returns focus to the filter area.
       */
      if (event.key !== "Escape") {
        return;
      }

      const activeElement = document.activeElement;

      if (
        activeElement &&
        (
          activeElement.matches("select") ||
          activeElement.matches("input")
        )
      ) {
        activeElement.blur();
      }
    });
  }


  /* -------------------------------------------------------
     PUBLIC PAGE API
  ------------------------------------------------------- */

  window.IncidentPage = {
    refresh: function () {
      window.location.reload();
    },

    clearFilters: function () {
      const url = new URL(window.location.href);

      url.searchParams.delete("status");
      url.searchParams.delete("severity");

      window.location.href = url.toString();
    }
  };

})();
