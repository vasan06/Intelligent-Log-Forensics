/*
 * scene-login.js — ILF Login 3D Scene
 * Concept: DNA-like double helix made of log data particles.
 * Each strand = a log stream. Colour shifts on mouse proximity.
 * Mouse-reactive: helix leans toward cursor.
 * Reference aesthetic: Austensor — GPU particles, colour motion, no grid.
 */

(function initLoginScene() {
  const canvas   = document.getElementById('hero-canvas');
  if (!canvas || !window.THREE) return;

  /* ── Renderer ──────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 10);

  /* ── Colour palette (warm, not neon) ──────── */
  const COLOURS = [
    new THREE.Color('#2D2B6B'),   // indigo
    new THREE.Color('#4340A8'),   // lighter indigo
    new THREE.Color('#4A6FA5'),   // slate
    new THREE.Color('#E8903A'),   // amber
    new THREE.Color('#2E8B6E'),   // teal
    new THREE.Color('#7B4F9E'),   // muted violet
  ];

  /* ── Double helix particle geometry ──────── */
  const PARTICLE_COUNT = 1200;
  const positions  = new Float32Array(PARTICLE_COUNT * 3);
  const colours    = new Float32Array(PARTICLE_COUNT * 3);
  const basePos    = new Float32Array(PARTICLE_COUNT * 3); // store for animation
  const phases     = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t      = (i / PARTICLE_COUNT) * Math.PI * 8;  // helix parameter
    const strand  = i % 2 === 0 ? 0 : Math.PI;          // two strands, offset by pi
    const radius  = 1.4;
    const x       = Math.cos(t + strand) * radius;
    const y       = (i / PARTICLE_COUNT) * 14 - 7;      // vertical spread
    const z       = Math.sin(t + strand) * radius;

    positions[i*3]   = x;
    positions[i*3+1] = y;
    positions[i*3+2] = z;
    basePos[i*3]     = x;
    basePos[i*3+1]   = y;
    basePos[i*3+2]   = z;
    phases[i]        = Math.random() * Math.PI * 2;

    /* Colour per position along helix */
    const c = COLOURS[Math.floor((i / PARTICLE_COUNT) * COLOURS.length) % COLOURS.length];
    colours[i*3]   = c.r;
    colours[i*3+1] = c.g;
    colours[i*3+2] = c.b;
  }

  /* Cross-rungs (connecting lines between strands) */
  const rungPositions = [];
  for (let i = 0; i < PARTICLE_COUNT - 1; i += 2) {
    if (i % 40 === 0) {
      rungPositions.push(
        basePos[i*3], basePos[i*3+1], basePos[i*3+2],
        basePos[(i+1)*3], basePos[(i+1)*3+1], basePos[(i+1)*3+2]
      );
    }
  }
  const rungGeo = new THREE.BufferGeometry();
  rungGeo.setAttribute('position', new THREE.Float32BufferAttribute(rungPositions, 3));
  const rungMat = new THREE.LineBasicMaterial({ color: 0xD5D3CE, transparent: true, opacity: 0.25 });
  scene.add(new THREE.LineSegments(rungGeo, rungMat));

  /* Particle system */
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colours,   3));

  const mat = new THREE.PointsMaterial({
    size: 0.06, vertexColors: true,
    transparent: true, opacity: 0.88,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(geo, mat);
  scene.add(particles);

  /* ── Ambient floating micro-particles ──────── */
  const AMBIENT_COUNT = 300;
  const ambPos = new Float32Array(AMBIENT_COUNT * 3);
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    ambPos[i*3]   = (Math.random() - 0.5) * 20;
    ambPos[i*3+1] = (Math.random() - 0.5) * 16;
    ambPos[i*3+2] = (Math.random() - 0.5) * 8  - 4;
  }
  const ambGeo = new THREE.BufferGeometry();
  ambGeo.setAttribute('position', new THREE.BufferAttribute(ambPos, 3));
  const ambMat = new THREE.PointsMaterial({ size: 0.028, color: 0xC8C5D4, transparent: true, opacity: 0.35 });
  scene.add(new THREE.Points(ambGeo, ambMat));

  /* ── Mouse tracking ─────────────────────────── */
  const mouse = { x: 0, y: 0, nx: 0, ny: 0 };
  document.addEventListener('mousemove', e => {
    mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
  });

  /* ── Animation loop ─────────────────────────── */
  let tick = 0;
  const posAttr = geo.getAttribute('position');
  const colAttr = geo.getAttribute('color');

  function animate() {
    requestAnimationFrame(animate);
    tick += 0.010;

    /* Smooth mouse follow */
    mouse.nx += (mouse.x - mouse.nx) * 0.04;
    mouse.ny += (mouse.y - mouse.ny) * 0.04;

    /* Helix rotation + mouse lean */
    particles.rotation.y  = tick * 0.25 + mouse.nx * 0.3;
    particles.rotation.x  = mouse.ny * 0.18;
    rungGeo.attributes.position.needsUpdate = false; // rungs stay with parent

    /* Colour pulse along helix — each particle shifts hue over time */
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t     = (i / PARTICLE_COUNT + tick * 0.12) % 1;
      const ci    = Math.floor(t * COLOURS.length) % COLOURS.length;
      const cn    = (ci + 1) % COLOURS.length;
      const frac  = (t * COLOURS.length) % 1;
      const r     = COLOURS[ci].r + (COLOURS[cn].r - COLOURS[ci].r) * frac;
      const g     = COLOURS[ci].g + (COLOURS[cn].g - COLOURS[ci].g) * frac;
      const b     = COLOURS[ci].b + (COLOURS[cn].b - COLOURS[ci].b) * frac;
      colAttr.setXYZ(i, r, g, b);

      /* Subtle position breathing */
      const base_x = basePos[i*3];
      const base_z = basePos[i*3+2];
      const breathe = Math.sin(tick * 2 + phases[i]) * 0.04;
      posAttr.setX(i, base_x + breathe * Math.sign(base_x));
      posAttr.setZ(i, base_z + breathe * Math.sign(base_z));
    }
    colAttr.needsUpdate = true;
    posAttr.needsUpdate = true;

    /* Slow camera drift */
    camera.position.x += (mouse.nx * 0.5 - camera.position.x) * 0.02;
    camera.position.y += (mouse.ny * 0.3 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  /* ── Resize ─────────────────────────────────── */
  const ro = new ResizeObserver(() => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(canvas);
})();
