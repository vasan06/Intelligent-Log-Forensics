javascript
/* =========================================================
   INTELLIGENT LOG FORENSICS
   GLOBAL APPLICATION JAVASCRIPT
   File: app/static/js/app.js

   Responsibilities:
   - Toast notifications
   - Global loading helpers
   - Safe JSON utilities
   - Global click feedback
   - Accessibility helpers

   Page-specific functionality must NOT be placed here.
========================================================= */

(function () {
    "use strict";


    /* =====================================================
       DOM READY
    ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            initializeToastSystem();

            initializeFlashMessages();

            initializeButtonLoading();

            initializeAutoDismissAlerts();

        }
    );


    /* =====================================================
       TOAST SYSTEM
    ===================================================== */

    function initializeToastSystem() {

        const container =
            document.getElementById(
                "toast-container"
            );

        if (!container) {
            return;
        }

        /*
         * Expose globally because Flask flash
         * messages and page-specific JS can
         * use the same notification system.
         */

        window.showToast =
            function (
                message,
                type,
                duration
            ) {

                createToast(
                    container,
                    message,
                    type,
                    duration
                );

            };

    }


    function createToast(
        container,
        message,
        type,
        duration
    ) {

        if (
            message === undefined ||
            message === null ||
            String(message).trim() === ""
        ) {
            return;
        }


        const normalizedType =
            normalizeToastType(type);


        const toast =
            document.createElement(
                "div"
            );

        toast.className =
            "ilf-toast ilf-toast-" +
            normalizedType;


        toast.setAttribute(
            "role",
            normalizedType === "error"
                ? "alert"
                : "status"
        );


        const icon =
            getToastIcon(
                normalizedType
            );


        toast.innerHTML = `
            <div class="ilf-toast-icon">
                ${icon}
            </div>

            <div class="ilf-toast-content">
                <div class="ilf-toast-message"></div>
            </div>

            <button
                type="button"
                class="ilf-toast-close"
                aria-label="Dismiss notification"
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <line
                        x1="18"
                        y1="6"
                        x2="6"
                        y2="18"
                    />
                    <line
                        x1="6"
                        y1="6"
                        x2="18"
                        y2="18"
                    />
                </svg>
            </button>
        `;


        const messageElement =
            toast.querySelector(
                ".ilf-toast-message"
            );


        /*
         * textContent prevents accidental HTML
         * injection through server messages.
         */

        messageElement.textContent =
            String(message);


        container.appendChild(
            toast
        );


        /*
         * Force animation frame before
         * applying visible state.
         */

        requestAnimationFrame(
            function () {

                toast.classList.add(
                    "is-visible"
                );

            }
        );


        const closeButton =
            toast.querySelector(
                ".ilf-toast-close"
            );


        let timer =
            null;


        function removeToast() {

            if (
                toast.classList.contains(
                    "is-removing"
                )
            ) {
                return;
            }


            if (timer) {

                clearTimeout(
                    timer
                );

            }


            toast.classList.remove(
                "is-visible"
            );

            toast.classList.add(
                "is-removing"
            );


            window.setTimeout(
                function () {

                    toast.remove();

                },
                220
            );

        }


        closeButton.addEventListener(
            "click",
            removeToast
        );


        const toastDuration =
            Number.isFinite(
                Number(duration)
            )
                ? Number(duration)
                : 4200;


        timer =
            window.setTimeout(
                removeToast,
                toastDuration
            );

    }


    function initializeFlashMessages() {

        const dataElement =
            document.getElementById(
                "ilf-flash-messages"
            );

        if (!dataElement) {
            return;
        }


        const messages =
            JSON.parse(
                dataElement.dataset.messages || "[]"
            );

        if (!Array.isArray(messages)) {
            return;
        }


        messages.forEach(
            function (entry) {

                if (
                    !Array.isArray(entry) ||
                    entry.length < 2
                ) {
                    return;
                }


                window.showToast(
                    entry[1],
                    entry[0] === "message"
                        ? "info"
                        : entry[0]
                );

            }
        );

    }


    /* =====================================================
       TOAST TYPE
    ===================================================== */

    function normalizeToastType(type) {

        const value =
            String(
                type || "info"
            ).toLowerCase();


        const allowedTypes = [
            "success",
            "error",
            "warning",
            "info"
        ];


        return allowedTypes.includes(
            value
        )
            ? value
            : "info";

    }


    /* =====================================================
       TOAST ICONS
    ===================================================== */

    function getToastIcon(type) {

        const icons = {

            success: `
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <path d="M20 6L9 17l-5-5"/>
                </svg>
            `,

            error: `
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <circle
                        cx="12"
                        cy="12"
                        r="9"
                    />
                    <line
                        x1="12"
                        y1="8"
                        x2="12"
                        y2="12"
                    />
                    <line
                        x1="12"
                        y1="16"
                        x2="12.01"
                        y2="16"
                    />
                </svg>
            `,

            warning: `
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <path
                        d="M10.3 3.6L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.6a2 2 0 00-3.4 0z"
                    />
                    <line
                        x1="12"
                        y1="9"
                        x2="12"
                        y2="13"
                    />
                    <line
                        x1="12"
                        y1="17"
                        x2="12.01"
                        y2="17"
                    />
                </svg>
            `,

            info: `
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <circle
                        cx="12"
                        cy="12"
                        r="9"
                    />
                    <line
                        x1="12"
                        y1="10"
                        x2="12"
                        y2="16"
                    />
                    <line
                        x1="12"
                        y1="7"
                        x2="12.01"
                        y2="7"
                    />
                </svg>
            `

        };


        return icons[type] ||
            icons.info;

    }


    /* =====================================================
       BUTTON LOADING
    ===================================================== */

    function initializeButtonLoading() {

        document.addEventListener(
            "submit",
            function (event) {

                const form =
                    event.target;


                if (
                    !(form instanceof HTMLFormElement)
                ) {
                    return;
                }


                /*
                 * Don't automatically lock forms
                 * that explicitly opt out.
                 */

                if (
                    form.dataset.noAutoLoading ===
                    "true"
                ) {
                    return;
                }


                const submitButton =
                    form.querySelector(
                        'button[type="submit"], input[type="submit"]'
                    );


                if (!submitButton) {
                    return;
                }


                /*
                 * Keep original content so it
                 * can be restored if necessary.
                 */

                if (
                    !submitButton.dataset.originalContent
                ) {

                    submitButton.dataset.originalContent =
                        submitButton.innerHTML;

                }


                submitButton.disabled =
                    true;

                submitButton.classList.add(
                    "is-loading"
                );


                /*
                 * Don't replace the entire button
                 * with text if the page has its own
                 * loading component.
                 */

                if (
                    submitButton.dataset.loadingText
                ) {

                    submitButton.textContent =
                        submitButton.dataset.loadingText;

                }

            }
        );

    }


    /* =====================================================
       AUTO DISMISS SERVER ALERTS
    ===================================================== */

    function initializeAutoDismissAlerts() {

        const alerts =
            document.querySelectorAll(
                ".alert[data-auto-dismiss]"
            );


        alerts.forEach(
            function (alert) {

                const duration =
                    parseInt(
                        alert.dataset.autoDismiss,
                        10
                    );


                if (
                    !Number.isFinite(duration) ||
                    duration <= 0
                ) {
                    return;
                }


                window.setTimeout(
                    function () {

                        alert.classList.add(
                            "is-hidden"
                        );


                        window.setTimeout(
                            function () {

                                alert.remove();

                            },
                            200
                        );

                    },
                    duration
                );

            }
        );

    }


    /* =====================================================
       SAFE JSON PARSER
    ===================================================== */

    window.ilfParseJSON =
        function (
            value,
            fallback
        ) {

            try {

                return JSON.parse(
                    value
                );

            } catch (error) {

                return fallback !== undefined
                    ? fallback
                    : null;

            }

        };


    /* =====================================================
       BUTTON LOADING HELPERS
    ===================================================== */

    window.ilfSetButtonLoading =
        function (
            button,
            loading,
            loadingText
        ) {

            if (!button) {
                return;
            }


            if (
                !button.dataset.originalContent
            ) {

                button.dataset.originalContent =
                    button.innerHTML;

            }


            if (loading) {

                button.disabled =
                    true;

                button.classList.add(
                    "is-loading"
                );


                if (loadingText) {

                    button.textContent =
                        loadingText;

                }

            } else {

                button.disabled =
                    false;

                button.classList.remove(
                    "is-loading"
                );


                if (
                    button.dataset.originalContent
                ) {

                    button.innerHTML =
                        button.dataset.originalContent;

                }

            }

        };


    /* =====================================================
       GLOBAL ERROR REPORTING
    ===================================================== */

    window.addEventListener(
        "error",
        function (event) {

            /*
             * We intentionally do not show raw
             * JavaScript errors to users.
             *
             * Development debugging remains
             * available through DevTools.
             */

            if (
                window.__ILF_DEBUG__ === true
            ) {

                console.debug(
                    "[ILF]",
                    event.error ||
                    event.message
                );

            }

        }
    );


    /* =====================================================
       UNHANDLED PROMISE REJECTION
    ===================================================== */

    window.addEventListener(
        "unhandledrejection",
        function (event) {

            if (
                window.__ILF_DEBUG__ === true
            ) {

                console.debug(
                    "[ILF] Unhandled promise rejection:",
                    event.reason
                );

            }

        }
    );


})();
