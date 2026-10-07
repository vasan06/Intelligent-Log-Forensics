/* ILF API client: cookie-backed JWT + local token mirror. */
const API_BASE = '/api';
const Api = {
  accessToken: () => localStorage.getItem('ilf_access_token') || '',
  refreshToken: () => localStorage.getItem('ilf_refresh_token') || '',
  token: () => Api.accessToken(),
  user: () => { try { return JSON.parse(localStorage.getItem('ilf_user') || '{}'); } catch { return {}; } },
  setAuth: (access, refresh, user) => {
    if (access) localStorage.setItem('ilf_access_token', access);
    if (refresh) localStorage.setItem('ilf_refresh_token', refresh);
    if (user) localStorage.setItem('ilf_user', JSON.stringify(user));
    localStorage.removeItem('ilf_token');
  },
  clearAuth: () => {
    ['ilf_access_token','ilf_refresh_token','ilf_token','ilf_user'].forEach(k => localStorage.removeItem(k));
    ['ilf_page_state_v1:', 'ilf_active_event', 'ilf_event_logs'].forEach(prefix => {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && (prefix.endsWith(':') ? key.startsWith(prefix) : key === prefix)) {
          sessionStorage.removeItem(key);
        }
      }
    });
    try {
      fetch(API_BASE + '/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: '' })
      }).catch(() => {});
    } catch {}
  },
  migrateLegacyToken: () => {
    if (!localStorage.getItem('ilf_access_token')) {
      const old = localStorage.getItem('ilf_token');
      if (old) { localStorage.setItem('ilf_access_token', old); localStorage.removeItem('ilf_token'); }
    }
  },
  authHeaders: () => {
    Api.migrateLegacyToken();
    const h = {'X-ILF-Client':'web/2.1'};
    const token = Api.accessToken();
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  },
  _redirectLogin: () => {
    Api.clearAuth();
    if (!location.pathname.endsWith('/signin') && !location.pathname.endsWith('/login')) {
      const loginUrl = new URL('/login', window.location.origin);
      loginUrl.searchParams.set('next', location.pathname + location.search + location.hash);
      window.location.replace(loginUrl.pathname + loginUrl.search);
    }
  },
  refreshAccessToken: async () => {
    const refresh = Api.refreshToken();
    if (!refresh) return {ok:false,status:401,data:null};
    try {
      const res = await fetch(API_BASE + '/auth/refresh', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json','X-ILF-Client':'web/2.1'},
        body:JSON.stringify({refresh_token:refresh})
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.access_token) { Api.clearAuth(); return {ok:false,status:res.status,data}; }
      Api.setAuth(data.access_token, data.refresh_token, data.user || Api.user());
      return {ok:true,status:res.status,data};
    } catch (e) { return {ok:false,status:0,data:null,error:e.message}; }
  },
  _req: async (method, path, body=null, isForm=false, retry=true) => {
    Api.migrateLegacyToken();
    if (!Api.accessToken()) {
      if (Api.refreshToken()) {
        const refreshed = await Api.refreshAccessToken();
        if (!refreshed.ok) { Api._redirectLogin(); return {ok:false,status:401,data:null}; }
      } else {
        Api._redirectLogin();
        return {ok:false,status:401,data:null};
      }
    }
    const makeOptions = () => {
      const headers = {...Api.authHeaders()};
      if (!isForm) headers['Content-Type'] = 'application/json';
      return {method, credentials:'include', headers, ...(body == null ? {} : {body:isForm ? body : JSON.stringify(body)})};
    };
    let res;
    try { res = await fetch(API_BASE + path, makeOptions()); }
    catch (e) { return {ok:false,status:0,data:null,error:e.message}; }
    if (res.status === 401 && retry) {
      const refreshed = await Api.refreshAccessToken();
      if (!refreshed.ok) { Api._redirectLogin(); return {ok:false,status:401,data:refreshed.data}; }
      try { res = await fetch(API_BASE + path, makeOptions()); }
      catch (e) { return {ok:false,status:0,data:null,error:e.message}; }
    }
    const data = (res.headers.get('content-type') || '').includes('application/json')
      ? await res.json().catch(() => null) : await res.text().catch(() => '');
    if (res.status === 401) { Api._redirectLogin(); return {ok:false,status:401,data}; }
    return {ok:res.ok,status:res.status,data};
  },
  get:p=>Api._req('GET',p), post:(p,b)=>Api._req('POST',p,b), put:(p,b)=>Api._req('PUT',p,b), del:p=>Api._req('DELETE',p), form:(p,f)=>Api._req('POST',p,f,true),
  login:(email,password)=>Api.post('/auth/login',{email,password}),
  signup:(name,email,password)=>Api.post('/auth/signup',{name,email,password}),
  refresh:()=>Api.refreshAccessToken(),
  logout:async()=>{const r=await Api._req('POST','/auth/logout',{refresh_token:Api.refreshToken()},false,false); Api.clearAuth(); return r;},
  logoutAll:async()=>{const r=await Api._req('POST','/auth/logout-all',null,false,false); Api.clearAuth(); return r;},
  verifyOtp:(email,otp,type='reset')=>Api.post('/auth/verify-otp',{email,otp,type}),
  resendOtp:(email,type='reset')=>Api.post('/auth/resend-otp',{email,type}),
  forgotPassword:email=>fetch(API_BASE+'/auth/forgot-password',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}).then(async r=>({ok:r.ok,status:r.status,data:await r.json().catch(()=>null)})),
  resetPassword:(email,otp,password)=>fetch(API_BASE+'/auth/reset-password',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,otp,new_password:password})}).then(async r=>({ok:r.ok,status:r.status,data:await r.json().catch(()=>null)})),
  dashStats:(p={})=>Api.get('/dashboard/stats'+(Object.keys(p).length?'?'+new URLSearchParams(p):'')), dashMlSummary:()=>Api.get('/dashboard/ml-summary'),
  streamLogs:(p={})=>Api.get('/logs/stream?'+new URLSearchParams(p)), saveSimulation:b=>Api.post('/logs/simulation',b),
  uploadLog:f=>Api.form('/logs/upload',f), uploadJob:id=>Api.get('/logs/jobs/'+encodeURIComponent(id)), uploadedFileRecords:(id,offset=0,limit=100)=>Api.get('/logs/files/'+encodeURIComponent(id)+'/records?'+new URLSearchParams({offset,limit})), pipelineStatus:id=>Api.get('/logs/pipeline/'+id), sampleLogs:type=>Api.get('/logs/demo-sample/'+encodeURIComponent(type)),
  history:(p={})=>Api.get('/history'+(Object.keys(p).length?'?'+new URLSearchParams(p):'')), historyDetail:id=>Api.get('/history/'+encodeURIComponent(id)), deleteHistory:id=>Api.del('/history/'+encodeURIComponent(id)), deleteHistoryMany:ids=>Api._req('DELETE','/history',{ids}), clearHistory:()=>Api._req('DELETE','/history',{clear_all:true}),
  mlAnalyze:b=>Api.post('/ml/analyze',b), mlAlgos:()=>Api.get('/ml/algorithms'), getMlEvent:id=>Api.get('/ml/load-event/'+id),
  mitreCatalog:(p={})=>Api.get('/mitre/catalog?'+new URLSearchParams(p)), mitreMap:b=>Api.post('/mitre/map',b), mitreTechnique:id=>Api.get('/mitre/technique/'+id), mitreTactics:()=>Api.get('/mitre/tactics'), mitreUserLatest:()=>Api.get('/mitre/user-latest'),
  generateReport:b=>Api._reqBlob('POST','/reports/generate',b), reportPreview:b=>Api.post('/reports/preview',b), reportHistory:()=>Api.get('/reports/history'), reportActivities:()=>Api.get('/reports/activities'), downloadReport:id=>Api._reqBlob('GET','/reports/download/'+id),
  adminStats:()=>Api.get('/admin/stats'), adminUsers:()=>Api.get('/admin/users'), adminCreateUser:b=>Api.post('/admin/users',b), adminUpdateUser:(id,b)=>Api.put('/admin/users/'+id,b), adminDeleteUser:id=>Api.del('/admin/users/'+id),
  adminLogs:(p={})=>Api.get('/admin/logs?'+new URLSearchParams(p)), adminUserActivity:uid=>Api.get('/admin/users/'+uid+'/activity'),
  adminSystemHealth:()=>Api.get('/admin/system-health'), adminRevokeUserSessions:uid=>Api.post('/admin/users/'+uid+'/revoke-sessions'),
  getProfile:()=>Api.get('/user/profile'), updateProfile:b=>Api.put('/user/profile',b), exportData:()=>Api.get('/user/export'), exportPdf:()=>Api._reqBlob('GET','/user/export-pdf'),
  _reqBlob:async(method,path,body,retry=true)=>{
    if (!Api.accessToken()) {
      if (Api.refreshToken()) {
        const refreshed = await Api.refreshAccessToken();
        if (!refreshed.ok) { Api._redirectLogin(); return {ok:false,status:401,blob:null}; }
      } else {
        Api._redirectLogin(); return {ok:false,status:401,blob:null};
      }
    }
    const make=()=>({method,credentials:'include',headers:{'Content-Type':'application/json','X-ILF-Client':'web/2.1',...Api.authHeaders()},body:JSON.stringify(body)});
    let res;
    try{res=await fetch(API_BASE+path,make());}catch(e){return {ok:false,status:0,blob:null,error:e.message};}
    if(res.status===401&&retry){const rr=await Api.refreshAccessToken();if(!rr.ok){Api._redirectLogin();return {ok:false,status:401,blob:null};}res=await fetch(API_BASE+path,make());}
    if(res.status===401){Api._redirectLogin();return {ok:false,status:401,blob:null};}
    return {ok:res.ok,status:res.status,blob:await res.blob()};
  }
};
Api.migrateLegacyToken();

/* =========================================================
   CUSTOM STYLED MODAL POPUP DIALOGS (Zero Native browser alert)
   ========================================================= */
function showModalAlert(message, title = 'Security Notice', type = 'info') {
  return new Promise(resolve => {
    let overlay = document.getElementById('ilfGlobalModalOverlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'ilfGlobalModalOverlay';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(6px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;opacity:1;';

    const iconSvg = {
      error: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      warn: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      success: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      info: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    }[type] || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

    overlay.innerHTML = `
      <div class="modal" style="max-width:440px;width:100%;padding:24px;background:#ffffff;border:1px solid #E2E8F0;border-radius:14px;box-shadow:0 20px 45px rgba(15,23,42,0.2);transform:none;">
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;">
          <div style="flex-shrink:0;padding:8px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">${iconSvg}</div>
          <div style="flex:1;">
            <h3 style="margin:0 0 6px;font-size:16px;font-weight:700;color:#0F172A;font-family:inherit;">${title}</h3>
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">${message}</p>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
          <button class="btn btn-primary btn-sm" id="ilfModalOkBtn" style="min-width:80px;padding:8px 18px;border-radius:8px;font-weight:600;background:#2563EB;color:#fff;border:none;cursor:pointer;">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeDialog = () => {
      overlay.remove();
      resolve(true);
    };

    overlay.querySelector('#ilfModalOkBtn').onclick = closeDialog;
    overlay.onclick = e => { if (e.target === overlay) closeDialog(); };
  });
}

function showModalConfirm(message, title = 'Confirm Action', options = {}) {
  const { confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = options;
  return new Promise(resolve => {
    let overlay = document.getElementById('ilfGlobalModalOverlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'ilfGlobalModalOverlay';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(6px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;opacity:1;';

    const iconSvg = danger
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

    const confirmBg = danger ? '#DC2626' : '#2563EB';

    overlay.innerHTML = `
      <div class="modal" style="max-width:440px;width:100%;padding:24px;background:#ffffff;border:1px solid #E2E8F0;border-radius:14px;box-shadow:0 20px 45px rgba(15,23,42,0.2);transform:none;">
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;">
          <div style="flex-shrink:0;padding:8px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">${iconSvg}</div>
          <div style="flex:1;">
            <h3 style="margin:0 0 6px;font-size:16px;font-weight:700;color:#0F172A;font-family:inherit;">${title}</h3>
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">${message}</p>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
          <button class="btn btn-ghost btn-sm" id="ilfModalCancelBtn" style="padding:8px 16px;border-radius:8px;border:1px solid #CBD5E1;background:transparent;cursor:pointer;color:#475569;">${cancelText}</button>
          <button class="btn btn-sm" id="ilfModalConfirmBtn" style="padding:8px 18px;border-radius:8px;font-weight:600;background:${confirmBg};color:#fff;border:none;cursor:pointer;">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const finish = result => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('#ilfModalConfirmBtn').onclick = () => finish(true);
    overlay.querySelector('#ilfModalCancelBtn').onclick = () => finish(false);
    overlay.onclick = e => { if (e.target === overlay) finish(false); };
  });
}

if (typeof window !== 'undefined') {
  window.showModalAlert = showModalAlert;
  window.showModalConfirm = showModalConfirm;
  window.alert = function(msg) {
    showModalAlert(String(msg), 'Security Notice', 'error');
  };
}
