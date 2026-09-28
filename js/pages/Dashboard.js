(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        initializeDashboard();
    });


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    function initializeDashboard() {
        initializeClock();
        initializeRefresh();
        initializeCounters();
        initializePanels();
        initializeLiveUpdates();
    }


    /* =====================================================
       UTC CLOCK
    ===================================================== */

    function initializeClock() {
        const clock =
            document.getElementById("dashboard-clock");

        if (!clock) {
            return;
        }

        function updateClock() {
            const now = new Date();

            clock.textContent =
                now.toISOString().slice(11, 19);
        }

        updateClock();

        window.setInterval(
            updateClock,
            1000
        );
    }


    /* =====================================================
       REFRESH
    ===================================================== */

    function initializeRefresh() {
        const button =
            document.getElementById(
                "refresh-dashboard"
            );

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            async function () {
                await refreshDashboard(button);
            }
        );
    }


    async function refreshDashboard(button) {
        button.disabled = true;
        button.classList.add("is-loading");

        try {
            /*
             * Reloading the page keeps all server-rendered
             * Jinja telemetry as the source of truth.
             */
            window.location.reload();

        } catch (error) {
            console.error(
                "Dashboard refresh failed:",
                error
            );

            button.disabled = false;
            button.classList.remove(
                "is-loading"
            );
        }
    }


    /* =====================================================
       KPI COUNTERS
    ===================================================== */

    function initializeCounters() {
        document
            .querySelectorAll(
                ".metric-value[id]"
            )
            .forEach(function (element) {
                const rawValue =
                    element.textContent.trim();

                const numericValue =
                    parseFloat(
                        rawValue.replace(
                            /[^0-9.-]/g,
                            ""
                        )
                    );

                if (
                    Number.isFinite(
                        numericValue
                    )
                ) {
                    animateNumber(
                        element,
                        numericValue
                    );
                }
            });
    }


    function animateNumber(element, target) {
        const duration = 700;
        const startTime = performance.now();

        function frame(currentTime) {
            const progress =
                Math.min(
                    (currentTime - startTime) /
                    duration,
                    1
                );

            const eased =
                1 -
                Math.pow(
                    1 - progress,
                    3
                );

            const value =
                target * eased;

            if (
                Number.isInteger(target)
            ) {
                element.textContent =
                    Math.round(value);
            } else {
                element.textContent =
                    value.toFixed(1);
            }

            if (progress < 1) {
                requestAnimationFrame(
                    frame
                );
            } else {
                element.textContent =
                    Number.isInteger(target)
                        ? String(target)
                        : target.toFixed(1);
            }
        }

        requestAnimationFrame(frame);
    }


    /* =====================================================
       PANEL INTERACTION
    ===================================================== */

    function initializePanels() {
        document
            .querySelectorAll(
                ".dashboard-panel"
            )
            .forEach(function (panel) {
                panel.addEventListener(
                    "mouseenter",
                    function () {
                        panel.classList.add(
                            "is-hovered"
                        );
                    }
                );

                panel.addEventListener(
                    "mouseleave",
                    function () {
                        panel.classList.remove(
                            "is-hovered"
                        );
                    }
                );
            });
    }


    /* =====================================================
       LIVE STATUS
    ===================================================== */

    function initializeLiveUpdates() {
        const liveFeed =
            document.getElementById(
                "live-feed"
            );

        if (!liveFeed) {
            return;
        }

        /*
         * We do not invent telemetry events here.
         * Backend-rendered events remain the source of truth.
         *
         * This only provides a visual live indicator.
         */
        document
            .querySelectorAll(
                ".live-badge"
            )
            .forEach(function (badge) {
                badge.classList.add(
                    "is-active"
                );
            });
    }


    /* =====================================================
       OPTIONAL APPSTATE INTEGRATION
    ===================================================== */

    if (
        typeof window.EventBus !== "undefined"
    ) {
        try {
            if (
                typeof window.EventBus.on ===
                "function"
            ) {
                window.EventBus.on(
                    "dashboard:refresh",
                    function () {
                        window.location.reload();
                    }
                );
            }
        } catch (error) {
            console.debug(
                "EventBus dashboard integration unavailable.",
                error
            );
        }
    }

})();