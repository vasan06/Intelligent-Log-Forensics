/* =========================================================
LIVE ATTACK SIMULATOR
Intelligent Log Forensics
========================================================= */

(function () {
"use strict";


let eventCount = 0;

document.addEventListener("DOMContentLoaded", function () {
    initializeSimulator();
});

/* =====================================================
   INITIALIZATION
===================================================== */

function initializeSimulator() {
    initializeKeyboardSupport();
}

/* =====================================================
   GENERATE SIMULATED EVENT
===================================================== */

window.generateEvent = async function (eventType, card) {
    if (!eventType || !card) {
        return;
    }

    if (card.dataset.generating === "true") {
        return;
    }

    card.dataset.generating = "true";
    card.classList.add("is-generating");

    try {
        const response = await fetch("/api/simulator/generate", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                event_type: eventType
            })
        });

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            console.error(
                "Simulator returned invalid JSON:",
                error
            );
        }

        if (!response.ok) {
            const message =
                data.error ||
                data.message ||
                "Failed to generate event.";

            showSimulatorToast(message, "error");
            return;
        }

        if (!data.ok) {
            showSimulatorToast(
                data.message ||
                data.error ||
                "Event generation failed.",
                "error"
            );
            return;
        }

        if (!data.event) {
            showSimulatorToast(
                "Server generated the event but returned no event data.",
                "error"
            );
            return;
        }

        addEventToLog(data.event);

        showSimulatorToast(
            "Event generated: " +
            (data.event.category || eventType),
            "warning"
        );

    } catch (error) {
        console.error(
            "Live simulator request failed:",
            error
        );

        showSimulatorToast(
            "Unable to connect to the simulator.",
            "error"
        );

    } finally {
        setTimeout(function () {
            card.dataset.generating = "false";
            card.classList.remove("is-generating");
        }, 500);
    }
};

/* =====================================================
   ADD EVENT TO EVENT STREAM
===================================================== */

function addEventToLog(event) {
    const log = document.getElementById("event-log");
    const emptyLog = document.getElementById("empty-log");
    const counter = document.getElementById("event-count");

    if (!log || !counter) {
        return;
    }

    eventCount += 1;

    if (emptyLog) {
        emptyLog.style.display = "none";
    }

    counter.textContent =
        eventCount +
        " event" +
        (eventCount === 1 ? "" : "s");

    counter.classList.remove("pulse");

    requestAnimationFrame(function () {
        counter.classList.add("pulse");
    });

    const severity = String(
        event.severity || "Notice"
    ).toLowerCase();

    let severityClass = "warning";

    if (severity === "critical") {
        severityClass = "critical";
    } else if (severity === "high") {
        severityClass = "high";
    }

    const severityColor =
        severity === "critical"
            ? "var(--color-critical)"
            : severity === "high"
            ? "var(--color-high)"
            : "var(--color-warning)";

    const eventElement =
        document.createElement("div");

    eventElement.className =
        "simulator-generated-event " +
        severityClass;

    eventElement.innerHTML = `
        <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:var(--space-2);
            margin-bottom:3px;
        ">

            <span style="
                font-size:11px;
                font-weight:600;
                color:${severityColor};
            ">
                ${escapeHtml(event.severity || "Notice")}
            </span>

            <span class="simulator-event-time">
                ${escapeHtml(
                    formatTimestamp(event.timestamp)
                )}
            </span>

        </div>

        <div style="
            font-size:var(--text-xs);
            font-weight:500;
            color:var(--color-text);
            margin-bottom:3px;
        ">

            ${escapeHtml(
                event.category || "Security Event"
            )}

            <span style="
                color:var(--color-text-muted);
                font-weight:400;
            ">
                —
                ${escapeHtml(
                    event.technique_id || "N/A"
                )}
            </span>

        </div>

        <div class="simulator-event-message">
            ${escapeHtml(
                event.message || "No event message"
            )}
        </div>

        <div class="simulator-event-meta">

            <span>
                Score:
                ${escapeHtml(
                    String(event.score ?? "N/A")
                )}
            </span>

            <span>
                IP:
                ${escapeHtml(
                    event.source_ip || "Unknown"
                )}
            </span>

        </div>
    `;

    /*
     * Newest event goes to the top.
     */
    log.insertBefore(
        eventElement,
        log.firstChild
    );
}

/* =====================================================
   CLEAR GENERATED EVENTS
===================================================== */

window.clearEvents = function () {
    const log = document.getElementById("event-log");
    const counter = document.getElementById("event-count");

    if (!log || !counter) {
        return;
    }

    eventCount = 0;

    log.innerHTML = `
        <div
            id="empty-log"
            style="
                display:flex;
                flex-direction:column;
                align-items:center;
                justify-content:center;
                height:100%;
                color:var(--color-text-muted);
                text-align:center;
            "
        >

            <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                style="margin-bottom:var(--space-3)"
            >
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>

            <p style="
                font-size:var(--text-sm);
                margin:0;
            ">
                Click an event generator to create
                synthetic attack events
            </p>

        </div>
    `;

    counter.textContent = "0 events";
};

/* =====================================================
   KEYBOARD ACCESSIBILITY
===================================================== */

function initializeKeyboardSupport() {
    const cards = document.querySelectorAll(
        ".simulator-event-card"
    );

    cards.forEach(function (card) {
        card.addEventListener(
            "keydown",
            function (event) {
                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();
                    card.click();
                }
            }
        );
    });
}

/* =====================================================
   FORMAT TIMESTAMP
===================================================== */

function formatTimestamp(timestamp) {
    if (!timestamp) {
        return new Date()
            .toISOString()
            .substring(0, 19);
    }

    return String(timestamp)
        .substring(0, 19)
        .replace("T", " ");
}

/* =====================================================
   HTML ESCAPING
===================================================== */

function escapeHtml(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        function (character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[character];
        }
    );
}

/* =====================================================
   TOAST
===================================================== */

function showSimulatorToast(message, type) {
    /*
     * Use the global application toast when available.
     */
    if (
        typeof window.showToast ===
        "function"
    ) {
        window.showToast(
            message,
            type || "info"
        );
        return;
    }

    /*
     * Fallback toast for standalone simulator use.
     */
    let toast =
        document.getElementById(
            "simulator-toast"
        );

    if (!toast) {
        toast = document.createElement("div");

        toast.id = "simulator-toast";

        toast.style.cssText = `
            position:fixed;
            right:20px;
            bottom:20px;
            z-index:9999;
            max-width:360px;
            padding:12px 16px;
            border-radius:8px;
            background:var(--color-surface);
            border:1px solid var(--color-border);
            box-shadow:var(--shadow-lg);
            color:var(--color-text);
            font-size:13px;
            line-height:1.5;
            animation:fadeInUp 0.2s ease;
        `;

        document.body.appendChild(toast);
    }

    toast.textContent = message;

    clearTimeout(
        showSimulatorToast.timeout
    );

    showSimulatorToast.timeout =
        setTimeout(function () {
            if (toast) {
                toast.remove();
            }
        }, 3000);
}


})();
