/* Keeps lightweight page state while navigating within the authenticated session. */
const PageSession = (() => {
  const STORAGE_PREFIX = 'ilf_page_state_v1:';
  const INTERACTIVE_CLASSES = ['active', 'open', 'show', 'expanded', 'collapsed', 'selected', 'hidden'];
  let saveTimer;
  let contentSnapshot = '';

  function storageKey() {
    const user = typeof Api !== 'undefined' && typeof Api.user === 'function'
      ? Api.user()
      : {};
    const userId = user.id || user.user_id || user.email;
    if (!userId) return null;
    return STORAGE_PREFIX + encodeURIComponent(String(userId).toLowerCase()) + ':' + location.pathname;
  }

  function capture(includeContent = false) {
    const key = storageKey();
    if (!key) return;

    const fields = {};
    document.querySelectorAll('input[id], textarea[id], select[id], [contenteditable="true"][id]').forEach(element => {
      if (element.matches('input[type="password"], input[type="file"], input[type="hidden"], input[type="submit"], input[type="button"], input[type="reset"]')) return;

      if (element.matches('input[type="checkbox"], input[type="radio"]')) {
        fields[element.id] = { checked: element.checked, value: element.value };
      } else if (element instanceof HTMLSelectElement && element.multiple) {
        fields[element.id] = { selected: Array.from(element.selectedOptions, option => option.value) };
      } else if (element.isContentEditable) {
        fields[element.id] = { text: element.textContent };
      } else {
        fields[element.id] = { value: element.value };
      }
    });

    const elements = {};
    document.querySelectorAll('[id]').forEach(element => {
      const transient = /overlay|modal|loading|toast/i.test(element.id);
      const classes = transient ? [] : INTERACTIVE_CLASSES.filter(className => element.classList.contains(className));
      const display = element.style.display;
      if (classes.length || (display && !transient)) {
        elements[element.id] = { classes, ...(!transient && display ? { display } : {}) };
      }
    });

    const main = document.querySelector('main');
    if (includeContent) {
      const pageSnapshot = main?.cloneNode(true);
      pageSnapshot?.querySelectorAll('[id]').forEach(element => {
        if (/overlay|modal|loading|toast/i.test(element.id)) element.remove();
      });
      contentSnapshot = pageSnapshot?.innerHTML || '';
    }
    try {
      sessionStorage.setItem(key, JSON.stringify({
        fields,
        elements,
        content: contentSnapshot,
        pageVersion: main?.dataset.pageSessionVersion || '1',
        scrollX: window.scrollX,
        scrollY: window.scrollY
      }));
    } catch (error) {
      console.warn('Unable to preserve this page state for the current session.', error);
    }
  }

  function restore() {
    const key = storageKey();
    if (!key) return;

    let state;
    try {
      state = JSON.parse(sessionStorage.getItem(key) || 'null');
    } catch (error) {
      console.warn('Unable to restore this page state for the current session.', error);
      return;
    }
    if (!state) return;

    const main = document.querySelector('main');
    const pageVersion = main?.dataset.pageSessionVersion || '1';
    if ((state.pageVersion || '1') !== pageVersion) {
      sessionStorage.removeItem(key);
      return;
    }

    contentSnapshot = state.content || '';
    if (main && contentSnapshot) main.innerHTML = contentSnapshot;

    Object.entries(state.fields || {}).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (!element) return;

      if ('checked' in value && element instanceof HTMLInputElement) {
        element.checked = value.checked;
        element.value = value.value;
      } else if ('selected' in value && element instanceof HTMLSelectElement) {
        Array.from(element.options).forEach(option => {
          option.selected = value.selected.includes(option.value);
        });
      } else if ('text' in value && element.isContentEditable) {
        element.textContent = value.text;
      } else if ('value' in value && 'value' in element) {
        element.value = value.value;
      }
    });

    Object.entries(state.elements || {}).forEach(([id, saved]) => {
      const element = document.getElementById(id);
      if (!element) return;
      INTERACTIVE_CLASSES.forEach(className => {
        element.classList.toggle(className, saved.classes.includes(className));
      });
      if (saved.display && !/overlay|modal|loading|toast/i.test(id)) {
        element.style.display = saved.display;
      }
    });

    if (Number.isFinite(state.scrollX) && Number.isFinite(state.scrollY)) {
      requestAnimationFrame(() => window.scrollTo(state.scrollX, state.scrollY));
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(capture, 150);
  }

  document.addEventListener('input', scheduleSave);
  document.addEventListener('change', scheduleSave);
  window.addEventListener('scroll', scheduleSave, { passive: true });
  window.addEventListener('pagehide', () => capture(true));
  restore();

  return { save: capture };
})();
