/* ================================================================
   INTELLIGENT LOG FORENSICS — 3D VISUALIZATION ENGINE
   Three.js r128 — Full interactive forensic pipeline model
   ================================================================ */

(function () {
  'use strict';

  // ── Shared State ─────────────────────────────────────────────────
  let heroRenderer, heroScene, heroCamera;
  let sceneRenderer, sceneScene, sceneCamera, sceneControls;
  let modules = [];
  let particles = [];
  let flowParticles = [];
  let animMode = 'assembled';
  let orbitAngle = 0;
  let autoOrbit = false;
  let clock = { t: 0 };
  let raycaster, mouse;
  let hoveredModule = null;
  let explodedT = 0;
  let explodedDir = 1;

  const PI2 = Math.PI * 2;

  // ── Color palette ─────────────────────────────────────────────────
  const C = {
    bg: 0xf0f5ff,
    primary: 0x2563eb,
    primaryLight: 0x93c5fd,
    surface: 0xffffff,
    border: 0xe2e8f0,
    critical: 0xdc2626,
    high: 0xea580c,
    warning: 0xca8a04,
    success: 0x16a34a,
    purple: 0x9333ea,
    teal: 0x0d9488,
    slate: 0x64748b,
    glow: 0x60a5fa,
  };

  // ── Module definitions ────────────────────────────────────────────
  const MODULE_DEFS = [
    { id: 'ingest',    label: 'Log Ingestion',      color: C.primary,   emissive: 0x1e40af, shape: 'box',      size: [1.1,0.5,0.9],  pos: [-2.8, 1.2, 0],   info: 'Accepts CSV, JSON, JSONL, LOG, TXT. Intelligent format detection and stream parsing.' },
    { id: 'parse',     label: 'Parser & Tokenizer', color: C.teal,      emissive: 0x0f766e, shape: 'box',      size: [1.0,0.5,0.9],  pos: [-1.4, 1.2, 0],   info: 'Extracts IPs, timestamps, HTTP methods, status codes, user agents and payloads.' },
    { id: 'detect',    label: 'Threat Detection',   color: C.critical,  emissive: 0x991b1b, shape: 'box',      size: [1.2,0.6,1.0],  pos: [0,    1.2, 0],   info: 'Behavioral signature scanner: Brute Force, SQL Injection, Command Injection, Port Scan and more.' },
    { id: 'ml',        label: 'ML Engine',          color: C.purple,    emissive: 0x6b21a8, shape: 'box',      size: [1.0,0.5,0.9],  pos: [1.4,  1.2, 0],   info: 'Ensemble: Isolation Forest 40% + Local Outlier Factor 35% + One-Class SVM 25%.' },
    { id: 'mitre',     label: 'MITRE Mapper',       color: C.warning,   emissive: 0x92400e, shape: 'box',      size: [1.0,0.5,0.9],  pos: [2.8,  1.2, 0],   info: 'Maps every detection to ATT&CK tactics: Credential Access, Execution, C2, Impact and more.' },
    { id: 'correlate', label: 'Correlator',         color: C.high,      emissive: 0x9a3412, shape: 'box',      size: [1.0,0.5,0.9],  pos: [-1.4,-0.3, 0],   info: 'Groups related events by category and technique to create actionable incident clusters.' },
    { id: 'incident',  label: 'Incident Engine',    color: C.success,   emissive: 0x14532d, shape: 'box',      size: [1.2,0.6,1.0],  pos: [0,   -0.3, 0],   info: 'Creates incidents with severity, confidence, evidence trail and investigation workflow.' },
    { id: 'report',    label: 'Report Generator',   color: C.slate,     emissive: 0x334155, shape: 'box',      size: [1.0,0.5,0.9],  pos: [1.4, -0.3, 0],   info: 'Generates comprehensive PDF forensic reports with timelines, MITRE maps and evidence.' },
  ];

  // ── Helpers ───────────────────────────────────────────────────────
  function hexToThree(h) { return new THREE.Color(h); }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpV3(a, b, t) {
    return new THREE.Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
  }
  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  // ── HERO CANVAS (background particle field) ───────────────────────
  function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    heroRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    heroRenderer.setClearColor(0x000000, 0);

    heroScene = new THREE.Scene();
    heroCamera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    heroCamera.position.set(0, 0, 20);

    // Floating data nodes
    const nodeGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const nodeColors = [C.primary, C.primaryLight, C.success, C.purple, C.teal];
    for (let i = 0; i < 120; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: nodeColors[i % nodeColors.length], transparent: true, opacity: Math.random() * 0.5 + 0.2 });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      mesh.position.set((Math.random()-0.5)*40, (Math.random()-0.5)*20, (Math.random()-0.5)*10 - 5);
      mesh.userData = { ox: mesh.position.x, oy: mesh.position.y, oz: mesh.position.z, speed: Math.random()*0.4+0.2, phase: Math.random()*PI2 };
      heroScene.add(mesh);
      particles.push(mesh);
    }

    // Connecting lines (edges)
    const lineMat = new THREE.LineBasicMaterial({ color: C.primaryLight, transparent: true, opacity: 0.12 });
    for (let i = 0; i < 50; i++) {
      const a = particles[Math.floor(Math.random()*particles.length)];
      const b = particles[Math.floor(Math.random()*particles.length)];
      const geo = new THREE.BufferGeometry().setFromPoints([a.position.clone(), b.position.clone()]);
      heroScene.add(new THREE.Line(geo, lineMat));
    }

    // Mouse parallax
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const my = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      heroCamera.position.x += (mx * 3 - heroCamera.position.x) * 0.02;
      heroCamera.position.y += (-my * 2 - heroCamera.position.y) * 0.02;
    });

    resizeHero();
    window.addEventListener('resize', resizeHero);
  }

  function resizeHero() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas || !heroRenderer) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    heroRenderer.setSize(w, h, false);
    heroCamera.aspect = w / h;
    heroCamera.updateProjectionMatrix();
  }

  // ── MAIN SCENE CANVAS ─────────────────────────────────────────────
  function initSceneCanvas() {
    const canvas = document.getElementById('scene-canvas');
    if (!canvas) return;

    sceneRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    sceneRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    sceneRenderer.setClearColor(0xf0f5ff, 1);
    sceneRenderer.shadowMap.enabled = true;
    sceneRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    sceneScene = new THREE.Scene();
    sceneScene.fog = new THREE.Fog(0xf0f5ff, 18, 30);

    sceneCamera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    sceneCamera.position.set(0, 3, 11);
    sceneCamera.lookAt(0, 0, 0);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    sceneScene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(8, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    sceneScene.add(sun);
    const fill = new THREE.DirectionalLight(0xdbeafe, 0.5);
    fill.position.set(-6, 4, -4);
    sceneScene.add(fill);
    const rim = new THREE.PointLight(0x93c5fd, 0.8, 20);
    rim.position.set(0, 8, -4);
    sceneScene.add(rim);

    // Floor grid
    const gridHelper = new THREE.GridHelper(20, 20, 0xdbeafe, 0xe2e8f0);
    gridHelper.position.y = -1.5;
    sceneScene.add(gridHelper);

    // Build modules
    buildModules();

    // Data flow particles
    buildFlowParticles();

    // Raycaster for hover
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2(9999, 9999);

    // Mouse controls (simple orbit)
    let isDragging = false, lastX = 0, lastY = 0;
    let camTheta = 0, camPhi = 0.35;
    let camRadius = 11;
    const camTarget = new THREE.Vector3(0, 0, 0);

    canvas.addEventListener('mousedown', e => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      if (isDragging) {
        camTheta -= (e.clientX - lastX) * 0.008;
        camPhi = Math.max(0.05, Math.min(Math.PI/2 - 0.05, camPhi - (e.clientY - lastY) * 0.005));
        lastX = e.clientX; lastY = e.clientY;
        autoOrbit = false;
      }
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      camRadius = Math.max(5, Math.min(20, camRadius + e.deltaY * 0.01));
    }, { passive: false });

    canvas.addEventListener('click', e => {
      if (!raycaster || !sceneCamera) return;
      raycaster.setFromCamera(mouse, sceneCamera);
      const meshes = modules.map(m => m.mesh);
      const hits = raycaster.intersectObjects(meshes);
      if (hits.length) {
        const mod = modules.find(m => m.mesh === hits[0].object);
        if (mod) showModuleInfo(mod);
      }
    });

    // Camera orbit updater (stored on window so animation loop can use it)
    window._sceneOrbit = function(dt) {
      if (autoOrbit) { camTheta += dt * 0.25; }
      const sx = Math.sin(camTheta), cx = Math.cos(camTheta);
      const sy = Math.sin(camPhi),   cy = Math.cos(camPhi);
      sceneCamera.position.set(
        camTarget.x + camRadius * cx * cy,
        camTarget.y + camRadius * sy,
        camTarget.z + camRadius * sx * cy
      );
      sceneCamera.lookAt(camTarget);
    };

    resizeScene();
    window.addEventListener('resize', resizeScene);
  }

  function resizeScene() {
    const canvas = document.getElementById('scene-canvas');
    if (!canvas || !sceneRenderer) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    sceneRenderer.setSize(w, h, false);
    sceneCamera.aspect = w / h;
    sceneCamera.updateProjectionMatrix();
  }

  // ── Module building ───────────────────────────────────────────────
  function buildModules() {
    MODULE_DEFS.forEach((def, i) => {
      const geo = new THREE.BoxGeometry(...def.size);
      // Bevel effect via edges
      const mat = new THREE.MeshPhongMaterial({
        color: def.color,
        emissive: def.emissive,
        emissiveIntensity: 0.15,
        shininess: 60,
        transparent: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...def.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      sceneScene.add(mesh);

      // Edge lines
      const edgeGeo = new THREE.EdgesGeometry(geo);
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
      const edges = new THREE.LineSegments(edgeGeo, edgeMat);
      mesh.add(edges);

      // Glow sphere (hidden by default)
      const glowGeo = new THREE.SphereGeometry(Math.max(...def.size) * 0.7, 8, 8);
      const glowMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0, wireframe: false });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      mesh.add(glow);

      const assembled = new THREE.Vector3(...def.pos);
      const exploded = new THREE.Vector3(
        def.pos[0] * 2.2 + (Math.random()-0.5)*0.8,
        def.pos[1] + (i % 3 - 1) * 2.5,
        (i % 2 === 0 ? 2.5 : -2.5) + (Math.random()-0.5)*0.5
      );

      modules.push({ ...def, mesh, glow, assembled, exploded, baseY: def.pos[1] });
    });
  }

  function buildFlowParticles() {
    // Small spheres that travel along connection paths
    const geo = new THREE.SphereGeometry(0.04, 4, 4);
    const FLOW_PATHS = [
      { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 },
      { from: 3, to: 4 }, { from: 1, to: 5 }, { from: 5, to: 6 },
      { from: 2, to: 6 }, { from: 6, to: 7 },
    ];
    FLOW_PATHS.forEach(path => {
      const color = modules[path.from]?.color || C.primary;
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      for (let j = 0; j < 3; j++) {
        const mesh = new THREE.Mesh(geo, mat.clone());
        sceneScene.add(mesh);
        flowParticles.push({ mesh, path, t: (j / 3 + Math.random() * 0.1) % 1, speed: 0.18 + Math.random() * 0.12 });
      }
    });
  }

  function drawConnectionLines() {
    const CONNECTIONS = [
      [0,1],[1,2],[2,3],[3,4],[1,5],[5,6],[2,6],[6,7]
    ];
    const lineMat = new THREE.LineBasicMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.5 });
    CONNECTIONS.forEach(([a, b]) => {
      if (!modules[a] || !modules[b]) return;
      const geo = new THREE.BufferGeometry().setFromPoints([
        modules[a].assembled.clone(), modules[b].assembled.clone()
      ]);
      const line = new THREE.Line(geo, lineMat.clone());
      line.userData.isConnection = true;
      sceneScene.add(line);
    });
  }

  // ── Scene modes ───────────────────────────────────────────────────
  window.setScene = function (mode) {
    animMode = mode;
    autoOrbit = (mode === 'orbit');
    document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
    const btnId = { assembled: 'btn-assembled', exploded: 'btn-exploded', flow: 'btn-flow', orbit: 'btn-orbit' }[mode];
    document.getElementById(btnId)?.classList.add('active');
    if (mode === 'assembled') showModuleInfo(null);
  };

  function showModuleInfo(mod) {
    const el = document.getElementById('module-info');
    if (!el) return;
    if (!mod) { el.textContent = 'Click any module to inspect its role in the forensic pipeline.'; return; }
    el.innerHTML = `<strong style="color:var(--color-text)">${mod.label}</strong> — ${mod.info}`;
  }

  // ── Animation Loop ────────────────────────────────────────────────
  let last = 0;
  function animate(ts) {
    requestAnimationFrame(animate);
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    clock.t += dt;

    animateHero(dt);
    animateScene(dt);
  }

  function animateHero(dt) {
    if (!heroRenderer || !heroScene || !heroCamera) return;
    const t = clock.t;
    particles.forEach(p => {
      const d = p.userData;
      p.position.x = d.ox + Math.sin(t * d.speed + d.phase) * 1.5;
      p.position.y = d.oy + Math.cos(t * d.speed * 0.7 + d.phase) * 0.8;
      p.material.opacity = 0.15 + Math.sin(t * d.speed + d.phase) * 0.15;
    });
    heroRenderer.render(heroScene, heroCamera);
  }

  function animateScene(dt) {
    if (!sceneRenderer || !sceneScene || !sceneCamera) return;
    const t = clock.t;

    if (window._sceneOrbit) window._sceneOrbit(dt);

    // Module animations
    modules.forEach((mod, i) => {
      const mesh = mod.mesh;
      const delay = i * 0.06;

      if (animMode === 'assembled' || animMode === 'orbit') {
        // Hover bob
        mesh.position.x += (mod.assembled.x - mesh.position.x) * 0.08;
        mesh.position.z += (mod.assembled.z - mesh.position.z) * 0.08;
        const targetY = mod.assembled.y + Math.sin(t * 0.6 + i * 0.7) * 0.06;
        mesh.position.y += (targetY - mesh.position.y) * 0.06;
        mesh.rotation.y += (0 - mesh.rotation.y) * 0.05;
      } else if (animMode === 'exploded') {
        // Explode out
        const targetX = mod.exploded.x;
        const targetY = mod.exploded.y + Math.sin(t * 0.5 + i * 0.8) * 0.08;
        const targetZ = mod.exploded.z;
        mesh.position.x += (targetX - mesh.position.x) * 0.06;
        mesh.position.y += (targetY - mesh.position.y) * 0.06;
        mesh.position.z += (targetZ - mesh.position.z) * 0.06;
        mesh.rotation.y = Math.sin(t * 0.3 + i) * 0.15;
        mesh.rotation.z = Math.sin(t * 0.4 + i * 1.3) * 0.08;
      } else if (animMode === 'flow') {
        // Return to assembled, extra pulse
        mesh.position.x += (mod.assembled.x - mesh.position.x) * 0.08;
        mesh.position.y += (mod.assembled.y - mesh.position.y) * 0.08;
        mesh.position.z += (mod.assembled.z - mesh.position.z) * 0.08;
        // Scale pulse
        const pulse = 1 + Math.sin(t * 2 + i * 0.8) * 0.025;
        mesh.scale.setScalar(pulse);
        mesh.rotation.y += 0.003;
      }

      // Hover highlight
      if (hoveredModule === mod) {
        mod.glow.material.opacity = 0.06 + Math.sin(t * 3) * 0.03;
        mesh.material.emissiveIntensity = 0.4;
      } else {
        mod.glow.material.opacity += (0 - mod.glow.material.opacity) * 0.1;
        mesh.material.emissiveIntensity += (0.15 - mesh.material.emissiveIntensity) * 0.08;
      }
    });

    // Flow particles
    if (animMode === 'flow' || animMode === 'assembled' || animMode === 'orbit') {
      flowParticles.forEach(fp => {
        fp.t = (fp.t + dt * fp.speed) % 1;
        const fromMod = modules[fp.path.from];
        const toMod = modules[fp.path.to];
        if (!fromMod || !toMod) return;
        const from = fromMod.mesh.position;
        const to = toMod.mesh.position;
        fp.mesh.position.lerpVectors(from, to, easeInOut(fp.t));
        fp.mesh.material.opacity = Math.sin(fp.t * Math.PI) * 0.9;
        fp.mesh.visible = (animMode !== 'exploded');
      });
    } else {
      flowParticles.forEach(fp => { fp.mesh.visible = false; });
    }

    // Raycaster hover
    if (raycaster && sceneCamera) {
      raycaster.setFromCamera(mouse, sceneCamera);
      const meshes = modules.map(m => m.mesh);
      const hits = raycaster.intersectObjects(meshes);
      const newHover = hits.length ? modules.find(m => m.mesh === hits[0].object) || null : null;
      if (newHover !== hoveredModule) {
        hoveredModule = newHover;
        document.getElementById('scene-canvas').style.cursor = hoveredModule ? 'pointer' : 'grab';
        if (hoveredModule) showModuleInfo(hoveredModule);
      }
    }

    sceneRenderer.render(sceneScene, sceneCamera);
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    if (typeof THREE === 'undefined') return;
    initHeroCanvas();
    initSceneCanvas();
    if (sceneScene) drawConnectionLines();
    requestAnimationFrame(animate);
    showModuleInfo(null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
