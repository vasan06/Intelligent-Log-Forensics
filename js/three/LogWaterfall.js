(function () {
    "use strict";

    class LogWaterfall {
        constructor(container, options = {}) {
            this.container =
                typeof container === "string"
                    ? document.querySelector(container)
                    : container;

            this.options = {
                rows: 42,
                columns: 18,
                spacingX: 0.55,
                spacingY: 0.16,
                depthSpacing: 0.38,
                speed: 0.018,
                autoMove: true,
                ...options
            };

            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.group = null;

            this.rows = [];
            this.particles = null;

            this.animationFrame = null;

            this.isDragging = false;
            this.pointer = {
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
                    "LogWaterfall: THREE.js is not loaded."
                );
                return;
            }

            this.createScene();
            this.createCamera();
            this.createRenderer();
            this.createLights();
            this.createWaterfall();
            this.createBackgroundParticles();
            this.bindEvents();
            this.resize();

            this.animate();
        }

        createScene() {
            this.scene = new THREE.Scene();

            this.scene.background =
                new THREE.Color(0x050910);

            this.group = new THREE.Group();

            this.scene.add(this.group);
        }

        createCamera() {
            const width =
                this.container.clientWidth || 900;

            const height =
                this.container.clientHeight || 500;

            this.camera =
                new THREE.PerspectiveCamera(
                    42,
                    width / height,
                    0.1,
                    1000
                );

            this.camera.position.set(
                0,
                1.5,
                15
            );

            this.camera.lookAt(
                0,
                -1,
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
                this.container.clientWidth || 900,
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
                "log-waterfall-canvas";

            this.renderer.domElement.style.display =
                "block";

            this.renderer.domElement.style.width =
                "100%";

            this.renderer.domElement.style.height =
                "100%";

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

            const blueLight =
                new THREE.PointLight(
                    0x3d82ff,
                    2.5,
                    35
                );

            blueLight.position.set(
                4,
                5,
                8
            );

            this.scene.add(blueLight);

            const violetLight =
                new THREE.PointLight(
                    0x8d5cff,
                    1.5,
                    30
                );

            violetLight.position.set(
                -5,
                -4,
                4
            );

            this.scene.add(violetLight);
        }

        createWaterfall() {
            const rows =
                this.options.rows;

            const columns =
                this.options.columns;

            const spacingX =
                this.options.spacingX;

            const spacingY =
                this.options.spacingY;

            const depthSpacing =
                this.options.depthSpacing;

            const totalWidth =
                (columns - 1) *
                spacingX;

            const totalHeight =
                (rows - 1) *
                spacingY;

            for (
                let row = 0;
                row < rows;
                row++
            ) {
                const rowGroup =
                    new THREE.Group();

                const y =
                    totalHeight / 2 -
                    row * spacingY;

                const z =
                    -row *
                    depthSpacing;

                rowGroup.position.set(
                    0,
                    y,
                    z
                );

                this.createLogRow(
                    rowGroup,
                    columns,
                    totalWidth,
                    row
                );

                this.group.add(
                    rowGroup
                );

                this.rows.push({
                    group: rowGroup,
                    baseY: y,
                    baseZ: z,
                    index: row
                });
            }
        }

        createLogRow(
            rowGroup,
            columns,
            totalWidth,
            rowIndex
        ) {
            for (
                let column = 0;
                column < columns;
                column++
            ) {
                const isThreat =
                    this.isThreatCell(
                        rowIndex,
                        column
                    );

                const width =
                    0.35 +
                    Math.random() * 0.42;

                const height =
                    0.025 +
                    Math.random() * 0.035;

                const geometry =
                    new THREE.BoxGeometry(
                        width,
                        height,
                        0.025
                    );

                const material =
                    new THREE.MeshBasicMaterial({
                        color:
                            isThreat
                                ? 0xff5d70
                                : this.getNormalColor(
                                      rowIndex,
                                      column
                                  ),

                        transparent: true,

                        opacity:
                            0.45 +
                            Math.random() *
                                0.45
                    });

                const bar =
                    new THREE.Mesh(
                        geometry,
                        material
                    );

                const x =
                    column *
                    this.options.spacingX -
                    totalWidth / 2;

                bar.position.set(
                    x,
                    0,
                    Math.random() *
                        0.08
                );

                bar.userData = {
                    row: rowIndex,
                    column: column,
                    threat: isThreat,
                    phase:
                        Math.random() *
                        Math.PI *
                        2,
                    baseOpacity:
                        material.opacity
                };

                rowGroup.add(bar);
            }
        }

        isThreatCell(
            row,
            column
        ) {
            const pattern =
                (row * 7 + column * 13) %
                29;

            return (
                pattern === 0 ||
                pattern === 3 ||
                pattern === 17
            );
        }

        getNormalColor(
            row,
            column
        ) {
            const value =
                (row * 11 + column * 5) %
                4;

            if (value === 0) {
                return 0x5f8dff;
            }

            if (value === 1) {
                return 0x58b7ff;
            }

            if (value === 2) {
                return 0x7f82e8;
            }

            return 0x48658f;
        }

        createBackgroundParticles() {
            const count = 180;

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
                    16;

                positions[i * 3 + 1] =
                    (Math.random() - 0.5) *
                    10;

                positions[i * 3 + 2] =
                    (Math.random() - 0.5) *
                    10 -
                    2;
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
                    color: 0x6683b5,
                    size: 0.035,
                    transparent: true,
                    opacity: 0.35
                });

            this.particles =
                new THREE.Points(
                    geometry,
                    material
                );

            this.group.add(
                this.particles
            );
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
                dx * 0.006;

            this.rotation.x +=
                dy * 0.004;

            this.rotation.x =
                Math.max(
                    -0.7,
                    Math.min(
                        0.7,
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
                        22,
                        this.camera.position.z
                    )
                );
        }

        updateWaterfall(time) {
            this.rows.forEach(
                (row, index) => {
                    if (
                        this.options.autoMove
                    ) {
                        row.group.position.y =
                            row.baseY +
                            Math.sin(
                                time * 0.0008 +
                                index * 0.3
                            ) *
                                0.025;

                        row.group.position.x =
                            Math.sin(
                                time * 0.00045 +
                                index
                            ) *
                            0.025;
                    }

                    row.group.children.forEach(
                        (bar, column) => {
                            if (
                                !bar.userData
                            ) {
                                return;
                            }

                            const pulse =
                                Math.sin(
                                    time *
                                        0.003 +
                                    bar.userData.phase
                                );

                            const base =
                                bar.userData
                                    .baseOpacity;

                            bar.material.opacity =
                                Math.max(
                                    0.18,
                                    Math.min(
                                        1,
                                        base +
                                            pulse *
                                                0.12
                                    )
                                );

                            if (
                                bar.userData
                                    .threat
                            ) {
                                bar.scale.y =
                                    1 +
                                    Math.max(
                                        0,
                                        pulse
                                    ) *
                                        1.8;
                            }
                        }
                    );
                }
            );

            if (this.particles) {
                this.particles.rotation.y =
                    time * 0.00005;
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
                this.options.autoMove &&
                !this.isDragging
            ) {
                this.rotation.y +=
                    0.00035;
            }

            this.group.rotation.x =
                this.rotation.x;

            this.group.rotation.y =
                this.rotation.y;

            this.updateWaterfall(
                time
            );

            this.renderer.render(
                this.scene,
                this.camera
            );
        }

        setAutoMove(enabled) {
            this.options.autoMove =
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
                900;

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

        destroy() {
            if (
                this.animationFrame
            ) {
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

            this.rows = [];
            this.particles = null;
        }
    }

    window.LogWaterfall =
        LogWaterfall;

})();