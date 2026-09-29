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
    if (!location.pathname.endsWith('/signin') && !location.pathname.endsWith('/login')) location.replace('/login');
  },
  refreshAccessToken: async () => {
    const refresh = Api.refreshToken();
    if (!refresh || !Api.accessToken()) return {ok:false,status:401,data:null};
    try {
      const res = await fetch(API_BASE + '/auth/refresh', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json','X-ILF-Client':'web/2.1'},
        body:JSON.stringify({refresh_token:refresh})
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.access_token) { Api.clearAuth(); return {ok:false,status:res.status,data}; }
      Api.setAuth(data.access_token, data.refresh_token, data.user);
      return {ok:true,status:res.status,data};
    } catch (e) { return {ok:false,status:0,data:null,error:e.message}; }
  },
  _req: async (method, path, body=null, isForm=false, retry=true) => {
    Api.migrateLegacyToken();
    // A missing access token is treated as an explicit logout. Never silently
    // resurrect a session using only the refresh token.
    if (!Api.accessToken()) { Api._redirectLogin(); return {ok:false,status:401,data:null}; }
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
  dashStats:()=>Api.get('/dashboard/stats'), dashMlSummary:()=>Api.get('/dashboard/ml-summary'),
  streamLogs:(p={})=>Api.get('/logs/stream?'+new URLSearchParams(p)),
  uploadLog:f=>Api.form('/logs/upload',f), pipelineStatus:id=>Api.get('/logs/pipeline/'+id),
  mlAnalyze:b=>Api.post('/ml/analyze',b), mlAlgos:()=>Api.get('/ml/algorithms'),
  mitreCatalog:(p={})=>Api.get('/mitre/catalog?'+new URLSearchParams(p)), mitreMap:b=>Api.post('/mitre/map',b), mitreTechnique:id=>Api.get('/mitre/technique/'+id), mitreTactics:()=>Api.get('/mitre/tactics'),
  generateReport:b=>Api._reqBlob('POST','/reports/generate',b), reportPreview:b=>Api.post('/reports/preview',b), reportHistory:()=>Api.get('/reports/history'),
  adminStats:()=>Api.get('/admin/stats'), adminUsers:()=>Api.get('/admin/users'), adminCreateUser:b=>Api.post('/admin/users',b), adminUpdateUser:(id,b)=>Api.put('/admin/users/'+id,b), adminDeleteUser:id=>Api.del('/admin/users/'+id),
  getProfile:()=>Api.get('/user/profile'), updateProfile:b=>Api.put('/user/profile',b), exportData:()=>Api.get('/user/export'),
  _reqBlob:async(method,path,body,retry=true)=>{
    if (!Api.accessToken()) { Api._redirectLogin(); return {ok:false,status:401,blob:null}; }
    const make=()=>({method,credentials:'include',headers:{'Content-Type':'application/json','X-ILF-Client':'web/2.1',...Api.authHeaders()},body:JSON.stringify(body)});
    let res;
    try{res=await fetch(API_BASE+path,make());}catch(e){return {ok:false,status:0,blob:null,error:e.message};}
    if(res.status===401&&retry){const rr=await Api.refreshAccessToken();if(!rr.ok){Api._redirectLogin();return {ok:false,status:401,blob:null};}res=await fetch(API_BASE+path,make());}
    if(res.status===401){Api._redirectLogin();return {ok:false,status:401,blob:null};}
    return {ok:res.ok,status:res.status,blob:await res.blob()};
  }
};
Api.migrateLegacyToken();
