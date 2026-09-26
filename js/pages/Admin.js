(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        initializeAdminPage();
    });

    function initializeAdminPage() {
        bindRefresh();
        bindSearch();
        bindFilters();
        bindActionButtons();
        loadAdminData();
    }


    /* =====================================================
       REFRESH
    ===================================================== */

    function bindRefresh() {
        const button = document.getElementById("refresh-admin");

        if (!button) {
            return;
        }

        button.addEventListener("click", function () {
            loadAdminData();
        });
    }


    /* =====================================================
       SEARCH
    ===================================================== */

    function bindSearch() {
        const input = document.getElementById("admin-search");

        if (!input) {
            return;
        }

        input.addEventListener("input", function () {
            const query = input.value.trim().toLowerCase();

            document
                .querySelectorAll(
                    "[data-admin-row], .operator-row, .user-row"
                )
                .forEach(function (row) {
                    const text = row.textContent.toLowerCase();

                    row.hidden = query !== "" && !text.includes(query);
                });
        });
    }


    /* =====================================================
       FILTERS
    ===================================================== */

    function bindFilters() {
        document
            .querySelectorAll("[data-admin-filter]")
            .forEach(function (filter) {
                filter.addEventListener("change", function () {
                    applyFilter(filter);
                });
            });
    }

    function applyFilter(filter) {
        const value = filter.value.toLowerCase();

        const rows = document.querySelectorAll(
            "[data-admin-row], .operator-row, .user-row"
        );

        rows.forEach(function (row) {
            if (!value || value === "all") {
                row.hidden = false;
                return;
            }

            const rowStatus = (
                row.dataset.status ||
                row.dataset.role ||
                row.textContent ||
                ""
            ).toLowerCase();

            row.hidden = !rowStatus.includes(value);
        });
    }


    /* =====================================================
       ACTION BUTTONS
    ===================================================== */

    function bindActionButtons() {
        document.addEventListener("click", function (event) {
            const button = event.target.closest(
                "[data-admin-action]"
            );

            if (!button) {
                return;
            }

            const action = button.dataset.adminAction;

            if (action === "refresh") {
                loadAdminData();
            }

            if (action === "toggle") {
                toggleOperator(button);
            }

            if (action === "delete") {
                confirmDelete(button);
            }
        });
    }


    /* =====================================================
       TOGGLE OPERATOR
    ===================================================== */

    async function toggleOperator(button) {
        const operatorId = button.dataset.operatorId;

        if (!operatorId) {
            return;
        }

        const currentState =
            button.dataset.active === "true";

        button.disabled = true;

        try {
            const response = await fetch(
                `/api/v1/admin/operators/${encodeURIComponent(operatorId)}/status`,
                {
                    method: "PATCH",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        active: !currentState
                    })
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Request failed with status ${response.status}`
                );
            }

            button.dataset.active = String(!currentState);

            updateToggleLabel(
                button,
                !currentState
            );

        } catch (error) {
            console.error(
                "Unable to update operator status:",
                error
            );

            showAdminMessage(
                "Unable to update operator status.",
                "error"
            );

        } finally {
            button.disabled = false;
        }
    }


    function updateToggleLabel(button, active) {
        const label = button.querySelector(
            "[data-action-label]"
        );

        if (label) {
            label.textContent = active
                ? "Disable"
                : "Enable";
        }

        button.classList.toggle(
            "is-active",
            active
        );
    }


    /* =====================================================
       DELETE / REMOVE
    ===================================================== */

    function confirmDelete(button) {
        const operatorId = button.dataset.operatorId;

        if (!operatorId) {
            return;
        }

        const confirmed = window.confirm(
            "Remove this operator account?"
        );

        if (!confirmed) {
            return;
        }

        removeOperator(
            operatorId,
            button
        );
    }


    async function removeOperator(operatorId, button) {
        button.disabled = true;

        try {
            const response = await fetch(
                `/api/v1/admin/operators/${encodeURIComponent(operatorId)}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Request failed with status ${response.status}`
                );
            }

            const row = button.closest(
                "[data-admin-row], .operator-row, .user-row"
            );

            if (row) {
                row.remove();
            }

            showAdminMessage(
                "Operator removed successfully.",
                "success"
            );

        } catch (error) {
            console.error(
                "Unable to remove operator:",
                error
            );

            showAdminMessage(
                "Unable to remove operator.",
                "error"
            );

            button.disabled = false;
        }
    }


    /* =====================================================
       ADMIN DATA
    ===================================================== */

    async function loadAdminData() {
        const refreshButton =
            document.getElementById("refresh-admin");

        if (refreshButton) {
            refreshButton.classList.add("is-loading");
            refreshButton.disabled = true;
        }

        try {
            const response = await fetch(
                "/api/v1/admin",
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Admin request failed: ${response.status}`
                );
            }

            const data = await response.json();

            updateAdminMetrics(data);
            updateAdminRows(data);

        } catch (error) {
            /*
             * The page can still work using server-rendered
             * Jinja data when the optional admin endpoint
             * is unavailable.
             */
            console.warn(
                "Admin API unavailable:",
                error
            );

        } finally {
            if (refreshButton) {
                refreshButton.classList.remove(
                    "is-loading"
                );

                refreshButton.disabled = false;
            }
        }
    }


    /* =====================================================
       METRICS
    ===================================================== */

    function updateAdminMetrics(data) {
        const metrics = data.metrics || data;

        setText(
            "admin-total-operators",
            metrics.total_operators
        );

        setText(
            "admin-active-operators",
            metrics.active_operators
        );

        setText(
            "admin-pending-operators",
            metrics.pending_operators
        );

        setText(
            "admin-total-incidents",
            metrics.total_incidents
        );
    }


    /* =====================================================
       ROW DATA
    ===================================================== */

    function updateAdminRows(data) {
        if (!Array.isArray(data.operators)) {
            return;
        }

        const container =
            document.querySelector(
                "[data-admin-operators]"
            );

        if (!container) {
            return;
        }

        /*
         * Server-rendered rows are intentionally preserved.
         * This prevents the JS layer from inventing markup
         * that may not match the backend template.
         */
        if (data.operators.length === 0) {
            const emptyState =
                container.querySelector(
                    ".empty-state"
                );

            if (emptyState) {
                emptyState.hidden = false;
            }
        }
    }


    /* =====================================================
       HELPERS
    ===================================================== */

    function setText(id, value) {
        const element =
            document.getElementById(id);

        if (!element || value === undefined || value === null) {
            return;
        }

        element.textContent = value;
    }


    function showAdminMessage(message, type) {
        let element =
            document.getElementById(
                "admin-message"
            );

        if (!element) {
            element = document.createElement("div");

            element.id = "admin-message";
            element.className = "admin-message";

            document.body.appendChild(element);
        }

        element.textContent = message;
        element.dataset.type = type || "info";

        element.classList.add("is-visible");

        window.clearTimeout(
            element._hideTimer
        );

        element._hideTimer =
            window.setTimeout(function () {
                element.classList.remove(
                    "is-visible"
                );
            }, 3500);
    }

})();