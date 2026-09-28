/* ============================================================
   MITRE ATT&CK PAGE
   Intelligent Log Forensics
   ============================================================ */

(function () {
    "use strict";

    const state = {
        selectedTechnique: null,
        searchQuery: "",
        activeFilter: "all"
    };

    /* ----------------------------------------------------------
       Helpers
    ---------------------------------------------------------- */

    function qs(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function qsa(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }

    function normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    function getTechniqueId(element) {
        return (
            element.dataset.techniqueId ||
            element.dataset.technique ||
            qs("[data-technique-id]", element)?.dataset.techniqueId ||
            ""
        );
    }

    /* ----------------------------------------------------------
       Technique selection
    ---------------------------------------------------------- */

    function selectTechnique(element) {
        if (!element) {
            return;
        }

        qsa(
            ".mitre-technique.active, " +
            ".technique-card.active, " +
            ".matrix-cell.active, " +
            "[data-technique].active"
        ).forEach((item) => {
            item.classList.remove("active");
        });

        element.classList.add("active");

        const techniqueId = getTechniqueId(element);
        state.selectedTechnique = techniqueId || null;

        document.dispatchEvent(
            new CustomEvent("ilf:mitre-technique-selected", {
                detail: {
                    techniqueId: state.selectedTechnique,
                    element
                }
            })
        );

        updateTechniqueDetail(element);
    }

    /* ----------------------------------------------------------
       Detail panel
    ---------------------------------------------------------- */

    function updateTechniqueDetail(element) {
        const detailPanel = qs(
            "#mitre-detail, " +
            "#technique-detail, " +
            ".mitre-detail-panel, " +
            ".technique-detail"
        );

        if (!detailPanel || !element) {
            return;
        }

        const id =
            getTechniqueId(element) ||
            element.getAttribute("data-id") ||
            "UNMAPPED";

        const name =
            element.dataset.techniqueName ||
            element.dataset.name ||
            qs("[data-technique-name]", element)?.textContent ||
            qs(".technique-name", element)?.textContent ||
            element.textContent.trim();

        const description =
            element.dataset.description ||
            qs("[data-technique-description]", element)?.textContent ||
            qs(".technique-description", element)?.textContent ||
            "";

        const idTarget = qs(
            "[data-detail-technique-id], #detail-technique-id",
            detailPanel
        );

        const nameTarget = qs(
            "[data-detail-technique-name], #detail-technique-name",
            detailPanel
        );

        const descriptionTarget = qs(
            "[data-detail-technique-description], #detail-technique-description",
            detailPanel
        );

        if (idTarget) {
            idTarget.textContent = id;
        }

        if (nameTarget) {
            nameTarget.textContent = name.trim();
        }

        if (descriptionTarget) {
            descriptionTarget.textContent =
                description.trim() || "No technique description available.";
        }

        detailPanel.classList.add("is-visible");
    }

    /* ----------------------------------------------------------
       Search
    ---------------------------------------------------------- */

    function filterTechniques(query) {
        state.searchQuery = normalize(query);

        const techniques = qsa(
            "[data-technique], " +
            ".mitre-technique, " +
            ".technique-card, " +
            ".matrix-cell"
        );

        techniques.forEach((item) => {
            const searchableText = normalize(
                [
                    item.textContent,
                    item.dataset.techniqueId,
                    item.dataset.techniqueName,
                    item.dataset.name,
                    item.dataset.description
                ]
                    .filter(Boolean)
                    .join(" ")
            );

            const matches =
                !state.searchQuery ||
                searchableText.includes(state.searchQuery);

            item.hidden = !matches;
            item.classList.toggle("search-hidden", !matches);
        });

        updateEmptySearchState(techniques);
    }

    function updateEmptySearchState(items) {
        const visibleItems = items.filter((item) => !item.hidden);

        const emptyState = qs(
            "#mitre-search-empty, " +
            ".mitre-search-empty, " +
            "[data-mitre-search-empty]"
        );

        if (!emptyState) {
            return;
        }

        emptyState.hidden = visibleItems.length !== 0;
    }

    /* ----------------------------------------------------------
       Filters
    ---------------------------------------------------------- */

    function applyFilter(filter) {
        state.activeFilter = normalize(filter) || "all";

        qsa(
            "[data-mitre-filter], " +
            ".mitre-filter, " +
            ".filter-button"
        ).forEach((button) => {
            const buttonFilter = normalize(
                button.dataset.mitreFilter ||
                button.dataset.filter ||
                button.getAttribute("data-value")
            );

            button.classList.toggle(
                "active",
                buttonFilter === state.activeFilter
            );
        });

        const items = qsa(
            "[data-technique], " +
            ".mitre-technique, " +
            ".technique-card, " +
            ".matrix-cell"
        );

        items.forEach((item) => {
            if (state.activeFilter === "all") {
                item.classList.remove("filter-hidden");
                item.hidden = false;
                return;
            }

            const category = normalize(
                item.dataset.category ||
                item.dataset.tactic ||
                item.dataset.severity ||
                ""
            );

            const matches =
                category === state.activeFilter ||
                category.split(",").map(normalize).includes(state.activeFilter);

            item.classList.toggle("filter-hidden", !matches);

            if (!matches) {
                item.hidden = true;
            } else {
                item.hidden = false;
            }
        });

        if (state.searchQuery) {
            filterTechniques(state.searchQuery);
        }
    }

    /* ----------------------------------------------------------
       Search input initialization
    ---------------------------------------------------------- */

    function initializeSearch() {
        const searchInput = qs(
            "#mitre-search, " +
            "#technique-search, " +
            "[data-mitre-search]"
        );

        if (!searchInput) {
            return;
        }

        searchInput.addEventListener("input", function () {
            filterTechniques(this.value);
        });

        searchInput.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                this.value = "";
                filterTechniques("");
                this.blur();
            }
        });
    }

    /* ----------------------------------------------------------
       Filter buttons
    ---------------------------------------------------------- */

    function initializeFilters() {
        qsa(
            "[data-mitre-filter], " +
            ".mitre-filter, " +
            ".filter-button"
        ).forEach((button) => {
            button.addEventListener("click", function () {
                const filter =
                    this.dataset.mitreFilter ||
                    this.dataset.filter ||
                    this.dataset.value ||
                    "all";

                applyFilter(filter);
            });
        });
    }

    /* ----------------------------------------------------------
       Technique click handlers
    ---------------------------------------------------------- */

    function initializeTechniqueSelection() {
        qsa(
            "[data-technique], " +
            ".mitre-technique, " +
            ".technique-card, " +
            ".matrix-cell"
        ).forEach((element) => {
            element.addEventListener("click", function (event) {
                if (
                    event.target.closest("a") ||
                    event.target.closest("button")
                ) {
                    return;
                }

                selectTechnique(this);
            });

            element.setAttribute("tabindex", "0");

            element.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectTechnique(this);
                }
            });
        });
    }

    /* ----------------------------------------------------------
       Keyboard shortcut
    ---------------------------------------------------------- */

    function initializeKeyboardShortcuts() {
        document.addEventListener("keydown", function (event) {
            const activeElement = document.activeElement;

            const isTyping =
                activeElement &&
                (
                    activeElement.tagName === "INPUT" ||
                    activeElement.tagName === "TEXTAREA" ||
                    activeElement.isContentEditable
                );

            if (isTyping) {
                return;
            }

            if (event.key === "/") {
                const searchInput = qs(
                    "#mitre-search, " +
                    "#technique-search, " +
                    "[data-mitre-search]"
                );

                if (searchInput) {
                    event.preventDefault();
                    searchInput.focus();
                }
            }

            if (event.key === "Escape") {
                qsa(
                    ".mitre-technique.active, " +
                    ".technique-card.active, " +
                    ".matrix-cell.active"
                ).forEach((item) => {
                    item.classList.remove("active");
                });

                state.selectedTechnique = null;
            }
        });
    }

    /* ----------------------------------------------------------
       3D integration
    ---------------------------------------------------------- */

    function initializeThreeScene() {
        /*
         * Do not directly assume THREE exists.
         * The page can work normally even when Three.js is absent.
         */

        if (typeof window.THREE === "undefined") {
            document.documentElement.classList.add(
                "three-unavailable"
            );
            return;
        }

        document.documentElement.classList.add(
            "three-available"
        );

        document.dispatchEvent(
            new CustomEvent("ilf:mitre-three-ready")
        );
    }

    /* ----------------------------------------------------------
       EventBus integration
    ---------------------------------------------------------- */

    function initializeEventBus() {
        if (
            typeof window.EventBus === "undefined" ||
            typeof window.EventBus.on !== "function"
        ) {
            return;
        }

        window.EventBus.on(
            "mitre:select-technique",
            function (payload) {
                if (!payload) {
                    return;
                }

                const id =
                    payload.techniqueId ||
                    payload.id;

                if (!id) {
                    return;
                }

                const element = qs(
                    `[data-technique-id="${CSS.escape(id)}"]`
                );

                if (element) {
                    selectTechnique(element);
                }
            }
        );
    }

    /* ----------------------------------------------------------
       Live technique counters
    ---------------------------------------------------------- */

    function updateCounters() {
        const techniques = qsa(
            "[data-technique], " +
            ".mitre-technique, " +
            ".technique-card, " +
            ".matrix-cell"
        );

        const visible = techniques.filter(
            (item) => !item.hidden
        );

        const totalTarget = qs(
            "#mitre-total-techniques, " +
            "[data-mitre-total]"
        );

        const visibleTarget = qs(
            "#mitre-visible-techniques, " +
            "[data-mitre-visible]"
        );

        if (totalTarget) {
            totalTarget.textContent = techniques.length;
        }

        if (visibleTarget) {
            visibleTarget.textContent = visible.length;
        }
    }

    /* ----------------------------------------------------------
       Initialization
    ---------------------------------------------------------- */

    function init() {
        initializeSearch();
        initializeFilters();
        initializeTechniqueSelection();
        initializeKeyboardShortcuts();
        initializeThreeScene();
        initializeEventBus();
        updateCounters();

        document.documentElement.classList.add(
            "mitre-page-ready"
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    /* ----------------------------------------------------------
       Public API
    ---------------------------------------------------------- */

    window.MitrePage = {
        selectTechnique,
        filterTechniques,
        applyFilter,
        getState: function () {
            return {
                selectedTechnique: state.selectedTechnique,
                searchQuery: state.searchQuery,
                activeFilter: state.activeFilter
            };
        }
    };

})();