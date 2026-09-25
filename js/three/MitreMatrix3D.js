/* ============================================================
   MITRE MATRIX 3D
   Intelligent Log Forensics
   ============================================================ */

(function () {
    "use strict";

    class MitreMatrix3D {
        constructor(container, options = {}) {
            this.container =
                typeof container === "string"
                    ? document.querySelector(container)
                    : container;

            this.options = options;

            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;

            this.nodes = [];
            this.connections = [];
            this.animationFrame = null;

            this.mouse = {
                x: 0,
                y: 0,
                down: false,
                lastX: 0,
                lastY: 0
            };

            this.rotation = {
                x: 0.35,
                y: -0.45
            };

            this.cameraDistance = 18;

            this.destroyed = false;

            if (!this.container) {
                return;
            }

            this.init();
        }

        /* --------------------------------------------------------
           INIT
        --------------------------------------------------------- */

        init() {
            if (typeof THREE === "undefined") {
                console.warn(
                    "MitreMatrix3D: THREE.js is not loaded. 3D matrix disabled."
                );

                this.renderFallback();
                return;
            }

            this.setupScene();
            this.setupCamera();
            this.setupRenderer();
            this.setupLights();
            this.createMatrix();
            this.bindEvents();
            this.startAnimation();
        }

        /* --------------------------------------------------------
           SCENE
        --------------------------------------------------------- */

        setupScene() {
            this.scene = new THREE.Scene();

            this.scene.background = new THREE.Color(0x05080d);

            this.scene.fog = new THREE.FogExp2(
                0x05080d,
                0.035
            );
        }

        /* --------------------------------------------------------
           CAMERA
        --------------------------------------------------------- */

        setupCamera() {
            const width = this.container.clientWidth || 900;
            const height = this.container.clientHeight || 600;

            this.camera = new THREE.PerspectiveCamera(
                45,
                width / height,
                0.1,
                1000
            );

            this.camera.position.set(
                0,
                2,
                this.cameraDistance
            );

            this.camera.lookAt(0, 0, 0);
        }

        /* --------------------------------------------------------
           RENDERER
        --------------------------------------------------------- */

        setupRenderer() {
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });

            this.renderer.setPixelRatio(
                Math.min(window.devicePixelRatio || 1, 2)
            );

            this.renderer.setSize(
                this.container.clientWidth || 900,
                this.container.clientHeight || 600
            );

            this.renderer.outputColorSpace =
                THREE.SRGBColorSpace;

            this.renderer.domElement.className =
                "mitre-matrix-canvas";

            this.container.innerHTML = "";
            this.container.appendChild(
                this.renderer.domElement
            );
        }

        /* --------------------------------------------------------
           LIGHTING
        --------------------------------------------------------- */

        setupLights() {
            const ambient = new THREE.AmbientLight(
                0xffffff,
                0.7
            );

            this.scene.add(ambient);

            const keyLight = new THREE.PointLight(
                0x4fd1ff,
                2.5,
                40
            );

            keyLight.position.set(
                6,
                8,
                10
            );

            this.scene.add(keyLight);

            const secondaryLight = new THREE.PointLight(
                0x7c5cff,
                1.8,
                35
            );

            secondaryLight.position.set(
                -8,
                -4,
                6
            );

            this.scene.add(secondaryLight);
        }

        /* --------------------------------------------------------
           MATRIX
        --------------------------------------------------------- */

        createMatrix() {
            this.createGrid();

            const techniques = this.getTechniques();

            techniques.forEach((technique, index) => {
                this.createTechniqueNode(
                    technique,
                    index,
                    techniques.length
                );
            });

            this.createConnections();
        }

        /* --------------------------------------------------------
           TECHNIQUES
        --------------------------------------------------------- */

        getTechniques() {
            return [
                {
                    id: "T1059",
                    name: "Command and Scripting",
                    tactic: "Execution",
                    risk: 88
                },
                {
                    id: "T1078",
                    name: "Valid Accounts",
                    tactic: "Defense Evasion",
                    risk: 82
                },
                {
                    id: "T1053",
                    name: "Scheduled Task",
                    tactic: "Persistence",
                    risk: 76
                },
                {
                    id: "T1082",
                    name: "System Information Discovery",
                    tactic: "Discovery",
                    risk: 61
                },
                {
                    id: "T1049",
                    name: "System Network Connections",
                    tactic: "Discovery",
                    risk: 69
                },
                {
                    id: "T1105",
                    name: "Ingress Tool Transfer",
                    tactic: "Command and Control",
                    risk: 84
                },
                {
                    id: "T1021",
                    name: "Remote Services",
                    tactic: "Lateral Movement",
                    risk: 79
                },
                {
                    id: "T1055",
                    name: "Process Injection",
                    tactic: "Privilege Escalation",
                    risk: 91
                },
                {
                    id: "T1562",
                    name: "Impair Defenses",
                    tactic: "Defense Evasion",
                    risk: 94
                },
                {
                    id: "T exfil",
                    name: "Data Exfiltration",
                    tactic: "Exfiltration",
                    risk: 87
                }
            ];
        }

        /* --------------------------------------------------------
           NODE
        --------------------------------------------------------- */

        createTechniqueNode(
            technique,
            index,
            total
        ) {
            const angle =
                (index / total) *
                Math.PI *
                2;

            const radius = 5;

            const x =
                Math.cos(angle) *
                radius;

            const z =
                Math.sin(angle) *
                radius;

            const y =
                ((index % 3) - 1) *
                1.8;

            const group =
                new THREE.Group();

            group.position.set(
                x,
                y,
                z
            );

            /* Node */

            const geometry =
                new THREE.SphereGeometry(
                    0.42,
                    24,
                    24
                );

            const material =
                new THREE.MeshStandardMaterial({
                    color: this.getRiskColor(
                        technique.risk
                    ),
                    emissive: this.getRiskColor(
                        technique.risk
                    ),
                    emissiveIntensity: 0.7,
                    roughness: 0.25,
                    metalness: 0.65
                });

            const node =
                new THREE.Mesh(
                    geometry,
                    material
                );

            group.add(node);

            /* Glow */

            const glowGeometry =
                new THREE.SphereGeometry(
                    0.68,
                    20,
                    20
                );

            const glowMaterial =
                new THREE.MeshBasicMaterial({
                    color: this.getRiskColor(
                        technique.risk
                    ),
                    transparent: true,
                    opacity: 0.12
                });

            const glow =
                new THREE.Mesh(
                    glowGeometry,
                    glowMaterial
                );

            group.add(glow);

            /* Ring */

            const ringGeometry =
                new THREE.RingGeometry(
                    0.62,
                    0.67,
                    32
                );

            const ringMaterial =
                new THREE.MeshBasicMaterial({
                    color: this.getRiskColor(
                        technique.risk
                    ),
                    transparent: true,
                    opacity: 0.55,
                    side: THREE.DoubleSide
                });

            const ring =
                new THREE.Mesh(
                    ringGeometry,
                    ringMaterial
                );

            ring.rotation.x =
                Math.PI / 2;

            group.add(ring);

            group.userData = {
                technique,
                node,
                glow,
                ring,
                baseY: y,
                phase: Math.random() * Math.PI * 2
            };

            this.scene.add(group);

            this.nodes.push(group);
        }

        /* --------------------------------------------------------
           RISK COLOR
        --------------------------------------------------------- */

        getRiskColor(risk) {
            if (risk >= 90) {
                return 0xff4655;
            }

            if (risk >= 80) {
                return 0xff9f43;
            }

            if (risk >= 70) {
                return 0xffc857;
            }

            return 0x45d6a8;
        }

        /* --------------------------------------------------------
           GRID
        --------------------------------------------------------- */

        createGrid() {
            const gridHelper =
                new THREE.GridHelper(
                    18,
                    18,
                    0x1b5265,
                    0x10232d
                );

            gridHelper.position.y = -3.2;

            this.scene.add(gridHelper);

            const verticalGrid =
                new THREE.GridHelper(
                    18,
                    18,
                    0x263d72,
                    0x111923
                );

            verticalGrid.rotation.x =
                Math.PI / 2;

            this.scene.add(verticalGrid);
        }

        /* --------------------------------------------------------
           CONNECTIONS
        --------------------------------------------------------- */

        createConnections() {
            if (this.nodes.length < 2) {
                return;
            }

            for (
                let i = 0;
                i < this.nodes.length;
                i++
            ) {
                const next =
                    (i + 1) %
                    this.nodes.length;

                this.createConnection(
                    this.nodes[i],
                    this.nodes[next]
                );

                if (
                    i % 2 === 0 &&
                    this.nodes[i + 2]
                ) {
                    this.createConnection(
                        this.nodes[i],
                        this.nodes[i + 2]
                    );
                }
            }
        }

        createConnection(
            first,
            second
        ) {
            const start =
                first.position;

            const end =
                second.position;

            const points = [
                new THREE.Vector3(
                    start.x,
                    start.y,
                    start.z
                ),
                new THREE.Vector3(
                    end.x,
                    end.y,
                    end.z
                )
            ];

            const geometry =
                new THREE.BufferGeometry()
                    .setFromPoints(points);

            const material =
                new THREE.LineBasicMaterial({
                    color: 0x2a6f86,
                    transparent: true,
                    opacity: 0.45
                });

            const line =
                new THREE.Line(
                    geometry,
                    material
                );

            this.scene.add(line);

            this.connections.push({
                line,
                first,
                second
            });
        }

        /* --------------------------------------------------------
           EVENTS
        --------------------------------------------------------- */

        bindEvents() {
            this.onPointerDown =
                this.handlePointerDown.bind(this);

            this.onPointerMove =
                this.handlePointerMove.bind(this);

            this.onPointerUp =
                this.handlePointerUp.bind(this);

            this.onWheel =
                this.handleWheel.bind(this);

            this.onResize =
                this.handleResize.bind(this);

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

            this.renderer.domElement.setPointerCapture?.(
                event.pointerId
            );
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
                dy * 0.006;

            this.rotation.x =
                Math.max(
                    -1.2,
                    Math.min(
                        1.2,
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
                event.deltaY * 0.01;

            this.cameraDistance =
                Math.max(
                    9,
                    Math.min(
                        30,
                        this.cameraDistance
                    )
                );
        }

        handleResize() {
            if (
                !this.renderer ||
                !this.camera ||
                !this.container
            ) {
                return;
            }

            const width =
                this.container.clientWidth ||
                900;

            const height =
                this.container.clientHeight ||
                600;

            this.camera.aspect =
                width / height;

            this.camera.updateProjectionMatrix();

            this.renderer.setSize(
                width,
                height
            );
        }

        /* --------------------------------------------------------
           ANIMATION
        --------------------------------------------------------- */

        startAnimation() {
            const animate = () => {
                if (this.destroyed) {
                    return;
                }

                this.animationFrame =
                    requestAnimationFrame(
                        animate
                    );

                this.updateNodes();
                this.updateConnections();
                this.updateCamera();

                this.renderer.render(
                    this.scene,
                    this.camera
                );
            };

            animate();
        }

        updateNodes() {
            const time =
                performance.now() * 0.001;

            this.nodes.forEach(
                (group) => {
                    const data =
                        group.userData;

                    group.position.y =
                        data.baseY +
                        Math.sin(
                            time * 1.2 +
                            data.phase
                        ) *
                        0.16;

                    data.ring.rotation.z =
                        time * 0.7;

                    const pulse =
                        1 +
                        Math.sin(
                            time * 2 +
                            data.phase
                        ) *
                        0.08;

                    data.glow.scale.set(
                        pulse,
                        pulse,
                        pulse
                    );
                }
            );
        }

        updateConnections() {
            this.connections.forEach(
                (connection) => {
                    const start =
                        connection.first.position;

                    const end =
                        connection.second.position;

                    const position =
                        connection.line.geometry
                            .attributes
                            .position;

                    position.setXYZ(
                        0,
                        start.x,
                        start.y,
                        start.z
                    );

                    position.setXYZ(
                        1,
                        end.x,
                        end.y,
                        end.z
                    );

                    position.needsUpdate =
                        true;
                }
            );
        }

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
                Math.sin(
                    this.rotation.x
                ) *
                distance *
                0.55;

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

        /* --------------------------------------------------------
           FALLBACK
        --------------------------------------------------------- */

        renderFallback() {
            this.container.innerHTML = `
                <div class="three-fallback">
                    <div class="three-fallback-icon">MITRE</div>
                    <strong>MITRE Matrix Visualization</strong>
                    <span>3D visualization engine unavailable.</span>
                </div>
            `;
        }

        /* --------------------------------------------------------
           PUBLIC API
        --------------------------------------------------------- */

        focusTechnique(techniqueId) {
            const target =
                this.nodes.find(
                    (node) =>
                        node.userData.technique.id ===
                        techniqueId
                );

            if (!target) {
                return;
            }

            const position =
                target.position;

            this.cameraDistance = 10;

            this.rotation.y =
                Math.atan2(
                    position.x,
                    position.z
                );

            this.rotation.x =
                Math.atan2(
                    position.y,
                    Math.sqrt(
                        position.x *
                            position.x +
                            position.z *
                            position.z
                    )
                );
        }

        destroy() {
            this.destroyed = true;

            if (this.animationFrame) {
                cancelAnimationFrame(
                    this.animationFrame
                );
            }

            if (this.renderer) {
                this.renderer.dispose();
            }

            if (
                this.renderer &&
                this.renderer.domElement
            ) {
                this.renderer.domElement.remove();
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
        }
    }

    /* ------------------------------------------------------------
       AUTO INITIALIZATION
    ------------------------------------------------------------- */

    function initMitreMatrix() {
        const container =
            document.querySelector(
                "#mitre-matrix-3d"
            ) ||
            document.querySelector(
                ".mitre-matrix-3d"
            );

        if (!container) {
            return;
        }

        window.mitreMatrix3D =
            new MitreMatrix3D(
                container
            );
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initMitreMatrix
        );
    } else {
        initMitreMatrix();
    }

    window.MitreMatrix3D =
        MitreMatrix3D;

})();