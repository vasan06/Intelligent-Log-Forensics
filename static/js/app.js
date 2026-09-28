/* ================================================================
   INTELLIGENT LOG FORENSICS — Core App JS
   ================================================================ */
'use strict';

// ── Toast Notifications ───────────────────────────────────────────
window.showToast = function(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-critical)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  toast.innerHTML = `
    ${icons[type] || icons.info}
    <span style="flex:1">${message}</span>
    <button onclick="this.parentElement.remove()" style="opacity:0.5;cursor:pointer;background:none;border:none;font-size:16px;color:inherit;padding:0;line-height:1">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 200);
  }, duration);
};

// ── Flash Messages (deferred from Flask) ─────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Handle .alert close buttons
  document.querySelectorAll('.alert-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.alert')?.remove());
  });

  // Auto-dismiss flash alerts after 5s
  document.querySelectorAll('.alert').forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.3s';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  });
});

// ── Sidebar toggle ────────────────────────────────────────────────
window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle('open');
  overlay?.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
};

// ── Dropdown toggle ───────────────────────────────────────────────
window.toggleDropdown = function(trigger) {
  const menu = trigger.nextElementSibling;
  if (!menu || !menu.classList.contains('dropdown-menu')) return;
  const isOpen = menu.classList.toggle('open');
  if (isOpen) {
    document.addEventListener('click', function handler(e) {
      if (!trigger.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
        document.removeEventListener('click', handler);
      }
    });
  }
};

// ── Animated counters ─────────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target) || target === 0) return;
    let start = 0;
    const duration = 1000;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ── Intersection observer for counters ───────────────────────────
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounters();
      counterObserver.disconnect();
    }
  });
}, { threshold: 0.1 });

document.addEventListener('DOMContentLoaded', () => {
  const statsEl = document.querySelector('.stats-grid, .stats-grid-4');
  if (statsEl) counterObserver.observe(statsEl);
});

// ── Notification polling ──────────────────────────────────────────
(function pollNotifications() {
  const badge = document.querySelector('.notification-badge');
  if (!badge) return;

  async function checkNotifications() {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      if (data.unread_count > 0) {
        badge.style.display = 'block';
        badge.title = `${data.unread_count} unread notifications`;
      } else {
        badge.style.display = 'none';
      }
    } catch (_) {}
  }

  // Poll every 60 seconds
  checkNotifications();
  setInterval(checkNotifications, 60000);
})();
