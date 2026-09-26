/* =========================================================
   ML ANALYSIS PAGE
   app/static/js/ml_analysis.js
========================================================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initializeMLAnalysis();
  });

  function initializeMLAnalysis() {
    initializeScoreBars();
    initializeStatCounters();
    initializeTableInteractions();
    initializeFileSelector();
  }

  /* =====================================================
     SCORE BARS
  ===================================================== */

  function initializeScoreBars() {
    const fills = document.querySelectorAll(
      ".score-bar-fill, .ml-score-fill, .progress-fill"
    );

    fills.forEach(function (fill) {
      const width = fill.dataset.width !== undefined
        ? `${fill.dataset.width}%`
        : fill.style.width;

      if (!width) {
        return;
      }

      if (fill.dataset.color) {
        fill.style.backgroundColor = fill.dataset.color;
      }

      fill.style.width = "0%";

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          fill.style.width = width;
        });
      });
    });
  }

  /* =====================================================
     STAT COUNTERS
  ===================================================== */

  function initializeStatCounters() {
    const counters = document.querySelectorAll("[data-count]");

    counters.forEach(function (counter) {
      const target = Number(counter.dataset.count);

      if (!Number.isFinite(target) || target < 0) {
        return;
      }

      animateCounter(counter, target);
    });
  }

  function animateCounter(element, target) {
    const duration = 700;
    const start = performance.now();

    function update(now) {
      const progress = Math.min((now - start) / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);

      element.textContent = value.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  /* =====================================================
     FILE SELECTOR
  ===================================================== */

  function initializeFileSelector() {
    const selector = document.querySelector(
      'select[name="file_id"]'
    );

    if (!selector) {
      return;
    }

    selector.addEventListener("change", function () {
      const form = selector.closest("form");

      if (!form) {
        return;
      }

      form.classList.add("is-loading");

      selector.disabled = true;

      form.submit();
    });
  }

  /* =====================================================
     TABLE INTERACTIONS
  ===================================================== */

  function initializeTableInteractions() {
    const rows = document.querySelectorAll(
      ".ml-threats-table tbody tr, .table-container tbody tr"
    );

    rows.forEach(function (row) {
      row.addEventListener("mouseenter", function () {
        row.classList.add("row-active");
      });

      row.addEventListener("mouseleave", function () {
        row.classList.remove("row-active");
      });
    });
  }

  /* =====================================================
     PUBLIC HELPERS
  ===================================================== */

  window.MLAnalysis = {
    refreshScores: initializeScoreBars
  };
})();