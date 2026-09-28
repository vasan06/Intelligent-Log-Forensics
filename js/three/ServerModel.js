(function () {
    "use strict";

    class ExplodedServerScene {
        constructor(container, options = {}) {
            this.container =
                typeof container === "string"
                    ? document.querySelector(container)
                    : container;

            this.options = options;

            this.scene = null;
            this.camera = null;
            this.renderer = null;

            this.serverGroup = null;
            this.serverParts = [];
            this.rackLights = [];
            this.animationFrame = null;

            this.mouse = {
                down: false,
                lastX: 0,
                lastY: 0
            };

            this.rotation = {
                x: -0.12,
                y: 0.35
            };

            this.cameraDistance = 11;
            this.destroyed = false;

            if (!this.container) {
                console.warn(
                    "ExplodedServerScene: container not found."
                );
                return;
            }

            this.init();
        }

        /* ========================================================
           INITIALIZATION
        ======================================================== */

        init() {
            if (typeof THREE === "undefined") {
                console.warn(
                    "ExplodedServerScene: THREE.js is not loaded."
                );

                this.renderFallback();
                return;
            }

            this.setupScene();
            this.setupCamera();
            this.setupRenderer();
            this.setupLights();
            this.createEnvironment();
            this.createServer();
            this.bindEvents();
            this.startAnimation();
        }

        /* ========================================================
           SCENE
        ======================================================== */

        setupScene() {
            this.scene = new THREE.Scene();

            this.scene.background =
                new THREE.Color(0x05080d);

            this.scene.fog = new THREE.FogExp2(
                0x05080d,
                0.045
            );
        }

        /* ========================================================
           CAMERA
        ======================================================== */

        setupCamera() {
            const width =
                this.container.clientWidth || 800;

            const height =
                this.container.clientHeight || 500;

            this.camera =
                new THREE.PerspectiveCamera(
                    42,
                    width / height,
                    0.1,
                    100
                );

            this.camera.position.set(
                0,
                0.8,
                this.cameraDistance
            );

            this.camera.lookAt(
                0,
                0,
                0
            );
        }

        /* ========================================================
           RENDERER
        ======================================================== */

        setupRenderer() {
            this.renderer =
                new THREE.WebGLRenderer({
                    antialias: true,
                    alpha: true
                });

            this.renderer.setPixelRatio(
                Math.min(
                    window.devicePixelRatio || 1,
                    2
                )
            );

            this.renderer.setSize(
                this.container.clientWidth || 800,
                this.container.clientHeight || 500
            );

            if (
                "outputColorSpace" in
                this.renderer
            ) {
                this.renderer.outputColorSpace =
                    THREE.SRGBColorSpace;
            }

            this.renderer.domElement.className =
                "server-model-canvas";

            this.container.innerHTML = "";

            this.container.appendChild(
                this.renderer.domElement
            );
        }

        /* ========================================================
           LIGHTING
        ======================================================== */

        setupLights() {
            const ambient =
                new THREE.AmbientLight(
                    0xffffff,
                    0.65
                );

            this.scene.add(ambient);

            const cyanLight =
                new THREE.PointLight(
                    0x35d7ff,
                    3,
                    25
                );

            cyanLight.position.set(
                5,
                5,
                7
            );

            this.scene.add(cyanLight);

            const purpleLight =
                new THREE.PointLight(
                    0x7b61ff,
                    2,
                    22
                );

            purpleLight.position.set(
                -5,
                2,
                4
            );

            this.scene.add(purpleLight);

            const topLight =
                new THREE.DirectionalLight(
                    0xffffff,
                    0.8
                );

            topLight.position.set(
                0,
                10,
                4
            );

            this.scene.add(topLight);
        }

        /* ========================================================
           ENVIRONMENT
        ======================================================== */

        createEnvironment() {
            const grid =
                new THREE.GridHelper(
                    18,
                    18,
                    0x164457,
                    0x0c2029
                );

            grid.position.y = -3.8;

            this.scene.add(grid);

            const floorGeometry =
                new THREE.PlaneGeometry(
                    22,
                    22
                );

            const floorMaterial =
                new THREE.MeshStandardMaterial({
                    color: 0x070b11,
                    metalness: 0.5,
                    roughness: 0.8
                });

            const floor =
                new THREE.Mesh(
                    floorGeometry,
                    floorMaterial
                );

            floor.rotation.x =
                -Math.PI / 2;

            floor.position.y = -3.82;

            this.scene.add(floor);
        }

        /* ========================================================
           SERVER
        ======================================================== */

        createServer() {
            this.serverGroup =
                new THREE.Group();

            this.scene.add(
                this.serverGroup
            );

            this.createRackFrame();
            this.createServerUnits();
            this.createCenterCore();
        }

        /* ========================================================
           RACK FRAME
        ======================================================== */

        createRackFrame() {
            const frameMaterial =
                new THREE.MeshStandardMaterial({
                    color: 0x111923,
                    metalness: 0.75,
                    roughness: 0.3
                });

            const frameWidth = 5.2;
            const frameHeight = 7;
            const frameDepth = 2.3;

            const postGeometry =
                new THREE.BoxGeometry(
                    0.22,
                    frameHeight,
                    0.22
                );

            const positions = [
                [-frameWidth / 2, 0, -frameDepth / 2],
                [frameWidth / 2, 0, -frameDepth / 2],
                [-frameWidth / 2, 0, frameDepth / 2],
                [frameWidth / 2, 0, frameDepth / 2]
            ];

            positions.forEach(
                (position) => {
                    const post =
                        new THREE.Mesh(
                            postGeometry,
                            frameMaterial
                        );

                    post.position.set(
                        position[0],
                        0,
                        position[2]
                    );

                    this.serverGroup.add(
                        post
                    );
                }
            );

            const topBottomGeometry =
                new THREE.BoxGeometry(
                    frameWidth,
                    0.22,
                    0.22
                );

            [-frameHeight / 2, frameHeight / 2]
                .forEach((y) => {
                    const bar =
                        new THREE.Mesh(
                            topBottomGeometry,
                            frameMaterial
                        );

                    bar.position.y = y;

                    this.serverGroup.add(
                        bar
                    );
                });
        }

        /* ========================================================
           SERVER UNITS
        ======================================================== */

        createServerUnits() {
            const count = 8;

            const unitHeight = 0.68;
            const spacing = 0.82;

            for (
                let index = 0;
                index < count;
                index++
            ) {
                const y =
                    2.7 -
                    index * spacing;

                this.createServerUnit(
                    index,
                    y
                );
            }
        }

        createServerUnit(index, y) {
            const unitGroup =
                new THREE.Group();

            unitGroup.position.y = y;

            const bodyGeometry =
                new THREE.BoxGeometry(
                    4.65,
                    0.62,
                    1.95
                );

            const bodyMaterial =
                new THREE.MeshStandardMaterial({
                    color:
                        index % 2 === 0
                            ? 0x151e29
                            : 0x101822,
                    metalness: 0.7,
                    roughness: 0.32
                });

            const body =
                new THREE.Mesh(
                    bodyGeometry,
                    bodyMaterial
                );

            unitGroup.add(body);

            /* Front panel */

            const frontGeometry =
                new THREE.BoxGeometry(
                    4.25,
                    0.43,
                    0.06
                );

            const frontMaterial =
                new THREE.MeshStandardMaterial({
                    color: 0x0a1119,
                    metalness: 0.5,
                    roughness: 0.45
                });

            const front =
                new THREE.Mesh(
                    frontGeometry,
                    frontMaterial
                );

            front.position.z = 1.01;

            unitGroup.add(front);

            /* Drive slots */

            for (
                let slot = 0;
                slot < 4;
                slot++
            ) {
                const slotGeometry =
                    new THREE.BoxGeometry(
                        0.48,
                        0.18,
                        0.08
                    );

                const slotMaterial =
                    new THREE.MeshStandardMaterial({
                        color: 0x202d3a,
                        metalness: 0.6,
                        roughness: 0.35
                    });

                const drive =
                    new THREE.Mesh(
                        slotGeometry,
                        slotMaterial
                    );

                drive.position.set(
                    -1.65 +
                        slot * 0.56,
                    0,
                    1.055
                );

                unitGroup.add(
                    drive
                );
            }

            /* Status LEDs */

            const ledColors = [
                0x37e6a1,
                0x31d7ff,
                index === 3
                    ? 0xffa63d
                    : 0x37e6a1
            ];

            ledColors.forEach(
                (color, ledIndex) => {
                    const ledGeometry =
                        new THREE.SphereGeometry(
                            0.055,
                            10,
                            10
                        );

                    const ledMaterial =
                        new THREE.MeshBasicMaterial({
                            color
                        });

                    const led =
                        new THREE.Mesh(
                            ledGeometry,
                            ledMaterial
                        );

                    led.position.set(
                        1.15 +
                            ledIndex *
                                0.25,
                        0,
                        1.08
                    );

                    unitGroup.add(
                        led
                    );

                    this.rackLights.push(
                        {
                            mesh: led,
                            phase:
                                index +
                                ledIndex
                        }
                    );
                }
            );

            /* Vent lines */

            for (
                let line = 0;
                line < 6;
                line++
            ) {
                const ventGeometry =
                    new THREE.BoxGeometry(
                        0.055,
                        0.24,
                        0.05
                    );

                const ventMaterial =
                    new THREE.MeshBasicMaterial({
                        color: 0x2c3d4d
                    });

                const vent =
                    new THREE.Mesh(
                        ventGeometry,
                        ventMaterial
                    );

                vent.position.set(
                    1.85 +
                        line * 0.18,
                    0,
                    1.075
                );

                unitGroup.add(
                    vent
                );
            }

            this.serverGroup.add(
                unitGroup
            );

            this.serverParts.push({
                group: unitGroup,
                baseY: y,
                phase:
                    index * 0.45
            });
        }

        /* ========================================================
           CENTRAL FORENSIC CORE
        ======================================================== */

        createCenterCore() {
            const coreGroup =
                new THREE.Group();

            coreGroup.position.set(
                0,
                0,
                1.55
            );

            const coreGeometry =
                new THREE.IcosahedronGeometry(
                    0.65,
                    1
                );

            const coreMaterial =
                new THREE.MeshStandardMaterial({
                    color: 0x25d8ff,
                    emissive: 0x087b99,
                    emissiveIntensity: 1.5,
                    metalness: 0.3,
                    roughness: 0.2,
                    wireframe: false
                });

            const core =
                new THREE.Mesh(
                    coreGeometry,
                    coreMaterial
                );

            coreGroup.add(core);

            const ringGeometry =
                new THREE.TorusGeometry(
                    0.95,
                    0.035,
                    12,
                    64
                );

            const ringMaterial =
                new THREE.MeshBasicMaterial({
                    color: 0x35d7ff
                });

            const ring =
                new THREE.Mesh(
                    ringGeometry,
                    ringMaterial
                );

            ring.rotation.x =
                Math.PI / 2;

            coreGroup.add(ring);

            const glowGeometry =
                new THREE.SphereGeometry(
                    1.15,
                    24,
                    24
                );

            const glowMaterial =
                new THREE.MeshBasicMaterial({
                    color: 0x18bfff,
                    transparent: true,
                    opacity: 0.08
                });

            const glow =
                new THREE.Mesh(
                    glowGeometry,
                    glowMaterial
                );

            coreGroup.add(glow);

            this.serverGroup.add(
                coreGroup
            );

            this.core = core;
            this.coreRing = ring;
            this.coreGlow = glow;
        }

        /* ========================================================
           POINTER EVENTS
        ======================================================== */

        bindEvents() {
            this.onPointerDown =
                this.handlePointerDown.bind(
                    this
                );

            this.onPointerMove =
                this.handlePointerMove.bind(
                    this
                );

            this.onPointerUp =
                this.handlePointerUp.bind(
                    this
                );

            this.onWheel =
                this.handleWheel.bind(
                    this
                );

            this.onResize =
                this.handleResize.bind(
                    this
                );

            this.renderer.domElement.addEventListener(
                "pointerdown",
                this.onPointerDown
            );

            window.addEventListener(
                "pointermove",
                this.onPointerMove
            );

            window.addEventListener(
                "pointerup",
                this.onPointerUp
            );

            this.renderer.domElement.addEventListener(
                "wheel",
                this.onWheel,
                {
                    passive: true
                }
            );

            window.addEventListener(
                "resize",
                this.onResize
            );
        }

        handlePointerDown(event) {
            this.mouse.down = true;

            this.mouse.lastX =
                event.clientX;

            this.mouse.lastY =
                event.clientY;
        }

        handlePointerMove(event) {
            if (!this.mouse.down) {
                return;
            }

            const dx =
                event.clientX -
                this.mouse.lastX;

            const dy =
                event.clientY -
                this.mouse.lastY;

            this.rotation.y +=
                dx * 0.006;

            this.rotation.x +=
                dy * 0.004;

            this.rotation.x =
                Math.max(
                    -0.8,
                    Math.min(
                        0.8,
                        this.rotation.x
                    )
                );

            this.mouse.lastX =
                event.clientX;

            this.mouse.lastY =
                event.clientY;
        }

        handlePointerUp() {
            this.mouse.down = false;
        }

        handleWheel(event) {
            this.cameraDistance +=
                event.deltaY * 0.008;

            this.cameraDistance =
                Math.max(
                    7,
                    Math.min(
                        18,
                        this.cameraDistance
                    )
                );
        }

        /* ========================================================
           CAMERA
        ======================================================== */

        updateCamera() {
            const distance =
                this.cameraDistance;

            const x =
                Math.sin(
                    this.rotation.y
                ) *
                distance;

            const z =
                Math.cos(
                    this.rotation.y
                ) *
                distance;

            const y =
                this.rotation.x *
                distance *
                0.35;

            this.camera.position.set(
                x,
                y,
                z
            );

            this.camera.lookAt(
                0,
                0,
                0
            );
        }

        /* ========================================================
           ANIMATION
        ======================================================== */

        updateServer() {
            const time =
                performance.now() *
                0.001;

            this.serverParts.forEach(
                (part) => {
                    if (
                        this.options.exploded
                    ) {
                        const offset =
                            Math.sin(
                                time * 0.7 +
                                part.phase
                            ) *
                            0.12;

                        part.group.position.y =
                            part.baseY +
                            offset;
                    }
                }
            );

            if (this.core) {
                this.core.rotation.x =
                    time * 0.5;

                this.core.rotation.y =
                    time * 0.8;
            }

            if (this.coreRing) {
                this.coreRing.rotation.z =
                    time * 0.9;
            }

            if (this.coreGlow) {
                const scale =
                    1 +
                    Math.sin(
                        time * 2
                    ) *
                    0.08;

                this.coreGlow.scale.set(
                    scale,
                    scale,
                    scale
                );
            }

            this.rackLights.forEach(
                (light) => {
                    const pulse =
                        0.65 +
                        Math.sin(
                            time * 2 +
                            light.phase
                        ) *
                        0.35;

                    light.mesh.scale.set(
                        pulse,
                        pulse,
                        pulse
                    );
                }
            );
        }

        startAnimation() {
            const animate = () => {
                if (this.destroyed) {
                    return;
                }

                this.animationFrame =
                    requestAnimationFrame(
                        animate
                    );

                this.updateServer();
                this.updateCamera();

                this.renderer.render(
                    this.scene,
                    this.camera
                );
            };

            animate();
        }

        /* ========================================================
           RESIZE
        ======================================================== */

        handleResize() {
            if (
                !this.renderer ||
                !this.camera
            ) {
                return;
            }

            const width =
                this.container.clientWidth ||
                800;

            const height =
                this.container.clientHeight ||
                500;

            this.camera.aspect =
                width / height;

            this.camera.updateProjectionMatrix();

            this.renderer.setSize(
                width,
                height
            );
        }

        /* ========================================================
           EXPLODED MODE
        ======================================================== */

        setExploded(enabled) {
            this.options.exploded =
                Boolean(enabled);

            this.serverParts.forEach(
                (part, index) => {
                    const target =
                        this.options.exploded
                            ? part.baseY +
                              (index -
                                  3.5) *
                                  0.22
                            : part.baseY;

                    part.group.position.y =
                        target;
                }
            );
        }

        /* ========================================================
           RESET VIEW
        ======================================================== */

        resetView() {
            this.rotation.x = -0.12;
            this.rotation.y = 0.35;
            this.cameraDistance = 11;
        }

        /* ========================================================
           FALLBACK
        ======================================================== */

        renderFallback() {
            this.container.innerHTML = `
                <div class="three-fallback">
                    <div class="three-fallback-icon">
                        ILF
                    </div>

                    <strong>
                        Forensic Server Model
                    </strong>

                    <span>
                        3D visualization engine unavailable.
                    </span>
                </div>
            `;
        }

        /* ========================================================
           CLEANUP
        ======================================================== */

        destroy() {
            this.destroyed = true;

            if (this.animationFrame) {
                cancelAnimationFrame(
                    this.animationFrame
                );
            }

            window.removeEventListener(
                "resize",
                this.onResize
            );

            window.removeEventListener(
                "pointermove",
                this.onPointerMove
            );

            window.removeEventListener(
                "pointerup",
                this.onPointerUp
            );

            if (this.renderer) {
                this.renderer.dispose();

                if (
                    this.renderer.domElement
                ) {
                    this.renderer.domElement.remove();
                }
            }

            this.serverParts = [];
            this.rackLights = [];
        }
    }

    /* ============================================================
       AUTO INITIALIZATION
    ============================================================= */

    function initializeServerModel() {
        const container =
            document.querySelector(
                "#server-model"
            ) ||
            document.querySelector(
                "#exploded-server"
            ) ||
            document.querySelector(
                ".server-model"
            );

        if (!container) {
            return;
        }

        window.explodedServerScene =
            new ExplodedServerScene(
                container,
                {
                    exploded: true
                }
            );
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initializeServerModel
        );
    } else {
        initializeServerModel();
    }

    window.ExplodedServerScene =
        ExplodedServerScene;

})();