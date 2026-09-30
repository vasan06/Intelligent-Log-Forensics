requireAuth();
injectNavbar();
setBreadcrumb([{href:'dashboard.html',label:'Dashboard'},{href:'profile.html',label:'Profile'}]);

async function loadProfile() {
  const res = await Api.getProfile();
  if (!res.ok) {
    toast('Failed to load profile', 'error');
    return;
  }
  const u = res.data.user;
  document.getElementById('profileAvatar').textContent = u.avatar || u.name.slice(0,2).toUpperCase();
  document.getElementById('profileName').textContent   = u.name;
  document.getElementById('profileEmail').textContent  = u.email;
  document.getElementById('profileRole').textContent   = (u.role || 'USER').toUpperCase();
  document.getElementById('inputName').value           = u.name;
  document.getElementById('inputEmail').value          = u.email;
  document.getElementById('inputRole').value           = (u.role || 'User');

  // Render Real Stats
  const s = res.data.stats || {};
  document.getElementById('statAnalyses').textContent = Number(s.analyses_run || 0).toLocaleString();
  document.getElementById('statLogs').textContent     = Number(s.logs_processed || 0).toLocaleString();
  document.getElementById('statThreats').textContent  = Number(s.threats_caught || 0).toLocaleString();
  document.getElementById('statReports').textContent  = Number(s.reports_generated || 0).toLocaleString();

  // Render Real Activity Feed
  const act = res.data.recent_activity || [];
  const feed = document.getElementById('activityFeed');
  if (!act.length) {
    feed.innerHTML = `
      <div style="padding:32px 16px;text-align:center;color:var(--ink-2);font-size:var(--text-sm);">
        <p style="font-weight:600;margin-bottom:4px;color:var(--ink-1);">No Activity Recorded Yet</p>
        <p style="font-size:12px;color:var(--ink-3);">Upload forensic files or execute live threat simulations to build your operational audit trail.</p>
      </div>
    `;
    return;
  }

  const dotColors = {
    CRITICAL: '#DC2626',
    HIGH: '#EF4444',
    MEDIUM: '#F59E0B',
    LOW: '#10B981',
    INFO: '#4338CA',
    SUCCESS: '#10B981'
  };

  feed.innerHTML = act.map(e => `
    <div class="activity-item">
      <div class="act-dot" style="background:${dotColors[e.badge] || '#6366F1'};"></div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div class="act-text">${e.title}</div>
          <span class="badge ${e.badge==='CRITICAL'||e.badge==='HIGH'?'badge-danger':e.badge==='MEDIUM'?'badge-warn':'badge-neutral'}" style="font-size:10px;padding:1px 6px;">${e.badge}</span>
        </div>
        <div class="act-sub">${e.detail}</div>
        <div class="act-time">${fmtTs(e.time)}</div>
      </div>
    </div>
  `).join('');
}

async function saveProfile() {
  const name  = document.getElementById('inputName').value.trim();
  const email = document.getElementById('inputEmail').value.trim();
  if (!name || !email) { toast('Name and email are required', 'warn'); return; }

  const res = await Api.updateProfile({ name, email });
  if (res.ok && res.data?.success) {
    const u = res.data.user;
    document.getElementById('profileName').textContent  = u.name;
    document.getElementById('profileEmail').textContent = u.email;
    document.getElementById('profileAvatar').textContent= u.avatar;
    const stored = Api.user() || {};
    Api.setAuth(Api.accessToken(), Api.refreshToken(), {...stored, name: u.name, email: u.email});
    refreshNavUser();
    toast('Profile updated successfully', 'success');
  } else {
    toast(res.data?.message || 'Save failed', 'error');
  }
}

async function updatePassword() {
  const curr = document.getElementById('currPassword').value;
  const nw = document.getElementById('newPassword').value;
  const cf = document.getElementById('confirmPassword').value;

  if (!curr || !nw) { toast('Current and new password required', 'warn'); return; }
  if (nw !== cf) { toast('New passwords do not match', 'warn'); return; }
  if (nw.length < 6) { toast('Password must be at least 6 characters', 'warn'); return; }

  const res = await Api.put('/user/password', { current_password: curr, new_password: nw });
  if (res.ok && res.data?.success) {
    document.getElementById('currPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    toast('Password changed successfully', 'success');
  } else {
    toast(res.data?.message || 'Password update failed', 'error');
  }
}

async function exportPdfDossier() {
  toast('Compiling profile PDF dossier…', 'info');
  const res = await Api.exportPdf();
  if (!res.ok || !res.blob) {
    toast('PDF export failed', 'error');
    return;
  }
  const url = window.URL.createObjectURL(res.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ILF_Profile_Dossier_${Date.now()}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  toast('Profile PDF downloaded', 'success');
}

async function exportJsonData() {
  const r = await Api.exportData();
  if (!r.ok) { toast(r.data?.message || 'Export failed', 'error'); return; }
  const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'ILF_User_Telemetry_Archive.json');
  toast('JSON telemetry archive exported', 'success');
}

window.addEventListener('DOMContentLoaded', loadProfile);