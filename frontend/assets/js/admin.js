requireAuth();
injectNavbar();
setBreadcrumb([{href:'dashboard.html',label:'Dashboard'},{href:'admin.html',label:'Administration'}]);

let allUsers = [];
let activeTab = 'users';

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  if (tab === 'users') {
    document.getElementById('tabBtnUsers').classList.add('active');
    document.getElementById('paneUsers').classList.add('active');
  } else if (tab === 'logs') {
    document.getElementById('tabBtnLogs').classList.add('active');
    document.getElementById('paneLogs').classList.add('active');
    loadAdminLogs();
  } else if (tab === 'inspector') {
    document.getElementById('tabBtnInspector').classList.add('active');
    document.getElementById('paneInspector').classList.add('active');
  }
}

function refreshCurrentTab() {
  loadAdminStats();
  if (activeTab === 'users') loadUsers();
  else if (activeTab === 'logs') loadAdminLogs();
}

async function loadAdminStats() {
  const res = await Api.adminStats();
  if (!res.ok) {
    if (res.status === 403) {
      toast('Admin privileges required to access this dashboard', 'error');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    }
    return;
  }
  const d = res.data;
  document.getElementById('kpiUsers').textContent = d.total_users || 0;
  document.getElementById('kpiActive').textContent = d.active_users || 0;
  document.getElementById('kpiFiles').textContent = d.total_files || 0;
  document.getElementById('kpiAnalyses').textContent = d.total_analyses || 0;
}

async function loadUsers() {
  const res = await Api.adminUsers();
  if (!res.ok) return;
  allUsers = res.data?.users || [];
  renderUsers();
  populateInspectorSelect();
}

function renderUsers() {
  const q = (document.getElementById('userSearch').value || '').trim().toLowerCase();
  const tbody = document.getElementById('usersTableBody');

  const filtered = allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
  );

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:24px;">No users match your search query.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>
        <strong style="color:var(--ink-0);">${u.name}</strong>
        <div class="t-mono-xs text-muted">${u.email}</div>
      </td>
      <td>
        <select class="select" style="padding:4px 8px;font-size:12px;" onchange="updateUserRole('${u.id}', this.value)">
          <option value="User" ${u.role==='User'?'selected':''}>User</option>
          <option value="Admin" ${u.role==='Admin'?'selected':''}>Admin</option>
        </select>
      </td>
      <td>
        <select class="select" style="padding:4px 8px;font-size:12px;" onchange="updateUserStatus('${u.id}', this.value)">
          <option value="active" ${u.status==='active'?'selected':''}>active</option>
          <option value="inactive" ${u.status==='inactive'?'selected':''}>inactive</option>
        </select>
      </td>
      <td class="t-mono-xs text-muted">${fmtTs(u.created_at)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-outline" onclick="jumpToInspect('${u.id}')">Inspect</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}', '${u.name}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function populateInspectorSelect() {
  const sel = document.getElementById('inspectUserSelect');
  sel.innerHTML = '<option value="">-- Choose a user account --</option>' +
    allUsers.map(u => `<option value="${u.id}">${u.name} (${u.email}) [${u.role}]</option>`).join('');
}

async function createUser() {
  const name = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  const password = document.getElementById('newUserPassword').value;
  const role = document.getElementById('newUserRole').value;

  if (!name || !email || !password) {
    toast('Name, email, and password are required', 'warn');
    return;
  }

  const res = await Api.adminCreateUser({ name, email, password, role });
  if (res.ok && res.data?.success) {
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPassword').value = '';
    toast(`User "${name}" created with role "${role}"`, 'success');
    loadUsers();
    loadAdminStats();
  } else {
    toast(res.data?.message || 'Failed to create user', 'error');
  }
}

async function updateUserRole(id, role) {
  const res = await Api.adminUpdateUser(id, { role });
  if (res.ok && res.data?.success) {
    toast(`Role updated to ${role}`, 'success');
    loadUsers();
  } else {
    toast(res.data?.message || 'Update failed', 'error');
  }
}

async function updateUserStatus(id, status) {
  const res = await Api.adminUpdateUser(id, { status });
  if (res.ok && res.data?.success) {
    toast(`Status set to ${status}`, 'success');
    loadUsers();
  } else {
    toast(res.data?.message || 'Update failed', 'error');
  }
}

async function deleteUser(id, name) {
  if (!confirm(`Permanently delete user "${name}" and all their telemetry, files, and reports?`)) return;
  const res = await Api.adminDeleteUser(id);
  if (res.ok && res.data?.success) {
    toast(`User "${name}" deleted`, 'success');
    loadUsers();
    loadAdminStats();
  } else {
    toast(res.data?.message || 'Delete failed', 'error');
  }
}

async function loadAdminLogs() {
  const sev = document.getElementById('logFilterSev').value;
  const src = document.getElementById('logFilterSrc').value;
  const tbody = document.getElementById('adminLogsBody');

  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:24px;">Streaming logs…</td></tr>';

  const res = await Api.adminLogs({ severity: sev, source: src, limit: 40 });
  if (!res.ok || !res.data?.logs) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:24px;">Failed to load system logs.</td></tr>';
    return;
  }

  const logs = res.data.logs;
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:24px;">No system logs matched the filter.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(l => `
    <tr>
      <td class="t-mono-xs text-muted">${fmtTs(l.timestamp)}</td>
      <td>${sevBadge(l.severity)}</td>
      <td style="font-weight:600;color:var(--slate);font-size:12px;">${l.source}</td>
      <td class="t-mono-xs text-muted">${l.ip}</td>
      <td style="font-size:12px;">${l.message}</td>
    </tr>
  `).join('');
}

function jumpToInspect(userId) {
  switchTab('inspector');
  document.getElementById('inspectUserSelect').value = userId;
  inspectUser(userId);
}

async function inspectUser(userId) {
  const container = document.getElementById('inspectorContent');
  if (!userId) {
    container.innerHTML = '<div class="card" style="padding:48px;text-align:center;color:var(--ink-3);">Select a user above to inspect their audit trail.</div>';
    return;
  }

  container.innerHTML = '<div class="card" style="padding:48px;text-align:center;color:var(--ink-3);">Aggregating forensic audit trails from PostgreSQL…</div>';

  const res = await Api.adminUserActivity(userId);
  if (!res.ok || !res.data?.user) {
    container.innerHTML = '<div class="card" style="padding:48px;text-align:center;color:#DC2626;">Failed to retrieve user activity.</div>';
    return;
  }

  const u = res.data.user;
  const files = res.data.files || [];
  const analyses = res.data.analyses || [];
  const reports = res.data.reports || [];

  container.innerHTML = `
    <!-- User Dossier Banner -->
    <div class="inspector-card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:var(--sp-4);">
        <div>
          <h3 style="font-size:1.25rem;font-weight:700;color:var(--ink-0);margin-bottom:2px;">${u.name}</h3>
          <div class="t-mono-xs text-muted">${u.email} · UUID: ${u.id}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <span class="badge ${u.role==='Admin'?'badge-primary':'badge-neutral'}">${u.role}</span>
          <span class="badge ${u.status==='active'?'badge-success':'badge-danger'}">${u.status}</span>
        </div>
      </div>

      <div class="grid-3" style="gap:var(--sp-3);">
        <div style="background:#fff;padding:12px;border-radius:var(--r-md);border:1px solid var(--surface-3);">
          <div style="font-size:11px;color:var(--ink-3);font-weight:600;">Uploaded Batches</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--ink-0);">${files.length}</div>
        </div>
        <div style="background:#fff;padding:12px;border-radius:var(--r-md);border:1px solid var(--surface-3);">
          <div style="font-size:11px;color:var(--ink-3);font-weight:600;">ML & Simulations</div>
          <div style="font-size:1.3rem;font-weight:800;color:var(--brand-primary);">${analyses.length}</div>
        </div>
        <div style="background:#fff;padding:12px;border-radius:var(--r-md);border:1px solid var(--surface-3);">
          <div style="font-size:11px;color:var(--ink-3);font-weight:600;">Generated Reports</div>
          <div style="font-size:1.3rem;font-weight:800;color:#10B981;">${reports.length}</div>
        </div>
      </div>
    </div>

    <!-- Analyses & Simulations -->
    <div class="card mb-6">
      <div style="padding:var(--sp-5) var(--sp-5) 0;">
        <div class="section-label">Investigative Analyses & Threat Simulations</div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Analysis ID</th><th>Scenario / Algorithm</th><th>Risk Rating</th><th>Anomalies</th><th>Timestamp</th></tr></thead>
          <tbody>
            ${analyses.length ? analyses.map(a => `
              <tr>
                <td class="t-mono-xs" style="font-weight:600;color:var(--brand-primary);">${a.id.slice(0,8)}…</td>
                <td style="font-weight:600;color:var(--ink-0);">${a.algorithm}</td>
                <td><span class="badge ${a.risk_level==='CRITICAL'||a.risk_level==='HIGH'?'badge-danger':a.risk_level==='MEDIUM'?'badge-warn':'badge-success'}">${a.risk_level}</span></td>
                <td><strong>${a.anomalies_found}</strong> flagged</td>
                <td class="t-mono-xs text-muted">${fmtTs(a.created_at)}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:20px;">No analyses recorded for this user.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Uploaded Files -->
    <div class="card mb-6">
      <div style="padding:var(--sp-5) var(--sp-5) 0;">
        <div class="section-label">Uploaded Forensic Files (PostgreSQL In-DB Storage)</div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Filename</th><th>Lines</th><th>Size</th><th>Virtual Storage Location</th><th>Date</th></tr></thead>
          <tbody>
            ${files.length ? files.map(f => `
              <tr>
                <td style="font-weight:600;color:var(--ink-0);">${f.filename}</td>
                <td>${f.lines_count} lines</td>
                <td>${(f.size/1024).toFixed(1)} KB</td>
                <td class="t-mono-xs text-muted">${f.db_location || `db://uploads/${f.id}`}</td>
                <td class="t-mono-xs text-muted">${fmtTs(f.created_at)}</td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--ink-3);padding:20px;">No uploaded files for this user.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.addEventListener('DOMContentLoaded', () => {
  loadAdminStats();
  loadUsers();
});