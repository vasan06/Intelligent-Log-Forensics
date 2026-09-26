/* =========================================================
   ANALYZE PAGE
   Intelligent Log Forensics
========================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", initAnalyze);

  function initAnalyze() {
    initFilterForm();
    initSearch();
    initPanelInteractions();
    initAutoScroll();
    initKeyboardShortcuts();
    initQualityBars();
  }

  function initQualityBars() {
    document.querySelectorAll(".metric-quality-track [data-width]").forEach((bar) => {
      bar.style.width = `${bar.dataset.width}%`;
    });
  }

  /* -------------------------------------------------------
     FILTER FORM
  ------------------------------------------------------- */

  function initFilterForm() {
    const forms = document.querySelectorAll(
      '.analyze-page form, form[action*="analyze"]'
    );

    forms.forEach((form) => {
      form.addEventListener("submit", function () {
        const submitButton = form.querySelector(
          'button[type="submit"]'
        );

        if (!submitButton) return;

        submitButton.dataset.originalText =
          submitButton.innerHTML;

        submitButton.disabled = true;
        submitButton.style.opacity = "0.7";

        submitButton.innerHTML = `
          <span class="analyze-loading-dot"></span>
          Applying...
        `;
      });
    });
  }

  /* -------------------------------------------------------
     SEARCH
  ------------------------------------------------------- */

  function initSearch() {
    const searchInputs = document.querySelectorAll(
      'input[name="q"]'
    );

    searchInputs.forEach((input) => {
      let timer = null;

      input.addEventListener("input", function () {
        clearTimeout(timer);

        input.classList.toggle(
          "has-value",
          input.value.trim().length > 0
        );

        timer = setTimeout(() => {
          input.dispatchEvent(
            new CustomEvent("analyze:search-change", {
              detail: {
                value: input.value.trim()
              }
            })
          );
        }, 250);
      });

      input.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          input.value = "";
          input.classList.remove("has-value");
          input.focus();
        }
      });
    });
  }

  /* -------------------------------------------------------
     PANEL INTERACTIONS
  ------------------------------------------------------- */

  function initPanelInteractions() {
    const panels = document.querySelectorAll(
      ".analyze-page .card"
    );

    panels.forEach((panel) => {
      const scrollArea = panel.querySelector(
        '[style*="overflow-y"], .threat-list, .log-records'
      );

      if (!scrollArea) return;

      scrollArea.addEventListener("scroll", function () {
        panel.classList.toggle(
          "is-scrolling",
          scrollArea.scrollTop > 5
        );
      });
    });
  }

  /* -------------------------------------------------------
     AUTO SCROLL
  ------------------------------------------------------- */

  function initAutoScroll() {
    const containers = document.querySelectorAll(
      ".analyze-page .threat-list, " +
      ".analyze-page .log-records"
    );

    containers.forEach((container) => {
      container.addEventListener("wheel", function (event) {
        if (
          container.scrollHeight <=
          container.clientHeight
        ) {
          return;
        }

        event.stopPropagation();
      });
    });
  }

  /* -------------------------------------------------------
     KEYBOARD SHORTCUTS
  ------------------------------------------------------- */

  function initKeyboardShortcuts() {
    document.addEventListener("keydown", function (event) {
      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "k"
      ) {
        const search = document.querySelector(
          'input[name="q"]'
        );

        if (!search) return;

        event.preventDefault();
        search.focus();
        search.select();
      }
    });
  }

  /* -------------------------------------------------------
     LOADING STYLE
  ------------------------------------------------------- */

  const style = document.createElement("style");

  style.textContent = `
    .analyze-loading-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 7px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      vertical-align: -1px;
      animation: analyzeSpin .65s linear infinite;
    }

    .analyze-page .card.is-scrolling {
      box-shadow:
        0 10px 34px rgba(15, 23, 42, .07);
    }

    .analyze-page input.has-value {
      border-color: rgba(37, 99, 235, .45);
    }

    @keyframes analyzeSpin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  document.head.appendChild(style);

})();