/* ============================================================
   ATTACK GRAPH
   Intelligent Log Forensics
   ============================================================ */

(function () {
    "use strict";

    class AttackGraph {
        constructor(container, options = {}) {
            this.container =
                typeof container === "string"
                    ? document.querySelector(container)
                    : container;

            this.options = {
                autoRotate: true,
                rotationSpeed: 0.002,
                nodeCount: 14,
                ...options
            };

            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.graphGroup = null;
            this.nodes = [];
            this.edges = [];
            this.animationFrame = null;

            this.isDragging = false;
            this.previousPointer = {
                x: 0,
                y: 0
            };

            this.rotation = {
                x: 0,
                y: 0
            };

            if (!this.container) {
                return;
            }

            this.init();
        }

        init() {
            if (typeof THREE === "undefined") {
                console.error(
                    "AttackGraph: THREE.js is not loaded. Load Three.js before AttackGraph.js."
                );
                return;
            }

            this.createScene();
            this.createCamera();
            this.createRenderer();
            this.createLights();
            this.createGraph();
            this.bindEvents();
            this.resize();

            this.animate();
        }

        createScene() {
            this.scene = new THREE.Scene();

            this.scene.background = new THREE.Color(0x070b12);

            this.graphGroup = new THREE.Group();

            this.scene.add(this.graphGroup);
        }

        createCamera() {
            const width = this.container.clientWidth || 800;
            const height = this.container.clientHeight || 500;

            this.camera = new THREE.PerspectiveCamera(
                45,
                width / height,
                0.1,
                1000
            );

            this.camera.position.set(0, 1.5, 13);
            this.camera.lookAt(0, 0, 0);
        }

        createRenderer() {
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });

            this.renderer.setPixelRatio(
                Math.min(window.devicePixelRatio || 1, 2)
            );

            this.renderer.setSize(
                this.container.clientWidth || 800,
                this.container.clientHeight || 500
            );

            this.renderer.outputColorSpace =
                THREE.SRGBColorSpace;

            this.renderer.domElement.className =
                "attack-graph-canvas";

            this.container.innerHTML = "";
            this.container.appendChild(this.renderer.domElement);
        }

        createLights() {
            const ambientLight = new THREE.AmbientLight(
                0xffffff,
                0.7
            );

            this.scene.add(ambientLight);

            const pointLight = new THREE.PointLight(
                0x5b8cff,
                2.2,
                30
            );

            pointLight.position.set(4, 6, 8);

            this.scene.add(pointLight);

            const secondaryLight = new THREE.PointLight(
                0x8a5cff,
                1.5,
                25
            );

            secondaryLight.position.set(-5, -2, 5);

            this.scene.add(secondaryLight);
        }

        createGraph() {
            this.createNodes();
            this.createConnections();
        }

        createNodes() {
            const nodeGeometry = new THREE.SphereGeometry(
                0.16,
                20,
                20
            );

            const glowGeometry = new THREE.SphereGeometry(
                0.28,
                16,
                16
            );

            const positions = [
                [0, 0, 0],

                [-3, 1.8, 0],
                [-2.8, -1.6, 0.5],

                [3, 1.7, -0.4],
                [3, -1.8, 0.2],

                [-1.3, 3.2, -0.7],
                [1.5, 3.1, 0.4],

                [-1.5, -3, -0.4],
                [1.6, -3, 0.6],

                [-4.2, 0, -1],
                [4.2, 0, -1],

                [-2, 0.3, -2.5],
                [2.1, -0.5, -2.2],

                [0, 2, -2.8],
                [0, -2, -2.7]
            ];

            positions
                .slice(0, this.options.nodeCount)
                .forEach((position, index) => {
                    const isPrimary = index === 0;

                    const material = new THREE.MeshStandardMaterial({
                        color: isPrimary
                            ? 0xffffff
                            : 0x67a7ff,

                        emissive: isPrimary
                            ? 0x4d7cff
                            : 0x164c9c,

                        emissiveIntensity: isPrimary
                            ? 2.2
                            : 1.4,

                        metalness: 0.25,
                        roughness: 0.35
                    });

                    const node =
                        new THREE.Mesh(
                            nodeGeometry,
                            material
                        );

                    node.position.set(
                        position[0],
                        position[1],
                        position[2]
                    );

                    node.userData = {
                        id: `attack-node-${index}`,
                        type: isPrimary
                            ? "root"
                            : "technique"
                    };

                    this.graphGroup.add(node);

                    const glowMaterial =
                        new THREE.MeshBasicMaterial({
                            color: isPrimary
                                ? 0x5c82ff
                                : 0x287dff,

                            transparent: true,
                            opacity: 0.12
                        });

                    const glow =
                        new THREE.Mesh(
                            glowGeometry,
                            glowMaterial
                        );

                    glow.position.copy(node.position);

                    this.graphGroup.add(glow);

                    this.nodes.push({
                        mesh: node,
                        glow
                    });
                });
        }

        createConnections() {
            const connectionPairs = [
                [0, 1],
                [0, 2],
                [0, 3],
                [0, 4],

                [1, 5],
                [1, 9],

                [2, 7],
                [2, 9],

                [3, 6],
                [3, 10],

                [4, 8],
                [4, 10],

                [5, 6],
                [5, 13],

                [6, 13],

                [7, 8],
                [7, 14],

                [8, 14],

                [9, 11],
                [10, 12],

                [11, 12],
                [11, 13],
                [12, 14]
            ];

            connectionPairs.forEach(
                ([from, to], index) => {
                    if (
                        !this.nodes[from] ||
                        !this.nodes[to]
                    ) {
                        return;
                    }

                    const start =
                        this.nodes[from].mesh.position;

                    const end =
                        this.nodes[to].mesh.position;

                    const points = [
                        start.clone(),
                        end.clone()
                    ];

                    const geometry =
                        new THREE.BufferGeometry()
                            .setFromPoints(points);

                    const material =
                        new THREE.LineBasicMaterial({
                            color:
                                index % 3 === 0
                                    ? 0x4f7cff
                                    : 0x284b82,

                            transparent: true,
                            opacity: 0.55
                        });

                    const line =
                        new THREE.Line(
                            geometry,
                            material
                        );

                    this.graphGroup.add(line);

                    this.edges.push(line);
                }
            );
        }

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
                this.resize.bind(this);

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
            this.isDragging = true;

            this.previousPointer.x =
                event.clientX;

            this.previousPointer.y =
                event.clientY;

            this.renderer.domElement.style.cursor =
                "grabbing";
        }

        handlePointerMove(event) {
            if (!this.isDragging) {
                return;
            }

            const deltaX =
                event.clientX -
                this.previousPointer.x;

            const deltaY =
                event.clientY -
                this.previousPointer.y;

            this.rotation.y +=
                deltaX * 0.008;

            this.rotation.x +=
                deltaY * 0.008;

            this.rotation.x = Math.max(
                -0.9,
                Math.min(0.9, this.rotation.x)
            );

            this.previousPointer.x =
                event.clientX;

            this.previousPointer.y =
                event.clientY;
        }

        handlePointerUp() {
            this.isDragging = false;

            if (this.renderer) {
                this.renderer.domElement.style.cursor =
                    "grab";
            }
        }

        handleWheel(event) {
            if (!this.camera) {
                return;
            }

            this.camera.position.z +=
                event.deltaY * 0.005;

            this.camera.position.z = Math.max(
                7,
                Math.min(20, this.camera.position.z)
            );
        }

        resize() {
            if (
                !this.container ||
                !this.camera ||
                !this.renderer
            ) {
                return;
            }

            const width =
                this.container.clientWidth || 800;

            const height =
                this.container.clientHeight || 500;

            this.camera.aspect =
                width / height;

            this.camera.updateProjectionMatrix();

            this.renderer.setSize(
                width,
                height
            );
        }

        updateNodes(time) {
            this.nodes.forEach(
                (node, index) => {
                    const pulse =
                        1 +
                        Math.sin(
                            time * 0.002 +
                            index * 0.65
                        ) *
                        0.12;

                    node.glow.scale.setScalar(
                        pulse
                    );
                }
            );
        }

        animate() {
            this.animationFrame =
                requestAnimationFrame(
                    () => this.animate()
                );

            const time =
                performance.now();

            if (
                this.options.autoRotate &&
                !this.isDragging
            ) {
                this.rotation.y +=
                    this.options.rotationSpeed;
            }

            this.graphGroup.rotation.x =
                this.rotation.x;

            this.graphGroup.rotation.y =
                this.rotation.y;

            this.updateNodes(time);

            this.renderer.render(
                this.scene,
                this.camera
            );
        }

        setAutoRotate(enabled) {
            this.options.autoRotate =
                Boolean(enabled);
        }

        destroy() {
            if (this.animationFrame) {
                cancelAnimationFrame(
                    this.animationFrame
                );
            }

            window.removeEventListener(
                "resize",
                this.onResize
            );

            if (this.renderer) {
                this.renderer.domElement.removeEventListener(
                    "pointerdown",
                    this.onPointerDown
                );

                this.renderer.domElement.removeEventListener(
                    "pointermove",
                    this.onPointerMove
                );

                this.renderer.domElement.removeEventListener(
                    "pointerup",
                    this.onPointerUp
                );

                this.renderer.domElement.removeEventListener(
                    "wheel",
                    this.onWheel
                );

                this.renderer.dispose();
            }

            this.nodes = [];
            this.edges = [];
        }
    }

    window.AttackGraph = AttackGraph;

})();