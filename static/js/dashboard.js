/* =========================================================
   DASHBOARD
   Intelligent Log Forensics
========================================================= */

(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        initializeDashboard();
    });

    function initializeDashboard() {
        initializeDashboardData();
        animateCounters();
        animateProgressBars();
        animateSeverityBars();
        initializeReveal();
        initializeIncidentRows();
        initializeFileTable();
    }

    function initializeDashboardData() {
        const dataElement = document.getElementById("dashboard-data");

        if (dataElement) {
            window.DASHBOARD_DATA = JSON.parse(
                dataElement.dataset.dashboard || "{}"
            );
        }
    }


    /* =====================================================
       NUMBER COUNTERS
    ===================================================== */

    function animateCounters() {
        const counters = document.querySelectorAll("[data-count]");

        counters.forEach(function (counter) {
            const target = Number(counter.dataset.count);

            if (!Number.isFinite(target) || target <= 0) {
                return;
            }

            const duration = 900;
            const startTime = performance.now();

            function updateCounter(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                const eased = 1 - Math.pow(1 - progress, 3);
                const value = Math.floor(target * eased);

                counter.textContent = value.toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target.toLocaleString();
                }
            }

            counter.textContent = "0";
            requestAnimationFrame(updateCounter);
        });
    }


    /* =====================================================
       PROGRESS BARS
    ===================================================== */

    function animateProgressBars() {
        const bars = document.querySelectorAll(".progress-fill");

        bars.forEach(function (bar) {
            const originalWidth = bar.dataset.progress !== undefined
                ? `${bar.dataset.progress}%`
                : bar.style.width;

            if (!originalWidth) {
                return;
            }

            bar.style.width = "0%";
            bar.style.transition =
                "width 900ms cubic-bezier(0.22, 1, 0.36, 1)";

            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    bar.style.width = originalWidth;
                });
            });
        });
    }

    function animateSeverityBars() {
        document.querySelectorAll(".severity-bar [data-width]").forEach(function (bar) {
            const width = `${bar.dataset.width}%`;
            bar.style.width = "0%";
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    bar.style.width = width;
                });
            });
        });
    }


    /* =====================================================
       SCROLL REVEAL
    ===================================================== */

    function initializeReveal() {
        const elements = document.querySelectorAll(
            ".stat-card, .card, .table-container"
        );

        if (!elements.length) {
            return;
        }

        if (!("IntersectionObserver" in window)) {
            elements.forEach(function (element) {
                element.classList.add("dashboard-visible");
            });
            return;
        }

        const observer = new IntersectionObserver(
            function (entries, obs) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.classList.add("dashboard-visible");
                    obs.unobserve(entry.target);
                });
            },
            {
                threshold: 0.08,
                rootMargin: "0px 0px -30px 0px"
            }
        );

        elements.forEach(function (element) {
            element.classList.add("dashboard-reveal");
            observer.observe(element);
        });
    }


    /* =====================================================
       INCIDENT ROW INTERACTION
    ===================================================== */

    function initializeIncidentRows() {
        const incidentLinks = document.querySelectorAll(
            'a[href*="incident_detail"]'
        );

        incidentLinks.forEach(function (item) {
            item.addEventListener("mouseenter", function () {
                item.classList.add("incident-hover");
            });

            item.addEventListener("mouseleave", function () {
                item.classList.remove("incident-hover");
            });
        });
    }


    /* =====================================================
       FILE TABLE INTERACTION
    ===================================================== */

    function initializeFileTable() {
        const rows = document.querySelectorAll(
            ".table-container tbody tr"
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
       DASHBOARD REFRESH HELPER
    ===================================================== */

    window.refreshDashboard = function () {
        window.location.reload();
    };


    /* =====================================================
       EXPOSE DASHBOARD API
    ===================================================== */

    window.IntelligentLogForensicsDashboard = {
        refresh: function () {
            window.location.reload();
        },

        animateCounters: animateCounters,

        animateProgressBars: animateProgressBars
    };

})();