/**
 * INTELLIGENT LOG FORENSIC - 3D ATTACK PATH RECONSTRUCTION GRAPH
 * Low-poly 3D node objects (Attacker, Perimeter Server, Auth Server, Database)
 * Animated energy beam paths showing multi-stage attack direction and progression
 */

class AttackGraphScene {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.nodes = [];
    this.beams = [];
    this.currentTimeStep = 1.0;
    this.animationFrameId = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 900;
    const height = this.container.clientHeight || 400;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 10, 26);
    this.camera.lookAt(0, 0, 0);

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.container.appendChild(this.renderer.domElement);
    } catch (e) {
      console.warn('[AttackGraph] WebGL fallback active');
      return;
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x06B6D4, 2.5);
    dirLight.position.set(10, 20, 15);
    this.scene.add(dirLight);

    // 1. Build 3D Attack Topology Nodes
    this.buildGraphTopology();

    // 2. Build Energy Beams connecting them
    this.buildAnimatedBeams();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  buildGraphTopology() {
    const nodeDefs = [
      { id: 'adversary', type: 'user', name: 'External Adversary (185.220.101.5)', pos: [-12, 0, 0], color: 0xEF4444 },
      { id: 'gateway', type: 'server', name: 'DMZ Ingress Gateway / Nginx', pos: [-5, 2, 2], color: 0xF97316 },
      { id: 'app', type: 'server', name: 'Core Application Service', pos: [2, -1, -1], color: 0xEAB308 },
      { id: 'auth', type: 'server', name: 'Active Directory / IAM', pos: [3, 4, 3], color: 0x4F46E5 },
      { id: 'db', type: 'database', name: 'Production Database Vault', pos: [11, 0, 0], color: 0x06B6D4 }
    ];

    nodeDefs.forEach(def => {
      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(...def.pos);

      let mesh = null;
      if (def.type === 'server') {
        // Low-poly Server rack node
        const geo = new THREE.BoxBufferGeometry(2.0, 2.8, 2.0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x111A2E, emissive: def.color, emissiveIntensity: 0.35, roughness: 0.3 });
        mesh = new THREE.Mesh(geo, mat);
      } else if (def.type === 'database') {
        // Low-poly Cylinder database node
        const geo = new THREE.CylinderBufferGeometry(1.4, 1.4, 2.6, 16);
        const mat = new THREE.MeshStandardMaterial({ color: 0x0C1220, emissive: def.color, emissiveIntensity: 0.45, roughness: 0.2 });
        mesh = new THREE.Mesh(geo, mat);
      } else {
        // Attacker / Terminal node (octahedron)
        const geo = new THREE.OctahedronBufferGeometry(1.6);
        const mat = new THREE.MeshStandardMaterial({ color: 0x2A1116, emissive: def.color, emissiveIntensity: 0.6, roughness: 0.2 });
        mesh = new THREE.Mesh(geo, mat);
      }

      nodeGroup.add(mesh);

      // Orbital glow ring
      const ringGeo = new THREE.RingBufferGeometry(1.8, 2.0, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: def.color, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      nodeGroup.add(ring);

      nodeGroup.userData = { def, basePos: [...def.pos], ring };
      this.scene.add(nodeGroup);
      this.nodes.push(nodeGroup);
    });
  }

  buildAnimatedBeams() {
    const paths = [
      { from: 0, to: 1, step: 0.25, label: 'Initial Access (T1190)' },
      { from: 1, to: 2, step: 0.50, label: 'Exploitation (T1059)' },
      { from: 2, to: 3, step: 0.75, label: 'Credential Theft (T1003)' },
      { from: 3, to: 4, step: 1.00, label: 'Data Exfiltration (T1041)' }
    ];

    paths.forEach(p => {
      const start = this.nodes[p.from].position;
      const end = this.nodes[p.to].position;

      // Curve
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      mid.y += 2.0;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

      const points = curve.getPoints(30);
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: 0x4F46E5,
        transparent: true,
        opacity: 0.8,
        linewidth: 2
      });

      const line = new THREE.Line(geo, mat);
      this.scene.add(line);

      // Energy pulse bead
      const beadGeo = new THREE.SphereBufferGeometry(0.28, 8, 8);
      const beadMat = new THREE.MeshBasicMaterial({ color: 0x06B6D4 });
      const bead = new THREE.Mesh(beadGeo, beadMat);
      this.scene.add(bead);

      this.beams.push({
        line,
        bead,
        curve,
        step: p.step,
        progress: 0
      });
    });
  }

  setTimeStep(val) {
    this.currentTimeStep = Math.max(0, Math.min(1.0, val));
    this.beams.forEach(beam => {
      if (beam.step <= this.currentTimeStep + 0.1) {
        beam.line.material.opacity = 0.9;
        beam.bead.visible = true;
      } else {
        beam.line.material.opacity = 0.15;
        beam.bead.visible = false;
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

    const time = Date.now() * 0.002;

    // Pulse node rings and animate beads along curves
    this.nodes.forEach(node => {
      node.rotation.y += 0.01;
      if (node.userData.ring) {
        node.userData.ring.scale.setScalar(1 + 0.08 * Math.sin(time * 2));
      }
    });

    this.beams.forEach(beam => {
      if (beam.bead.visible) {
        beam.progress = (beam.progress + 0.01) % 1.0;
        const pos = beam.curve.getPointAt(beam.progress);
        beam.bead.position.copy(pos);
      }
    });

    this.renderer.render(this.scene, this.camera);
  }
}

window.AttackGraphScene = AttackGraphScene;
