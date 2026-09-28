/*
 * scene-dashboard.js — ILF Dashboard 3D Scene
 * Concept: Neural network / threat graph — nodes connected by edges.
 * Represents log sources (nodes) connected by data flows (edges).
 * Node colour = threat level. Mouse proximity causes node repulsion.
 * Hanging in space — no ground plane, no grid, no support.
 */

(function initDashboardScene() {
  const canvas = document.getElementById('dash-canvas');
  if (!canvas || !window.THREE) return;

  const W = canvas.clientWidth, H = canvas.clientHeight;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
  camera.position.set(0, 0, 14);

  /* ── Node colours (threat levels) ────────── */
  const NODE_COLOURS = {
    safe:     new THREE.Color('#2E8B6E'),
    low:      new THREE.Color('#4A6FA5'),
    medium:   new THREE.Color('#E8903A'),
    high:     new THREE.Color('#C0392B'),
    critical: new THREE.Color('#7B2D8B'),
  };
  const COLOUR_ARR = Object.values(NODE_COLOURS);

  /* ── Build node network ──────────────────── */
  const NODE_COUNT = 22;
  const nodes = [], positions3D = [];

  for (let i = 0; i < NODE_COUNT; i++) {
    const phi   = Math.acos(1 - 2 * (i + 0.5) / NODE_COUNT); // Fibonacci sphere
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r     = 4.5;
    const pos   = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
    positions3D.push(pos);

    const level = COLOUR_ARR[Math.floor(Math.random() * COLOUR_ARR.length)];
    const geo   = new THREE.SphereGeometry(0.10 + Math.random() * 0.10, 12, 12);
    const mat   = new THREE.MeshPhongMaterial({ color: level, emissive: level, emissiveIntensity: 0.4, shininess: 60 });
    const mesh  = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh._base   = pos.clone();
    mesh._phase  = Math.random() * Math.PI * 2;
    mesh._speed  = 0.4 + Math.random() * 0.6;
    mesh._colour = level.clone();
    scene.add(mesh);
    nodes.push(mesh);
  }

  /* ── Edges between nearby nodes ─────────── */
  const edgePositions = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      const d = positions3D[i].distanceTo(positions3D[j]);
      if (d < 4.2) {
        edgePositions.push(
          positions3D[i].x, positions3D[i].y, positions3D[i].z,
          positions3D[j].x, positions3D[j].y, positions3D[j].z
        );
      }
    }
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xD5D3CE, transparent: true, opacity: 0.20 });
  scene.add(new THREE.LineSegments(edgeGeo, edgeMat));

  /* ── Lights ──────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const pLight = new THREE.PointLight(0x4340A8, 3, 30);
  pLight.position.set(5, 5, 5);
  scene.add(pLight);
  const pLight2 = new THREE.PointLight(0xE8903A, 2, 25);
  pLight2.position.set(-6, -4, 3);
  scene.add(pLight2);

  /* ── Mouse ───────────────────────────────── */
  const mouse = { nx: 0, ny: 0, rx: 0, ry: 0 };
  document.addEventListener('mousemove', e => {
    mouse.rx = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.ry = -(e.clientY / window.innerHeight - 0.5) * 2;
  });

  /* ── Animate ─────────────────────────────── */
  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.006;

    mouse.nx += (mouse.rx - mouse.nx) * 0.04;
    mouse.ny += (mouse.ry - mouse.ny) * 0.04;

    /* Slow orbit */
    scene.rotation.y = t * 0.18 + mouse.nx * 0.25;
    scene.rotation.x = mouse.ny * 0.12;

    /* Node breathing + colour shift */
    nodes.forEach(node => {
      const breath = Math.sin(t * node._speed + node._phase) * 0.06;
      node.position.set(
        node._base.x + breath,
        node._base.y + breath * 0.5,
        node._base.z + breath * 0.8
      );
      /* Slow emissive pulse */
      node.material.emissiveIntensity = 0.3 + Math.abs(Math.sin(t * node._speed + node._phase)) * 0.5;
    });

    /* Moving light */
    pLight.position.x = Math.sin(t * 0.5) * 8;
    pLight.position.y = Math.cos(t * 0.3) * 6;

    renderer.render(scene, camera);
  }
  animate();

  const ro = new ResizeObserver(() => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  });
  ro.observe(canvas);
})();
