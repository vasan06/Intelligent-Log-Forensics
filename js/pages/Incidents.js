(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        initializeIncidentsPage();
    });


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    function initializeIncidentsPage() {
        initializeSearch();
        initializeFilters();
        initializeRefresh();
        initializeIncidentRows();
        initializeSeverityBadges();
    }


    /* =====================================================
       SEARCH
    ===================================================== */

    function initializeSearch() {
        const searchInput =
            document.getElementById(
                "incident-search"
            );

        if (!searchInput) {
            return;
        }

        searchInput.addEventListener(
            "input",
            function () {
                applyIncidentFilters();
            }
        );
    }


    /* =====================================================
       FILTERS
    ===================================================== */

    function initializeFilters() {
        document
            .querySelectorAll(
                "[data-incident-filter]"
            )
            .forEach(function (filter) {
                filter.addEventListener(
                    "change",
                    function () {
                        applyIncidentFilters();
                    }
                );
            });
    }


    function applyIncidentFilters() {
        const searchInput =
            document.getElementById(
                "incident-search"
            );

        const query =
            searchInput
                ? searchInput.value
                      .trim()
                      .toLowerCase()
                : "";

        const severityFilter =
            getFilterValue("severity");

        const statusFilter =
            getFilterValue("status");

        const rows =
            document.querySelectorAll(
                "[data-incident-row], .incident-row"
            );

        let visibleCount = 0;

        rows.forEach(function (row) {
            const text =
                row.textContent
                    .trim()
                    .toLowerCase();

            const severity =
                (
                    row.dataset.severity ||
                    ""
                ).toLowerCase();

            const status =
                (
                    row.dataset.status ||
                    ""
                ).toLowerCase();

            const matchesSearch =
                !query ||
                text.includes(query);

            const matchesSeverity =
                !severityFilter ||
                severityFilter === "all" ||
                severity === severityFilter;

            const matchesStatus =
                !statusFilter ||
                statusFilter === "all" ||
                status === statusFilter;

            const visible =
                matchesSearch &&
                matchesSeverity &&
                matchesStatus;

            row.hidden = !visible;

            if (visible) {
                visibleCount += 1;
            }
        });

        updateEmptyFilterState(
            visibleCount
        );
    }


    function getFilterValue(type) {
        const filter =
            document.querySelector(
                `[data-incident-filter="${type}"]`
            );

        if (!filter) {
            return "";
        }

        return filter.value
            .trim()
            .toLowerCase();
    }


    /* =====================================================
       REFRESH
    ===================================================== */

    function initializeRefresh() {
        const button =
            document.getElementById(
                "refresh-incidents"
            );

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            function () {
                button.disabled = true;
                button.classList.add(
                    "is-loading"
                );

                window.location.reload();
            }
        );
    }


    /* =====================================================
       INCIDENT ROWS
    ===================================================== */

    function initializeIncidentRows() {
        document
            .querySelectorAll(
                "[data-incident-row], .incident-row"
            )
            .forEach(function (row) {
                row.addEventListener(
                    "mouseenter",
                    function () {
                        row.classList.add(
                            "is-hovered"
                        );
                    }
                );

                row.addEventListener(
                    "mouseleave",
                    function () {
                        row.classList.remove(
                            "is-hovered"
                        );
                    }
                );
            });
    }


    /* =====================================================
       SEVERITY BADGES
    ===================================================== */

    function initializeSeverityBadges() {
        document
            .querySelectorAll(
                ".severity-badge, .incident-severity"
            )
            .forEach(function (badge) {
                const severity =
                    badge.textContent
                        .trim()
                        .toLowerCase();

                badge.dataset.severity =
                    severity;

                badge.classList.add(
                    `severity-${sanitizeClassName(severity)}`
                );
            });
    }


    function sanitizeClassName(value) {
        return value
            .replace(
                /[^a-z0-9_-]/g,
                ""
            );
    }


    /* =====================================================
       FILTER EMPTY STATE
    ===================================================== */

    function updateEmptyFilterState(
        visibleCount
    ) {
        const emptyState =
            document.getElementById(
                "incident-filter-empty"
            );

        if (!emptyState) {
            return;
        }

        emptyState.hidden =
            visibleCount !== 0;
    }


    /* =====================================================
       KEYBOARD SHORTCUT
    ===================================================== */

    document.addEventListener(
        "keydown",
        function (event) {
            if (
                event.key === "/" &&
                !isTypingTarget(
                    event.target
                )
            ) {
                const search =
                    document.getElementById(
                        "incident-search"
                    );

                if (search) {
                    event.preventDefault();
                    search.focus();
                }
            }

            if (
                event.key === "Escape"
            ) {
                const search =
                    document.getElementById(
                        "incident-search"
                    );

                if (search) {
                    search.value = "";
                    applyIncidentFilters();
                    search.blur();
                }
            }
        }
    );


    function isTypingTarget(element) {
        if (!element) {
            return false;
        }

        const tag =
            element.tagName.toLowerCase();

        return (
            tag === "input" ||
            tag === "textarea" ||
            tag === "select" ||
            element.isContentEditable
        );
    }


    /* =====================================================
       INITIAL FILTER APPLICATION
    ===================================================== */

    applyIncidentFilters();

})();