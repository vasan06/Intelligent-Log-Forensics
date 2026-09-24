/**
 * INTELLIGENT LOG FORENSIC - LANDING PAGE CONTROLLER
 * GSAP ScrollTrigger 3D server dismantling, ticker, and interactive feature canvases
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Hero 3D Exploded Server Model
  const heroServer = new ExplodedServerScene('hero-server-canvas', {
    exploded: false,
    interactive: true
  });

  // 2. GSAP ScrollTrigger Integration: Dismantle on scroll down, reassemble on scroll up
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    ScrollTrigger.create({
      trigger: '.hero-section',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.2,
      onUpdate: (self) => {
        // As user scrolls down past hero, server model dismantles progressively
        if (heroServer) {
          heroServer.setExplodeFactor(self.progress * 1.5);
        }
      }
    });

    // Animate feature cards on scroll
    gsap.utils.toArray('.feature-card').forEach((card, index) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 85%'
        },
        y: 40,
        opacity: 0,
        duration: 0.6,
        delay: (index % 3) * 0.15,
        ease: 'power3.out'
      });
    });
  }

  // 3. Populate Threat Ticker with Synthetic Events
  const tickerTrack = document.getElementById('threat-ticker-track');
  if (tickerTrack) {
    const tickerItems = [
      { text: "SQLi Probe: ' OR 1=1 --", sev: 'badge-critical', ip: '198.51.100.44' },
      { text: 'Brute Force Auth: attempt 47/50', sev: 'badge-high', ip: '203.0.113.195' },
      { text: 'Directory Traversal: /etc/passwd', sev: 'badge-high', ip: '185.220.101.5' },
      { text: 'C2 Beacon Detected: 30s period', sev: 'badge-critical', ip: '45.146.164.110' },
      { text: 'Privilege Escalation: sudo bash', sev: 'badge-critical', ip: '10.0.0.12' },
      { text: 'Credential Dump: mimikatz memory', sev: 'badge-critical', ip: '194.26.29.112' },
      { text: 'Port Scan: 22,80,443,3306', sev: 'badge-medium', ip: '172.16.4.88' },
      { text: 'Data Exfiltration: 847MB outbound', sev: 'badge-critical', ip: '185.220.101.5' }
    ];

    // Double for seamless infinite loop
    const combined = [...tickerItems, ...tickerItems];
    tickerTrack.innerHTML = combined.map(item => `
      <div class="ticker-item">
        <span class="badge ${item.sev}">${item.sev.replace('badge-', '').toUpperCase()}</span>
        <span style="color:#67E8F9;">${item.ip}</span>
        <span>${item.text}</span>
      </div>
    `).join('');
  }

  // 4. Initialize Mini MITRE 3D Teaser Matrix (4x4)
  if (document.getElementById('mitre-teaser-canvas')) {
    new MitreMatrix3D('mitre-teaser-canvas', {
      isMiniTeaser: true
    });
  }

  // 5. Initialize Micro 3D Icons for Feature Cards
  initFeatureCanvases();
});

function initFeatureCanvases() {
  document.querySelectorAll('.feature-canvas-holder').forEach((holder, idx) => {
    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 4.5;

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(60, 60);
      holder.appendChild(renderer.domElement);

      let geo;
      const colors = [0x4F46E5, 0x06B6D4, 0xEF4444, 0xF97316, 0x22C55E, 0x8B5CF6];
      const color = colors[idx % colors.length];

      switch (idx) {
        case 0: geo = new THREE.BoxBufferGeometry(1.6, 1.6, 1.6); break;
        case 1: geo = new THREE.OctahedronBufferGeometry(1.4); break;
        case 2: geo = new THREE.TorusBufferGeometry(1.1, 0.35, 12, 24); break;
        case 3: geo = new THREE.DodecahedronBufferGeometry(1.3); break;
        case 4: geo = new THREE.ConeBufferGeometry(1.2, 1.8, 16); break;
        default: geo = new THREE.IcosahedronBufferGeometry(1.3); break;
      }

      const mat = new THREE.MeshStandardMaterial({
        color: 0x0C1220,
        emissive: color,
        emissiveIntensity: 0.6,
        wireframe: true
      });

      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      const light = new THREE.AmbientLight(0xffffff, 1.5);
      scene.add(light);

      function loop() {
        requestAnimationFrame(loop);
        mesh.rotation.x += 0.015;
        mesh.rotation.y += 0.02;
        renderer.render(scene, camera);
      }
      loop();
    } catch (e) {
      // 2D fallback
    }
  });
}
