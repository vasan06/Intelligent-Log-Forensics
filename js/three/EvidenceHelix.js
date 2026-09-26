/* ============================================================
   EVIDENCE HELIX
   Intelligent Log Forensics
   ============================================================ */

(function () {
    "use strict";

    class EvidenceHelix {
        constructor(container, options = {}) {
            this.container =
                typeof container === "string"
                    ? document.querySelector(container)
                    : container;

            this.options = {
                points: 80,
                radius: 2.1,
                height: 7,
                rotationSpeed: 0.0018,
                autoRotate: true,
                ...options
            };

            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.group = null;

            this.nodes = [];
            this.lines = [];

            this.isDragging = false;
            this.pointer = {
                x: 0,
                y: 0
            };

            this.rotation = {
                x: 0,
                y: 0
            };

            this.animationFrame = null;

            if (!this.container) {
                return;
            }

            this.init();
        }

        init() {
            if (typeof THREE === "undefined") {
                console.error(
                    "EvidenceHelix: THREE.js is not loaded."
                );
                return;
            }

            this.createScene();
            this.createCamera();
            this.createRenderer();
            this.createLights();
            this.createHelix();
            this.createParticles();
            this.bindEvents();
            this.resize();

            this.animate();
        }

        createScene() {
            this.scene = new THREE.Scene();

            this.scene.background =
                new THREE.Color(0x060a11);

            this.group = new THREE.Group();

            this.scene.add(this.group);
        }

        createCamera() {
            const width =
                this.container.clientWidth || 800;

            const height =
                this.container.clientHeight || 600;

            this.camera =
                new THREE.PerspectiveCamera(
                    42,
                    width / height,
                    0.1,
                    1000
                );

            this.camera.position.set(
                0,
                0,
                14
            );

            this.camera.lookAt(
                0,
                0,
                0
            );
        }

        createRenderer() {
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
                this.container.clientHeight || 600
            );

            if (
                "outputColorSpace" in
                this.renderer
            ) {
                this.renderer.outputColorSpace =
                    THREE.SRGBColorSpace;
            }

            this.renderer.domElement.className =
                "evidence-helix-canvas";

            this.renderer.domElement.style.width =
                "100%";

            this.renderer.domElement.style.height =
                "100%";

            this.renderer.domElement.style.display =
                "block";

            this.container.innerHTML = "";

            this.container.appendChild(
                this.renderer.domElement
            );
        }

        createLights() {
            const ambient =
                new THREE.AmbientLight(
                    0xffffff,
                    0.65
                );

            this.scene.add(ambient);

            const keyLight =
                new THREE.PointLight(
                    0x4f8cff,
                    2.4,
                    30
                );

            keyLight.position.set(
                5,
                5,
                7
            );

            this.scene.add(keyLight);

            const secondary =
                new THREE.PointLight(
                    0x8d5cff,
                    1.8,
                    25
                );

            secondary.position.set(
                -5,
                -3,
                4
            );

            this.scene.add(secondary);
        }

        createHelix() {
            const count =
                this.options.points;

            const radius =
                this.options.radius;

            const height =
                this.options.height;

            const helixPointsA = [];
            const helixPointsB = [];

            const nodeGeometry =
                new THREE.SphereGeometry(
                    0.105,
                    12,
                    12
                );

            const glowGeometry =
                new THREE.SphereGeometry(
                    0.22,
                    10,
                    10
                );

            for (
                let i = 0;
                i < count;
                i++
            ) {
                const progress =
                    i / (count - 1);

                const y =
                    height / 2 -
                    progress * height;

                const angle =
                    progress *
                    Math.PI *
                    8;

                const x1 =
                    Math.cos(angle) *
                    radius;

                const z1 =
                    Math.sin(angle) *
                    radius;

                const x2 =
                    Math.cos(angle + Math.PI) *
                    radius;

                const z2 =
                    Math.sin(angle + Math.PI) *
                    radius;

                this.addHelixNode(
                    x1,
                    y,
                    z1,
                    nodeGeometry,
                    glowGeometry,
                    0x66a8ff,
                    i
                );

                this.addHelixNode(
                    x2,
                    y,
                    z2,
                    nodeGeometry,
                    glowGeometry,
                    0x9b72ff,
                    i
                );

                helixPointsA.push(
                    new THREE.Vector3(
                        x1,
                        y,
                        z1
                    )
                );

                helixPointsB.push(
                    new THREE.Vector3(
                        x2,
                        y,
                        z2
                    )
                );
            }

            this.createHelixLine(
                helixPointsA,
                0x438cff
            );

            this.createHelixLine(
                helixPointsB,
                0x8b65ed
            );

            this.createRungs(
                helixPointsA,
                helixPointsB
            );
        }

        addHelixNode(
            x,
            y,
            z,
            nodeGeometry,
            glowGeometry,
            color,
            index
        ) {
            const material =
                new THREE.MeshStandardMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: 1.7,
                    metalness: 0.35,
                    roughness: 0.3
                });

            const node =
                new THREE.Mesh(
                    nodeGeometry,
                    material
                );

            node.position.set(
                x,
                y,
                z
            );

            node.userData = {
                index: index,
                type: "evidence"
            };

            this.group.add(node);

            const glowMaterial =
                new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.13
                });

            const glow =
                new THREE.Mesh(
                    glowGeometry,
                    glowMaterial
                );

            glow.position.copy(
                node.position
            );

            this.group.add(glow);

            this.nodes.push({
                node: node,
                glow: glow,
                index: index
            });
        }

        createHelixLine(
            points,
            color
        ) {
            const geometry =
                new THREE.BufferGeometry()
                    .setFromPoints(points);

            const material =
                new THREE.LineBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.55
                });

            const line =
                new THREE.Line(
                    geometry,
                    material
                );

            this.group.add(line);

            this.lines.push(line);
        }

        createRungs(
            pointsA,
            pointsB
        ) {
            const step = 5;

            for (
                let i = 0;
                i < pointsA.length;
                i += step
            ) {
                const geometry =
                    new THREE.BufferGeometry()
                        .setFromPoints([
                            pointsA[i],
                            pointsB[i]
                        ]);

                const material =
                    new THREE.LineBasicMaterial({
                        color: 0x536a92,
                        transparent: true,
                        opacity: 0.25
                    });

                const rung =
                    new THREE.Line(
                        geometry,
                        material
                    );

                this.group.add(rung);

                this.lines.push(rung);
            }
        }

        createParticles() {
            const count = 120;

            const positions =
                new Float32Array(
                    count * 3
                );

            for (
                let i = 0;
                i < count;
                i++
            ) {
                positions[i * 3] =
                    (Math.random() - 0.5) *
                    9;

                positions[i * 3 + 1] =
                    (Math.random() - 0.5) *
                    9;

                positions[i * 3 + 2] =
                    (Math.random() - 0.5) *
                    5;
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

            const material =
                new THREE.PointsMaterial({
                    color: 0x7b9bd0,
                    size: 0.035,
                    transparent: true,
                    opacity: 0.45
                });

            const particles =
                new THREE.Points(
                    geometry,
                    material
                );

            particles.userData.type =
                "background-particles";

            this.group.add(
                particles
            );

            this.particles =
                particles;
        }

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
                this.resize.bind(
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
            this.isDragging = true;

            this.pointer.x =
                event.clientX;

            this.pointer.y =
                event.clientY;

            this.renderer.domElement.style.cursor =
                "grabbing";
        }

        handlePointerMove(event) {
            if (!this.isDragging) {
                return;
            }

            const dx =
                event.clientX -
                this.pointer.x;

            const dy =
                event.clientY -
                this.pointer.y;

            this.rotation.y +=
                dx * 0.007;

            this.rotation.x +=
                dy * 0.005;

            this.rotation.x =
                Math.max(
                    -0.8,
                    Math.min(
                        0.8,
                        this.rotation.x
                    )
                );

            this.pointer.x =
                event.clientX;

            this.pointer.y =
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
                event.deltaY * 0.004;

            this.camera.position.z =
                Math.max(
                    8,
                    Math.min(
                        20,
                        this.camera.position.z
                    )
                );
        }

        updateAnimation(time) {
            this.nodes.forEach(
                (item, index) => {
                    const pulse =
                        1 +
                        Math.sin(
                            time * 0.0025 +
                            index * 0.4
                        ) *
                        0.14;

                    item.glow.scale.setScalar(
                        pulse
                    );
                }
            );

            if (this.particles) {
                this.particles.rotation.y =
                    time * 0.00008;
            }
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

            this.group.rotation.x =
                this.rotation.x;

            this.group.rotation.y =
                this.rotation.y;

            this.updateAnimation(
                time
            );

            this.renderer.render(
                this.scene,
                this.camera
            );
        }

        setAutoRotate(enabled) {
            this.options.autoRotate =
                Boolean(enabled);
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
                this.container.clientWidth ||
                800;

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

            window.removeEventListener(
                "pointermove",
                this.onPointerMove
            );

            window.removeEventListener(
                "pointerup",
                this.onPointerUp
            );

            if (this.renderer) {
                this.renderer.domElement.removeEventListener(
                    "pointerdown",
                    this.onPointerDown
                );

                this.renderer.domElement.removeEventListener(
                    "wheel",
                    this.onWheel
                );

                this.renderer.dispose();
            }

            this.nodes = [];
            this.lines = [];
        }
    }

    window.EvidenceHelix =
        EvidenceHelix;

})();