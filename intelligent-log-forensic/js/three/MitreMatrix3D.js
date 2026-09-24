/**
 * INTELLIGENT LOG FORENSIC - 3D MITRE ATT&CK TACTICAL MATRIX
 * Interactive 3D grid of MITRE tactics and techniques
 * Raycaster hover lifts tiles with threat pulse; click emits technique details
 */

class MitreMatrix3D {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.options = Object.assign({
      isMiniTeaser: false,
      columns: 6,
      rows: 5,
      onSelectTechnique: null
    }, options);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-100, -100);
    this.tiles = [];
    this.hoveredTile = null;
    this.animationFrameId = null;

    this.tactics = [
      { name: 'Initial Access', color: 0x4F46E5 },
      { name: 'Execution', color: 0x06B6D4 },
      { name: 'Privilege Escalation', color: 0xF97316 },
      { name: 'Defense Evasion', color: 0x8B5CF6 },
      { name: 'Credential Access', color: 0xEF4444 },
      { name: 'Discovery', color: 0x38BDF8 },
      { name: 'Lateral Movement', color: 0xEC4899 },
      { name: 'Command & Control', color: 0xEF4444 }
    ];

    this.techniquesData = [
      { id: 'T1190', name: 'Exploit Public-Facing App', tactic: 'Initial Access', detected: 14, sev: 'critical' },
      { id: 'T1059', name: 'Command & Scripting Interpreter', tactic: 'Execution', detected: 8, sev: 'high' },
      { id: 'T1068', name: 'Exploitation for Priv Escalation', tactic: 'Privilege Escalation', detected: 6, sev: 'critical' },
      { id: 'T1078', name: 'Valid Accounts', tactic: 'Defense Evasion', detected: 2, sev: 'medium' },
      { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access', detected: 24, sev: 'high' },
      { id: 'T1003', name: 'OS Credential Dumping', tactic: 'Credential Access', detected: 11, sev: 'critical' },
      { id: 'T1083', name: 'File and Directory Discovery', tactic: 'Discovery', detected: 19, sev: 'high' },
      { id: 'T1046', name: 'Network Service Scanning', tactic: 'Discovery', detected: 32, sev: 'medium' },
      { id: 'T1021', name: 'Remote Services (SSH/RDP)', tactic: 'Lateral Movement', detected: 5, sev: 'high' },
      { id: 'T1071', name: 'Application Layer Protocol', tactic: 'Command & Control', detected: 17, sev: 'critical' },
      { id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration', detected: 9, sev: 'critical' },
      { id: 'T1499', name: 'Endpoint Denial of Service', tactic: 'Impact', detected: 3, sev: 'medium' }
    ];

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, this.options.isMiniTeaser ? 14 : 22);

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.container.appendChild(this.renderer.domElement);
    } catch (e) {
      console.warn('[MitreMatrix3D] WebGL fallback active');
      return;
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x06B6D4, 2.0);
    dirLight.position.set(5, 10, 15);
    this.scene.add(dirLight);

    this.buildMatrixGrid();

    // Event listeners
    this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.container.addEventListener('click', () => this.onClick());
    window.addEventListener('resize', () => this.onResize());

    this.animate();
  }

  buildMatrixGrid() {
    const cols = this.options.isMiniTeaser ? 4 : 6;
    const rows = this.options.isMiniTeaser ? 4 : 5;
    const tileWidth = 2.4;
    const tileHeight = 1.3;
    const gap = 0.3;

    const startX = -((cols * (tileWidth + gap)) - gap) / 2 + (tileWidth / 2);
    const startY = ((rows * (tileHeight + gap)) - gap) / 2 - (tileHeight / 2);

    let techIndex = 0;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const techData = this.techniquesData[techIndex % this.techniquesData.length];
        techIndex++;

        const isDetected = techData.detected > 0;
        let baseColor = 0xF1F5F9;
        let edgeColor = 0xCBD5E1;

        if (isDetected) {
          if (techData.sev === 'critical') {
            baseColor = 0xFEE2E2;
            edgeColor = 0xDC2626;
          } else if (techData.sev === 'high') {
            baseColor = 0xFFEDD5;
            edgeColor = 0xEA580C;
          } else {
            baseColor = 0xFEF9C3;
            edgeColor = 0xCA8A04;
          }
        }

        const geo = new THREE.BoxBufferGeometry(tileWidth, tileHeight, 0.25);
        const mat = new THREE.MeshStandardMaterial({
          color: baseColor,
          emissive: edgeColor,
          emissiveIntensity: isDetected ? 0.45 : 0.05,
          metalness: 0.1,
          roughness: 0.6
        });

        const tileMesh = new THREE.Mesh(geo, mat);
        const posX = startX + c * (tileWidth + gap);
        const posY = startY - r * (tileHeight + gap);
        tileMesh.position.set(posX, posY, 0);

        tileMesh.userData = {
          baseZ: 0,
          targetZ: 0,
          techData,
          isDetected,
          baseColor,
          edgeColor,
          col: c,
          row: r
        };

        this.scene.add(tileMesh);
        this.tiles.push(tileMesh);
      }
    }
  }

  onMouseMove(e) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / this.container.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.tiles);

    if (intersects.length > 0) {
      const topIntersect = intersects[0].object;
      if (this.hoveredTile !== topIntersect) {
        if (this.hoveredTile) {
          this.hoveredTile.userData.targetZ = this.hoveredTile.userData.baseZ;
          this.hoveredTile.material.emissiveIntensity = this.hoveredTile.userData.isDetected ? 0.35 : 0.05;
        }
        this.hoveredTile = topIntersect;
        this.hoveredTile.userData.targetZ = 1.2; // Lift toward viewer
        this.hoveredTile.material.emissiveIntensity = 0.85;
      }
    } else {
      if (this.hoveredTile) {
        this.hoveredTile.userData.targetZ = this.hoveredTile.userData.baseZ;
        this.hoveredTile.material.emissiveIntensity = this.hoveredTile.userData.isDetected ? 0.35 : 0.05;
        this.hoveredTile = null;
      }
    }
  }

  onClick() {
    if (this.hoveredTile && this.options.onSelectTechnique) {
      this.options.onSelectTechnique(this.hoveredTile.userData.techData);
    }
  }

  filterByTactic(tacticName) {
    this.tiles.forEach(tile => {
      if (!tacticName || tacticName === 'ALL' || tile.userData.techData.tactic.toLowerCase() === tacticName.toLowerCase()) {
        tile.userData.targetZ = 0.3;
        tile.material.opacity = 1.0;
      } else {
        tile.userData.targetZ = -0.6;
        tile.material.opacity = 0.25;
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

    const time = Date.now() * 0.003;

    // Smooth lift & pulse
    this.tiles.forEach(tile => {
      tile.position.z += (tile.userData.targetZ - tile.position.z) * 0.1;

      // Pulse detected tiles
      if (tile.userData.isDetected && tile !== this.hoveredTile) {
        const pulse = 0.3 + 0.15 * Math.sin(time + tile.userData.col + tile.userData.row);
        tile.material.emissiveIntensity = pulse;
      }
    });

    this.renderer.render(this.scene, this.camera);
  }
}

window.MitreMatrix3D = MitreMatrix3D;
