/* =========================================================
   INTELLIGENT LOG FORENSICS
   LOGIN PAGE — INTERACTION + 3D GATEWAY
   File: app/static/js/login.js
========================================================= */

(function () {
    "use strict";

    /* =====================================================
       CONFIG
    ===================================================== */

    const CONFIG = {
        particleCount: 180,
        trackerCount: 4,

        cameraDistance: 7,

        rotationSpeed: 0.00035,

        mouseInfluence: 0.22,

        gatewayColor: 0x2563eb,
        cyanColor: 0x06b6d4,
        violetColor: 0x7c3aed,

        transitionDelay: 850
    };


    /* =====================================================
       STATE
    ===================================================== */

    const state = {
        initialized: false,
        authenticating: false,

        mouseX: 0,
        mouseY: 0,

        targetMouseX: 0,
        targetMouseY: 0,

        time: 0,

        renderer: null,
        scene: null,
        camera: null,

        gatewayGroup: null,
        particleSystem: null,

        animationFrame: null,

        cleanupFunctions: []
    };


    /* =====================================================
       DOM
    ===================================================== */

    let page;
    let stage;
    let threeContainer;

    let form;
    let emailInput;
    let passwordInput;

    let passwordToggle;
    let submitButton;

    let transitionLayer;


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    document.addEventListener("DOMContentLoaded", initialize);


    function initialize() {

        page = document.querySelector(".ilf-auth-page");

        if (!page) {
            return;
        }

        stage =
            document.querySelector(".ilf-gateway-stage");

        threeContainer =
            document.querySelector(".ilf-three-container");

        form =
            document.querySelector(".ilf-signin-form");

        emailInput =
            document.querySelector("#email");

        passwordInput =
            document.querySelector("#password");

        passwordToggle =
            document.querySelector(".ilf-password-toggle");

        submitButton =
            document.querySelector(".ilf-submit-button");

        transitionLayer =
            document.querySelector(".ilf-gateway-transition");


        initializeGateway();

        initializeMouseTracking();

        initializePasswordToggle();

        initializeFormValidation();

        initializeAuthentication();

        initializeAlerts();

        initializeParticles();

        initializeTrackers();

        state.initialized = true;
    }


    /* =====================================================
       THREE.JS GATEWAY
    ===================================================== */

    function initializeGateway() {

        if (!stage || !threeContainer) {
            return;
        }

        if (
            typeof THREE === "undefined"
        ) {
            stage.classList.add("webgl-failed");

            return;
        }


        try {

            state.scene =
                new THREE.Scene();


            state.camera =
                new THREE.PerspectiveCamera(
                    38,
                    getStageAspectRatio(),
                    0.1,
                    100
                );


            state.camera.position.z =
                CONFIG.cameraDistance;


            state.renderer =
                new THREE.WebGLRenderer({
                    alpha: true,
                    antialias: true,
                    powerPreference: "high-performance"
                });


            state.renderer.setPixelRatio(
                Math.min(
                    window.devicePixelRatio || 1,
                    2
                )
            );


            state.renderer.setSize(
                threeContainer.clientWidth,
                threeContainer.clientHeight,
                false
            );


            state.renderer.outputColorSpace =
                THREE.SRGBColorSpace;


            state.renderer.toneMapping =
                THREE.ACESFilmicToneMapping;


            state.renderer.toneMappingExposure =
                1.05;


            threeContainer.appendChild(
                state.renderer.domElement
            );


            createGateway();

            createGatewayLights();

            createParticleSystem();

            createFloatingDataObjects();

            createOrbitalElements();


            stage.classList.add(
                "is-webgl"
            );


            animate();


            window.addEventListener(
                "resize",
                handleResize
            );


            state.cleanupFunctions.push(
                function () {
                    window.removeEventListener(
                        "resize",
                        handleResize
                    );
                }
            );

        } catch (error) {

            console.error(
                "ILF gateway initialization failed:",
                error
            );

            stage.classList.add(
                "webgl-failed"
            );
        }
    }


    /* =====================================================
       MAIN GATEWAY
    ===================================================== */

    function createGateway() {

        state.gatewayGroup =
            new THREE.Group();


        state.scene.add(
            state.gatewayGroup
        );


        /*
         * Central translucent core
         */

        const coreGeometry =
            new THREE.IcosahedronGeometry(
                1.05,
                3
            );


        const coreMaterial =
            new THREE.MeshPhysicalMaterial({
                color:
                    CONFIG.gatewayColor,

                transparent:
                    true,

                opacity:
                    0.13,

                roughness:
                    0.12,

                metalness:
                    0.15,

                transmission:
                    0.72,

                thickness:
                    0.8,

                clearcoat:
                    1,

                clearcoatRoughness:
                    0.08
            });


        const core =
            new THREE.Mesh(
                coreGeometry,
                coreMaterial
            );


        state.gatewayGroup.add(
            core
        );


        /*
         * Inner energy sphere
         */

        const innerGeometry =
            new THREE.SphereGeometry(
                0.57,
                48,
                48
            );


        const innerMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    CONFIG.cyanColor,

                transparent:
                    true,

                opacity:
                    0.075,

                blending:
                    THREE.AdditiveBlending,

                depthWrite:
                    false
            });


        const inner =
            new THREE.Mesh(
                innerGeometry,
                innerMaterial
            );


        state.gatewayGroup.add(
            inner
        );


        /*
         * Outer energy shell
         */

        const shellGeometry =
            new THREE.SphereGeometry(
                1.45,
                64,
                64
            );


        const shellMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    CONFIG.gatewayColor,

                transparent:
                    true,

                opacity:
                    0.035,

                wireframe:
                    true,

                blending:
                    THREE.AdditiveBlending,

                depthWrite:
                    false
            });


        const shell =
            new THREE.Mesh(
                shellGeometry,
                shellMaterial
            );


        state.gatewayGroup.add(
            shell
        );


        /*
         * Floating vertical energy structure
         */

        const verticalGeometry =
            new THREE.CylinderGeometry(
                0.018,
                0.018,
                4.2,
                12
            );


        const verticalMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    CONFIG.cyanColor,

                transparent:
                    true,

                opacity:
                    0.18,

                blending:
                    THREE.AdditiveBlending,

                depthWrite:
                    false
            });


        const vertical =
            new THREE.Mesh(
                verticalGeometry,
                verticalMaterial
            );


        state.gatewayGroup.add(
            vertical
        );


        /*
         * Energy rings
         */

        createEnergyRing(
            1.5,
            0.035,
            CONFIG.gatewayColor,
            0.38
        );

        createEnergyRing(
            1.9,
            0.022,
            CONFIG.cyanColor,
            0.26
        );

        createEnergyRing(
            2.35,
            0.014,
            CONFIG.violetColor,
            0.17
        );


        /*
         * Tilted secondary rings
         */

        const tiltedRing =
            createTorus(
                1.75,
                0.012,
                CONFIG.cyanColor,
                0.3
            );


        tiltedRing.rotation.x =
            Math.PI * 0.47;

        tiltedRing.rotation.z =
            Math.PI * 0.12;


        state.gatewayGroup.add(
            tiltedRing
        );


        const tiltedRing2 =
            createTorus(
                1.35,
                0.009,
                CONFIG.violetColor,
                0.22
            );


        tiltedRing2.rotation.y =
            Math.PI * 0.58;

        tiltedRing2.rotation.z =
            Math.PI * -0.17;


        state.gatewayGroup.add(
            tiltedRing2
        );
    }


    /* =====================================================
       ENERGY RING
    ===================================================== */

    function createEnergyRing(
        radius,
        tube,
        color,
        opacity
    ) {

        const ring =
            createTorus(
                radius,
                tube,
                color,
                opacity
            );


        ring.rotation.x =
            Math.PI * 0.5;


        state.gatewayGroup.add(
            ring
        );


        return ring;
    }


    /* =====================================================
       TORUS
    ===================================================== */

    function createTorus(
        radius,
        tube,
        color,
        opacity
    ) {

        const geometry =
            new THREE.TorusGeometry(
                radius,
                tube,
                12,
                160
            );


        const material =
            new THREE.MeshBasicMaterial({
                color: color,

                transparent: true,

                opacity: opacity,

                blending:
                    THREE.AdditiveBlending,

                depthWrite: false
            });


        return new THREE.Mesh(
            geometry,
            material
        );
    }


    /* =====================================================
       LIGHTING
    ===================================================== */

    function createGatewayLights() {

        const ambient =
            new THREE.AmbientLight(
                0xffffff,
                1.4
            );


        state.scene.add(
            ambient
        );


        const blueLight =
            new THREE.PointLight(
                CONFIG.gatewayColor,
                12,
                8
            );


        blueLight.position.set(
            2.2,
            1.8,
            2.5
        );


        state.scene.add(
            blueLight
        );


        const cyanLight =
            new THREE.PointLight(
                CONFIG.cyanColor,
                8,
                7
            );


        cyanLight.position.set(
            -2.3,
            -1.4,
            1.8
        );


        state.scene.add(
            cyanLight
        );


        const violetLight =
            new THREE.PointLight(
                CONFIG.violetColor,
                6,
                7
            );


        violetLight.position.set(
            0,
            2.5,
            -1
        );


        state.scene.add(
            violetLight
        );
    }


    /* =====================================================
       PARTICLE SYSTEM
    ===================================================== */

    function createParticleSystem() {

        const count =
            CONFIG.particleCount;


        const positions =
            new Float32Array(
                count * 3
            );


        const sizes =
            new Float32Array(
                count
            );


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const radius =
                1.7 +
                Math.random() * 2.1;


            const theta =
                Math.random() *
                Math.PI *
                2;


            const phi =
                Math.acos(
                    2 * Math.random() - 1
                );


            positions[i * 3] =
                radius *
                Math.sin(phi) *
                Math.cos(theta);


            positions[i * 3 + 1] =
                radius *
                Math.cos(phi);


            positions[i * 3 + 2] =
                radius *
                Math.sin(phi) *
                Math.sin(theta);


            sizes[i] =
                0.015 +
                Math.random() * 0.035;
        }


        const geometry =
            new THREE.BufferGeometry();


        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(
                positions,
                3
            )
        );


        geometry.setAttribute(
            "size",
            new THREE.BufferAttribute(
                sizes,
                1
            )
        );


        const material =
            new THREE.PointsMaterial({
                color:
                    CONFIG.gatewayColor,

                size:
                    0.035,

                transparent:
                    true,

                opacity:
                    0.72,

                blending:
                    THREE.AdditiveBlending,

                depthWrite:
                    false,

                sizeAttenuation:
                    true
            });


        state.particleSystem =
            new THREE.Points(
                geometry,
                material
            );


        state.scene.add(
            state.particleSystem
        );
    }


    /* =====================================================
       FLOATING DATA OBJECTS
    ===================================================== */

    function createFloatingDataObjects() {

        /*
         * Small floating crystalline structures.
         * They deliberately avoid grid placement.
         */

        for (
            let i = 0;
            i < 11;
            i++
        ) {

            const geometry =
                new THREE.OctahedronGeometry(
                    0.035 +
                    Math.random() * 0.065,
                    1
                );


            const material =
                new THREE.MeshBasicMaterial({
                    color:
                        i % 3 === 0
                            ? CONFIG.cyanColor
                            : i % 3 === 1
                                ? CONFIG.gatewayColor
                                : CONFIG.violetColor,

                    transparent:
                        true,

                    opacity:
                        0.3 +
                        Math.random() * 0.35,

                    wireframe:
                        Math.random() > 0.5,

                    blending:
                        THREE.AdditiveBlending,

                    depthWrite:
                        false
                });


            const object =
                new THREE.Mesh(
                    geometry,
                    material
                );


            const angle =
                Math.random() *
                Math.PI *
                2;


            const radius =
                1.5 +
                Math.random() *
                2.1;


            object.position.set(
                Math.cos(angle) *
                radius,

                (
                    Math.random() -
                    0.5
                ) * 3.5,

                Math.sin(angle) *
                radius
            );


            object.userData = {
                baseY:
                    object.position.y,

                speed:
                    0.0005 +
                    Math.random() *
                    0.0012,

                phase:
                    Math.random() *
                    Math.PI *
                    2,

                rotationSpeed:
                    (
                        Math.random() -
                        0.5
                    ) * 0.012
            };


            state.gatewayGroup.add(
                object
            );
        }
    }


    /* =====================================================
       ORBITAL ELEMENTS
    ===================================================== */

    function createOrbitalElements() {

        for (
            let i = 0;
            i < 3;
            i++
        ) {

            const geometry =
                new THREE.TorusGeometry(
                    2.7 +
                    i * 0.35,

                    0.004 +
                    i * 0.002,

                    8,

                    180
                );


            const material =
                new THREE.MeshBasicMaterial({
                    color:
                        i === 0
                            ? CONFIG.gatewayColor
                            : i === 1
                                ? CONFIG.cyanColor
                                : CONFIG.violetColor,

                    transparent:
                        true,

                    opacity:
                        0.08 -
                        i * 0.015,

                    blending:
                        THREE.AdditiveBlending,

                    depthWrite:
                        false
                });


            const orbit =
                new THREE.Mesh(
                    geometry,
                    material
                );


            orbit.rotation.x =
                Math.random() *
                Math.PI;


            orbit.rotation.y =
                Math.random() *
                Math.PI;


            orbit.rotation.z =
                Math.random() *
                Math.PI;


            orbit.userData.orbitSpeed =
                (
                    Math.random() -
                    0.5
                ) * 0.0008;


            state.scene.add(
                orbit
            );
        }
    }


    /* =====================================================
       HTML PARTICLES
    ===================================================== */

    function initializeParticles() {

        const container =
            document.querySelector(
                ".ilf-particle-field"
            );


        if (!container) {
            return;
        }


        container.innerHTML = "";


        const colors = [
            "#2563eb",
            "#06b6d4",
            "#7c3aed"
        ];


        for (
            let i = 0;
            i < 28;
            i++
        ) {

            const particle =
                document.createElement(
                    "span"
                );


            particle.className =
                "ilf-particle";


            particle.style.left =
                `${Math.random() * 100}%`;


            particle.style.top =
                `${Math.random() * 100}%`;


            particle.style.setProperty(
                "--particle-size",
                `${2 + Math.random() * 3}px`
            );


            particle.style.setProperty(
                "--particle-color",
                colors[
                    Math.floor(
                        Math.random() *
                        colors.length
                    )
                ]
            );


            particle.style.setProperty(
                "--particle-opacity",
                `${0.25 + Math.random() * 0.45}`
            );


            particle.style.animation =
                `tracker-breathe ${
                    2.5 +
                    Math.random() * 3
                }s ease-in-out ${
                    Math.random() * 2
                }s infinite`;


            container.appendChild(
                particle
            );
        }
    }


    /* =====================================================
       TRACKERS
    ===================================================== */

    function initializeTrackers() {

        const container =
            document.querySelector(
                ".ilf-gateway-trackers"
            );


        if (!container) {
            return;
        }


        container.innerHTML = "";


        const positions = [
            ["12%", "23%"],
            ["82%", "27%"],
            ["18%", "73%"],
            ["77%", "76%"]
        ];


        positions.forEach(
            function (position, index) {

                const tracker =
                    document.createElement(
                        "span"
                    );


                tracker.className =
                    "ilf-tracker";


                tracker.style.left =
                    position[0];


                tracker.style.top =
                    position[1];


                tracker.style.animationDelay =
                    `${index * 0.45}s`;


                container.appendChild(
                    tracker
                );
            }
        );
    }


    /* =====================================================
       MOUSE / POINTER TRACKING
    ===================================================== */

    function initializeMouseTracking() {

        if (!stage) {
            return;
        }


        const handlePointerMove =
            function (event) {

                const rect =
                    stage.getBoundingClientRect();


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


                state.targetMouseX =
                    (x - 0.5) *
                    2;


                state.targetMouseY =
                    (y - 0.5) *
                    2;
            };


        const resetPointer =
            function () {

                state.targetMouseX = 0;

                state.targetMouseY = 0;
            };


        stage.addEventListener(
            "pointermove",
            handlePointerMove
        );


        stage.addEventListener(
            "pointerleave",
            resetPointer
        );


        state.cleanupFunctions.push(
            function () {

                stage.removeEventListener(
                    "pointermove",
                    handlePointerMove
                );

                stage.removeEventListener(
                    "pointerleave",
                    resetPointer
                );
            }
        );
    }


    /* =====================================================
       PASSWORD TOGGLE
    ===================================================== */

    function initializePasswordToggle() {

        if (
            !passwordToggle ||
            !passwordInput
        ) {
            return;
        }


        passwordToggle.addEventListener(
            "click",
            function () {

                const showing =
                    passwordInput.type ===
                    "text";


                passwordInput.type =
                    showing
                        ? "password"
                        : "text";


                passwordToggle.setAttribute(
                    "aria-label",
                    showing
                        ? "Show password"
                        : "Hide password"
                );


                passwordToggle.classList.toggle(
                    "is-visible",
                    !showing
                );
            }
        );
    }


    /* =====================================================
       FORM VALIDATION
    ===================================================== */

    function initializeFormValidation() {

        if (!form) {
            return;
        }


        form.addEventListener(
            "submit",
            function (event) {

                const valid =
                    validateForm();


                if (!valid) {

                    event.preventDefault();

                    return;
                }


                startAuthenticationState();
            }
        );


        if (emailInput) {

            emailInput.addEventListener(
                "blur",
                function () {

                    validateEmail();
                }
            );
        }


        if (passwordInput) {

            passwordInput.addEventListener(
                "blur",
                function () {

                    validatePassword();
                }
            );
        }
    }


    function validateForm() {

        const emailValid =
            validateEmail();


        const passwordValid =
            validatePassword();


        return (
            emailValid &&
            passwordValid
        );
    }


    function validateEmail() {

        if (!emailInput) {
            return true;
        }


        const value =
            emailInput.value.trim();


        if (!value) {

            setFieldError(
                emailInput,
                "Email address is required."
            );

            return false;
        }


        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (
            !emailPattern.test(value)
        ) {

            setFieldError(
                emailInput,
                "Enter a valid email address."
            );

            return false;
        }


        clearFieldError(
            emailInput
        );


        return true;
    }


    function validatePassword() {

        if (!passwordInput) {
            return true;
        }


        const value =
            passwordInput.value;


        if (!value) {

            setFieldError(
                passwordInput,
                "Password is required."
            );

            return false;
        }


        clearFieldError(
            passwordInput
        );


        return true;
    }


    /* =====================================================
       FIELD ERROR HELPERS
    ===================================================== */

    function setFieldError(
        input,
        message
    ) {

        const field =
            input.closest(
                ".ilf-field"
            );


        if (!field) {
            return;
        }


        field.classList.add(
            "has-error"
        );


        let error =
            field.querySelector(
                ".ilf-field-error"
            );


        if (!error) {

            error =
                document.createElement(
                    "div"
                );

            error.className =
                "ilf-field-error";


            field.appendChild(
                error
            );
        }


        error.textContent =
            message;
    }


    function clearFieldError(
        input
    ) {

        const field =
            input.closest(
                ".ilf-field"
            );


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
       AUTHENTICATION STATE
    ===================================================== */

    function initializeAuthentication() {

        /*
         * Existing Flask form submission remains untouched.
         *
         * We don't replace fetch() here because the actual
         * authentication endpoint belongs to the backend.
         *
         * This layer only controls the visual state before
         * the browser follows the normal POST.
         */
    }


    function startAuthenticationState() {

        if (
            state.authenticating ||
            !submitButton
        ) {
            return;
        }


        state.authenticating =
            true;


        page.classList.add(
            "is-authenticating"
        );


        submitButton.classList.add(
            "is-loading"
        );


        submitButton.disabled =
            true;


        showAuthenticationProgress();


        /*
         * Give the gateway a short visual response before
         * Flask navigation happens.
         */

        setTimeout(
            function () {

                triggerGatewayTransition();

            },
            300
        );
    }


    /* =====================================================
       AUTH PROGRESS UI
    ===================================================== */

    function showAuthenticationProgress() {

        const existing =
            document.querySelector(
                ".ilf-auth-progress"
            );


        if (existing) {
            return;
        }


        const progress =
            document.createElement(
                "div"
            );


        progress.className =
            "ilf-auth-progress";


        progress.innerHTML = `
            <div class="ilf-progress-orb"></div>

            <div class="ilf-progress-content">
                <strong>Establishing secure session</strong>
                <span>Verifying identity and preparing your forensic workspace...</span>
            </div>
        `;


        if (submitButton) {

            submitButton.parentElement
                .appendChild(
                    progress
                );
        }
    }


    /* =====================================================
       GATEWAY TRANSITION
    ===================================================== */

    function triggerGatewayTransition() {

        if (!transitionLayer) {
            return;
        }


        transitionLayer.classList.add(
            "is-active"
        );


        explodeGateway();

        createTransitionParticles();
    }


    function explodeGateway() {

        if (
            !state.gatewayGroup
        ) {
            return;
        }


        state.gatewayGroup.traverse(
            function (object) {

                if (
                    object.isMesh ||
                    object.isPoints
                ) {

                    object.userData.transition =
                        true;
                }
            }
        );
    }


    /* =====================================================
       TRANSITION PARTICLES
    ===================================================== */

    function createTransitionParticles() {

        const container =
            document.querySelector(
                ".ilf-transition-particles"
            );


        if (!container) {
            return;
        }


        container.innerHTML = "";


        for (
            let i = 0;
            i < 34;
            i++
        ) {

            const particle =
                document.createElement(
                    "span"
                );


            particle.style.position =
                "absolute";


            particle.style.left =
                "50%";


            particle.style.top =
                "50%";


            particle.style.width =
                `${2 + Math.random() * 4}px`;


            particle.style.height =
                particle.style.width;


            particle.style.borderRadius =
                "50%";


            particle.style.background =
                i % 3 === 0
                    ? "#2563eb"
                    : i % 3 === 1
                        ? "#06b6d4"
                        : "#7c3aed";


            particle.style.boxShadow =
                `0 0 14px ${particle.style.background}`;


            const angle =
                Math.random() *
                Math.PI *
                2;


            const distance =
                120 +
                Math.random() *
                260;


            const x =
                Math.cos(angle) *
                distance;


            const y =
                Math.sin(angle) *
                distance;


            particle.animate(
                [
                    {
                        transform:
                            "translate(-50%, -50%) scale(0.3)",

                        opacity:
                            "0"
                    },
                    {
                        transform:
                            "translate(-50%, -50%) scale(1)",

                        opacity:
                            "1",

                        offset:
                            0.18
                    },
                    {
                        transform:
                            `translate(
                                calc(-50% + ${x}px),
                                calc(-50% + ${y}px)
                            )
                            scale(0)`,

                        opacity:
                            "0"
                    }
                ],
                {
                    duration:
                        1300 +
                        Math.random() * 900,

                    delay:
                        Math.random() * 350,

                    easing:
                        "cubic-bezier(.16,1,.3,1)",

                    fill:
                        "forwards"
                }
            );


            container.appendChild(
                particle
            );
        }
    }


    /* =====================================================
       ALERT HANDLING
    ===================================================== */

    function initializeAlerts() {

        const alerts =
            document.querySelectorAll(
                ".ilf-alert"
            );


        alerts.forEach(
            function (alert) {

                const close =
                    alert.querySelector(
                        ".ilf-alert-close"
                    );


                if (close) {

                    close.addEventListener(
                        "click",
                        function () {

                            alert.remove();
                        }
                    );
                }
            }
        );
    }


    /* =====================================================
       THREE.JS ANIMATION LOOP
    ===================================================== */

    function animate() {

        if (
            !state.renderer ||
            !state.scene ||
            !state.camera
        ) {
            return;
        }


        state.animationFrame =
            requestAnimationFrame(
                animate
            );


        state.time +=
            0.016;


        /*
         * Smooth pointer interpolation
         */

        state.mouseX +=
            (
                state.targetMouseX -
                state.mouseX
            ) * 0.055;


        state.mouseY +=
            (
                state.targetMouseY -
                state.mouseY
            ) * 0.055;


        /*
         * Gateway parallax
         */

        if (state.gatewayGroup) {

            state.gatewayGroup.rotation.y =
                state.mouseX *
                CONFIG.mouseInfluence;

            state.gatewayGroup.rotation.x =
                -state.mouseY *
                CONFIG.mouseInfluence;

            state.gatewayGroup.position.x =
                state.mouseX * 0.08;

            state.gatewayGroup.position.y =
                -state.mouseY * 0.06;
        }


        /*
         * Particle orbital motion
         */

        if (
            state.particleSystem
        ) {

            state.particleSystem.rotation.y +=
                CONFIG.rotationSpeed;

            state.particleSystem.rotation.x +=
                CONFIG.rotationSpeed * 0.35;
        }


        /*
         * Floating objects
         */

        if (
            state.gatewayGroup
        ) {

            state.gatewayGroup.children
                .forEach(
                    function (object) {

                        if (
                            !object.userData ||
                            !object.userData.baseY
                        ) {
                            return;
                        }


                        object.position.y =
                            object.userData.baseY +
                            Math.sin(
                                state.time *
                                object.userData.speed *
                                1000 +
                                object.userData.phase
                            ) *
                            0.08;


                        object.rotation.x +=
                            object.userData.rotationSpeed;


                        object.rotation.y +=
                            object.userData.rotationSpeed *
                            0.7;
                    }
                );
        }


        /*
         * Camera movement
         */

        state.camera.position.x +=
            (
                state.mouseX * 0.18 -
                state.camera.position.x
            ) * 0.025;


        state.camera.position.y +=
            (
                -state.mouseY * 0.12 -
                state.camera.position.y
            ) * 0.025;


        state.camera.lookAt(
            0,
            0,
            0
        );


        state.renderer.render(
            state.scene,
            state.camera
        );
    }


    /* =====================================================
       RESIZE
    ===================================================== */

    function handleResize() {

        if (
            !state.renderer ||
            !state.camera ||
            !threeContainer
        ) {
            return;
        }


        const width =
            threeContainer.clientWidth;


        const height =
            threeContainer.clientHeight;


        state.camera.aspect =
            width / height;


        state.camera.updateProjectionMatrix();


        state.renderer.setSize(
            width,
            height,
            false
        );


        state.renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio || 1,
                2
            )
        );
    }


    function getStageAspectRatio() {

        if (!threeContainer) {
            return 1;
        }


        return (
            threeContainer.clientWidth /
            Math.max(
                threeContainer.clientHeight,
                1
            )
        );
    }


    /* =====================================================
       CLEANUP
    ===================================================== */

    window.addEventListener(
        "beforeunload",
        function () {

            if (
                state.animationFrame
            ) {

                cancelAnimationFrame(
                    state.animationFrame
                );
            }


            state.cleanupFunctions
                .forEach(
                    function (cleanup) {

                        try {
                            cleanup();
                        } catch (_) {
                            /* Ignore cleanup errors */
                        }
                    }
                );


            if (
                state.renderer
            ) {

                state.renderer.dispose();
            }
        }
    );

})();