javascript
/* =========================================================
   INTELLIGENT LOG FORENSICS
   APPLICATION SHELL
   File: app/static/js/app_shell.js

   Responsibilities:
   - User dropdown
   - Mobile navigation
   - Outside-click handling
   - Escape-key handling
   - Page navigation transition
   - Header scroll state
   - Accessibility states

   No framework required.
   No fake API calls.
========================================================= */

(function () {
    "use strict";


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        initializeApplicationShell
    );


    function initializeApplicationShell() {

        initializeUserMenu();

        initializeMobileNavigation();

        initializeOutsideClick();

        initializeKeyboardControls();

        initializeNavigationTransitions();

        initializeHeaderScrollState();

    }


    /* =====================================================
       USER MENU
    ===================================================== */

    function initializeUserMenu() {

        const menu =
            document.querySelector(
                ".ilf-user-menu"
            );

        const trigger =
            document.querySelector(
                ".ilf-user-trigger"
            );

        if (!menu || !trigger) {
            return;
        }


        trigger.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                const isOpen =
                    menu.classList.contains(
                        "is-open"
                    );

                closeAllMenus();

                if (!isOpen) {

                    menu.classList.add(
                        "is-open"
                    );

                    trigger.setAttribute(
                        "aria-expanded",
                        "true"
                    );

                }

            }
        );

    }


    /* =====================================================
       CLOSE ALL MENUS
    ===================================================== */

    function closeAllMenus() {

        const userMenu =
            document.querySelector(
                ".ilf-user-menu"
            );

        const userTrigger =
            document.querySelector(
                ".ilf-user-trigger"
            );

        if (userMenu) {

            userMenu.classList.remove(
                "is-open"
            );

        }

        if (userTrigger) {

            userTrigger.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    }


    /* =====================================================
       MOBILE NAVIGATION
    ===================================================== */

    function initializeMobileNavigation() {

        const header =
            document.querySelector(
                ".ilf-top-header"
            );

        const trigger =
            document.querySelector(
                ".ilf-mobile-menu-trigger"
            );

        if (!header || !trigger) {
            return;
        }


        trigger.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                const isOpen =
                    header.classList.contains(
                        "mobile-open"
                    );


                if (isOpen) {

                    closeMobileNavigation();

                } else {

                    openMobileNavigation();

                }

            }
        );


        /*
         * Close mobile navigation after selecting
         * a navigation destination.
         */

        const mobileLinks =
            document.querySelectorAll(
                ".ilf-mobile-nav-item"
            );


        mobileLinks.forEach(
            function (link) {

                link.addEventListener(
                    "click",
                    function () {

                        closeMobileNavigation();

                    }
                );

            }
        );

    }


    function openMobileNavigation() {

        const header =
            document.querySelector(
                ".ilf-top-header"
            );

        const trigger =
            document.querySelector(
                ".ilf-mobile-menu-trigger"
            );

        if (!header || !trigger) {
            return;
        }


        closeAllMenus();


        header.classList.add(
            "mobile-open"
        );

        trigger.classList.add(
            "is-open"
        );

        trigger.setAttribute(
            "aria-expanded",
            "true"
        );

    }


    function closeMobileNavigation() {

        const header =
            document.querySelector(
                ".ilf-top-header"
            );

        const trigger =
            document.querySelector(
                ".ilf-mobile-menu-trigger"
            );

        if (!header || !trigger) {
            return;
        }


        header.classList.remove(
            "mobile-open"
        );

        trigger.classList.remove(
            "is-open"
        );

        trigger.setAttribute(
            "aria-expanded",
            "false"
        );

    }


    /* =====================================================
       OUTSIDE CLICK
    ===================================================== */

    function initializeOutsideClick() {

        document.addEventListener(
            "click",
            function (event) {

                const userMenu =
                    document.querySelector(
                        ".ilf-user-menu"
                    );

                const mobileHeader =
                    document.querySelector(
                        ".ilf-top-header"
                    );


                /*
                 * User dropdown
                 */

                if (
                    userMenu &&
                    !userMenu.contains(
                        event.target
                    )
                ) {

                    closeAllMenus();

                }


                /*
                 * Mobile navigation.
                 *
                 * Don't close it when the click
                 * happens inside the navigation/header.
                 */

                if (
                    mobileHeader &&
                    mobileHeader.classList.contains(
                        "mobile-open"
                    )
                ) {

                    const navigation =
                        document.querySelector(
                            ".ilf-mobile-navigation"
                        );

                    const trigger =
                        document.querySelector(
                            ".ilf-mobile-menu-trigger"
                        );


                    const clickedInsideNavigation =
                        navigation &&
                        navigation.contains(
                            event.target
                        );

                    const clickedTrigger =
                        trigger &&
                        trigger.contains(
                            event.target
                        );


                    if (
                        !clickedInsideNavigation &&
                        !clickedTrigger
                    ) {

                        closeMobileNavigation();

                    }

                }

            }
        );

    }


    /* =====================================================
       KEYBOARD CONTROLS
    ===================================================== */

    function initializeKeyboardControls() {

        document.addEventListener(
            "keydown",
            function (event) {

                /*
                 * Escape closes everything.
                 */

                if (
                    event.key === "Escape"
                ) {

                    closeAllMenus();

                    closeMobileNavigation();

                    const trigger =
                        document.querySelector(
                            ".ilf-user-trigger"
                        );

                    if (trigger) {
                        trigger.focus();
                    }

                }

            }
        );

    }


    /* =====================================================
       NAVIGATION TRANSITIONS
    ===================================================== */

    function initializeNavigationTransitions() {

        const transition =
            document.querySelector(
                ".ilf-page-transition"
            );

        if (!transition) {
            return;
        }


        const links =
            document.querySelectorAll(
                "a[href]"
            );


        links.forEach(
            function (link) {

                link.addEventListener(
                    "click",
                    function (event) {

                        /*
                         * Respect browser/system behaviors.
                         */

                        if (
                            event.defaultPrevented
                        ) {
                            return;
                        }


                        if (
                            event.button !== 0
                        ) {
                            return;
                        }


                        if (
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                        ) {
                            return;
                        }


                        const href =
                            link.getAttribute(
                                "href"
                            );


                        if (
                            !href ||
                            href === "#" ||
                            href.startsWith(
                                "javascript:"
                            )
                        ) {
                            return;
                        }


                        /*
                         * Don't animate external URLs.
                         */

                        if (
                            link.origin &&
                            link.origin !==
                            window.location.origin
                        ) {
                            return;
                        }


                        /*
                         * Don't animate anchors
                         * on the same page.
                         */

                        if (
                            href.startsWith("#")
                        ) {
                            return;
                        }


                        /*
                         * Don't interfere with
                         * downloads.
                         */

                        if (
                            link.hasAttribute(
                                "download"
                            )
                        ) {
                            return;
                        }


                        /*
                         * Don't intercept
                         * logout/authentication
                         * requests.
                         *
                         * Backend should control
                         * those directly.
                         */

                        if (
                            href.includes(
                                "/logout"
                            )
                        ) {
                            return;
                        }


                        event.preventDefault();


                        transition.classList.add(
                            "is-active"
                        );


                        window.setTimeout(
                            function () {

                                window.location.href =
                                    link.href;

                            },
                            170
                        );

                    }
                );

            }
        );


        /*
         * Remove transition after browser
         * restores page from cache.
         */

        window.addEventListener(
            "pageshow",
            function () {

                transition.classList.remove(
                    "is-active"
                );

            }
        );

    }


    /* =====================================================
       HEADER SCROLL STATE
    ===================================================== */

    function initializeHeaderScrollState() {

        const header =
            document.querySelector(
                ".ilf-top-header"
            );

        if (!header) {
            return;
        }


        let ticking = false;


        function updateHeader() {

            const scrollPosition =
                window.scrollY;


            if (
                scrollPosition > 8
            ) {

                header.classList.add(
                    "is-scrolled"
                );

            } else {

                header.classList.remove(
                    "is-scrolled"
                );

            }


            ticking = false;

        }


        window.addEventListener(
            "scroll",
            function () {

                if (!ticking) {

                    window.requestAnimationFrame(
                        updateHeader
                    );

                    ticking = true;

                }

            },
            {
                passive: true
            }
        );


        updateHeader();

    }


    /* =====================================================
       RESIZE HANDLING
    ===================================================== */

    window.addEventListener(
        "resize",
        function () {

            /*
             * When returning from mobile to desktop,
             * clear the mobile menu state.
             */

            if (
                window.innerWidth > 1050
            ) {

                closeMobileNavigation();

            }

        }
    );


})();

