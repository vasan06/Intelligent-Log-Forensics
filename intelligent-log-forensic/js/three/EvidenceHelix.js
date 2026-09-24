/**
 * INTELLIGENT LOG FORENSIC - 3D DNA HELIX EVIDENCE CHAIN
 * Double helix forensic evidence structure representing data verification stages
 * Illuminates nodes sequentially during ingest & analysis pipeline
 */

class EvidenceHelixScene {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.helixGroup = null;
    this.nodes = [];
    this.activeStepIndex = -1;
    this.animationFrameId = null;

    this.pipelineStages = [
      { name: 'Upload Ingest', id: 'step-0' },
      { name: 'SHA-256 Hash Verified', id: 'step-1' },
      { name: 'Multi-Format Parsed', id: 'step-2' },
      { name: 'Telemetry Normalized', id: 'step-3' },
      { name: 'Exploit Rules Applied', id: 'step-4' },
      { name: 'ML Heuristic Scored', id: 'step-5' },
      { name: 'Incident Correlated', id: 'step-6' }
    ];

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 450;
    const height = this.container.clientHeight || 500;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 18);

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.container.appendChild(this.renderer.domElement);
    } catch (e) {
      console.warn('[EvidenceHelix] WebGL fallback active');
      return;
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x4F46E5, 3.0);
    dirLight1.position.set(10, 10, 10);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x06B6D4, 2.0);
    dirLight2.position.set(-10, -10, 10);
    this.scene.add(dirLight2);

    this.buildDoubleHelix();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  buildDoubleHelix() {
    this.helixGroup = new THREE.Group();
    const count = 16;
    const radius = 3.2;
    const height = 12;
    const stepY = height / count;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 3;
      const y = -height / 2 + i * stepY;

      const x1 = Math.cos(angle) * radius;
      const z1 = Math.sin(angle) * radius;

      const x2 = Math.cos(angle + Math.PI) * radius;
      const z2 = Math.sin(angle + Math.PI) * radius;

      // Base pair connector bar
      const barGeo = new THREE.CylinderBufferGeometry(0.08, 0.08, radius * 2, 8);
      const barMat = new THREE.MeshBasicMaterial({ color: 0x1C2E4A, transparent: true, opacity: 0.6 });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(0, y, 0);
      bar.rotation.z = Math.PI / 2;
      bar.rotation.y = -angle;
      this.helixGroup.add(bar);

      // Node A (Primary strand)
      const sphereGeo = new THREE.SphereBufferGeometry(0.35, 16, 16);
      const sphereMatA = new THREE.MeshStandardMaterial({
        color: 0x111A2E,
        emissive: 0x4F46E5,
        emissiveIntensity: 0.2,
        roughness: 0.3
      });
      const nodeA = new THREE.Mesh(sphereGeo, sphereMatA);
      nodeA.position.set(x1, y, z1);
      this.helixGroup.add(nodeA);

      // Node B (Complementary strand)
      const sphereMatB = new THREE.MeshStandardMaterial({
        color: 0x111A2E,
        emissive: 0x06B6D4,
        emissiveIntensity: 0.2,
        roughness: 0.3
      });
      const nodeB = new THREE.Mesh(sphereGeo, sphereMatB);
      nodeB.position.set(x2, y, z2);
      this.helixGroup.add(nodeB);

      this.nodes.push({ nodeA, nodeB, bar, index: i });
    }

    this.scene.add(this.helixGroup);
  }

  setPipelineProgress(stepIndex) {
    this.activeStepIndex = stepIndex;
    const nodesPerStep = Math.floor(this.nodes.length / 7);

    this.nodes.forEach((pair, idx) => {
      const stepForThisNode = Math.floor(idx / nodesPerStep);
      if (stepForThisNode <= stepIndex) {
        pair.nodeA.material.emissiveIntensity = 0.95;
        pair.nodeB.material.emissiveIntensity = 0.95;
        pair.nodeA.material.color.setHex(0x4F46E5);
        pair.nodeB.material.color.setHex(0x06B6D4);
        pair.bar.material.color.setHex(0x06B6D4);
        pair.bar.material.opacity = 0.9;
      } else {
        pair.nodeA.material.emissiveIntensity = 0.2;
        pair.nodeB.material.emissiveIntensity = 0.2;
        pair.bar.material.opacity = 0.4;
      }
    });
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (this.helixGroup) {
      this.helixGroup.rotation.y += 0.008;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.EvidenceHelixScene = EvidenceHelixScene;
