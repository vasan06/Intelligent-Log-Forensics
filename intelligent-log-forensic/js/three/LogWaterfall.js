/**
 * INTELLIGENT LOG FORENSIC - 3D LOG STREAM WATERFALL
 * Real-time cascading 3D log entries in perspective space
 * Critical threat rows float forward with intense glow
 */

class LogWaterfallScene {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.logPlanes = [];
    this.animationFrameId = null;
    this.maxRows = 16;
    this.rowSpacing = 1.35;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 320;
    const height = this.container.clientHeight || 180;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.camera.position.set(0, -2, 10);
    this.camera.rotation.x = 0.25;

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.container.appendChild(this.renderer.domElement);
    } catch (e) {
      console.warn('[LogWaterfall] WebGL fallback active');
      return;
    }

    // Populate initial waterfall planes
    const sampleLogs = [
      { text: 'POST /api/v1/search - 200 OK', sev: 'safe' },
      { text: "POST /auth/login ' OR 1=1 --", sev: 'critical' },
      { text: 'GET /c2/beacon 30s interval', sev: 'critical' },
      { text: 'GET /dashboard/metrics - 200 OK', sev: 'safe' },
      { text: 'SUDO /bin/bash guest NOPASSWD', sev: 'critical' },
      { text: 'GET /static/app.css - 304', sev: 'safe' },
      { text: 'GET /../../etc/passwd - 403', sev: 'high' }
    ];

    for (let i = 0; i < this.maxRows; i++) {
      const sample = sampleLogs[i % sampleLogs.length];
      this.createLogPlane(sample.text, sample.sev, i * this.rowSpacing - (this.maxRows * this.rowSpacing / 2));
    }

    // Subscribe to live log additions
    if (window.eventBus) {
      window.eventBus.on('log:added', (log) => {
        const text = `${log.method || 'GET'} ${log.target || '/'} ${log.payload_snippet || ''}`.substring(0, 36);
        this.pushLog(text, log.severity);
      });
    }

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  createTexture(text, severity) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Background panel
    let bgColor = 'rgba(12, 18, 32, 0.85)';
    let textColor = '#94A3B8';
    let borderColor = 'rgba(28, 46, 74, 0.8)';

    if (severity === 'critical') {
      bgColor = 'rgba(239, 68, 68, 0.25)';
      textColor = '#EF4444';
      borderColor = '#EF4444';
    } else if (severity === 'high') {
      bgColor = 'rgba(249, 115, 22, 0.2)';
      textColor = '#F97316';
      borderColor = '#F97316';
    } else if (severity === 'safe') {
      textColor = '#38BDF8';
    }

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 22px monospace';
    ctx.fillText(text, 16, 40);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  createLogPlane(text, severity, yPos) {
    const texture = this.createTexture(text, severity);
    const geometry = new THREE.PlaneBufferGeometry(8, 0.95);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, yPos, severity === 'critical' ? 1.5 : (Math.random() - 0.5) * 0.4);
    mesh.userData = {
      severity,
      targetZ: severity === 'critical' ? 1.4 : 0,
      currentY: yPos
    };

    this.scene.add(mesh);
    this.logPlanes.push(mesh);
  }

  pushLog(text, severity) {
    if (this.logPlanes.length === 0) return;
    const topMesh = this.logPlanes.shift();
    topMesh.material.map.dispose();
    topMesh.material.map = this.createTexture(text, severity);
    topMesh.userData.severity = severity;
    topMesh.userData.targetZ = severity === 'critical' ? 1.6 : 0;
    topMesh.position.y = (this.maxRows * this.rowSpacing / 2);
    topMesh.position.z = topMesh.userData.targetZ;
    this.logPlanes.push(topMesh);
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

    // Cascade downward
    this.logPlanes.forEach(plane => {
      plane.position.y -= 0.025;
      if (plane.position.y < -(this.maxRows * this.rowSpacing / 2)) {
        plane.position.y = (this.maxRows * this.rowSpacing / 2);
      }
    });

    this.renderer.render(this.scene, this.camera);
  }
}

window.LogWaterfallScene = LogWaterfallScene;
