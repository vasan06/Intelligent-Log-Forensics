/**
 * INTELLIGENT LOG FORENSIC - 3D EXPLODED SERVER INFRASTRUCTURE
 * Three.js BufferGeometry Server Rack that dismantles/reassembles
 * Custom procedural circuit glow texture & mouse parallax
 */

class ExplodedServerScene {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.options = Object.assign({
      exploded: false,
      interactive: true,
      scrollControlled: false,
      speed: 0.008
    }, options);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.serverGroup = null;
    this.blades = [];
    this.cableParticles = null;
    this.animationFrameId = null;
    this.explodeFactor = this.options.exploded ? 1.0 : 0.0;
    this.targetExplodeFactor = this.explodeFactor;
    this.mouseX = 0;
    this.mouseY = 0;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 500;
    const height = this.container.clientHeight || 450;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 5, 24);

    // 2. Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.container.appendChild(this.renderer.domElement);
    } catch (e) {
      console.warn('[ThreeJS] WebGL not supported. Rendering 2D fallback.');
      this.container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#06B6D4;font-family:monospace;">[3D HARDWARE TELEMETRY ACTIVE]</div>';
      return;
    }

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x0C1220, 2.5);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x4F46E5, 3.5);
    dirLight1.position.set(10, 20, 15);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x06B6D4, 2.8);
    dirLight2.position.set(-15, -10, 10);
    this.scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x06B6D4, 2, 30);
    pointLight.position.set(0, 0, 5);
    this.scene.add(pointLight);

    // 4. Construct Server Infrastructure Rack
    this.buildServerRack();

    // 5. Add Particle Circuit Network
    this.buildCircuitParticles();

    // 6. Event Listeners
    if (this.options.interactive) {
      window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    }
    window.addEventListener('resize', () => this.onResize());

    // Tab visibility handling for performance
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      } else {
        this.animate();
      }
    });

    this.animate();
  }

  buildServerRack() {
    this.serverGroup = new THREE.Group();
    const rackWidth = 8;
    const rackDepth = 10;
    const bladeHeight = 1.1;
    const bladeCount = 5;

    // Materials
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0B111E,
      metalness: 0.85,
      roughness: 0.25,
      wireframe: false
    });

    const circuitMat = new THREE.MeshStandardMaterial({
      color: 0x111A2E,
      emissive: 0x4F46E5,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.4
    });

    const ledMatCyan = new THREE.MeshBasicMaterial({ color: 0x06B6D4 });
    const ledMatRed = new THREE.MeshBasicMaterial({ color: 0xEF4444 });
    const ledMatGreen = new THREE.MeshBasicMaterial({ color: 0x22C55E });

    // Rack outer vertical rails (chassis frame)
    const railGeo = new THREE.BoxBufferGeometry(0.4, bladeCount * bladeHeight * 2.2, 0.4);
    const railPositions = [
      [-rackWidth / 2 - 0.4, 0, rackDepth / 2],
      [rackWidth / 2 + 0.4, 0, rackDepth / 2],
      [-rackWidth / 2 - 0.4, 0, -rackDepth / 2],
      [rackWidth / 2 + 0.4, 0, -rackDepth / 2]
    ];
    railPositions.forEach(pos => {
      const rail = new THREE.Mesh(railGeo, chassisMat);
      rail.position.set(...pos);
      this.serverGroup.add(rail);
    });

    // Server Blades (Dismantling units)
    for (let i = 0; i < bladeCount; i++) {
      const bladeGroup = new THREE.Group();
      const initialY = (i - Math.floor(bladeCount / 2)) * (bladeHeight + 0.3);
      bladeGroup.position.set(0, initialY, 0);

      // Blade Main Body
      const bodyGeo = new THREE.BoxBufferGeometry(rackWidth, bladeHeight, rackDepth);
      const bladeMesh = new THREE.Mesh(bodyGeo, chassisMat);
      bladeGroup.add(bladeMesh);

      // Circuit Board Inset on Top
      const circuitGeo = new THREE.BoxBufferGeometry(rackWidth * 0.9, 0.05, rackDepth * 0.8);
      const circuitMesh = new THREE.Mesh(circuitGeo, circuitMat);
      circuitMesh.position.set(0, bladeHeight / 2 + 0.02, 0);
      bladeGroup.add(circuitMesh);

      // Front Bezel & Drive Trays
      for (let d = 0; d < 4; d++) {
        const driveGeo = new THREE.BoxBufferGeometry(1.6, bladeHeight * 0.7, 0.2);
        const driveMesh = new THREE.Mesh(driveGeo, chassisMat);
        driveMesh.position.set(-2.8 + d * 1.9, 0, rackDepth / 2 + 0.1);
        bladeGroup.add(driveMesh);

        // Blinking LED status indicator
        const ledGeo = new THREE.BoxBufferGeometry(0.12, 0.12, 0.05);
        const ledMesh = new THREE.Mesh(ledGeo, i === 2 && d === 1 ? ledMatRed : (d % 2 === 0 ? ledMatCyan : ledMatGreen));
        ledMesh.position.set(-2.8 + d * 1.9 + 0.6, 0.2, rackDepth / 2 + 0.25);
        bladeGroup.add(ledMesh);
      }

      bladeGroup.userData = {
        baseY: initialY,
        explodeOffset: (i - Math.floor(bladeCount / 2)) * 2.8,
        zOffset: (bladeCount - i) * 1.2
      };

      this.blades.push(bladeGroup);
      this.serverGroup.add(bladeGroup);
    }

    this.serverGroup.rotation.y = -0.45;
    this.serverGroup.rotation.x = 0.2;
    this.scene.add(this.serverGroup);
  }

  buildCircuitParticles() {
    const particleCount = 200; // Hard capped under 2000
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16;

      // Electric Indigo to Cyan colors
      const isCyan = Math.random() > 0.5;
      colors[i * 3] = isCyan ? 0.02 : 0.31;
      colors[i * 3 + 1] = isCyan ? 0.71 : 0.27;
      colors[i * 3 + 2] = isCyan ? 0.83 : 0.90;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    this.cableParticles = new THREE.Points(geometry, pMaterial);
    this.scene.add(this.cableParticles);
  }

  onMouseMove(e) {
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;
    this.mouseX = (e.clientX - windowHalfX) * 0.0003;
    this.mouseY = (e.clientY - windowHalfY) * 0.0003;
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  setExplodeFactor(factor) {
    this.targetExplodeFactor = Math.max(0, Math.min(1.5, factor));
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    // Smooth lerp for explode factor
    this.explodeFactor += (this.targetExplodeFactor - this.explodeFactor) * 0.06;

    // Apply exploded offsets to server blades
    this.blades.forEach(blade => {
      const { baseY, explodeOffset, zOffset } = blade.userData;
      blade.position.y = baseY + (explodeOffset * this.explodeFactor);
      blade.position.z = zOffset * this.explodeFactor * 0.8;
      blade.rotation.x = this.explodeFactor * 0.08 * (explodeOffset > 0 ? 1 : -1);
    });

    // Subtle ambient breathing & parallax rotation
    if (this.serverGroup) {
      this.serverGroup.rotation.y += (this.mouseX * 2 - (this.serverGroup.rotation.y + 0.45)) * 0.05 + 0.0015;
      this.serverGroup.rotation.x += (-this.mouseY * 2 - (this.serverGroup.rotation.x - 0.2)) * 0.05;
    }

    if (this.cableParticles) {
      this.cableParticles.rotation.y += 0.001;
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

window.ExplodedServerScene = ExplodedServerScene;
