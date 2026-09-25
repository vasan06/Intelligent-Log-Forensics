/* ============================================================
   ILF — LIVE TELEMETRY GENERATOR
   /static/js/engine/LiveGenerator.js
   ============================================================ */

(function () {
    "use strict";

    const LiveGenerator = {
        running: false,
        timer: null,
        interval: 5000,
        listeners: new Set(),

        state: {
            totalSignals: 0,
            totalThreats: 0,
            activeClusters: 0,
            evidenceBundles: 0,
            threatIndex: 0,
            forensicFidelity: 0,
            eventsPerSecond: 0,
            lastUpdate: null
        },

        /* --------------------------------------------------------
           Utility
        -------------------------------------------------------- */

        clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        },

        random(min, max) {
            return Math.floor(
                Math.random() * (max - min + 1)
            ) + min;
        },

        /* --------------------------------------------------------
           Read initial values from existing dashboard
        -------------------------------------------------------- */

        readDOMState() {
            const totalSignals = document.getElementById(
                "metric-total-signals"
            );

            const totalThreats = document.getElementById(
                "metric-total-threats"
            );

            const activeClusters = document.getElementById(
                "metric-active-clusters"
            );

            const evidenceBundles = document.getElementById(
                "metric-vault-bundles"
            );

            const threatIndex = document.getElementById(
                "metric-threat-index"
            );

            const fidelity = document.getElementById(
                "metric-fidelity"
            );

            const numberFrom = (element, fallback = 0) => {
                if (!element) {
                    return fallback;
                }

                const value = Number(
                    String(element.textContent)
                        .replace(/[^\d.-]/g, "")
                );

                return Number.isFinite(value)
                    ? value
                    : fallback;
            };

            this.state.totalSignals =
                numberFrom(totalSignals);

            this.state.totalThreats =
                numberFrom(totalThreats);

            this.state.activeClusters =
                numberFrom(activeClusters);

            this.state.evidenceBundles =
                numberFrom(evidenceBundles);

            this.state.threatIndex =
                numberFrom(threatIndex);

            this.state.forensicFidelity =
                numberFrom(fidelity);

            this.state.lastUpdate =
                new Date().toISOString();
        },

        /* --------------------------------------------------------
           Generate one telemetry update
        -------------------------------------------------------- */

        generate() {
            const state = this.state;

            const signalIncrement = this.random(0, 12);

            state.totalSignals += signalIncrement;

            /*
             * Threats should grow slower than raw signals.
             */
            if (Math.random() > 0.45) {
                state.totalThreats += this.random(0, 3);
            }

            /*
             * Only occasionally create/close an incident cluster.
             */
            const clusterRoll = Math.random();

            if (clusterRoll > 0.93) {
                state.activeClusters += 1;
            } else if (
                clusterRoll < 0.04 &&
                state.activeClusters > 0
            ) {
                state.activeClusters -= 1;
            }

            /*
             * Evidence bundles generally increase with telemetry.
             */
            if (Math.random() > 0.6) {
                state.evidenceBundles += this.random(0, 2);
            }

            /*
             * Calculate a bounded threat index.
             */
            const threatPressure =
                state.totalSignals > 0
                    ? (
                        state.totalThreats /
                        state.totalSignals
                    ) * 100
                    : 0;

            const clusterPressure =
                state.activeClusters * 4;

            const targetThreatIndex =
                this.clamp(
                    Math.round(
                        threatPressure +
                        clusterPressure
                    ),
                    0,
                    100
                );

            /*
             * Smooth the value instead of jumping suddenly.
             */
            state.threatIndex = Math.round(
                (
                    state.threatIndex * 0.75
                ) +
                (
                    targetThreatIndex * 0.25
                )
            );

            /*
             * Fidelity remains high unless the telemetry stream
             * becomes inconsistent.
             */
            const fidelityTarget =
                this.clamp(
                    100 -
                    Math.round(
                        state.activeClusters * 1.5
                    ),
                    70,
                    100
                );

            state.forensicFidelity = Math.round(
                (
                    state.forensicFidelity * 0.8
                ) +
                (
                    fidelityTarget * 0.2
                )
            );

            state.eventsPerSecond =
                Number(
                    (
                        signalIncrement /
                        (this.interval / 1000)
                    ).toFixed(2)
                );

            state.lastUpdate =
                new Date().toISOString();

            return {
                ...state
            };
        },

        /* --------------------------------------------------------
           Notify listeners
        -------------------------------------------------------- */

        emit(data) {
            this.listeners.forEach((listener) => {
                try {
                    listener(data);
                } catch (error) {
                    console.error(
                        "[LiveGenerator] Listener error:",
                        error
                    );
                }
            });

            /*
             * Also expose a browser event so other files can
             * listen without depending directly on this object.
             */
            document.dispatchEvent(
                new CustomEvent(
                    "ilf:telemetry-update",
                    {
                        detail: data
                    }
                )
            );
        },

        /* --------------------------------------------------------
           Subscribe
        -------------------------------------------------------- */

        subscribe(callback) {
            if (typeof callback !== "function") {
                return function () {};
            }

            this.listeners.add(callback);

            return () => {
                this.listeners.delete(callback);
            };
        },

        /* --------------------------------------------------------
           One update cycle
        -------------------------------------------------------- */

        tick() {
            const data = this.generate();

            this.emit(data);

            return data;
        },

        /* --------------------------------------------------------
           Start generator
        -------------------------------------------------------- */

        start(interval = this.interval) {
            if (this.running) {
                return;
            }

            this.interval =
                Math.max(
                    Number(interval) || 5000,
                    1000
                );

            this.readDOMState();

            this.running = true;

            /*
             * Initial event.
             */
            this.emit({
                ...this.state
            });

            this.timer = window.setInterval(
                () => this.tick(),
                this.interval
            );

            document.dispatchEvent(
                new CustomEvent(
                    "ilf:telemetry-started"
                )
            );
        },

        /* --------------------------------------------------------
           Stop generator
        -------------------------------------------------------- */

        stop() {
            if (this.timer !== null) {
                window.clearInterval(this.timer);
                this.timer = null;
            }

            this.running = false;

            document.dispatchEvent(
                new CustomEvent(
                    "ilf:telemetry-stopped"
                )
            );
        },

        /* --------------------------------------------------------
           Restart
        -------------------------------------------------------- */

        restart(interval = this.interval) {
            this.stop();
            this.start(interval);
        },

        /* --------------------------------------------------------
           Get current state
        -------------------------------------------------------- */

        getState() {
            return {
                ...this.state
            };
        }
    };

    /* ------------------------------------------------------------
       Expose globally
       ------------------------------------------------------------ */

    window.LiveGenerator = LiveGenerator;

    /*
     * Automatically start only on pages that explicitly opt in.
     *
     * Add:
     *
     * <body data-live-telemetry>
     *
     * to dashboard if required.
     */
    document.addEventListener(
        "DOMContentLoaded",
        function () {
            if (
                document.body &&
                document.body.hasAttribute(
                    "data-live-telemetry"
                )
            ) {
                LiveGenerator.start();
            }
        }
    );

})();