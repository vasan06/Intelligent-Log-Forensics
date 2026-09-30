
/*
 * navbar.js — ILF Top Navigation
 *
 * Compact text-first navigation.
 * No icons in the primary navigation.
 * Admin tab appears only for Admin users.
 * Navbar is injected once on authenticated pages.
 */

const NAV_ICONS = {
  user: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  `,

  logout: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  `,

  settings: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  `,

  menu: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  `
};


/* ─────────────────────────────────────────────
   Navigation definitions
   ───────────────────────────────────────────── */

const ALL_NAV_LINKS = [
  { href: "/dashboard",      label: "Dashboard" },
  { href: "/live-monitor",   label: "Live Monitor", badge: "LIVE" },
  { href: "/log-explorer",   label: "Log Explorer" },
  { href: "/ml-analysis",    label: "ML Analysis" },
  { href: "/mitre-tracker",  label: "MITRE Tracker" },
  { href: "/mitre-catalog",  label: "ATT&CK Catalog" },
  { href: "/reports",        label: "Reports" },
  { href: "/admin",          label: "Admin", adminOnly: true }
];


/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function getCurrentPath() {
  const pathname = window.location.pathname || "/";

  let path = pathname.replace(/\/+$/, "");

  if (!path || path === "/") {
    return "/dashboard";
  }

  path = path.replace(/\.html$/, "");

  return path;
}


function getUser() {
  if (typeof Api !== "undefined" && typeof Api.user === "function") {
    return Api.user() || {};
  }

  return {};
}


function getInitials(name) {
  return String(name || "U")
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}


/* ─────────────────────────────────────────────
   Build navigation
   ───────────────────────────────────────────── */

function buildNavLinks(visibleLinks, currentPath) {

  return visibleLinks.map(link => {

    const active =
      currentPath === link.href ||
      (
        link.href === "/dashboard" &&
        currentPath === "/"
      );

    const badge = link.badge
      ? `<span class="nav-badge">${link.badge}</span>`
      : "";

    return `
      <a
        href="${link.href}"
        class="nav-link ${active ? "active" : ""}"
        data-page="${link.href}"
      >
        <span class="nav-link-label">${link.label}</span>
        ${badge}
      </a>
    `;
  }).join("");
}


function buildDrawerLinks(visibleLinks, currentPath) {

  return visibleLinks.map(link => {

    const active =
      currentPath === link.href ||
      (
        link.href === "/dashboard" &&
        currentPath === "/"
      );

    const badge = link.badge
      ? `<span class="nav-badge">${link.badge}</span>`
      : "";

    return `
      <a
        href="${link.href}"
        class="drawer-link ${active ? "active" : ""}"
      >
        <span>${link.label}</span>
        ${badge}
      </a>
    `;
  }).join("");
}


/* ─────────────────────────────────────────────
   Inject navbar
   ───────────────────────────────────────────── */

function injectNavbar() {

  if (document.getElementById("mainNav")) {
    return;
  }

  const user = getUser();

  const role = String(user.role || "").toLowerCase();
  const isAdmin = role === "admin";

  const userName = user.name || "User";
  const userEmail = user.email || "";
  const initials = getInitials(userName);

  const currentPath = getCurrentPath();

  const visibleLinks = ALL_NAV_LINKS.filter(
    link => !link.adminOnly || isAdmin
  );

  const linksHtml = buildNavLinks(
    visibleLinks,
    currentPath
  );

  const drawerHtml = buildDrawerLinks(
    visibleLinks,
    currentPath
  );


  const header = document.createElement("header");

  header.className = "ilf-navbar-wrapper";

  header.innerHTML = `
    <nav
      class="nav"
      id="mainNav"
      role="navigation"
      aria-label="Main navigation"
    >

      <!-- BRAND -->
      <a
        href="/dashboard"
        class="nav-brand"
        title="Intelligent Log Forensic"
      >
        <span class="nav-brand-title">
          Intelligent Log Forensic
        </span>
      </a>


      <!-- DESKTOP LINKS -->
      <div class="nav-links" id="navLinks">
        ${linksHtml}
      </div>


      <!-- RIGHT SIDE -->
      <div class="nav-right">

        <div class="nav-divider"></div>


        <!-- USER -->
        <div
          class="nav-user-wrap"
          id="navUserWrap"
        >

          <button
            type="button"
            class="nav-user-btn"
            id="navUserBtn"
            aria-expanded="false"
            aria-haspopup="true"
          >

            <div
              class="avatar avatar-sm"
              id="navAvatar"
            >
              ${initials}
            </div>

            <span
              class="nav-user-name"
              id="navUserName"
            >
              ${userName}
            </span>

            <span
              class="nav-user-role-badge ${isAdmin ? "admin-badge" : ""}"
              id="navUserRole"
            >
              ${isAdmin ? "Admin" : "User"}
            </span>

            <svg
              class="nav-chevron"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>

          </button>


          <!-- USER DROPDOWN -->
          <div
            class="nav-user-dropdown"
            id="navDropdown"
          >

            <div class="dropdown-header">

              <div class="font-600">
                ${userName}
              </div>

              <div class="text-xs text-muted">
                ${userEmail}
              </div>

            </div>


            <div class="dropdown-sep"></div>


            <a
              href="/profile"
              class="dropdown-item"
            >
              ${NAV_ICONS.user}
              <span>My Profile</span>
            </a>


            ${
              isAdmin
                ? `
                  <a
                    href="/admin"
                    class="dropdown-item"
                  >
                    ${NAV_ICONS.settings}
                    <span>Administration</span>
                  </a>
                `
                : ""
            }


            <div class="dropdown-sep"></div>


            <button
              type="button"
              class="dropdown-item danger"
              id="navLogoutBtn"
            >
              ${NAV_ICONS.logout}
              <span>Sign Out</span>
            </button>

          </div>

        </div>


        <!-- MOBILE MENU -->
        <button
          type="button"
          class="nav-hamburger"
          id="navHamburger"
          aria-label="Open navigation menu"
          aria-expanded="false"
        >
          ${NAV_ICONS.menu}
        </button>

      </div>

    </nav>


    <!-- MOBILE DRAWER -->
    <div
      class="nav-drawer"
      id="navDrawer"
      aria-hidden="true"
    >
      ${drawerHtml}
    </div>
  `;


  /*
   * Insert navbar BEFORE the page content.
   *
   * This is important:
   * the navbar occupies normal document space and
   * therefore cannot sit on top of dashboard components.
   */
  document.body.prepend(header);


  /* User menu */
  const userButton = document.getElementById("navUserBtn");

  if (userButton) {
    userButton.addEventListener("click", event => {
      event.stopPropagation();
      toggleUserMenu();
    });
  }


  /* Logout */
  const logoutButton = document.getElementById("navLogoutBtn");

  if (logoutButton) {
    logoutButton.addEventListener("click", doLogout);
  }


  /* Mobile drawer */
  const hamburger = document.getElementById("navHamburger");

  if (hamburger) {
    hamburger.addEventListener("click", event => {
      event.stopPropagation();
      toggleDrawer();
      if (document.getElementById("navDrawer")?.classList.contains("open")) {
        prefetchDrawerPages();
      }
    });
  }


  /* Scroll shadow */
  window.addEventListener("scroll", handleNavbarScroll, {
    passive: true
  });

  handleNavbarScroll();
}

const prefetchedPages = new Set();

function prefetchPage(href) {
  const target = new URL(href, window.location.href);
  if (target.origin !== window.location.origin || target.pathname === window.location.pathname) return;
  if (prefetchedPages.has(target.href)) return;

  const prefetch = document.createElement("link");
  prefetch.rel = "prefetch";
  prefetch.href = target.href;
  prefetch.referrerPolicy = "same-origin";
  document.head.appendChild(prefetch);

  prefetchedPages.add(target.href);
  return true;
}

function prefetchPageOnIntent(event) {
  if (!(event.target instanceof Element)) return;

  const link = event.target.closest(
    ".nav-link, .drawer-link, .dropdown-item[href], .nav-brand"
  );

  if (!link || !link.href || link.dataset.prefetched) return;
  if (prefetchPage(link.href)) link.dataset.prefetched = "true";
}

function prefetchDrawerPages() {
  document.querySelectorAll("#navDrawer .drawer-link").forEach(link => {
    if (prefetchPage(link.href)) link.dataset.prefetched = "true";
  });
}

document.addEventListener("pointerover", prefetchPageOnIntent, { passive: true });
document.addEventListener("focusin", prefetchPageOnIntent);
document.addEventListener("touchstart", prefetchPageOnIntent, { passive: true });


/* ─────────────────────────────────────────────
   User menu
   ───────────────────────────────────────────── */

function toggleUserMenu() {

  const wrap = document.getElementById("navUserWrap");
  const button = document.getElementById("navUserBtn");

  if (!wrap) return;

  const open = !wrap.classList.contains("open");

  wrap.classList.toggle("open", open);

  if (button) {
    button.setAttribute(
      "aria-expanded",
      String(open)
    );
  }
}


/* ─────────────────────────────────────────────
   Mobile drawer
   ───────────────────────────────────────────── */

function toggleDrawer() {

  const drawer = document.getElementById("navDrawer");
  const hamburger = document.getElementById("navHamburger");

  if (!drawer) return;

  const open = !drawer.classList.contains("open");

  drawer.classList.toggle("open", open);
  drawer.setAttribute(
    "aria-hidden",
    String(!open)
  );

  if (hamburger) {
    hamburger.setAttribute(
      "aria-expanded",
      String(open)
    );
  }
}


/* ─────────────────────────────────────────────
   Close menus when clicking outside
   ───────────────────────────────────────────── */

document.addEventListener("click", event => {

  const wrap = document.getElementById("navUserWrap");

  if (
    wrap &&
    !wrap.contains(event.target)
  ) {
    wrap.classList.remove("open");

    const button =
      document.getElementById("navUserBtn");

    if (button) {
      button.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  }


  const drawer =
    document.getElementById("navDrawer");

  const hamburger =
    document.getElementById("navHamburger");

  if (
    drawer &&
    drawer.classList.contains("open") &&
    !drawer.contains(event.target) &&
    !hamburger?.contains(event.target)
  ) {
    drawer.classList.remove("open");

    drawer.setAttribute(
      "aria-hidden",
      "true"
    );

    if (hamburger) {
      hamburger.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  }

});


/* ─────────────────────────────────────────────
   Escape closes menus
   ───────────────────────────────────────────── */

document.addEventListener("keydown", event => {

  if (event.key !== "Escape") {
    return;
  }

  const wrap =
    document.getElementById("navUserWrap");

  const drawer =
    document.getElementById("navDrawer");

  const hamburger =
    document.getElementById("navHamburger");

  if (wrap) {
    wrap.classList.remove("open");
  }

  if (drawer) {
    drawer.classList.remove("open");
    drawer.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  const button =
    document.getElementById("navUserBtn");

  if (button) {
    button.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  if (hamburger) {
    hamburger.setAttribute(
      "aria-expanded",
      "false"
    );
  }

});


/* ─────────────────────────────────────────────
   Navbar shadow
   ───────────────────────────────────────────── */

function handleNavbarScroll() {

  const nav =
    document.getElementById("mainNav");

  if (!nav) return;

  nav.classList.toggle(
    "scrolled",
    window.scrollY > 8
  );
}


/* ─────────────────────────────────────────────
   Refresh user information
   ───────────────────────────────────────────── */

function refreshNavUser() {

  if (
    typeof Api === "undefined" ||
    typeof Api.user !== "function"
  ) {
    return;
  }

  const user = Api.user() || {};

  const name = user.name || "User";

  const initials = getInitials(name);

  const avatar =
    document.getElementById("navAvatar");

  const nameElement =
    document.getElementById("navUserName");

  const roleElement =
    document.getElementById("navUserRole");

  if (avatar) {
    avatar.textContent = initials;
  }

  if (nameElement) {
    nameElement.textContent = name;
  }

  if (roleElement) {
    const isAdmin =
      String(user.role || "").toLowerCase() === "admin";

    roleElement.textContent =
      isAdmin ? "Admin" : "User";

    roleElement.classList.toggle(
      "admin-badge",
      isAdmin
    );
  }
}


/* ─────────────────────────────────────────────
   Logout
   ───────────────────────────────────────────── */

async function doLogout() {

  try {

    if (
      typeof Api !== "undefined" &&
      typeof Api.logout === "function"
    ) {
      await Api.logout().catch(() => {});
    }

  } finally {

    if (
      typeof Api !== "undefined" &&
      typeof Api.clearAuth === "function"
    ) {
      Api.clearAuth();
    } else {
      localStorage.clear();
    }

    window.location.replace("/login");
  }
}


/* ─────────────────────────────────────────────
   Auto inject
   ───────────────────────────────────────────── */

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    injectNavbar
  );

} else {

  injectNavbar();

}
