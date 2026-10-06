setBreadcrumb([{ href: 'dashboard.html', label: 'Dashboard' }, { href: 'history.html', label: 'History' }]);

let historyItems = [];
let selectedHistory = new Set();

const severityClass = value => String(value || 'INFO').toLowerCase().replace('warning', 'warn');
const fmtTime = value => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function toastHistory(message, type = 'info') {
  if (typeof toast === 'function') toast(message, type);
  else if (window.showModalAlert) showModalAlert(message, 'History', type === 'error' ? 'error' : 'info');
}

async function loadHistory() {
  const q = document.getElementById('historySearch')?.value || '';
  const severity = document.getElementById('severityFilter')?.value || 'all';
  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = '<tr><td colspan="6" class="history-empty">Loading history...</td></tr>';

  const res = await Api.history({ q, severity });
  if (!res.ok || !res.data?.success) {
    tbody.innerHTML = '<tr><td colspan="6" class="history-empty">History could not be loaded.</td></tr>';
    return;
  }

  historyItems = res.data.history || [];
  selectedHistory = new Set([...selectedHistory].filter(id => historyItems.some(item => item.id === id)));
  renderHistory();
}

function renderHistory() {
  const tbody = document.getElementById('historyBody');
  const bulkBtn = document.getElementById('bulkDeleteBtn');
  const selectAll = document.getElementById('selectAllHistory');

  bulkBtn.disabled = selectedHistory.size === 0;
  selectAll.checked = historyItems.length > 0 && historyItems.every(item => selectedHistory.has(item.id));

  if (!historyItems.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="history-empty">No saved history matches this view.</td></tr>';
    return;
  }

  tbody.innerHTML = historyItems.map(item => `
    <tr>
      <td><input type="checkbox" class="history-check" data-id="${escapeHtml(item.id)}" ${selectedHistory.has(item.id) ? 'checked' : ''}/></td>
      <td>
        <div class="history-event-title">${escapeHtml(item.summary)}</div>
        <div class="history-event-summary">${escapeHtml(item.title)} · ${escapeHtml(item.total_logs)} events</div>
      </td>
      <td><span class="history-severity ${severityClass(item.severity)}">${escapeHtml(item.severity_label)}</span></td>
      <td>${escapeHtml(fmtTime(item.created_at))}</td>
      <td>${escapeHtml(item.source || '-')}</td>
      <td>
        <button class="btn btn-outline btn-sm" data-view="${escapeHtml(item.id)}">View</button>
        <button class="btn btn-danger btn-sm" data-delete="${escapeHtml(item.id)}">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function viewHistory(id) {
  const res = await Api.historyDetail(id);
  if (!res.ok || !res.data?.success) {
    toastHistory('History entry could not be opened.', 'error');
    return;
  }
  const item = res.data.entry;
  const raw = JSON.stringify(item.technical?.results || {}, null, 2);
  document.getElementById('historyDetailContent').innerHTML = `
    <h3>${escapeHtml(item.summary)}</h3>
    <p class="text-muted">${escapeHtml(item.title)} · ${escapeHtml(fmtTime(item.created_at))}</p>
    <div class="history-detail-grid">
      <div class="history-detail-card"><span>Severity</span>${escapeHtml(item.severity_label)}</div>
      <div class="history-detail-card"><span>Source</span>${escapeHtml(item.source || '-')}</div>
      <div class="history-detail-card"><span>Total events</span>${escapeHtml(item.total_logs)}</div>
      <div class="history-detail-card"><span>Flagged events</span>${escapeHtml(item.anomalies)}</div>
    </div>
    <h4>Technical Details</h4>
    <pre class="history-raw">${escapeHtml(raw)}</pre>
  `;
  document.getElementById('historyDetail').classList.add('open');
  document.getElementById('historyDetail').setAttribute('aria-hidden', 'false');
}

async function deleteEntries(ids, clearAll = false) {
  const message = clearAll
    ? 'This will permanently remove all of your saved history entries from the database.'
    : `This will permanently remove ${ids.length} selected history entr${ids.length === 1 ? 'y' : 'ies'} from the database.`;
  const ok = await showModalConfirm(message, 'Delete History', { confirmText: 'Delete', danger: true });
  if (!ok) return;

  const res = clearAll ? await Api.clearHistory() : ids.length === 1 ? await Api.deleteHistory(ids[0]) : await Api.deleteHistoryMany(ids);
  if (!res.ok || !res.data?.success) {
    toastHistory('Delete failed. No history was removed.', 'error');
    return;
  }
  selectedHistory.clear();
  toastHistory(`${res.data.deleted || 0} history entr${res.data.deleted === 1 ? 'y' : 'ies'} removed.`, 'success');
  loadHistory();
}

document.getElementById('historySearch').addEventListener('input', () => {
  clearTimeout(window.historySearchTimer);
  window.historySearchTimer = setTimeout(loadHistory, 220);
});
document.getElementById('severityFilter').addEventListener('change', loadHistory);
document.getElementById('bulkDeleteBtn').addEventListener('click', () => deleteEntries([...selectedHistory]));
document.getElementById('clearHistoryBtn').addEventListener('click', () => deleteEntries([], true));
document.getElementById('selectAllHistory').addEventListener('change', event => {
  selectedHistory = event.target.checked ? new Set(historyItems.map(item => item.id)) : new Set();
  renderHistory();
});
document.getElementById('historyBody').addEventListener('click', event => {
  const rowCheck = event.target.closest('.history-check');
  const viewBtn = event.target.closest('[data-view]');
  const deleteBtn = event.target.closest('[data-delete]');
  if (rowCheck) {
    rowCheck.checked ? selectedHistory.add(rowCheck.dataset.id) : selectedHistory.delete(rowCheck.dataset.id);
    renderHistory();
  } else if (viewBtn) {
    viewHistory(viewBtn.dataset.view);
  } else if (deleteBtn) {
    deleteEntries([deleteBtn.dataset.delete]);
  }
});
document.getElementById('historyDetailClose').addEventListener('click', () => {
  document.getElementById('historyDetail').classList.remove('open');
  document.getElementById('historyDetail').setAttribute('aria-hidden', 'true');
});

loadHistory();
