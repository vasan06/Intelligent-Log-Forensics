javascript
/* =========================================================
   INTELLIGENT LOG FORENSICS
   FORGOT PASSWORD / ACCOUNT RECOVERY
   File: app/static/js/forgot_password.js
========================================================= */

(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        initializeRecoveryPage();
    });


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    function initializeRecoveryPage() {
        const page = document.querySelector(".ilf-recovery-page");

        if (!page) {
            return;
        }

        initializeRecoveryScene();
        initializeEmailValidation();
        initializeForm();
        initializeAlerts();
        initializePointerInteraction();
    }


    /* =====================================================
       RECOVERY 3D / PARTICLE SCENE
    ===================================================== */

    function initializeRecoveryScene() {
        const container = document.querySelector(
            ".ilf-recovery-three-container"
        );

        const particleLayer = document.querySelector(
            ".ilf-recovery-particles"
        );

        if (!container || !particleLayer) {
            return;
        }

        /*
         * We intentionally keep this scene lightweight.
         * No framework is required.
         *
         * The particles form a loose recovery field around
         * the central core instead of looking like a normal
         * 2D grid.
         */

        const particleCount =
            window.innerWidth <= 520 ? 28 :
            window.innerWidth <= 820 ? 38 :
            55;

        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement("span");

            particle.className =
                "ilf-recovery-particle";

            const angle =
                Math.random() * Math.PI * 2;

            const radius =
                95 + Math.random() * 185;

            const depth =
                Math.random() * 2 - 1;

            const size =
                1.5 + Math.random() * 3;

            const duration =
                4 + Math.random() * 7;

            const delay =
                Math.random() * -8;

            particle.style.width =
                `${size}px`;

            particle.style.height =
                `${size}px`;

            particle.style.left =
                "50%";

            particle.style.top =
                "50%";

            particle.style.setProperty(
                "--particle-angle",
                `${angle}rad`
            );

            particle.style.setProperty(
                "--particle-radius",
                `${radius}px`
            );

            particle.style.setProperty(
                "--particle-depth",
                depth.toFixed(2)
            );

            particle.style.setProperty(
                "--particle-duration",
                `${duration}s`
            );

            particle.style.setProperty(
                "--particle-delay",
                `${delay}s`
            );

            particleLayer.appendChild(
                particle
            );

            particles.push({
                element: particle,
                angle,
                radius,
                depth,
                speed:
                    0.00015 +
                    Math.random() * 0.00025,
                phase:
                    Math.random() * Math.PI * 2
            });
        }


        /*
         * Add required particle styling dynamically so
         * the page remains self-contained.
         */

        injectParticleStyles();


        let animationFrame = null;

        function animate(timestamp) {

            particles.forEach((particle) => {

                particle.angle +=
                    particle.speed *
                    16;

                const breathing =
                    Math.sin(
                        timestamp * 0.0007 +
                        particle.phase
                    ) * 8;

                const radius =
                    particle.radius +
                    breathing;

                const x =
                    Math.cos(particle.angle) *
                    radius;

                const y =
                    Math.sin(particle.angle) *
                    radius *
                    0.72;

                const scale =
                    0.72 +
                    (
                        (particle.depth + 1) /
                        2
                    ) * 0.55;

                particle.element.style.transform =
                    `translate3d(
                        calc(-50% + ${x}px),
                        calc(-50% + ${y}px),
                        0
                    ) scale(${scale})`;

            });

            animationFrame =
                requestAnimationFrame(
                    animate
                );
        }


        animationFrame =
            requestAnimationFrame(
                animate
            );


        /*
         * Pause expensive animation when page is hidden.
         */

        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.hidden &&
                    animationFrame
                ) {
                    cancelAnimationFrame(
                        animationFrame
                    );

                    animationFrame = null;

                    return;
                }

                if (
                    !document.hidden &&
                    !animationFrame
                ) {
                    animationFrame =
                        requestAnimationFrame(
                            animate
                        );
                }

            }
        );
    }


    /* =====================================================
       PARTICLE STYLES
    ===================================================== */

    function injectParticleStyles() {

        if (
            document.getElementById(
                "ilf-recovery-particle-styles"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "ilf-recovery-particle-styles";

        style.textContent = `
            .ilf-recovery-particle {
                position: absolute;

                display: block;

                border-radius: 50%;

                background:
                    rgba(37, 99, 235, 0.48);

                box-shadow:
                    0 0 9px
                    rgba(37, 99, 235, 0.18);

                pointer-events: none;

                will-change:
                    transform,
                    opacity;

                opacity:
                    calc(
                        0.28 +
                        (
                            (var(--particle-depth) + 1)
                            * 0.22
                        )
                    );
            }

            .ilf-recovery-particle:nth-child(3n) {
                background:
                    rgba(8, 145, 178, 0.42);

                box-shadow:
                    0 0 9px
                    rgba(8, 145, 178, 0.16);
            }

            .ilf-recovery-particle:nth-child(7n) {
                background:
                    rgba(124, 58, 237, 0.34);

                box-shadow:
                    0 0 10px
                    rgba(124, 58, 237, 0.13);
            }

            @media (prefers-reduced-motion: reduce) {
                .ilf-recovery-particle {
                    opacity: 0.45;
                }
            }
        `;

        document.head.appendChild(style);
    }


    /* =====================================================
       POINTER INTERACTION
    ===================================================== */

    function initializePointerInteraction() {

        const container =
            document.querySelector(
                ".ilf-recovery-three-container"
            );

        const core =
            document.querySelector(
                ".ilf-recovery-core"
            );

        if (!container || !core) {
            return;
        }


        let targetX = 0;
        let targetY = 0;

        let currentX = 0;
        let currentY = 0;


        container.addEventListener(
            "pointermove",
            (event) => {

                const rect =
                    container.getBoundingClientRect();

                const x =
                    (
                        event.clientX -
                        rect.left
                    ) /
                    rect.width -
                    0.5;

                const y =
                    (
                        event.clientY -
                        rect.top
                    ) /
                    rect.height -
                    0.5;

                targetX = x * 10;
                targetY = y * 8;
            }
        );


        container.addEventListener(
            "pointerleave",
            () => {
                targetX = 0;
                targetY = 0;
            }
        );


        function animateCore() {

            currentX +=
                (targetX - currentX) *
                0.055;

            currentY +=
                (targetY - currentY) *
                0.055;


            core.style.transform =
                `translate(
                    calc(-50% + ${currentX}px),
                    calc(-50% + ${currentY}px)
                )`;

            requestAnimationFrame(
                animateCore
            );
        }


        animateCore();
    }


    /* =====================================================
       EMAIL VALIDATION
    ===================================================== */

    function initializeEmailValidation() {

        const input =
            document.querySelector(
                "#recovery-email"
            );

        const field =
            input?.closest(
                ".ilf-field"
            );

        const state =
            document.querySelector(
                "[data-field-state]"
            );

        const error =
            field?.querySelector(
                ".ilf-field-error"
            );


        if (!input || !field) {
            return;
        }


        input.addEventListener(
            "focus",
            () => {

                field.classList.add(
                    "is-focused"
                );
            }
        );


        input.addEventListener(
            "blur",
            () => {

                field.classList.remove(
                    "is-focused"
                );

                validateEmail();
            }
        );


        input.addEventListener(
            "input",
            () => {

                if (
                    field.classList.contains(
                        "has-error"
                    )
                ) {
                    validateEmail();
                }
            }
        );


        function validateEmail() {

            const value =
                input.value.trim();

            field.classList.remove(
                "has-error",
                "is-valid"
            );

            if (!value) {

                if (state) {
                    state.textContent =
                        "REQUIRED";
                }

                if (error) {
                    error.textContent = "";
                }

                return false;
            }


            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


            if (!emailPattern.test(value)) {

                field.classList.add(
                    "has-error"
                );

                if (state) {
                    state.textContent =
                        "INVALID";
                }

                if (error) {
                    error.textContent =
                        "Enter a valid email address.";
                }

                return false;
            }


            field.classList.add(
                "is-valid"
            );

            if (state) {
                state.textContent =
                    "VALID";
            }

            if (error) {
                error.textContent = "";
            }

            return true;
        }


        input._validateRecoveryEmail =
            validateEmail;
    }


    /* =====================================================
       FORM SUBMISSION
    ===================================================== */

    function initializeForm() {

        const form =
            document.querySelector(
                ".ilf-recovery-form"
            );

        const button =
            document.querySelector(
                ".ilf-recovery-submit"
            );

        const page =
            document.querySelector(
                ".ilf-recovery-page"
            );

        if (!form || !button || !page) {
            return;
        }


        form.addEventListener(
            "submit",
            (event) => {

                const input =
                    document.querySelector(
                        "#recovery-email"
                    );

                const validator =
                    input?._validateRecoveryEmail;


                if (
                    validator &&
                    !validator()
                ) {
                    event.preventDefault();

                    input?.focus();

                    return;
                }


                /*
                 * Do NOT intercept the actual POST.
                 *
                 * Flask remains responsible for:
                 * - processing the request
                 * - generating the reset token
                 * - sending the email
                 * - redirecting / flashing result
                 *
                 * JS only provides the visual state.
                 */

                button.classList.add(
                    "is-loading"
                );

                button.disabled = true;

                page.classList.add(
                    "is-authenticating"
                );


                updateRecoveryState(
                    "RECOVERY CHANNEL ACTIVE"
                );


                updateProcessStep(2);


                /*
                 * If backend returns normally,
                 * browser navigation will happen naturally.
                 *
                 * No fake success response is generated.
                 */
            }
        );
    }


    /* =====================================================
       RECOVERY STATE
    ===================================================== */

    function updateRecoveryState(message) {

        const state =
            document.querySelector(
                "[data-recovery-state]"
            );

        if (!state) {
            return;
        }

        state.textContent =
            message;
    }


    /* =====================================================
       PROCESS STEPS
    ===================================================== */

    function updateProcessStep(stepNumber) {

        const steps =
            document.querySelectorAll(
                "[data-process-step]"
            );

        steps.forEach((step) => {

            const number =
                Number(
                    step.dataset.processStep
                );

            step.classList.remove(
                "is-active",
                "is-complete"
            );

            if (number < stepNumber) {
                step.classList.add(
                    "is-complete"
                );
            }

            if (number === stepNumber) {
                step.classList.add(
                    "is-active"
                );
            }
        });
    }


    /* =====================================================
       FLASH ALERTS
    ===================================================== */

    function initializeAlerts() {

        const alerts =
            document.querySelectorAll(
                ".ilf-alert"
            );


        alerts.forEach((alert) => {

            const close =
                alert.querySelector(
                    ".ilf-alert-close"
                );


            if (close) {

                close.addEventListener(
                    "click",
                    () => {

                        alert.style.opacity =
                            "0";

                        alert.style.transform =
                            "translateY(-5px)";

                        alert.style.transition =
                            "opacity 180ms ease, transform 180ms ease";


                        window.setTimeout(
                            () => {
                                alert.remove();
                            },
                            190
                        );
                    }
                );
            }
        });
    }

})();

