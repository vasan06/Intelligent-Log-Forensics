/* =========================================================
LANDING PAGE CONTROLLER
Intelligent Log Forensics
========================================================= */

(function () {
"use strict";

```
/*
 * Prevent duplicate initialization if Landing.js
 * accidentally gets included more than once.
 */
if (window.__ILF_LANDING_INITIALIZED__) {
    return;
}

window.__ILF_LANDING_INITIALIZED__ = true;


/* =====================================================
   DOM READY
===================================================== */

function start() {
    initializeLandingPage();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
        once: true
    });
} else {
    start();
}


/* =====================================================
   LANDING PAGE INITIALIZATION
===================================================== */

function initializeLandingPage() {
    initializeServerScene();
    initializeMitreScene();
    initializeNavigation();
    initializeTelemetryStatus();
    initializeScrollEffects();

    console.log(
        "[ILF] Landing page initialized successfully."
    );
}


/* =====================================================
   THREE.JS SERVER SCENE
===================================================== */

function initializeServerScene() {

    /*
     * This MUST match the HTML:
     *
     * <div id="hero-server-canvas"></div>
     */
    const container = document.getElementById(
        "hero-server-canvas"
    );

    if (!container) {
        console.warn(
            "[ILF] #hero-server-canvas was not found."
        );
        return;
    }

    if (typeof THREE === "undefined") {
        console.error(
            "[ILF] Three.js is not loaded."
        );
        return;
    }

    /*
     * ServerModel.js is expected to expose:
     *
     * window.ExplodedServerScene
     */
    if (
        typeof window.ExplodedServerScene !==
        "function"
    ) {
        console.error(
            "[ILF] ExplodedServerScene is not available. " +
            "Check ServerModel.js loading and class export."
        );
        return;
    }

    try {

        /*
         * Destroy an existing scene first.
         * This protects against accidental duplicate
         * initialization.
         */
        if (
            window.landingServerScene &&
            typeof window.landingServerScene.destroy ===
                "function"
        ) {
            window.landingServerScene.destroy();
        }

        window.landingServerScene =
            new window.ExplodedServerScene(container);

        console.log(
            "[ILF] 3D server scene initialized."
        );

    } catch (error) {

        console.error(
            "[ILF] Failed to initialize server scene:",
            error
        );
    }
}


/* =====================================================
   MITRE THREE.JS SCENE
===================================================== */

function initializeMitreScene() {

    const container = document.getElementById(
        "mitre-teaser-canvas"
    );

    /*
     * MITRE canvas is optional.
     * If the page does not have it, simply skip it.
     */
    if (!container) {
        return;
    }

    if (typeof THREE === "undefined") {
        console.warn(
            "[ILF] Three.js is not available for MITRE scene."
        );
        return;
    }

    /*
     * Different versions of the project may expose
     * different MITRE scene constructors.
     *
     * Try the known implementation first.
     */
    if (
        typeof window.MitreMatrix3D ===
        "function"
    ) {
        try {

            if (
                window.landingMitreScene &&
                typeof window.landingMitreScene.destroy ===
                    "function"
            ) {
                window.landingMitreScene.destroy();
            }

            window.landingMitreScene =
                new window.MitreMatrix3D(container);

            console.log(
                "[ILF] MITRE 3D scene initialized."
            );

        } catch (error) {

            console.error(
                "[ILF] Failed to initialize MITRE scene:",
                error
            );
        }

        return;
    }

    /*
     * Some versions may use AttackGraph instead.
     */
    if (
        typeof window.AttackGraph ===
        "function"
    ) {
        try {

            window.landingMitreScene =
                new window.AttackGraph(container);

            console.log(
                "[ILF] Attack graph initialized."
            );

        } catch (error) {

            console.error(
                "[ILF] Failed to initialize attack graph:",
                error
            );
        }

        return;
    }

    console.warn(
        "[ILF] No MITRE visualization constructor found."
    );
}


/* =====================================================
   NAVIGATION
===================================================== */

function initializeNavigation() {

    /*
     * IMPORTANT:
     *
     * Flask currently exposes:
     *
     * /login
     * /register
     *
     * It does NOT expose /auth.
     */

    const loginButtons =
        document.querySelectorAll(
            '[data-action="login"], ' +
            ".login-button"
        );

    const signupButtons =
        document.querySelectorAll(
            '[data-action="signup"], ' +
            ".signup-button"
        );


    loginButtons.forEach(function (button) {

        /*
         * Do not override normal <a href=""> navigation
         * unless the button is not already linked.
         */
        if (
            button.tagName === "A" &&
            button.getAttribute("href")
        ) {
            return;
        }

        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                window.location.href = "/login";
            }
        );
    });


    signupButtons.forEach(function (button) {

        if (
            button.tagName === "A" &&
            button.getAttribute("href")
        ) {
            return;
        }

        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                window.location.href = "/register";
            }
        );
    });
}


/* =====================================================
   TELEMETRY STATUS
===================================================== */

function initializeTelemetryStatus() {

    const statusElements =
        document.querySelectorAll(
            "[data-live-status]"
        );

    statusElements.forEach(
        function (element) {

            element.classList.add(
                "is-live"
            );
        }
    );


    /*
     * Existing landing page status indicators.
     */
    const statusDots =
        document.querySelectorAll(
            ".status-dot, .pulse-dot, .ticker-live-dot"
        );

    statusDots.forEach(
        function (dot) {

            dot.classList.add(
                "is-live"
            );
        }
    );
}


/* =====================================================
   TELEMETRY COUNTER ANIMATION
===================================================== */

function initializeTelemetryCounters() {

    const counters =
        document.querySelectorAll(
            "[data-metric]"
        );

    counters.forEach(
        function (element) {

            const rawValue =
                element.textContent.trim();

            /*
             * Do not modify non-numeric values.
             */
            const numericValue =
                parseFloat(
                    rawValue.replace(
                        /[^0-9.]/g,
                        ""
                    )
                );

            if (
                Number.isNaN(numericValue)
            ) {
                return;
            }

            element.dataset.initialized =
                "true";
        }
    );
}


/* =====================================================
   SCROLL EFFECTS
===================================================== */

function initializeScrollEffects() {

    const navigation =
        document.querySelector(
            ".site-nav"
        );

    if (!navigation) {
        return;
    }

    let ticking = false;

    function updateNavigation() {

        const scrollTop =
            window.scrollY ||
            window.pageYOffset ||
            0;

        if (scrollTop > 20) {
            navigation.classList.add(
                "is-scrolled"
            );
        } else {
            navigation.classList.remove(
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
                    updateNavigation
                );

                ticking = true;
            }
        },
        {
            passive: true
        }
    );

    updateNavigation();
}


/* =====================================================
   CLEANUP
===================================================== */

function cleanup() {

    if (
        window.landingServerScene &&
        typeof window.landingServerScene.destroy ===
            "function"
    ) {
        try {
            window.landingServerScene.destroy();
        } catch (error) {
            console.warn(
                "[ILF] Server scene cleanup failed:",
                error
            );
        }
    }


    if (
        window.landingMitreScene &&
        typeof window.landingMitreScene.destroy ===
            "function"
    ) {
        try {
            window.landingMitreScene.destroy();
        } catch (error) {
            console.warn(
                "[ILF] MITRE scene cleanup failed:",
                error
            );
        }
    }
}


window.addEventListener(
    "beforeunload",
    cleanup
);


/* =====================================================
   PUBLIC DEBUG HANDLE
===================================================== */

window.ILFLanding = {
    initialize: initializeLandingPage,
    serverScene: function () {
        return window.landingServerScene || null;
    },
    mitreScene: function () {
        return window.landingMitreScene || null;
    }
};
```

})();
