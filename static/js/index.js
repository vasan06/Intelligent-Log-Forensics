/* =========================================================
   INTELLIGENT LOG FORENSICS
   Landing Page — index.js
   ---------------------------------------------------------
   Handles:
   - Hero 3D forensic visualization
   - Interactive pipeline visualization
   - Mouse / touch parallax
   - Scroll-based dismantle motion
   - Data-flow animation
   - Auto orbit
   - Module interaction
   - Scroll reveal
   - Navigation state
   - Smooth navigation
   - Responsive canvas handling
========================================================= */

(function () {
  "use strict";

  /* =======================================================
     GLOBAL STATE
  ======================================================= */

  const state = {
    hero: {
      scene: null,
      camera: null,
      renderer: null,
      group: null,
      particles: null,
      rings: [],
      nodes: [],
      animationId: null,
      mouseX: 0,
      mouseY: 0,
      targetX: 0,
      targetY: 0
    },

    pipeline: {
      scene: null,
      camera: null,
      renderer: null,
      root: null,
      modules: [],
      particles: [],
      links: [],
      animationId: null,
      mode: "assembled",
      autoOrbit: false,
      dragging: false,
      pointerX: 0,
      pointerY: 0,
      rotationX: 0.15,
      rotationY: 0,
      targetRotationX: 0.15,
      targetRotationY: 0,
      lastTime: 0
    }
  };


  /* =======================================================
     INITIALIZATION
  ======================================================= */

  document.addEventListener("DOMContentLoaded", () => {
    initializeNavigation();
    initializeScrollReveal();
    initializeSmoothScroll();
    initializeHeroScene();
    initializePipelineScene();
    initializeGlobalPointerEffects();
  });


  /* =======================================================
     NAVIGATION
  ======================================================= */

  function initializeNavigation() {
    const nav = document.getElementById("main-nav");

    if (!nav) {
      return;
    }

    const updateNav = () => {
      nav.classList.toggle("scrolled", window.scrollY > 24);
      updateActiveSection();
    };

    window.addEventListener("scroll", updateNav, {
      passive: true
    });

    updateNav();
  }


  function updateActiveSection() {
    const sections = document.querySelectorAll(
      "section[id]"
    );

    const links = document.querySelectorAll(
      ".lp-nav-link[href^='#']"
    );

    if (!sections.length || !links.length) {
      return;
    }

    let current = "";

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();

      if (
        rect.top <= window.innerHeight * 0.35 &&
        rect.bottom >= window.innerHeight * 0.35
      ) {
        current = section.id;
      }
    });

    links.forEach((link) => {
      const href = link.getAttribute("href");

      link.classList.toggle(
        "active",
        href === `#${current}`
      );
    });
  }


  /* =======================================================
     SMOOTH SCROLL
  ======================================================= */

  function initializeSmoothScroll() {
    document.querySelectorAll(
      'a[href^="#"]'
    ).forEach((link) => {
      link.addEventListener("click", (event) => {
        const selector = link.getAttribute("href");

        if (!selector || selector === "#") {
          return;
        }

        const target = document.querySelector(selector);

        if (!target) {
          return;
        }

        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });
  }


  /* =======================================================
     SCROLL REVEAL
  ======================================================= */

  function initializeScrollReveal() {
    const elements = document.querySelectorAll(
      ".reveal"
    );

    if (!elements.length) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.classList.add("visible");
      });

      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("visible");

          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -60px 0px"
      }
    );

    elements.forEach((element) => {
      observer.observe(element);
    });
  }


  /* =======================================================
     HERO THREE.JS SCENE
  ======================================================= */

  function initializeHeroScene() {
    const canvas = document.getElementById(
      "hero-canvas"
    );

    if (!canvas || typeof THREE === "undefined") {
      return;
    }

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      42,
      canvas.clientWidth / Math.max(canvas.clientHeight, 1),
      0.1,
      100
    );

    camera.position.set(
      0,
      0,
      9
    );

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );

    renderer.setSize(
      canvas.clientWidth,
      canvas.clientHeight,
      false
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    const root = new THREE.Group();

    scene.add(root);

    state.hero.scene = scene;
    state.hero.camera = camera;
    state.hero.renderer = renderer;
    state.hero.group = root;


    /* -------------------------------------------------------
       Lighting
    ------------------------------------------------------- */

    const ambient = new THREE.AmbientLight(
      0xffffff,
      2
    );

    scene.add(ambient);

    const lightA = new THREE.PointLight(
      0x2563eb,
      12,
      20
    );

    lightA.position.set(
      -4,
      3,
      4
    );

    scene.add(lightA);

    const lightB = new THREE.PointLight(
      0x14b8a6,
      9,
      18
    );

    lightB.position.set(
      4,
      -2,
      3
    );

    scene.add(lightB);


    /* -------------------------------------------------------
       Central Forensic Core
    ------------------------------------------------------- */

    const core = createHeroCore();

    root.add(core);


    /* -------------------------------------------------------
       Floating Data Nodes
    ------------------------------------------------------- */

    createHeroNodes(root);


    /* -------------------------------------------------------
       Orbit Rings
    ------------------------------------------------------- */

    createHeroRings(root);


    /* -------------------------------------------------------
       Background Particles
    ------------------------------------------------------- */

    createHeroParticles(scene);


    /* -------------------------------------------------------
       Interaction
    ------------------------------------------------------- */

    canvas.addEventListener(
      "pointermove",
      (event) => {
        const rect = canvas.getBoundingClientRect();

        state.hero.targetX =
          ((event.clientX - rect.left) /
            rect.width -
            0.5);

        state.hero.targetY =
          ((event.clientY - rect.top) /
            rect.height -
            0.5);
      }
    );

    canvas.addEventListener(
      "pointerleave",
      () => {
        state.hero.targetX = 0;
        state.hero.targetY = 0;
      }
    );


    /* -------------------------------------------------------
       Resize
    ------------------------------------------------------- */

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (!width || !height) {
        return;
      }

      camera.aspect =
        width / height;

      camera.updateProjectionMatrix();

      renderer.setSize(
        width,
        height,
        false
      );
    };

    window.addEventListener(
      "resize",
      resize
    );


    /* -------------------------------------------------------
       Animation
    ------------------------------------------------------- */

    const clock = new THREE.Clock();

    function animate() {
      state.hero.animationId =
        requestAnimationFrame(animate);

      const elapsed =
        clock.getElapsedTime();

      state.hero.group.rotation.y =
        elapsed * 0.10;

      state.hero.group.rotation.x =
        Math.sin(elapsed * 0.35) * 0.08;

      state.hero.mouseX +=
        (state.hero.targetX -
          state.hero.mouseX) * 0.035;

      state.hero.mouseY +=
        (state.hero.targetY -
          state.hero.mouseY) * 0.035;

      root.position.x =
        state.hero.mouseX * 0.35;

      root.position.y =
        -state.hero.mouseY * 0.25;

      animateHeroNodes(elapsed);
      animateHeroRings(elapsed);

      renderer.render(
        scene,
        camera
      );
    }

    resize();
    animate();
  }


  /* =======================================================
     HERO CORE
  ======================================================= */

  function createHeroCore() {
    const group = new THREE.Group();

    const outerGeometry =
      new THREE.IcosahedronGeometry(
        1.15,
        2
      );

    const outerMaterial =
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.22,
        roughness: 0.08,
        metalness: 0.1,
        transmission: 0.35,
        thickness: 0.8,
        side: THREE.DoubleSide
      });

    const outer =
      new THREE.Mesh(
        outerGeometry,
        outerMaterial
      );

    group.add(outer);


    const innerGeometry =
      new THREE.IcosahedronGeometry(
        0.72,
        1
      );

    const innerMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        emissive: 0x2563eb,
        emissiveIntensity: 1.4,
        transparent: true,
        opacity: 0.82,
        roughness: 0.18,
        metalness: 0.35
      });

    const inner =
      new THREE.Mesh(
        innerGeometry,
        innerMaterial
      );

    group.add(inner);


    /* Central data point */

    const pointGeometry =
      new THREE.SphereGeometry(
        0.19,
        24,
        24
      );

    const pointMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xffffff
      });

    const point =
      new THREE.Mesh(
        pointGeometry,
        pointMaterial
      );

    group.add(point);


    /* Tiny data fragments */

    for (let i = 0; i < 16; i++) {
      const angle =
        (Math.PI * 2 * i) / 16;

      const radius =
        1.45 + Math.random() * 0.35;

      const fragmentGeometry =
        new THREE.BoxGeometry(
          0.035,
          0.035,
          0.12
        );

      const fragmentMaterial =
        new THREE.MeshBasicMaterial({
          color:
            i % 2 === 0
              ? 0x2563eb
              : 0x14b8a6
        });

      const fragment =
        new THREE.Mesh(
          fragmentGeometry,
          fragmentMaterial
        );

      fragment.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        (Math.random() - 0.5) * 0.5
      );

      fragment.lookAt(0, 0, 0);

      group.add(fragment);
    }

    return group;
  }


  /* =======================================================
     HERO DATA NODES
  ======================================================= */

  function createHeroNodes(root) {
    const nodeGeometry =
      new THREE.SphereGeometry(
        0.045,
        12,
        12
      );

    for (let i = 0; i < 32; i++) {
      const material =
        new THREE.MeshBasicMaterial({
          color:
            i % 3 === 0
              ? 0x14b8a6
              : 0x2563eb
        });

      const node =
        new THREE.Mesh(
          nodeGeometry,
          material
        );

      const radius =
        2.0 + Math.random() * 2.3;

      const theta =
        Math.random() * Math.PI * 2;

      const phi =
        Math.acos(
          2 * Math.random() - 1
        );

      node.userData = {
        radius,
        theta,
        phi,
        speed:
          0.15 +
          Math.random() * 0.25
      };

      node.position.set(
        radius *
          Math.sin(phi) *
          Math.cos(theta),

        radius *
          Math.sin(phi) *
          Math.sin(theta),

        radius *
          Math.cos(phi)
      );

      root.add(node);

      state.hero.nodes.push(node);
    }
  }


  function animateHeroNodes(time) {
    state.hero.nodes.forEach(
      (node) => {
        const data =
          node.userData;

        const theta =
          data.theta +
          time * data.speed;

        node.position.x =
          data.radius *
          Math.sin(data.phi) *
          Math.cos(theta);

        node.position.y =
          data.radius *
          Math.sin(data.phi) *
          Math.sin(theta);

        node.position.z =
          data.radius *
          Math.cos(data.phi);
      }
    );
  }


  /* =======================================================
     HERO RINGS
  ======================================================= */

  function createHeroRings(root) {
    const ringConfigs = [
      {
        radius: 1.7,
        rotation: [0.7, 0.2, 0.1]
      },
      {
        radius: 2.15,
        rotation: [1.2, 0.4, 0.8]
      },
      {
        radius: 2.7,
        rotation: [0.2, 1.0, 0.4]
      }
    ];

    ringConfigs.forEach(
      (config, index) => {
        const geometry =
          new THREE.TorusGeometry(
            config.radius,
            0.008,
            8,
            160
          );

        const material =
          new THREE.MeshBasicMaterial({
            color:
              index === 1
                ? 0x14b8a6
                : 0x2563eb,
            transparent: true,
            opacity: 0.35
          });

        const ring =
          new THREE.Mesh(
            geometry,
            material
          );

        ring.rotation.set(
          ...config.rotation
        );

        root.add(ring);

        state.hero.rings.push(ring);
      }
    );
  }


  function animateHeroRings(time) {
    state.hero.rings.forEach(
      (ring, index) => {
        ring.rotation.z =
          time *
          (0.08 + index * 0.035);

        ring.rotation.x +=
          0.0003;
      }
    );
  }


  /* =======================================================
     HERO PARTICLES
  ======================================================= */

  function createHeroParticles(scene) {
    const count = 900;

    const positions =
      new Float32Array(
        count * 3
      );

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      positions[i3] =
        (Math.random() - 0.5) *
        18;

      positions[i3 + 1] =
        (Math.random() - 0.5) *
        10;

      positions[i3 + 2] =
        (Math.random() - 0.5) *
        8;
    }

    const geometry =
      new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        positions,
        3
      )
    );

    const material =
      new THREE.PointsMaterial({
        color: 0x2563eb,
        size: 0.018,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      });

    const particles =
      new THREE.Points(
        geometry,
        material
      );

    scene.add(particles);

    state.hero.particles =
      particles;
  }


  /* =======================================================
     PIPELINE 3D VISUALIZATION
  ======================================================= */

  function initializePipelineScene() {
    const canvas =
      document.getElementById(
        "scene-canvas"
      );

    if (!canvas || typeof THREE === "undefined") {
      return;
    }

    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        45,
        canvas.clientWidth /
          Math.max(canvas.clientHeight, 1),
        0.1,
        100
      );

    camera.position.set(
      0,
      1.5,
      11
    );

    const renderer =
      new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference:
          "high-performance"
      });

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        2
      )
    );

    renderer.setSize(
      canvas.clientWidth,
      canvas.clientHeight,
      false
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    state.pipeline.scene =
      scene;

    state.pipeline.camera =
      camera;

    state.pipeline.renderer =
      renderer;


    /* -------------------------------------------------------
       Lights
    ------------------------------------------------------- */

    scene.add(
      new THREE.AmbientLight(
        0xffffff,
        2
      )
    );

    const light =
      new THREE.PointLight(
        0x2563eb,
        18,
        30
      );

    light.position.set(
      3,
      5,
      6
    );

    scene.add(light);


    /* -------------------------------------------------------
       Root
    ------------------------------------------------------- */

    const root =
      new THREE.Group();

    scene.add(root);

    state.pipeline.root =
      root;


    /* -------------------------------------------------------
       Modules
    ------------------------------------------------------- */

    const modules = [
      {
        id: "ingestion",
        title: "LOG INGESTION",
        subtitle: "Raw Events",
        position: [-4.5, 0, 0],
        color: 0x2563eb
      },
      {
        id: "parsing",
        title: "PARSER",
        subtitle: "Normalize",
        position: [-2.2, 1.0, 0],
        color: 0x0ea5e9
      },
      {
        id: "detection",
        title: "THREAT ENGINE",
        subtitle: "Detection",
        position: [0, 0, 0],
        color: 0xef4444
      },
      {
        id: "ml",
        title: "ML ANALYSIS",
        subtitle: "Anomaly Score",
        position: [2.2, 1.0, 0],
        color: 0x8b5cf6
      },
      {
        id: "intelligence",
        title: "FORENSIC INTELLIGENCE",
        subtitle: "Evidence",
        position: [4.5, 0, 0],
        color: 0x14b8a6
      }
    ];

    modules.forEach(
      (config) => {
        const module =
          createPipelineModule(
            config
          );

        root.add(module);

        state.pipeline.modules.push(
          module
        );
      }
    );


    /* -------------------------------------------------------
       Connection Lines
    ------------------------------------------------------- */

    for (
      let i = 0;
      i < modules.length - 1;
      i++
    ) {
      const line =
        createPipelineLink(
          modules[i].position,
          modules[i + 1].position
        );

      root.add(line);

      state.pipeline.links.push(
        line
      );
    }


    /* -------------------------------------------------------
       Flow Particles
    ------------------------------------------------------- */

    createPipelineParticles(
      root,
      modules
    );


    /* -------------------------------------------------------
       Pointer Controls
    ------------------------------------------------------- */

    canvas.addEventListener(
      "pointerdown",
      (event) => {
        state.pipeline.dragging =
          true;

        state.pipeline.pointerX =
          event.clientX;

        state.pipeline.pointerY =
          event.clientY;

        canvas.setPointerCapture(
          event.pointerId
        );
      }
    );

    canvas.addEventListener(
      "pointermove",
      (event) => {
        if (
          !state.pipeline.dragging
        ) {
          return;
        }

        const dx =
          event.clientX -
          state.pipeline.pointerX;

        const dy =
          event.clientY -
          state.pipeline.pointerY;

        state.pipeline.targetRotationY +=
          dx * 0.005;

        state.pipeline.targetRotationX +=
          dy * 0.004;

        state.pipeline.pointerX =
          event.clientX;

        state.pipeline.pointerY =
          event.clientY;
      }
    );

    canvas.addEventListener(
      "pointerup",
      (event) => {
        state.pipeline.dragging =
          false;

        canvas.releasePointerCapture(
          event.pointerId
        );
      }
    );

    canvas.addEventListener(
      "pointercancel",
      () => {
        state.pipeline.dragging =
          false;
      }
    );


    /* -------------------------------------------------------
       Wheel Zoom
    ------------------------------------------------------- */

    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();

        camera.position.z +=
          event.deltaY * 0.006;

        camera.position.z =
          Math.max(
            7,
            Math.min(
              16,
              camera.position.z
            )
          );
      },
      {
        passive: false
      }
    );


    /* -------------------------------------------------------
       Resize
    ------------------------------------------------------- */

    const resize = () => {
      const width =
        canvas.clientWidth;

      const height =
        canvas.clientHeight;

      if (!width || !height) {
        return;
      }

      camera.aspect =
        width / height;

      camera.updateProjectionMatrix();

      renderer.setSize(
        width,
        height,
        false
      );
    };

    window.addEventListener(
      "resize",
      resize
    );


    /* -------------------------------------------------------
       Animation
    ------------------------------------------------------- */

    const clock =
      new THREE.Clock();

    function animate() {
      state.pipeline.animationId =
        requestAnimationFrame(
          animate
        );

      const elapsed =
        clock.getElapsedTime();

      if (
        state.pipeline.autoOrbit &&
        !state.pipeline.dragging
      ) {
        state.pipeline.targetRotationY =
          elapsed * 0.16;
      }

      state.pipeline.rotationY +=
        (
          state.pipeline.targetRotationY -
          state.pipeline.rotationY
        ) * 0.06;

      state.pipeline.rotationX +=
        (
          state.pipeline.targetRotationX -
          state.pipeline.rotationX
        ) * 0.06;

      root.rotation.y =
        state.pipeline.rotationY;

      root.rotation.x =
        state.pipeline.rotationX;

      animatePipelineModules(
        elapsed
      );

      animatePipelineParticles(
        elapsed
      );

      renderer.render(
        scene,
        camera
      );
    }

    resize();
    animate();
  }


  /* =======================================================
     PIPELINE MODULE
  ======================================================= */

  function createPipelineModule(config) {
    const group =
      new THREE.Group();

    group.position.set(
      ...config.position
    );

    group.userData = {
      id: config.id,
      title: config.title,
      subtitle: config.subtitle,
      baseY: config.position[1]
    };


    /* Outer glass shell */

    const shellGeometry =
      new THREE.BoxGeometry(
        1.55,
        1.35,
        1.55
      );

    const shellMaterial =
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
        roughness: 0.08,
        metalness: 0.15,
        transmission: 0.25,
        thickness: 0.5
      });

    const shell =
      new THREE.Mesh(
        shellGeometry,
        shellMaterial
      );

    group.add(shell);


    /* Inner core */

    const coreGeometry =
      new THREE.IcosahedronGeometry(
        0.52,
        1
      );

    const coreMaterial =
      new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0.82,
        roughness: 0.2,
        metalness: 0.35
      });

    const core =
      new THREE.Mesh(
        coreGeometry,
        coreMaterial
      );

    group.add(core);


    /* Orbit ring */

    const ringGeometry =
      new THREE.TorusGeometry(
        0.78,
        0.012,
        8,
        64
      );

    const ringMaterial =
      new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.65
      });

    const ring =
      new THREE.Mesh(
        ringGeometry,
        ringMaterial
      );

    ring.rotation.x =
      Math.PI / 2;

    group.add(ring);


    /* Data nodes */

    for (let i = 0; i < 8; i++) {
      const node =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            0.035,
            8,
            8
          ),
          new THREE.MeshBasicMaterial({
            color: config.color
          })
        );

      const angle =
        (Math.PI * 2 * i) / 8;

      node.position.set(
        Math.cos(angle) * 0.88,
        Math.sin(angle) * 0.42,
        Math.sin(angle) * 0.88
      );

      group.add(node);
    }


    /* Save child refs */

    group.userData.core =
      core;

    group.userData.ring =
      ring;

    group.userData.phase =
      Math.random() * Math.PI * 2;

    return group;
  }


  /* =======================================================
     MODULE ANIMATION
  ======================================================= */

  function animatePipelineModules(
    elapsed
  ) {
    state.pipeline.modules.forEach(
      (module) => {
        const phase =
          module.userData.phase;

        module.position.y =
          module.userData.baseY +
          Math.sin(
            elapsed * 1.2 +
            phase
          ) * 0.045;

        if (
          module.userData.core
        ) {
          module.userData.core.rotation.x +=
            0.006;

          module.userData.core.rotation.y +=
            0.009;
        }

        if (
          module.userData.ring
        ) {
          module.userData.ring.rotation.z =
            elapsed * 0.35;
        }
      }
    );
  }


  /* =======================================================
     PIPELINE LINKS
  ======================================================= */

  function createPipelineLink(
    from,
    to
  ) {
    const points = [
      new THREE.Vector3(...from),
      new THREE.Vector3(...to)
    ];

    const geometry =
      new THREE.BufferGeometry()
        .setFromPoints(points);

    const material =
      new THREE.LineBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.38
      });

    const line =
      new THREE.Line(
        geometry,
        material
      );

    return line;
  }


  /* =======================================================
     FLOW PARTICLES
  ======================================================= */

  function createPipelineParticles(
    root,
    modules
  ) {
    for (
      let i = 0;
      i < 70;
      i++
    ) {
      const particle =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            0.028,
            8,
            8
          ),
          new THREE.MeshBasicMaterial({
            color:
              i % 2
                ? 0x2563eb
                : 0x14b8a6
          })
        );

      const segment =
        Math.floor(
          Math.random() *
            (modules.length - 1)
        );

      particle.userData = {
        segment,
        progress:
          Math.random(),
        speed:
          0.12 +
          Math.random() * 0.18
      };

      root.add(particle);

      state.pipeline.particles.push(
        particle
      );
    }
  }


  function animatePipelineParticles(
    elapsed
  ) {
    const modules =
      state.pipeline.modules;

    state.pipeline.particles.forEach(
      (particle) => {
        const data =
          particle.userData;

        data.progress +=
          data.speed * 0.01;

        if (data.progress > 1) {
          data.progress = 0;

          data.segment =
            (
              data.segment + 1
            ) %
            (modules.length - 1);
        }

        const a =
          modules[data.segment];

        const b =
          modules[data.segment + 1];

        if (!a || !b) {
          return;
        }

        const progress =
          data.progress;

        particle.position.lerpVectors(
          a.position,
          b.position,
          progress
        );

        particle.position.y +=
          Math.sin(
            elapsed * 2 +
            data.segment
          ) * 0.04;
      }
    );
  }


  /* =======================================================
     PUBLIC SCENE CONTROL
  ======================================================= */

  window.setScene =
    function (mode) {
      const pipeline =
        state.pipeline;

      if (!pipeline.root) {
        return;
      }

      pipeline.mode =
        mode;

      document
        .querySelectorAll(
          ".viz-btn"
        )
        .forEach((button) => {
          button.classList.remove(
            "active"
          );
        });

      const activeButton =
        document.getElementById(
          `btn-${mode}`
        );

      if (activeButton) {
        activeButton.classList.add(
          "active"
        );
      }

      pipeline.autoOrbit =
        mode === "orbit";

      const modules =
        pipeline.modules;

      if (mode === "assembled") {
        modules.forEach(
          (module, index) => {
            const original =
              [
                [-4.5, 0, 0],
                [-2.2, 1, 0],
                [0, 0, 0],
                [2.2, 1, 0],
                [4.5, 0, 0]
              ][index];

            module.userData.baseY =
              original[1];

            module.position.x =
              original[0];

            module.position.z =
              original[2];
          }
        );

        showModuleInfo(
          "Complete forensic pipeline — ingestion → parsing → detection → ML → intelligence"
        );
      }


      if (mode === "exploded") {
        modules.forEach(
          (module, index) => {
            const angle =
              (
                index /
                (modules.length - 1)
              ) *
              Math.PI -
              Math.PI / 2;

            const radius = 4.2;

            module.position.x =
              Math.cos(angle) *
              radius;

            module.position.y =
              Math.sin(angle) *
              radius *
              0.55;

            module.position.z =
              Math.sin(
                index * 1.8
              ) * 1.2;
          }
        );

        showModuleInfo(
          "Exploded view — each processing stage separated to reveal the internal forensic pipeline"
        );
      }


      if (mode === "flow") {
        modules.forEach(
          (module, index) => {
            module.position.x =
              -4.5 +
              index * 2.25;

            module.position.y =
              Math.sin(
                index * 1.4
              ) * 0.8;

            module.position.z =
              Math.cos(
                index * 1.2
              ) * 0.8;
          }
        );

        showModuleInfo(
          "Live data flow — particles represent log events moving through the analysis pipeline"
        );
      }


      if (mode === "orbit") {
        showModuleInfo(
          "Auto orbit — inspect the complete forensic system from every angle"
        );
      }
    };


  /* =======================================================
     MODULE INFO
  ======================================================= */

  function showModuleInfo(
    message
  ) {
    const info =
      document.getElementById(
        "module-info"
      );

    if (!info) {
      return;
    }

    info.textContent =
      message;
  }


  /* =======================================================
     GLOBAL POINTER PARALLAX
  ======================================================= */

  function initializeGlobalPointerEffects() {
    let x = 0;
    let y = 0;

    let targetX = 0;
    let targetY = 0;

    window.addEventListener(
      "pointermove",
      (event) => {
        targetX =
          event.clientX /
            window.innerWidth -
          0.5;

        targetY =
          event.clientY /
            window.innerHeight -
          0.5;
      },
      {
        passive: true
      }
    );

    function animate() {
      x +=
        (targetX - x) * 0.025;

      y +=
        (targetY - y) * 0.025;

      document.documentElement.style.setProperty(
        "--pointer-x",
        `${x * 100}%`
      );

      document.documentElement.style.setProperty(
        "--pointer-y",
        `${y * 100}%`
      );

      requestAnimationFrame(
        animate
      );
    }

    animate();
  }


  /* =======================================================
     CLEANUP
  ======================================================= */

  window.addEventListener(
    "beforeunload",
    () => {
      if (
        state.hero.animationId
      ) {
        cancelAnimationFrame(
          state.hero.animationId
        );
      }

      if (
        state.pipeline.animationId
      ) {
        cancelAnimationFrame(
          state.pipeline.animationId
        );
      }

      if (
        state.hero.renderer
      ) {
        state.hero.renderer.dispose();
      }

      if (
        state.pipeline.renderer
      ) {
        state.pipeline.renderer.dispose();
      }
    }
  );

})();