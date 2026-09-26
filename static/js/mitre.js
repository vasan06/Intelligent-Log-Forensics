/* =========================================================
   MITRE ATT&CK PAGE
   Intelligent Log Forensics
========================================================= */

(function () {
    "use strict";

    let techniqueData = {};
    let countData = {};

    document.addEventListener("DOMContentLoaded", function () {
        initializeMitrePage();
    });

    function initializeMitrePage() {
        loadServerData();
        initializeKeyboardControls();
        initializeTechniqueCards();
    }

    /* =====================================================
       SERVER DATA
    ===================================================== */

    function loadServerData() {
        const dataElement = document.getElementById("mitre-page-data");

        if (dataElement) {
            try {
                techniqueData = JSON.parse(dataElement.dataset.techniques || "{}");
            } catch (error) {
                console.error("Failed to parse MITRE technique data:", error);
                throw error;
            }

            try {
                countData = JSON.parse(dataElement.dataset.counts || "{}");
            } catch (error) {
                console.error("Failed to parse MITRE count data:", error);
                throw error;
            }
        }

        window.MITRE_TECHNIQUE_DATA = techniqueData;
        window.MITRE_COUNT_DATA = countData;
    }

    /* =====================================================
       TACTIC FILTER
    ===================================================== */

    window.filterTactic = function (tactic) {
        const cards = document.querySelectorAll(".mitre-card");

        cards.forEach(function (card) {
            const cardTactic = card.dataset.tactic || "";

            if (!tactic || cardTactic === tactic) {
                card.style.display = "";
            } else {
                card.style.display = "none";
            }
        });

        updateFilterState(tactic);
    };

    function updateFilterState(tactic) {
        document.querySelectorAll(".stats-grid .stat-card").forEach(function (card) {
            card.classList.remove("active");
        });

        if (!tactic) {
            return;
        }

        document.querySelectorAll(".stats-grid .stat-card").forEach(function (card) {
            const label = card.querySelector(".stat-label");

            if (
                label &&
                label.textContent.trim().toLowerCase() === tactic.toLowerCase()
            ) {
                card.classList.add("active");
            }
        });
    }

    /* =====================================================
       TECHNIQUE DETAIL
    ===================================================== */

    window.showTechniqueDetail = function (tid) {
        const technique = techniqueData[tid];

        if (!technique) {
            console.warn("MITRE technique not found:", tid);
            return;
        }

        const detectionCount = Number(countData[tid] || 0);

        setText("modal-tid", tid);
        setText("modal-name", technique.name || "Unknown Technique");
        setText("modal-tactic", technique.tactic || "Unknown");
        setText("modal-desc", technique.description || "No description available.");
        setText(
            "modal-indicators",
            technique.indicators || "No indicators available."
        );
        setText(
            "modal-remediation",
            technique.remediation || "No remediation guidance available."
        );

        const detectionContainer =
            document.getElementById("modal-detections");

        const detectionCountElement =
            document.getElementById("modal-detection-count");

        if (detectionContainer && detectionCountElement) {
            if (detectionCount > 0) {
                detectionContainer.style.display = "";

                detectionCountElement.textContent =
                    detectionCount +
                    " detection" +
                    (detectionCount !== 1 ? "s" : "") +
                    " in your logs";
            } else {
                detectionContainer.style.display = "none";
            }
        }

        openTechModal();
    };

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    /* =====================================================
       MODAL
    ===================================================== */

    function openTechModal() {
        const modal = document.getElementById("technique-modal");

        if (!modal) {
            return;
        }

        modal.style.display = "flex";
        document.body.classList.add("modal-open");

        requestAnimationFrame(function () {
            const closeButton = modal.querySelector(".btn");

            if (closeButton) {
                closeButton.focus();
            }
        });
    }

    window.closeTechModal = function () {
        const modal = document.getElementById("technique-modal");

        if (!modal) {
            return;
        }

        modal.style.display = "none";
        document.body.classList.remove("modal-open");
    };

    /* =====================================================
       KEYBOARD CONTROLS
    ===================================================== */

    function initializeKeyboardControls() {
        document.addEventListener("keydown", function (event) {
            const modal = document.getElementById("technique-modal");

            if (!modal) {
                return;
            }

            if (
                event.key === "Escape" &&
                modal.style.display === "flex"
            ) {
                closeTechModal();
            }
        });

        const modal = document.getElementById("technique-modal");

        if (modal) {
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    closeTechModal();
                }
            });
        }
    }

    /* =====================================================
       TECHNIQUE CARD INTERACTION
    ===================================================== */

    function initializeTechniqueCards() {
        document.querySelectorAll(".mitre-card").forEach(function (card) {
            card.addEventListener("keydown", function (event) {
                if (event.key !== "Enter" && event.key !== " ") {
                    return;
                }

                event.preventDefault();

                const techniqueId = card.dataset.technique;

                if (techniqueId) {
                    showTechniqueDetail(techniqueId);
                }
            });

            card.setAttribute("tabindex", "0");
            card.setAttribute("role", "button");
        });
    }

    /* =====================================================
       GLOBAL ESCAPE SAFETY
    ===================================================== */

    window.addEventListener("beforeunload", function () {
        document.body.classList.remove("modal-open");
    });
})();