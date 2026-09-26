/* =========================================================
   FILE ARCHIVE / UPLOADS
   Intelligent Log Forensics
========================================================= */

(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", initializeUploads);

    function initializeUploads() {
        initializeRowInteractions();
        initializeActionButtons();
        initializeQualityBars();
        initializeFileTooltips();
    }


    /* =====================================================
       ROW INTERACTIONS
    ===================================================== */

    function initializeRowInteractions() {
        const rows = document.querySelectorAll(
            ".uploads-page tbody tr"
        );

        rows.forEach((row) => {

            row.addEventListener("mouseenter", () => {
                row.classList.add("is-hovered");
            });

            row.addEventListener("mouseleave", () => {
                row.classList.remove("is-hovered");
            });
        });
    }


    /* =====================================================
       ACTION BUTTONS
    ===================================================== */

    function initializeActionButtons() {
        const buttons = document.querySelectorAll(
            ".uploads-page .file-actions a"
        );

        buttons.forEach((button) => {

            button.addEventListener("click", function () {

                this.classList.add("is-loading");

                const originalText = this.textContent.trim();

                if (originalText === "Analyze") {
                    this.textContent = "Opening...";
                } else if (originalText === "ML") {
                    this.textContent = "Loading...";
                }

                setTimeout(() => {
                    this.classList.remove("is-loading");
                }, 1500);
            });
        });
    }


    /* =====================================================
       QUALITY BARS
    ===================================================== */

    function initializeQualityBars() {
        const bars = document.querySelectorAll(
            ".uploads-page .score-bar-fill"
        );

        bars.forEach((bar) => {

            const width = bar.dataset.width !== undefined
                ? `${bar.dataset.width}%`
                : bar.style.width;

            bar.style.width = "0%";

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    bar.style.width = width;
                });
            });
        });
    }


    /* =====================================================
       FILE TOOLTIPS
    ===================================================== */

    function initializeFileTooltips() {
        const filenames = document.querySelectorAll(
            ".uploads-page .file-name-text"
        );

        filenames.forEach((element) => {

            const text = element.textContent.trim();

            if (text.length > 30) {
                element.setAttribute("title", text);
            }
        });
    }


    /* =====================================================
       OPTIONAL TABLE SEARCH API
       Can be used later without changing HTML.
    ===================================================== */

    window.filterUploads = function (query) {

        const search = String(query || "")
            .trim()
            .toLowerCase();

        const rows = document.querySelectorAll(
            ".uploads-page tbody tr"
        );

        let visibleCount = 0;

        rows.forEach((row) => {

            const text = row.textContent.toLowerCase();

            const visible =
                !search ||
                text.includes(search);

            row.style.display = visible ? "" : "none";

            if (visible) {
                visibleCount++;
            }
        });

        return visibleCount;
    };


    /* =====================================================
       OPTIONAL STATUS FILTER
    ===================================================== */

    window.filterUploadsByStatus = function (status) {

        const selectedStatus = String(status || "")
            .trim()
            .toLowerCase();

        const rows = document.querySelectorAll(
            ".uploads-page tbody tr"
        );

        let visibleCount = 0;

        rows.forEach((row) => {

            const badge = row.querySelector(".status-badge");

            if (!badge) {
                return;
            }

            const rowStatus =
                badge.textContent
                    .trim()
                    .toLowerCase();

            const visible =
                !selectedStatus ||
                rowStatus === selectedStatus;

            row.style.display =
                visible ? "" : "none";

            if (visible) {
                visibleCount++;
            }
        });

        return visibleCount;
    };


    /* =====================================================
       EXPOSE INITIALIZER
    ===================================================== */

    window.initializeUploads = initializeUploads;

})();