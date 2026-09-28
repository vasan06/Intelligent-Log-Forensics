/*
 * navbar.js — ILF Top Navigation
 * Injects horizontal nav with SVG icons, active state, user dropdown.
 * No emoji. All icons are inline SVG.
 */

/* ── SVG Icon library ──────────────────────── */
const ICONS = {
  home:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  folder:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  brain:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.16z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.16z"/></svg>`,
  shield:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  book:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  file:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  settings:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  user:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  logout:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  sun:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  menu:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  ilf:     `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
};

/* ── Nav link definitions ──────────────────── */
const NAV_LINKS = [
  { href: 'dashboard.html',     label: 'Dashboard',      icon: 'home'    },
  { href: 'live-monitor.html',  label: 'Live Monitor',   icon: 'monitor', badge: 'LIVE' },
  { href: 'log-explorer.html',  label: 'Log Explorer',   icon: 'folder'  },
  { href: 'ml-analysis.html',   label: 'ML Analysis',    icon: 'brain'   },
  { href: 'mitre-tracker.html', label: 'MITRE Tracker',  icon: 'shield'  },
  { href: 'mitre-catalog.html', label: 'ATT&CK Catalog', icon: 'book'    },
  { href: 'reports.html',       label: 'Reports',        icon: 'file'    },
  { href: 'admin.html',         label: 'Admin',          icon: 'settings'},
];

/* ── Inject navbar ─────────────────────────── */
function injectNavbar() {
  const user     = Api.user();
  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const page     = location.pathname.split('/').pop() || 'index.html';

  const linksHtml = NAV_LINKS.map(l => {
    const active = page === l.href ? 'active' : '';
    const badge  = l.badge ? `<span class="nav-badge">${l.badge}</span>` : '';
    return `<a href="${l.href}" class="nav-link ${active}" data-page="${l.href}">
      ${ICONS[l.icon]} <span>${l.label}</span>${badge}
    </a>`;
  }).join('');

  const drawerHtml = NAV_LINKS.map(l => {
    const active = page === l.href ? 'active' : '';
    return `<a href="${l.href}" class="nav-link ${active}">${ICONS[l.icon]} <span>${l.label}</span></a>`;
  }).join('');

  const nav = document.createElement('header');
  nav.innerHTML = `
    <nav class="nav" id="mainNav" role="navigation">
      <a href="landing.html" class="nav-brand">
        <div class="nav-brand-mark">${ICONS.ilf}</div>
        <div>
          <div class="nav-brand-name">ILF</div>
          <div class="nav-brand-abbr">Log Forensics</div>
        </div>
      </a>

      <div class="nav-links">${linksHtml}</div>

      <div class="nav-right">
        <div class="nav-divider"></div>
        <div class="nav-user-wrap" id="navUserWrap">
          <div class="nav-user-btn" id="navUserBtn" onclick="toggleUserMenu()">
            <div class="avatar avatar-sm" id="navAvatar">${initials}</div>
            <span class="nav-user-name" id="navUserName">${user.name || 'User'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="nav-user-dropdown" id="navDropdown">
            <a href="profile.html" class="dropdown-item">${ICONS.user} <span>My Profile</span></a>
            <div class="dropdown-sep"></div>
            <div class="dropdown-item danger" onclick="doLogout()">${ICONS.logout} <span>Sign Out</span></div>
          </div>
        </div>
        <button class="nav-hamburger" id="navHamburger" onclick="toggleDrawer()" aria-label="Menu">
          ${ICONS.menu}
        </button>
      </div>
    </nav>
    <div class="nav-drawer" id="navDrawer">${drawerHtml}</div>
  `;
  document.body.prepend(nav);

  /* Scroll shadow */
  window.addEventListener('scroll', () => {
    document.getElementById('mainNav').classList.toggle('scrolled', window.scrollY > 10);
  });
}

function toggleUserMenu() {
  document.getElementById('navUserWrap').classList.toggle('open');
}
function toggleDrawer() {
  document.getElementById('navDrawer').classList.toggle('open');
}
document.addEventListener('click', e => {
  const wrap = document.getElementById('navUserWrap');
  if (wrap && !wrap.contains(e.target)) wrap.classList.remove('open');
});

/* ── Update nav user info ──────────────────── */
function refreshNavUser() {
  const user     = Api.user();
  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const el = document.getElementById('navAvatar');
  const nm = document.getElementById('navUserName');
  if (el) el.textContent = initials;
  if (nm) nm.textContent = user.name || 'User';
}

async function doLogout() {
  await Api.logout();
  Api.clearAuth();
  window.location.href = 'index.html';
}
