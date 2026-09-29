/*
 * auth-guard.js — ILF Auth Utilities
 * JWT check, redirect, toast notifications, counter animation, helpers.
 */

/* ── Auth guard ────────────────────────────── */
function requireAuth() {
  if (!Api.token()) {
    window.location.href = 'signin.html';
    return false;
  }
  return true;
}

/* ── Toast system ──────────────────────────── */
const TOAST_ICONS = {
  success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  error:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  warn:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

function toast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type] || ''}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/* ── Number counter animation ──────────────── */
function animateCount(el, target, duration = 1000, suffix = '') {
  if (!el) return;
  const start = performance.now();
  const fn = now => {
    const t    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const val  = Math.round(target * ease);
    el.textContent = val.toLocaleString() + suffix;
    if (t < 1) requestAnimationFrame(fn);
  };
  requestAnimationFrame(fn);
}

/* ── Severity badge HTML ────────────────────── */
function sevBadge(sev) {
  const cls = `badge sev-${sev}`;
  return `<span class="${cls}">${sev}</span>`;
}

/* ── Format ISO timestamp ───────────────────── */
function fmtTs(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour12: false });
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

/* ── Scroll reveal observer ─────────────────── */
function initReveal() {
  const obs = new IntersectionObserver(
    entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')),
    { threshold: 0.1 }
  );
  document.querySelectorAll('.card-reveal').forEach(el => obs.observe(el));
}

/* ── Breadcrumb helper ──────────────────────── */
function setBreadcrumb(items) {
  const el = document.getElementById('breadcrumb');
  if (!el) return;
  const svgSep = `<svg class="breadcrumb-sep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><polyline points="9 18 15 12 9 6"/></svg>`;
  el.innerHTML = items.map((item, i) =>
    i < items.length - 1
      ? `<a href="${item.href}">${item.label}</a>${svgSep}`
      : `<span class="current">${item.label}</span>`
  ).join('');
}

/* ── Download blob as file ──────────────────── */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => initReveal());
