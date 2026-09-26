javascript
/* =========================================================
   INTELLIGENT LOG FORENSICS
   REGISTER PAGE
   Fresh 3D Particle Formation System
   File: app/static/js/register.js
========================================================= */

(() => {
    "use strict";

    /* =====================================================
       CONFIGURATION
    ====================================================== */

    const CONFIG = {
        particleCount: 1250,

        formationRadius: 1.85,

        idleRotationSpeed: 0.00032,

        mouseInfluence: 0.16,

        particleSize: 0.026,

        cameraDistance: 5.8,

        formationLerp: 0.035,

        interactionLerp: 0.06,

        pixelRatioLimit: 1.8,

        colors: {
            primary: 0x2563eb,
            cyan: 0x0891b2,
            violet: 0x7c3aed,
            white: 0xffffff
        }
    };


    /* =====================================================
       STATE
    ====================================================== */

    const state = {
        threeAvailable: false,

        rendererReady: false,

        animationFrame: null,

        pointer: {
            x: 0,
            y: 0,

            targetX: 0,
            targetY: 0
        },

        formation: {
            progress: 0,

            targetProgress: 0,

            phase: "INITIALIZING"
        },

        form: {
            name: false,

            email: false,

            password: 0,

            confirmation: false,

            terms: false
        },

        submitting: false,

        transitionStarted: false
    };


    /* =====================================================
       DOM REFERENCES
    ====================================================== */

    const DOM = {};


    function cacheDOM() {

        DOM.page =
            document.querySelector(".ilf-register-page");

        DOM.container =
            document.querySelector(
                ".ilf-register-three-container"
            );

        DOM.form =
            document.querySelector(
                ".ilf-register-form"
            );

        DOM.name =
            document.querySelector(
                "#register-name"
            );

        DOM.email =
            document.querySelector(
                "#register-email"
            );

        DOM.password =
            document.querySelector(
                "#register-password"
            );

        DOM.confirmPassword =
            document.querySelector(
                "#register-confirm-password"
            );

        DOM.terms =
            document.querySelector(
                '.ilf-consent input[type="checkbox"]'
            );

        DOM.submit =
            document.querySelector(
                ".ilf-register-submit"
            );

        DOM.passwordMeter =
            document.querySelector(
                ".ilf-password-meter"
            );

        DOM.passwordStrength =
            document.querySelector(
                "[data-password-strength]"
            );

        DOM.formationState =
            document.querySelector(
                "[data-formation-state]"
            );

        DOM.particleCount =
            document.querySelector(
                "[data-particle-count]"
            );

        DOM.transition =
            document.querySelector(
                ".ilf-register-transition"
            );
    }


    /* =====================================================
       INITIALIZATION
    ====================================================== */

    function initialize() {

        cacheDOM();

        if (!DOM.page || !DOM.form) {
            return;
        }

        initializeAlerts();

        initializePasswordControls();

        initializeFormInteraction();

        initializeValidation();

        initializeThreeScene();

        updateFormationState();

        updateParticleCounter();
    }


    /* =====================================================
       ALERTS
    ====================================================== */

    function initializeAlerts() {

        const closeButtons =
            document.querySelectorAll(
                ".ilf-alert-close"
            );

        closeButtons.forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const alert =
                        button.closest(".ilf-alert");

                    if (!alert) {
                        return;
                    }

                    alert.style.opacity = "0";

                    alert.style.transform =
                        "translateY(-5px)";

                    window.setTimeout(() => {
                        alert.remove();
                    }, 180);
                }
            );
        });
    }


    /* =====================================================
       PASSWORD CONTROLS
    ====================================================== */

    function initializePasswordControls() {

        const toggles =
            document.querySelectorAll(
                ".ilf-password-toggle"
            );

        toggles.forEach((toggle) => {

            toggle.addEventListener(
                "click",
                () => {

                    const targetId =
                        toggle.dataset.target;

                    const input =
                        document.getElementById(
                            targetId
                        );

                    if (!input) {
                        return;
                    }

                    const showing =
                        input.type === "text";

                    input.type =
                        showing
                            ? "password"
                            : "text";

                    toggle.classList.toggle(
                        "is-visible",
                        !showing
                    );

                    toggle.setAttribute(
                        "aria-label",
                        showing
                            ? "Show password"
                            : "Hide password"
                    );
                }
            );
        });


        if (DOM.password) {

            DOM.password.addEventListener(
                "input",
                () => {

                    const strength =
                        calculatePasswordStrength(
                            DOM.password.value
                        );

                    state.form.password =
                        strength;

                    updatePasswordMeter(
                        strength
                    );

                    updateConfirmationState();

                    updateFormationProgress();
                }
            );
        }


        if (DOM.confirmPassword) {

            DOM.confirmPassword.addEventListener(
                "input",
                () => {

                    updateConfirmationState();

                    updateFormationProgress();
                }
            );
        }
    }


    /* =====================================================
       PASSWORD STRENGTH
    ====================================================== */

    function calculatePasswordStrength(
        password
    ) {

        if (!password) {
            return 0;
        }

        let score = 0;

        if (password.length >= 8) {
            score++;
        }

        if (password.length >= 12) {
            score++;
        }

        if (/[A-Z]/.test(password)) {
            score++;
        }

        if (/[0-9]/.test(password)) {
            score++;
        }

        if (/[^A-Za-z0-9]/.test(password)) {
            score++;
        }

        if (score <= 1) {
            return 1;
        }

        if (score === 2) {
            return 2;
        }

        if (score === 3) {
            return 3;
        }

        return 4;
    }


    function updatePasswordMeter(
        strength
    ) {

        if (!DOM.passwordMeter) {
            return;
        }

        DOM.passwordMeter.className =
            "ilf-password-meter";

        if (strength > 0) {
            DOM.passwordMeter.classList.add(
                `is-level-${strength}`
            );
        }

        if (DOM.passwordStrength) {

            const labels = {
                0: "—",
                1: "WEAK",
                2: "FAIR",
                3: "STRONG",
                4: "SECURE"
            };

            DOM.passwordStrength.textContent =
                labels[strength];
        }
    }


    /* =====================================================
       FORM INTERACTION
    ====================================================== */

    function initializeFormInteraction() {

        const inputs =
            DOM.form.querySelectorAll(
                "input"
            );

        inputs.forEach((input) => {

            input.addEventListener(
                "focus",
                () => {

                    input
                        .closest(".ilf-field")
                        ?.classList.add(
                            "is-focused"
                        );
                }
            );

            input.addEventListener(
                "blur",
                () => {

                    input
                        .closest(".ilf-field")
                        ?.classList.remove(
                            "is-focused"
                        );

                    validateField(input);
                }
            );

            input.addEventListener(
                "input",
                () => {

                    clearFieldError(input);

                    updateFormState();

                    updateFormationProgress();
                }
            );

            input.addEventListener(
                "change",
                () => {

                    updateFormState();

                    updateFormationProgress();
                }
            );
        });
    }


    /* =====================================================
       FORM STATE
    ====================================================== */

    function updateFormState() {

        state.form.name =
            Boolean(
                DOM.name?.value.trim()
            );

        state.form.email =
            Boolean(
                DOM.email?.value.trim() &&
                DOM.email.checkValidity()
            );

        state.form.terms =
            Boolean(
                DOM.terms?.checked
            );

        updateFormationProgress();
    }


    function updateConfirmationState() {

        state.form.confirmation =
            Boolean(
                DOM.password &&
                DOM.confirmPassword &&
                DOM.password.value &&
                DOM.confirmPassword.value &&
                DOM.password.value ===
                    DOM.confirmPassword.value
            );
    }


    /* =====================================================
       FORMATION PROGRESS
    ====================================================== */

    function calculateFormationProgress() {

        let progress = 0;

        if (state.form.name) {
            progress += 0.15;
        }

        if (state.form.email) {
            progress += 0.15;
        }

        progress +=
            (state.form.password / 4) *
            0.35;

        if (state.form.confirmation) {
            progress += 0.2;
        }

        if (state.form.terms) {
            progress += 0.15;
        }

        return Math.min(
            1,
            progress
        );
    }


    function updateFormationProgress() {

        const progress =
            calculateFormationProgress();

        state.formation.targetProgress =
            progress;

        updateFormationState();
    }


    /* =====================================================
       FORMATION STATE TEXT
    ====================================================== */

    function updateFormationState() {

        const progress =
            state.formation.targetProgress;

        let phase = "INITIALIZING";

        if (progress >= 0.95) {
            phase = "READY";
        } else if (progress >= 0.72) {
            phase = "FORMING";
        } else if (progress >= 0.4) {
            phase = "STRUCTURING";
        } else if (progress >= 0.15) {
            phase = "GATHERING";
        }

        state.formation.phase =
            phase;

        if (DOM.formationState) {

            DOM.formationState.textContent =
                phase;
        }
    }


    /* =====================================================
       THREE.JS
    ====================================================== */

    function initializeThreeScene() {

        if (
            !DOM.container ||
            typeof window.THREE === "undefined"
        ) {

            createFallbackVisual();

            return;
        }

        state.threeAvailable = true;

        createThreeScene();
    }


    /* =====================================================
       THREE SCENE VARIABLES
    ====================================================== */

    let scene;

    let camera;

    let renderer;

    let particleSystem;

    let particleGeometry;

    let particleMaterial;

    let particlePositions;

    let particleTargets;

    let particleBasePositions;

    let particlePhases;

    let particleSizes;

    let sceneClock;

    let formationGroup;


    /* =====================================================
       THREE SCENE CREATION
    ====================================================== */

    function createThreeScene() {

        scene =
            new THREE.Scene();


        camera =
            new THREE.PerspectiveCamera(
                42,
                DOM.container.clientWidth /
                    DOM.container.clientHeight,
                0.1,
                100
            );


        camera.position.set(
            0,
            0.15,
            CONFIG.cameraDistance
        );


        renderer =
            new THREE.WebGLRenderer({
                alpha: true,
                antialias: true,
                powerPreference:
                    "high-performance"
            });


        renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio || 1,
                CONFIG.pixelRatioLimit
            )
        );


        renderer.setSize(
            DOM.container.clientWidth,
            DOM.container.clientHeight
        );


        renderer.outputColorSpace =
            THREE.SRGBColorSpace;


        renderer.setClearColor(
            0x000000,
            0
        );


        DOM.container.appendChild(
            renderer.domElement
        );


        formationGroup =
            new THREE.Group();


        scene.add(
            formationGroup
        );


        sceneClock =
            new THREE.Clock();


        createFormationParticles();

        createFormationCore();

        initializeThreeInteraction();

        initializeThreeResize();

        state.rendererReady = true;

        animate();
    }


    /* =====================================================
       PARTICLE FORMATION
    ====================================================== */

    function createFormationParticles() {

        const count =
            CONFIG.particleCount;


        particleGeometry =
            new THREE.BufferGeometry();


        particlePositions =
            new Float32Array(
                count * 3
            );


        particleTargets =
            new Float32Array(
                count * 3
            );


        particleBasePositions =
            new Float32Array(
                count * 3
            );


        particlePhases =
            new Float32Array(
                count
            );


        particleSizes =
            new Float32Array(
                count
            );


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const index =
                i * 3;


            /*
             * Start particles in a wide
             * floating cloud.
             */

            const start =
                createCloudPosition();


            particlePositions[index] =
                start.x;

            particlePositions[index + 1] =
                start.y;

            particlePositions[index + 2] =
                start.z;


            /*
             * Generate target geometry.
             */

            const target =
                createCrystalFormationPosition(
                    i,
                    count
                );


            particleTargets[index] =
                target.x;

            particleTargets[index + 1] =
                target.y;

            particleTargets[index + 2] =
                target.z;


            particleBasePositions[index] =
                target.x;

            particleBasePositions[index + 1] =
                target.y;

            particleBasePositions[index + 2] =
                target.z;


            particlePhases[i] =
                Math.random() *
                Math.PI *
                2;


            particleSizes[i] =
                0.5 +
                Math.random() *
                0.9;
        }


        particleGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(
                particlePositions,
                3
            )
        );


        particleGeometry.setAttribute(
            "aSize",
            new THREE.BufferAttribute(
                particleSizes,
                1
            )
        );


        /*
         * Use a soft procedural-looking
         * point material.
         */

        particleMaterial =
            new THREE.PointsMaterial({
                size:
                    CONFIG.particleSize,

                transparent: true,

                opacity: 0.82,

                depthWrite: false,

                blending:
                    THREE.AdditiveBlending,

                vertexColors: false,

                color:
                    CONFIG.colors.primary,

                sizeAttenuation: true
            });


        particleSystem =
            new THREE.Points(
                particleGeometry,
                particleMaterial
            );


        formationGroup.add(
            particleSystem
        );


        updateParticleCounter();
    }


    /* =====================================================
       CLOUD POSITION
    ====================================================== */

    function createCloudPosition() {

        const radius =
            2.3 +
            Math.random() *
            1.8;


        const theta =
            Math.random() *
            Math.PI *
            2;


        const phi =
            Math.acos(
                2 *
                    Math.random() -
                    1
            );


        return {
            x:
                radius *
                Math.sin(phi) *
                Math.cos(theta),

            y:
                radius *
                Math.sin(phi) *
                Math.sin(theta),

            z:
                radius *
                Math.cos(phi)
        };
    }


    /* =====================================================
       CRYSTAL / DATA FORMATION
    ====================================================== */

    function createCrystalFormationPosition(
        index,
        count
    ) {

        const t =
            index / count;


        /*
         * Main vertical crystal body.
         */

        const height =
            (t - 0.5) *
            3.25;


        /*
         * Width changes along the body,
         * producing an irregular crystalline
         * silhouette.
         */

        const normalized =
            Math.abs(t - 0.5) * 2;


        const width =
            (1 - normalized * 0.48) *
            CONFIG.formationRadius;


        const angle =
            index *
            2.3999632297;


        /*
         * Multiple nested layers prevent
         * the object from feeling like
         * a flat sphere.
         */

        const layer =
            index % 7;


        const layerOffset =
            layer *
            0.11;


        const radialNoise =
            Math.sin(
                index * 12.731
            ) *
            0.18;


        let radius =
            width *
            (
                0.35 +
                Math.random() *
                0.65
            );


        radius +=
            radialNoise +
            layerOffset;


        let x =
            Math.cos(angle) *
            radius;


        let y =
            height;


        let z =
            Math.sin(angle) *
            radius;


        /*
         * Add floating fragments
         * around the main object.
         */

        if (index % 11 === 0) {

            const fragment =
                0.35 +
                Math.random() *
                0.6;


            x *= fragment;

            z *= fragment;

            y +=
                (
                    Math.random() -
                    0.5
                ) *
                0.55;
        }


        /*
         * Slight twist creates depth.
         */

        const twist =
            height *
            0.24;


        const cos =
            Math.cos(twist);


        const sin =
            Math.sin(twist);


        const rotatedX =
            x * cos -
            z * sin;


        const rotatedZ =
            x * sin +
            z * cos;


        return {
            x: rotatedX,

            y,

            z: rotatedZ
        };
    }


    /* =====================================================
       FORMATION CORE
    ====================================================== */

    function createFormationCore() {

        const coreGeometry =
            new THREE.IcosahedronGeometry(
                0.48,
                2
            );


        const coreMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    CONFIG.colors.primary,

                transparent: true,

                opacity: 0.045,

                wireframe: true
            });


        const core =
            new THREE.Mesh(
                coreGeometry,
                coreMaterial
            );


        core.name =
            "formation-core";


        formationGroup.add(
            core
        );


        /*
         * Inner light point.
         */

        const glowGeometry =
            new THREE.SphereGeometry(
                0.18,
                16,
                16
            );


        const glowMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    CONFIG.colors.cyan,

                transparent: true,

                opacity: 0.2
            });


        const glow =
            new THREE.Mesh(
                glowGeometry,
                glowMaterial
            );


        glow.name =
            "formation-glow";


        formationGroup.add(
            glow
        );
    }


    /* =====================================================
       THREE INTERACTION
    ====================================================== */

    function initializeThreeInteraction() {

        DOM.container.addEventListener(
            "pointermove",
            (event) => {

                const rect =
                    DOM.container.getBoundingClientRect();


                const x =
                    (
                        event.clientX -
                        rect.left
                    ) /
                    rect.width;


                const y =
                    (
                        event.clientY -
                        rect.top
                    ) /
                    rect.height;


                state.pointer.targetX =
                    (x - 0.5) *
                    2;


                state.pointer.targetY =
                    (y - 0.5) *
                    2;
            }
        );


        DOM.container.addEventListener(
            "pointerleave",
            () => {

                state.pointer.targetX = 0;

                state.pointer.targetY = 0;
            }
        );
    }


    /* =====================================================
       RESIZE
    ====================================================== */

    function initializeThreeResize() {

        window.addEventListener(
            "resize",
            handleResize
        );
    }


    function handleResize() {

        if (
            !renderer ||
            !camera ||
            !DOM.container
        ) {
            return;
        }


        const width =
            DOM.container.clientWidth;


        const height =
            DOM.container.clientHeight;


        camera.aspect =
            width / height;


        camera.updateProjectionMatrix();


        renderer.setSize(
            width,
            height
        );
    }


    /* =====================================================
       ANIMATION
    ====================================================== */

    function animate() {

        if (!renderer) {
            return;
        }


        state.animationFrame =
            requestAnimationFrame(
                animate
            );


        const elapsed =
            sceneClock.getElapsedTime();


        /*
         * Smooth pointer movement.
         */

        state.pointer.x +=
            (
                state.pointer.targetX -
                state.pointer.x
            ) *
            CONFIG.interactionLerp;


        state.pointer.y +=
            (
                state.pointer.targetY -
                state.pointer.y
            ) *
            CONFIG.interactionLerp;


        /*
         * Smooth formation progress.
         */

        state.formation.progress +=
            (
                state.formation.targetProgress -
                state.formation.progress
            ) *
            CONFIG.formationLerp;


        updateParticleFormation(
            elapsed
        );


        updateFormationGroup(
            elapsed
        );


        renderer.render(
            scene,
            camera
        );
    }


    /* =====================================================
       PARTICLE ANIMATION
    ====================================================== */

    function updateParticleFormation(
        elapsed
    ) {

        if (
            !particleGeometry ||
            !particlePositions
        ) {
            return;
        }


        const positions =
            particleGeometry.attributes
                .position.array;


        const progress =
            state.formation.progress;


        for (
            let i = 0;
            i < CONFIG.particleCount;
            i++
        ) {

            const index =
                i * 3;


            const phase =
                particlePhases[i];


            /*
             * Start from target formation.
             */

            const targetX =
                particleTargets[index];


            const targetY =
                particleTargets[index + 1];


            const targetZ =
                particleTargets[index + 2];


            /*
             * Cloud expands when incomplete.
             */

            const cloudRadius =
                1 -
                progress;


            const cloud =
                createAnimatedCloudOffset(
                    i,
                    elapsed,
                    cloudRadius
                );


            const desiredX =
                targetX +
                cloud.x;


            const desiredY =
                targetY +
                cloud.y;


            const desiredZ =
                targetZ +
                cloud.z;


            /*
             * Organic micro movement.
             */

            const movement =
                0.018 +
                (1 - progress) *
                0.045;


            const driftX =
                Math.sin(
                    elapsed * 0.75 +
                    phase
                ) *
                movement;


            const driftY =
                Math.cos(
                    elapsed * 0.63 +
                    phase
                ) *
                movement;


            const driftZ =
                Math.sin(
                    elapsed * 0.82 +
                    phase * 1.7
                ) *
                movement;


            positions[index] +=
                (
                    desiredX +
                    driftX -
                    positions[index]
                ) *
                0.055;


            positions[index + 1] +=
                (
                    desiredY +
                    driftY -
                    positions[index + 1]
                ) *
                0.055;


            positions[index + 2] +=
                (
                    desiredZ +
                    driftZ -
                    positions[index + 2]
                ) *
                0.055;
        }


        particleGeometry.attributes
            .position.needsUpdate = true;
    }


    /* =====================================================
       CLOUD OFFSET
    ====================================================== */

    function createAnimatedCloudOffset(
        index,
        elapsed,
        intensity
    ) {

        if (intensity <= 0.01) {

            return {
                x: 0,
                y: 0,
                z: 0
            };
        }


        const seed =
            index * 0.173;


        const x =
            Math.sin(
                elapsed * 0.31 +
                seed
            ) *
            intensity *
            1.7;


        const y =
            Math.cos(
                elapsed * 0.27 +
                seed * 1.3
            ) *
            intensity *
            1.4;


        const z =
            Math.sin(
                elapsed * 0.38 +
                seed * 0.7
            ) *
            intensity *
            1.7;


        return {
            x,
            y,
            z
        };
    }


    /* =====================================================
       GROUP ANIMATION
    ====================================================== */

    function updateFormationGroup(
        elapsed
    ) {

        if (!formationGroup) {
            return;
        }


        /*
         * Slow floating movement.
         */

        formationGroup.position.y =
            Math.sin(
                elapsed * 0.65
            ) *
            0.045;


        /*
         * Mouse-controlled orientation.
         */

        const targetRotationY =
            state.pointer.x *
            CONFIG.mouseInfluence;


        const targetRotationX =
            state.pointer.y *
            CONFIG.mouseInfluence *
            0.65;


        formationGroup.rotation.y +=
            (
                targetRotationY -
                formationGroup.rotation.y
            ) *
            0.025;


        formationGroup.rotation.x +=
            (
                targetRotationX -
                formationGroup.rotation.x
            ) *
            0.025;


        /*
         * Continuous subtle rotation.
         */

        formationGroup.rotation.y +=
            CONFIG.idleRotationSpeed;


        /*
         * Slight scaling according to
         * registration progress.
         */

        const scale =
            0.92 +
            state.formation.progress *
            0.08;


        formationGroup.scale.lerp(
            new THREE.Vector3(
                scale,
                scale,
                scale
            ),
            0.035
        );
    }


    /* =====================================================
       PARTICLE COUNTER
    ====================================================== */

    function updateParticleCounter() {

        if (!DOM.particleCount) {
            return;
        }


        const visible =
            Math.floor(
                180 +
                state.formation.progress *
                1070
            );


        DOM.particleCount.textContent =
            String(visible)
                .padStart(3, "0");
    }


    /* =====================================================
       FALLBACK VISUAL
    ====================================================== */

    function createFallbackVisual() {

        if (!DOM.container) {
            return;
        }


        DOM.container.innerHTML = `
            <div
                style="
                    position:absolute;
                    inset:50% auto auto 50%;
                    width:180px;
                    height:180px;
                    transform:translate(-50%,-50%) rotate(45deg);
                    border:1px solid rgba(37,99,235,.18);
                    background:
                        linear-gradient(
                            135deg,
                            rgba(37,99,235,.08),
                            rgba(8,145,178,.03)
                        );
                    box-shadow:
                        0 0 80px rgba(37,99,235,.12),
                        inset 0 0 50px rgba(37,99,235,.05);
                    animation:
                        ilfFallbackFloat 5s ease-in-out infinite;
                "
            ></div>
        `;


        const style =
            document.createElement("style");


        style.textContent = `
            @keyframes ilfFallbackFloat {
                0%,100% {
                    transform:
                        translate(-50%,-50%)
                        rotate(45deg)
                        scale(.94);
                }

                50% {
                    transform:
                        translate(-50%,-54%)
                        rotate(135deg)
                        scale(1.04);
                }
            }
        `;


        document.head.appendChild(
            style
        );
    }


    /* =====================================================
       VALIDATION
    ====================================================== */

    function initializeValidation() {

        DOM.form.addEventListener(
            "submit",
            handleSubmit
        );
    }


    function validateField(
        input
    ) {

        if (
            !input ||
            input.type === "checkbox"
        ) {
            return true;
        }


        const field =
            input.closest(".ilf-field");


        if (!field) {
            return true;
        }


        clearFieldError(input);


        let valid = true;

        let message = "";


        if (
            input.required &&
            !input.value.trim()
        ) {

            valid = false;

            message =
                "This field is required.";
        }


        if (
            valid &&
            input.type === "email" &&
            input.value &&
            !input.checkValidity()
        ) {

            valid = false;

            message =
                "Enter a valid email address.";
        }


        if (
            valid &&
            input.name === "password" &&
            input.value &&
            input.value.length < 8
        ) {

            valid = false;

            message =
                "Password must contain at least 8 characters.";
        }


        if (
            valid &&
            input.name === "confirm_password" &&
            input.value !==
                DOM.password?.value
        ) {

            valid = false;

            message =
                "Passwords do not match.";
        }


        if (!valid) {

            showFieldError(
                input,
                message
            );
        }


        return valid;
    }


    function validateForm() {

        let valid = true;


        const fields =
            DOM.form.querySelectorAll(
                "input:not([type='checkbox'])"
            );


        fields.forEach((input) => {

            if (
                !validateField(input)
            ) {
                valid = false;
            }
        });


        if (
            DOM.terms &&
            !DOM.terms.checked
        ) {

            DOM.terms
                .closest(".ilf-consent")
                ?.classList.add(
                    "has-error"
                );

            valid = false;

        } else {

            DOM.terms
                ?.closest(".ilf-consent")
                ?.classList.remove(
                    "has-error"
                );
        }


        return valid;
    }


    function showFieldError(
        input,
        message
    ) {

        const field =
            input.closest(".ilf-field");


        if (!field) {
            return;
        }


        const error =
            field.querySelector(
                ".ilf-field-error"
            );


        if (!error) {
            return;
        }


        error.textContent =
            message;


        field.classList.add(
            "has-error"
        );
    }


    function clearFieldError(
        input
    ) {

        const field =
            input.closest(".ilf-field");


        if (!field) {
            return;
        }


        field.classList.remove(
            "has-error"
        );


        const error =
            field.querySelector(
                ".ilf-field-error"
            );


        if (error) {
            error.textContent = "";
        }
    }


    /* =====================================================
       SUBMIT
    ====================================================== */

    async function handleSubmit(
        event
    ) {

        event.preventDefault();


        if (state.submitting) {
            return;
        }


        if (!validateForm()) {

            updateFormationProgress();

            return;
        }


        state.submitting = true;


        if (DOM.submit) {

            DOM.submit.classList.add(
                "is-loading"
            );

            DOM.submit.disabled =
                true;
        }


        DOM.page?.classList.add(
            "is-authenticating"
        );


        state.formation.targetProgress =
            1;


        updateFormationState();


        /*
         * Give the formation enough time
         * to visibly complete before the
         * gateway transition.
         */

        await wait(450);


        startGatewayTransition();


        /*
         * IMPORTANT:
         *
         * We do not fake a successful
         * registration.
         *
         * After the visual transition,
         * the actual Flask POST is submitted.
         */

        await wait(900);


        submitNativeForm();
    }


    /* =====================================================
       NATIVE FORM SUBMISSION
    ====================================================== */

    function submitNativeForm() {

        /*
         * Remove our submit handler temporarily
         * so the browser performs the actual
         * server-side POST.
         */

        DOM.form.removeEventListener(
            "submit",
            handleSubmit
        );


        DOM.form.submit();
    }


    /* =====================================================
       GATEWAY TRANSITION
    ====================================================== */

    function startGatewayTransition() {

        if (
            state.transitionStarted ||
            !DOM.transition
        ) {
            return;
        }


        state.transitionStarted =
            true;


        DOM.transition.classList.add(
            "is-active"
        );


        /*
         * Animate formation toward
         * the gateway if Three.js exists.
         */

        if (
            formationGroup &&
            particlePositions
        ) {

            formationGroup.scale.set(
                1.08,
                1.08,
                1.08
            );


            animateFormationCollapse();
        }


        createTransitionParticles();
    }


    /* =====================================================
       FORMATION COLLAPSE
    ====================================================== */

    function animateFormationCollapse() {

        if (
            !formationGroup
        ) {
            return;
        }


        const start =
            performance.now();


        const duration =
            850;


        function collapse(
            timestamp
        ) {

            const elapsed =
                timestamp -
                start;


            const progress =
                Math.min(
                    elapsed /
                        duration,
                    1
                );


            const eased =
                1 -
                Math.pow(
                    1 - progress,
                    3
                );


            const scale =
                1.08 -
                eased *
                0.86;


            formationGroup.scale.set(
                scale,
                scale,
                scale
            );


            formationGroup.rotation.y +=
                0.04;


            if (
                progress < 1
            ) {

                requestAnimationFrame(
                    collapse
                );
            }
        }


        requestAnimationFrame(
            collapse
        );
    }


    /* =====================================================
       TRANSITION PARTICLES
    ====================================================== */

    function createTransitionParticles() {

        if (!DOM.transition) {
            return;
        }


        const container =
            DOM.transition.querySelector(
                ".ilf-transition-particles"
            );


        if (!container) {
            return;
        }


        container.innerHTML = "";


        const fragment =
            document.createDocumentFragment();


        for (
            let i = 0;
            i < 90;
            i++
        ) {

            const particle =
                document.createElement(
                    "span"
                );


            const angle =
                Math.random() *
                Math.PI *
                2;


            const distance =
                80 +
                Math.random() *
                320;


            const x =
                Math.cos(angle) *
                distance;


            const y =
                Math.sin(angle) *
                distance;


            particle.style.position =
                "absolute";


            particle.style.left =
                "50%";


            particle.style.top =
                "50%";


            particle.style.width =
                `${1 + Math.random() * 3}px`;


            particle.style.height =
                particle.style.width;


            particle.style.borderRadius =
                "50%";


            particle.style.background =
                Math.random() > 0.5
                    ? "#2563eb"
                    : "#0891b2";


            particle.style.opacity =
                "0";


            particle.style.boxShadow =
                "0 0 10px rgba(37,99,235,.35)";


            particle.style.setProperty(
                "--particle-x",
                `${x}px`
            );


            particle.style.setProperty(
                "--particle-y",
                `${y}px`
            );


            particle.style.animation =
                `ilfGatewayParticle ${
                    700 +
                    Math.random() *
                    700
                }ms ease-out forwards`;


            particle.style.animationDelay =
                `${Math.random() * 220}ms`;


            fragment.appendChild(
                particle
            );
        }


        container.appendChild(
            fragment
        );


        if (
            !document.getElementById(
                "ilf-gateway-particle-style"
            )
        ) {

            const style =
                document.createElement(
                    "style"
                );


            style.id =
                "ilf-gateway-particle-style";


            style.textContent = `
                @keyframes ilfGatewayParticle {

                    0% {
                        opacity: 0;
                        transform:
                            translate(-50%, -50%)
                            translate(
                                0,
                                0
                            )
                            scale(.2);
                    }

                    18% {
                        opacity: 1;
                    }

                    100% {
                        opacity: 0;
                        transform:
                            translate(-50%, -50%)
                            translate(
                                var(--particle-x),
                                var(--particle-y)
                            )
                            scale(1);
                    }
                }
            `;


            document.head.appendChild(
                style
            );
        }
    }


    /* =====================================================
       UTIL
    ====================================================== */

    function wait(
        milliseconds
    ) {

        return new Promise(
            (resolve) => {

                window.setTimeout(
                    resolve,
                    milliseconds
                );
            }
        );
    }


    /* =====================================================
       GLOBAL FORM STATE UPDATE
    ====================================================== */

    function syncFormState() {

        updateFormState();

        updateConfirmationState();

        updateFormationProgress();

        updateParticleCounter();
    }


    /* =====================================================
       PERIODIC VISUAL SYNC
    ====================================================== */

    window.setInterval(
        () => {

            if (
                state.rendererReady
            ) {

                updateParticleCounter();
            }

        },
        250
    );


    /* =====================================================
       BOOT
    ====================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();
    }

})();

