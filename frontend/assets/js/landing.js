/* =========================================================
   HERO MULTICOLOUR HELIX
   ========================================================= */
(function () {

  const canvas  = document.getElementById("heroCanvas");
  const visual  = document.getElementById("heroVisual");
  if (!canvas || !visual) return;

  const ctx = canvas.getContext("2d", { alpha: true });

  const popup   = document.getElementById("forensicPopup");
  const popCode = document.getElementById("popupCode");
  const popMsg  = document.getElementById("popupMessage");
  const popMeta = document.getElementById("popupMeta");

  /* ---- six-colour palette for the helix ---- */
  const HELIX_COLOURS = [
    { r:91,  g:142, b:232 }, // blue
    { r:123, g:111, b:240 }, // violet
    { r:224, g:107, b:176 }, // pink
    { r:96,  g:212, b:184 }, // teal
    { r:240, g:160, b:80  }, // amber
    { r:98,  g:201, b:232 }, // cyan
  ];

  /* ---- forensic events: code is digits only ---- */
  const FORENSIC_EVENTS = [
    { code:"403", message:"Suspicious authentication request detected.",     meta:"AUTH · POLICY VIOLATION"  },
    { code:"401", message:"Repeated failed authentication sequence.",        meta:"AUTH · BRUTE FORCE"       },
    { code:"429", message:"Request burst exceeded expected threshold.",      meta:"HTTP · RATE ANOMALY"      },
    { code:"500", message:"Unexpected process failure detected.",            meta:"SYSTEM · ERROR"           },
    { code:"503", message:"Service overload pattern detected.",              meta:"NETWORK · ANOMALY"        },
    { code:"418", message:"Unexpected protocol behaviour observed.",         meta:"PROTOCOL · FORENSIC EVENT"},
    { code:"0x17",message:"Abnormal outbound connection sequence.",          meta:"NETWORK · C2 INDICATOR"   },
    { code:"0x31",message:"Credential access pattern detected.",             meta:"IDENTITY · THREAT SIGNAL" },
  ];

  let width = 0, height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let particles = [];
  let mouse = { x:0, y:0, active:false, lastMove:0, vx:0, vy:0 };

  /* Helix is wide + irregular: not a cylinder */
  const ROTATION_SPEED = 0.00026;

  /* ---- resize ---- */
  function resize() {
    const rect = visual.getBoundingClientRect();
    width  = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr    = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width  = width  + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createParticles();
  }

  /* ---- particles ---- */
  function createParticles() {
    particles = [];
    const count = width < 600 ? 200 : 320;
    for (let i = 0; i < count; i++) {
      const strand = i % 2;
      /* Assign a colour from the palette based on position along helix */
      const colIdx = Math.floor(Math.random() * HELIX_COLOURS.length);
      particles.push({
        strand, t: Math.random(),
        phase:   Math.random() * Math.PI * 2,
        size:    Math.random() < .12 ? 2.2 : 0.8 + Math.random() * 1.3,
        alpha:   .22 + Math.random() * .6,
        speed:   .000032 + Math.random() * .000032,
        drift:   Math.random() * 1000,
        colIdx,
        /* colour shifts slowly */
        colShift: Math.random() * 0.002 + 0.0005,
        status:   Math.random() < .09,
        statusPhase: Math.random() * Math.PI * 2,
        statusSeed:  Math.random(),
        x:0, y:0, screenX:0, screenY:0,
        blownX:0, blownY:0, burst:0,
        event: FORENSIC_EVENTS[Math.floor(Math.random() * FORENSIC_EVENTS.length)],
      });
    }
  }

  /* ---- interpolate between two palette colours ---- */
  function lerpColour(a, b, t) {
    return {
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t,
    };
  }

  function getParticleColour(p, alpha, time) {
    /* shift colour index slowly over time */
    const t = ((p.colIdx + time * p.colShift) % HELIX_COLOURS.length);
    const i0 = Math.floor(t) % HELIX_COLOURS.length;
    const i1 = (i0 + 1) % HELIX_COLOURS.length;
    const frac = t - Math.floor(t);
    const c = lerpColour(HELIX_COLOURS[i0], HELIX_COLOURS[i1], frac);
    return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${alpha})`;
  }

  /* ---- irregular wide helix shape (not cylindrical) ---- */
  function getDNAPoint(p, time) {
    const direction = p.strand === 0 ? -1 : 1;
    const progress  = (p.t + time * p.speed) % 1;

    const angle =
      progress * Math.PI * 7.5 +
      time * ROTATION_SPEED +
      p.phase;

    const centerX = width * .52;
    const centerY = height * .50;

    /*
      Wide radius — noticeably wider than before.
      X radius uses a modulated value so it's NOT a uniform cylinder;
      it breathes / tapers at top & bottom like a real double helix.
    */
    const baseRadiusX = Math.min(width * .30, 230);
    const taper       = 0.62 + 0.38 * Math.cos(progress * Math.PI); // wider at middle
    const radiusX     = baseRadiusX * taper;

    const radiusY = Math.min(height * .40, 295);

    /* Add subtle twist — second harmonic so it's not a pure cylinder */
    const twist = Math.sin(angle * 1.7 + p.phase * .4) * radiusX * 0.14;

    const waveX = Math.sin(angle) * radiusX + twist;
    const waveY = (progress - .5) * radiusY * 2;

    return {
      x: centerX + waveX * direction,
      y: centerY + waveY,
      progress, angle,
    };
  }

  function getAmbientPoint(p, time) {
    const progress  = (p.t + time * p.speed * 1.35) % 1;
    const centerX   = width * .52;
    const xSpread   = width * .46;
    const x = centerX
      + Math.sin(p.phase + progress * Math.PI * 4) * xSpread * .65
      + Math.sin(time * .0002 + p.drift) * 28;
    return { x, y: -30 + progress * (height + 60), progress, angle:0 };
  }

  /* ---- cursor management ---- */
  let nearHelix = false;

  function isNearHelixParticle(mx, my) {
    for (const p of particles) {
      const dx = p.screenX - mx;
      const dy = p.screenY - my;
      if (dx*dx + dy*dy < 60*60) return true;
    }
    return false;
  }

  /* ---- render ---- */
  function render(now) {
    ctx.clearRect(0, 0, width, height);

    /* subtle glow */
    const glow = ctx.createRadialGradient(
      width*.52, height*.5, 10,
      width*.52, height*.5, Math.min(width,height)*.48
    );
    glow.addColorStop(0, "rgba(83,91,221,.06)");
    glow.addColorStop(.5,"rgba(82,178,215,.022)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0,0,width,height);

    const renderList = particles.slice().sort((a,b)=>Math.sin(a.phase)-Math.sin(b.phase));

    for (const p of renderList) {
      const helix = getDNAPoint(p, now);
      let targetX = helix.x, targetY = helix.y;

      if (p.statusSeed > .88 && Math.sin(p.phase + now * .0006) > .55) {
        const amb = getAmbientPoint(p, now);
        targetX = amb.x; targetY = amb.y;
      }

      /* mouse wind */
      const dx = p.screenX - mouse.x;
      const dy = p.screenY - mouse.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const IR = 160;

      if (mouse.active && dist < IR) {
        const force = Math.pow(1 - dist/IR, 2);
        const mf = Math.min(44, Math.sqrt(mouse.vx*mouse.vx+mouse.vy*mouse.vy)*3);
        const push = force * (30 + mf);
        p.blownX += (dx/dist)*push;
        p.blownY += (dy/dist)*push;
        p.burst = Math.min(1, p.burst + force*.12);
      }

      p.blownX *= .91; p.blownY *= .91; p.burst *= .955;
      targetX += p.blownX; targetY += p.blownY;
      p.screenX += (targetX - p.screenX)*.075;
      p.screenY += (targetY - p.screenY)*.075;

      const depth = Math.sin(helix.angle + p.phase);
      const depthAlpha = .38 + (depth+1)*.28;

      const codeVisible = p.status && Math.sin(p.statusPhase + now*.0012) > .65;
      if (codeVisible) drawStatusParticle(p, depthAlpha, now);
      else             drawParticle(p, depthAlpha, now);
    }

    drawRain(now);
  }

  function drawParticle(p, alpha, time) {
    const ba = Math.max(.15, alpha - p.burst*.25);
    ctx.beginPath();
    ctx.arc(p.screenX, p.screenY, p.size, 0, Math.PI*2);
    ctx.fillStyle = getParticleColour(p, ba, time);
    ctx.fill();

    if (p.size > 1.2) {
      ctx.beginPath();
      ctx.moveTo(p.screenX, p.screenY+3);
      ctx.lineTo(p.screenX, p.screenY+11);
      ctx.strokeStyle = getParticleColour(p, alpha*.14, time);
      ctx.lineWidth = .65;
      ctx.stroke();
    }
  }

  function drawStatusParticle(p, alpha, time) {
    const code = p.event.code;
    ctx.font = "700 9px ui-monospace,SFMono-Regular,Menlo,monospace";
    const tw = ctx.measureText(code).width;
    const px=5, bw=tw+px*2, bh=17;
    const x=p.screenX-bw/2, y=p.screenY-bh/2;

    ctx.fillStyle = `rgba(49,53,118,${.2*alpha})`;
    ctx.fillRect(x,y,bw,bh);

    /* use particle colour for the border */
    const c0 = HELIX_COLOURS[p.colIdx % HELIX_COLOURS.length];
    ctx.strokeStyle = `rgba(${c0.r},${c0.g},${c0.b},${.45*alpha})`;
    ctx.lineWidth = .65;
    ctx.strokeRect(x,y,bw,bh);

    ctx.fillStyle = `rgba(${c0.r},${c0.g},${c0.b},${.9*alpha})`;
    ctx.fillText(code, x+px, y+12);

    ctx.beginPath();
    ctx.moveTo(p.screenX, y+bh);
    ctx.lineTo(p.screenX, y+bh+7);
    ctx.strokeStyle = `rgba(${c0.r},${c0.g},${c0.b},${.18*alpha})`;
    ctx.lineWidth = .6;
    ctx.stroke();
  }

  function drawRain(time) {
    const rc = width < 600 ? 22 : 44;
    for (let i=0; i<rc; i++) {
      const seed = i*91.173;
      const x   = (seed*17.13) % width;
      const spd = 0.00004 + (seed%7)*.000004;
      const y   = ((time*spd+seed) % 1) * height;
      const len = 8 + (seed%18);
      ctx.beginPath();
      ctx.moveTo(x,y); ctx.lineTo(x,y+len);
      ctx.strokeStyle = "rgba(79,117,199,.06)";
      ctx.lineWidth = .6;
      ctx.stroke();
    }
  }

  /* ---- pointer events ---- */
  visual.addEventListener("pointermove", function(e) {
    const rect = visual.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouse.vx = x - mouse.x; mouse.vy = y - mouse.y;
    mouse.x=x; mouse.y=y; mouse.active=true; mouse.lastMove=performance.now();

    /* cursor: crosshair near helix particles, default elsewhere */
    const near = isNearHelixParticle(x,y);
    if (near !== nearHelix) {
      nearHelix = near;
      canvas.style.cursor = near ? "crosshair" : "default";
    }

    /* popup on nearest status particle */
    let closest=null, closestD=Infinity;
    for (const p of particles) {
      if (!p.status) continue;
      const dx=p.screenX-x, dy=p.screenY-y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if (d<closestD && d<38){closest=p;closestD=d}
    }
    if (closest) showPopup(closest, closest.screenX, closest.screenY);
    else hidePopup();
  });

  visual.addEventListener("pointerleave", function() {
    mouse.active=false; mouse.vx*=.25; mouse.vy*=.25;
    nearHelix=false; canvas.style.cursor="default";
    hidePopup();
  });

  function showPopup(p,x,y) {
    popCode.textContent = p.event.code;
    popMsg.textContent  = p.event.message;
    popMeta.textContent = p.event.meta;
    const pw=245;
    let left=x+22, top=y-48;
    if (left+pw>width-10) left=x-pw-22;
    top=Math.max(12,Math.min(height-125,top));
    popup.style.left=left+"px"; popup.style.top=top+"px";
    popup.classList.add("visible");
  }
  function hidePopup(){ popup.classList.remove("visible") }

  /* ---- loop ---- */
  let lastTime = performance.now();
  function animate(now) {
    const delta = Math.min(40, now-lastTime); lastTime=now;
    mouse.vx*=.90; mouse.vy*=.90;
    if (now-mouse.lastMove>120) mouse.active=false;
    render(now);
    requestAnimationFrame(animate);
  }

  function initPositions() {
    const now=performance.now();
    for (const p of particles) {
      const pt=getDNAPoint(p,now);
      p.screenX=pt.x; p.screenY=pt.y;
    }
  }

  window.addEventListener("resize", resize, {passive:true});
  resize();
  initPositions();
  requestAnimationFrame(animate);

})();


/* =========================================================
   LIVE DEMO TERMINAL
   ========================================================= */
const SEV_COLOURS = {
  INFO:     "#6BAADC",
  WARN:     "#D4A843",
  ERROR:    "#D96C6C",
  CRITICAL: "#D4618E",
  DEBUG:    "#9B8FCC",
};

const LOG_BANK = {
  normal: [
    ["INFO",    "nginx",   "GET /api/health 200 2ms"],
    ["DEBUG",   "redis",   "PING latency=1ms"],
    ["INFO",    "syslog",  "Cron backup completed exit=0"],
    ["INFO",    "api",     "GET /users 200 8ms"],
    ["DEBUG",   "worker",  "queue depth=4"],
    ["INFO",    "auth",    "session refreshed successfully"],
  ],
  ddos: [
    ["CRITICAL","iptables","FLOOD DETECTED SYN rate=2400/s DROP"],
    ["ERROR",   "nginx",   "upstream overload 503"],
    ["CRITICAL","nginx",   "rate limit exceeded: 1823 req/s"],
    ["ERROR",   "gateway", "connection queue saturation"],
    ["CRITICAL","firewall","abnormal packet burst detected"],
  ],
  brute_force: [
    ["ERROR",   "auth",    "pam_unix: authentication failure; user=root"],
    ["WARN",    "fail2ban","Ban 45.33.32.156 — 247 failures"],
    ["CRITICAL","ssh",     "Illegal user admin from 192.168.44.12"],
    ["ERROR",   "auth",    "password failure threshold exceeded"],
    ["WARN",    "ssh",     "multiple login attempts from external host"],
  ],
  ransomware: [
    ["CRITICAL","kernel",    "mass file rename to .locked: 1842 files/s"],
    ["CRITICAL","syslog",    "vssadmin delete shadows /all /quiet"],
    ["CRITICAL","iptables",  "RANSOM C2 outbound connection blocked"],
    ["CRITICAL","filesystem","unusual encrypted file activity"],
    ["ERROR",   "backup",    "snapshot deletion attempt detected"],
  ],
  hacking: [
    ["CRITICAL","syslog", "nmap SYN scan on 65535 ports detected"],
    ["ERROR",   "apache2","Directory traversal GET /../../../etc/passwd"],
    ["WARN",    "nginx",  "SSRF attempt URL=http://169.254.169.254/metadata"],
    ["CRITICAL","waf",    "suspicious exploit payload blocked"],
    ["ERROR",   "api",    "unexpected command parameter detected"],
  ],
};

let demoMode = "normal";

function setDemoMode(mode) {
  demoMode = mode;
  const label = mode.replace("_"," ").replace(/\b\w/g, c=>c.toUpperCase());
  document.getElementById("demoModeLabel").textContent = label;
  document.querySelectorAll(".demo-mode").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  const terminal = document.getElementById("demoTerminal");
  terminal.innerHTML = "";
  for (let i=0;i<8;i++) addDemoLine();
}

function addDemoLine() {
  const pool = LOG_BANK[demoMode] || LOG_BANK.normal;
  const [severity,source,message] = pool[Math.floor(Math.random()*pool.length)];
  const colour = SEV_COLOURS[severity] || "#C8C5D4";
  const ts = new Date().toLocaleTimeString("en-IN",{hour12:false});

  const div = document.createElement("div");
  div.className = "demo-line";
  div.innerHTML =
    `<span style="color:#55536b">${ts}</span>&nbsp;&nbsp;` +
    `<span style="color:${colour};font-weight:600;display:inline-block;min-width:70px">${severity}</span>` +
    `<span style="color:#70A890;display:inline-block;min-width:85px">${source}</span>` +
    `<span style="color:#C8C5D4">${message}</span>`;

  const terminal = document.getElementById("demoTerminal");
  terminal.appendChild(div);
  if (terminal.children.length > 80) terminal.firstChild.remove();
  terminal.scrollTop = terminal.scrollHeight;
}

for (let i=0;i<14;i++) addDemoLine();
setInterval(addDemoLine, 700);


/* =========================================================
   CARD REVEALS
   ========================================================= */
const revealObserver = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if (e.isIntersecting){
      e.target.classList.add("visible");
      revealObserver.unobserve(e.target);
    }
  });
},{threshold:.12});

document.querySelectorAll("#features .card-reveal, #how .card-reveal")
  .forEach(card=>revealObserver.observe(card));

/* =========================================================
   SCROLL SPY FOR NAVBAR
   ========================================================= */
const navLinks = document.querySelectorAll('.land-nav-link');
const sections = document.querySelectorAll('section[id]');

function updateActiveNav() {
  const scrollY = window.scrollY + 120;
  let currentSection = '';
  sections.forEach(sec => {
    const top = sec.offsetTop;
    const height = sec.offsetHeight;
    if (scrollY >= top && scrollY < top + height) {
      currentSection = sec.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    const href = link.getAttribute('href').replace('#', '');
    link.classList.toggle('active', href === currentSection);
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });
updateActiveNav();