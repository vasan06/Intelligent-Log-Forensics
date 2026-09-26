/* =========================================================
   INCIDENT DETAIL
   Intelligent Log Forensics
========================================================= */

(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        initializeIncidentDetail();
    });


    function initializeIncidentDetail() {
        initializeTimeline();
        initializeForm();
        initializeStatusIndicator();
        initializeCardReveal();
    }


    /* =====================================================
       TIMELINE ANIMATION
    ===================================================== */

    function initializeTimeline() {
        const events = document.querySelectorAll(".timeline-event");

        if (!events.length) {
            return;
        }

        events.forEach(function (event, index) {
            event.style.opacity = "0";
            event.style.transform = "translateY(8px)";
            event.style.transition =
                "opacity 350ms ease, transform 350ms ease";

            setTimeout(function () {
                event.style.opacity = "1";
                event.style.transform = "translateY(0)";
            }, 60 + index * 45);
        });
    }


    /* =====================================================
       UPDATE FORM
    ===================================================== */

    function initializeForm() {
        const form = document.querySelector(
            ".incident-update-form"
        );

        if (!form) {
            return;
        }

        const status = form.querySelector(
            'select[name="status"]'
        );

        const notes = form.querySelector(
            'textarea[name="notes"]'
        );

        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        if (status) {
            status.addEventListener("change", function () {
                status.classList.add("field-changed");
            });
        }

        if (notes) {
            notes.addEventListener("input", function () {
                notes.classList.add("field-changed");
            });
        }

        form.addEventListener("submit", function () {
            if (!submitButton) {
                return;
            }

            submitButton.disabled = true;
            submitButton.dataset.originalText =
                submitButton.textContent.trim();

            submitButton.textContent = "Updating...";

            submitButton.classList.add("is-loading");
        });
    }


    /* =====================================================
       STATUS INDICATOR
    ===================================================== */

    function initializeStatusIndicator() {
        const badges = document.querySelectorAll(
            ".incident-toolbar .badge"
        );

        badges.forEach(function (badge) {
            badge.addEventListener("mouseenter", function () {
                badge.style.transform = "translateY(-1px)";
            });

            badge.addEventListener("mouseleave", function () {
                badge.style.transform = "";
            });
        });
    }


    /* =====================================================
       CARD REVEAL
    ===================================================== */

    function initializeCardReveal() {
        const cards = document.querySelectorAll(
            ".incident-detail-card, .incident-main-column > .card, .incident-timeline-card"
        );

        if (!cards.length) {
            return;
        }

        cards.forEach(function (card, index) {
            card.style.opacity = "0";
            card.style.transform = "translateY(12px)";
            card.style.transition =
                "opacity 450ms ease, transform 450ms ease";

            setTimeout(function () {
                card.style.opacity = "1";
                card.style.transform = "translateY(0)";
            }, 80 + index * 100);
        });
    }


    /* =====================================================
       TIMELINE AUTO-SCROLL HELPER
    ===================================================== */

    window.scrollIncidentTimelineToTop = function () {
        const timeline = document.querySelector(
            ".incident-timeline"
        );

        if (!timeline) {
            return;
        }

        timeline.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.IntelligentLogForensicsIncident = {
        scrollTimelineToTop:
            window.scrollIncidentTimelineToTop
    };

})();