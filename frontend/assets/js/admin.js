requireAuth();
setBreadcrumb([{href:'admin.html',label:'Administration'}]);

let allUsers = [];
let activeTab = 'users';

function switchTab(tab) {
  if (!['users', 'logs', 'inspector', 'health'].includes(tab)) return;

  activeTab = tab;
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  // Sync navbar active state
  document.querySelectorAll('#mainNav .nav-link, #navDrawer .drawer-link').forEach(link => {
    if (link.dataset.tab) {
      const isActive = link.dataset.tab === tab;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  });

  const tabUrl = new URL(window.location.href);
  tabUrl.searchParams.set('tab', tab);
  window.history.replaceState(null, '', tabUrl);

  if (tab === 'users') {
    document.getElementById('paneUsers')?.classList.add('active');
  } else if (tab === 'logs') {
    document.getElementById('paneLogs')?.classList.add('active');
    loadAdminLogs();
  } else if (tab === 'inspector') {
    document.getElementById('paneInspector')?.classList.add('active');
  } else if (tab === 'health') {
    document.getElementById('paneHealth')?.classList.add('active');
    loadSystemHealth();
  }
}

function refreshCurrentTab() {
  loadAdminStats();
  if (activeTab === 'users') loadUsers();
  else if (activeTab === 'logs') loadAdminLogs();
  else if (activeTab === 'health') loadSystemHealth();
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
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-sm btn-outline" onclick="openEditModal('${u.id}')">Edit</button>
          <button class="btn btn-sm btn-outline" onclick="jumpToInspect('${u.id}')">Inspect</button>
          <button class="btn btn-sm btn-outline" onclick="revokeUserSessions('${u.id}', '${u.name}')" title="Revoke all active sessions">Revoke</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}', '${u.name}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openEditModal(uid) {
  const u = allUsers.find(x => x.id === uid);
  if (!u) return;
  document.getElementById('editUserId').value = u.id;
  document.getElementById('editUserName').value = u.name || '';
  document.getElementById('editUserEmail').value = u.email || '';
  document.getElementById('editUserRole').value = u.role || 'User';
  document.getElementById('editUserStatus').value = u.status || 'active';
  const modal = document.getElementById('editUserModal');
  if (modal) modal.style.display = 'flex';
}

function closeEditModal() {
  const modal = document.getElementById('editUserModal');
  if (modal) modal.style.display = 'none';
}

async function submitUserEdit() {
  const uid = document.getElementById('editUserId').value;
  const name = document.getElementById('editUserName').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();
  const role = document.getElementById('editUserRole').value;
  const status = document.getElementById('editUserStatus').value;

  if (!name || !email) {
    toast('Name and email cannot be empty', 'warn');
    return;
  }

  const res = await Api.adminUpdateUser(uid, { name, email, role, status });
  if (res.ok && res.data?.success) {
    toast('User updated successfully', 'success');
    closeEditModal();
    loadUsers();
  } else {
    toast(res.data?.message || 'Update failed', 'error');
  }
}

async function revokeUserSessions(uid, name) {
  const confirmed = await showModalConfirm(
    `Revoke all active sessions for ${name || 'this user'}? The user will need to log in again.`,
    'Revoke Active Sessions',
    { confirmText: 'Revoke Sessions', danger: true }
  );
  if (!confirmed) return;
  const res = await Api.adminRevokeUserSessions(uid);
  if (res.ok && res.data?.success) {
    toast(res.data.message || 'Sessions revoked successfully', 'success');
    loadAdminStats();
    if (activeTab === 'health') loadSystemHealth();
  } else {
    toast(res.data?.message || 'Failed to revoke sessions', 'error');
  }
}

async function loadSystemHealth() {
  const res = await Api.adminSystemHealth();
  if (!res.ok || !res.data?.success) {
    toast('Failed to load system health diagnostics', 'error');
    return;
  }
  const d = res.data;
  const db = d.database || {};
  const tbl = db.tables || {};

  const dialectEl = document.getElementById('diagDialect');
  if (dialectEl) dialectEl.textContent = db.dialect || 'PostgreSQL';
  const sessEl = document.getElementById('diagActiveSessions');
  if (sessEl) sessEl.textContent = db.active_sessions || 0;

  const countU = document.getElementById('diagCountUsers');
  if (countU) countU.textContent = tbl.users || 0;
  const countF = document.getElementById('diagCountFiles');
  if (countF) countF.textContent = tbl.uploaded_files || 0;
  const countA = document.getElementById('diagCountAnalyses');
  if (countA) countA.textContent = tbl.log_analyses || 0;
  const countS = document.getElementById('diagCountSessions');
  if (countS) countS.textContent = tbl.sessions || 0;
  const countR = document.getElementById('diagCountReports');
  if (countR) countR.textContent = tbl.reports || 0;

  const badge = document.getElementById('diagStatusBadge');
  if (badge) {
    badge.textContent = `${db.status === 'connected' ? 'PostgreSQL Online' : 'Database Disconnected'} · ${d.system?.status || 'Operational'}`;
    badge.className = db.status === 'connected' ? 'badge badge-success' : 'badge badge-danger';
  }
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
  const confirmed = await showModalConfirm(
    `Permanently delete user "${name}" and all their telemetry, files, and reports? This action cannot be reversed.`,
    'Delete User Account',
    { confirmText: 'Delete User', danger: true }
  );
  if (!confirmed) return;
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
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="badge ${u.role==='Admin'?'badge-primary':'badge-neutral'}">${u.role}</span>
          <span class="badge ${u.status==='active'?'badge-success':'badge-danger'}">${u.status}</span>
          <button class="btn btn-sm btn-outline" style="border-color:#FCA5A5;color:#DC2626;" onclick="revokeUserSessions('${u.id}', '${u.name}')">Revoke Active Sessions</button>
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
  const urlParams = new URLSearchParams(window.location.search);
  const requestedTab = urlParams.get('tab') || window.location.hash.replace('#', '');
  switchTab(['users', 'logs', 'inspector', 'health'].includes(requestedTab) ? requestedTab : 'users');
});