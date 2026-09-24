/**
 * INTELLIGENT LOG FORENSIC - ROUTER & NAVIGATION HELPER
 * Ensures active link states, smooth transitions, and tab routing
 */

class ForensicRouter {
  constructor() {
    this.init();
  }

  init() {
    this.highlightActiveNav();
    this.initTabs();
  }

  highlightActiveNav() {
    const currentPath = window.location.pathname;
    const filename = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';

    // Update main nav & sidebar items
    const navLinks = document.querySelectorAll('.nav-link, .sidebar-item');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href === filename || (filename === '' && href === 'index.html'))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = btn.getAttribute('data-tab');
        if (!targetId) return;

        const parent = btn.closest('.tabs-wrapper') || document;
        parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        parent.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPanel = parent.querySelector(`#${targetId}`);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.router = new ForensicRouter();
});
