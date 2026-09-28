/*
 * scene-explorer.js — ILF Log Explorer 3D Pipeline
 * Concept: 4 pipeline stage nodes (Collect→Parse→Categorise→Risk)
 * connected by flowing particle streams.
 * Active stage glows; completed stages turn teal.
 * Mouse hover = node pulse.
 */

(function initExplorerScene() {
  const canvas = document.getElementById('pipeline-canvas');
  if (!canvas || !window.THREE) return;

  const W = canvas.clientWidth, H = canvas.clientHeight;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.set(0, 0.5, 11);

  /* ── Stage colours ───────────────────────── */
  const COL = {
    idle:    new THREE.Color('#D5D3CE'),
    active:  new THREE.Color('#2D2B6B'),
    done:    new THREE.Color('#2E8B6E'),
    flow:    new THREE.Color('#4A6FA5'),
    danger:  new THREE.Color('#C0392B'),
  };

  /* ── Stage nodes ─────────────────────────── */
  const STAGES = [
    { label: 'Collect',    x: -4.5 },
    { label: 'Parse',      x: -1.5 },
    { label: 'Categorise', x:  1.5 },
    { label: 'Risk Score', x:  4.5 },
  ];
  const stageMeshes = [];
  const ringMeshes  = [];

  STAGES.forEach(s => {
    /* Core sphere */
    const geo  = new THREE.SphereGeometry(0.55, 24, 24);
    const mat  = new THREE.MeshPhongMaterial({ color: COL.idle, emissive: COL.idle, emissiveIntensity: 0.2, shininess: 80 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(s.x, 0, 0);
    mesh._state = 'idle'; // idle | active | done
    scene.add(mesh);
    stageMeshes.push(mesh);

    /* Orbit ring */
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.80, 0.025, 8, 48),
      new THREE.MeshBasicMaterial({ color: COL.idle, transparent: true, opacity: 0.3 })
    );
    ring.position.copy(mesh.position);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
    ringMeshes.push(ring);
  });

  /* ── Connecting cylinders ─────────────────── */
  for (let i = 0; i < STAGES.length - 1; i++) {
    const x1 = STAGES[i].x, x2 = STAGES[i+1].x;
    const cx  = (x1 + x2) / 2, len = x2 - x1 - 1.1;
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, len, 8),
      new THREE.MeshBasicMaterial({ color: 0xD5D3CE, transparent: true, opacity: 0.40 })
    );
    cyl.position.set(cx, 0, 0);
    cyl.rotation.z = Math.PI / 2;
    scene.add(cyl);
  }

  /* ── Flowing particles along pipeline ──────── */
  const FLOW_COUNT = 200;
  const flowPos = new Float32Array(FLOW_COUNT * 3);
  const flowT   = new Float32Array(FLOW_COUNT);   // parameter 0→1 along path
  const flowLane= new Float32Array(FLOW_COUNT);   // which gap 0,1,2

  for (let i = 0; i < FLOW_COUNT; i++) {
    flowT[i]    = Math.random();
    flowLane[i] = Math.floor(Math.random() * 3);
    const x = STAGES[flowLane[i]].x + flowT[i] * (STAGES[flowLane[i]+1].x - STAGES[flowLane[i]].x);
    flowPos[i*3]   = x;
    flowPos[i*3+1] = (Math.random() - 0.5) * 0.15;
    flowPos[i*3+2] = (Math.random() - 0.5) * 0.15;
  }
  const flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  const flowMat = new THREE.PointsMaterial({ size: 0.055, color: 0x4A6FA5, transparent: true, opacity: 0.7 });
  scene.add(new THREE.Points(flowGeo, flowMat));

  /* ── Lights ──────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const pLight = new THREE.PointLight(0x2D2B6B, 4, 20);
  pLight.position.set(0, 3, 4);
  scene.add(pLight);

  /* ── Mouse ───────────────────────────────── */
  const mouse = { nx: 0, ny: 0, rx: 0, ry: 0 };
  document.addEventListener('mousemove', e => {
    mouse.rx = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.ry = -(e.clientY / window.innerHeight - 0.5) * 2;
  });

  /* ── State colours ───────────────────────── */
  const STATE_COL = { idle: COL.idle, active: COL.active, done: COL.done };

  /* ── Expose state update for UI ─────────── */
  window.setPipelineStage = function(index, state) {
    if (!stageMeshes[index]) return;
    const c = STATE_COL[state] || COL.idle;
    stageMeshes[index].material.color.copy(c);
    stageMeshes[index].material.emissive.copy(c);
    stageMeshes[index].material.emissiveIntensity = state === 'active' ? 0.6 : state === 'done' ? 0.3 : 0.1;
    stageMeshes[index]._state = state;
    ringMeshes[index].material.color.copy(state === 'done' ? COL.done : state === 'active' ? new THREE.Color('#E8903A') : COL.idle);
  };

  /* ── Animate ─────────────────────────────── */
  let t = 0;
  const fpa = flowGeo.getAttribute('position');

  function animate() {
    requestAnimationFrame(animate);
    t += 0.012;

    mouse.nx += (mouse.rx - mouse.nx) * 0.05;
    mouse.ny += (mouse.ry - mouse.ny) * 0.05;

    /* Camera lean */
    camera.position.x += (mouse.nx * 0.8 - camera.position.x) * 0.03;
    camera.position.y += (mouse.ny * 0.4 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    /* Node rotation + pulse */
    stageMeshes.forEach((m, i) => {
      m.rotation.y += 0.008;
      if (m._state === 'active') {
        const pulse = 1 + Math.sin(t * 3 + i) * 0.06;
        m.scale.setScalar(pulse);
      }
      ringMeshes[i].rotation.y += 0.025;
      ringMeshes[i].rotation.z  = Math.sin(t * 0.5 + i) * 0.2;
    });

    /* Flow particles advance */
    for (let i = 0; i < FLOW_COUNT; i++) {
      flowT[i] += 0.004 + Math.random() * 0.002;
      if (flowT[i] > 1) flowT[i] = 0;
      const x = STAGES[flowLane[i]].x + flowT[i] * (STAGES[flowLane[i]+1].x - STAGES[flowLane[i]].x);
      fpa.setX(i, x);
    }
    fpa.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animate();

  const ro = new ResizeObserver(() => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  });
  ro.observe(canvas);
})();
