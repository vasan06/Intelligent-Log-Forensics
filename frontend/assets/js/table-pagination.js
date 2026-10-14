(() => {
  const initializedTables = new WeakMap();
  const pageSizes = [20, 50, 100];

  function addCellLabels(table) {
    const headers = Array.from(table.tHead?.rows[0]?.cells || []);
    if (!headers.length) return;

    Array.from(table.tBodies).forEach(tbody => {
      Array.from(tbody.rows).forEach(row => {
        Array.from(row.cells).forEach((cell, index) => {
          const header = headers[index];
          const label = header?.textContent.trim() ||
            header?.querySelector('[aria-label]')?.getAttribute('aria-label') ||
            '';
          if (label) cell.dataset.label = label;
        });
      });
    });
  }

  function setupTable(table) {
    addCellLabels(table);
    if (initializedTables.has(table)) return;

    const tbody = table.tBodies[0];
    const wrapper = table.closest('.table-wrap');
    if (!tbody) return;
    if (table.dataset.pagination === 'remote') {
      initializedTables.set(table, new MutationObserver(() => addCellLabels(table)));
      initializedTables.get(table).observe(tbody, { childList: true });
      return;
    }
    if (!wrapper) return;

    if (wrapper.nextElementSibling?.classList.contains('table-pagination')) {
      wrapper.nextElementSibling.remove();
    }

    const control = document.createElement('div');
    control.className = 'table-pagination';
    control.setAttribute('aria-label', 'Table pagination');
    control.innerHTML = `
      <label class="table-page-size-label">
        Rows per page
        <select class="select table-page-size">
          ${pageSizes.map(size => `<option value="${size}">${size}</option>`).join('')}
        </select>
      </label>
      <span class="table-page-status" aria-live="polite"></span>
      <div class="table-page-actions">
        <button class="btn btn-outline btn-sm table-page-previous" type="button" aria-label="Previous page">Previous</button>
        <button class="btn btn-outline btn-sm table-page-next" type="button" aria-label="Next page">Next</button>
      </div>
    `;
    wrapper.insertAdjacentElement('afterend', control);

    const sizeSelect = control.querySelector('.table-page-size');
    const status = control.querySelector('.table-page-status');
    const previous = control.querySelector('.table-page-previous');
    const next = control.querySelector('.table-page-next');
    const state = { page: 1, size: 20 };

    function update(resetPage = false) {
      addCellLabels(table);
      const rows = Array.from(tbody.rows);
      const dataRows = rows.filter(row => !Array.from(row.cells).some(cell => cell.colSpan > 1));
      const pageCount = Math.max(1, Math.ceil(dataRows.length / state.size));
      if (resetPage) state.page = 1;
      state.page = Math.min(state.page, pageCount);

      const startIndex = (state.page - 1) * state.size;
      const visibleRows = new Set(dataRows.slice(startIndex, startIndex + state.size));
      dataRows.forEach(row => { row.hidden = !visibleRows.has(row); });

      const first = dataRows.length ? startIndex + 1 : 0;
      const last = Math.min(startIndex + state.size, dataRows.length);
      status.textContent = dataRows.length
        ? `Showing ${first}–${last} of ${dataRows.length}`
        : 'No records';
      previous.disabled = state.page <= 1;
      next.disabled = state.page >= pageCount;
    }

    sizeSelect.addEventListener('change', () => {
      state.size = Number(sizeSelect.value);
      update(true);
    });
    previous.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        update();
      }
    });
    next.addEventListener('click', () => {
      state.page += 1;
      update();
    });

    initializedTables.set(table, new MutationObserver(() => update(true)));
    initializedTables.get(table).observe(tbody, { childList: true });
    update();
  }

  function scan(root = document) {
    if (root instanceof HTMLTableElement) setupTable(root);
    root.querySelectorAll?.('table').forEach(setupTable);
  }

  scan();
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) scan(node);
    }));
  }).observe(document.body, { childList: true, subtree: true });
})();
