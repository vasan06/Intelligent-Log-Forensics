/*
 * api.js — ILF API Client
 * Central fetch wrapper. All requests visible in DevTools → Network.
 * JWT token automatically attached. Auto-redirect on 401.
 */

const API_BASE = 'http://localhost:5000/api';

const Api = {
  /* ── Token helpers ─────────────────────────── */
  token:   () => localStorage.getItem('ilf_token') || '',
  user:    () => JSON.parse(localStorage.getItem('ilf_user') || '{}'),
  setAuth: (token, user) => {
    localStorage.setItem('ilf_token', token);
    localStorage.setItem('ilf_user', JSON.stringify(user));
  },
  clearAuth: () => {
    localStorage.removeItem('ilf_token');
    localStorage.removeItem('ilf_user');
  },

  /* ── Core request ──────────────────────────── */
  async _req(method, path, body = null, isForm = false) {
    const headers = { 'X-ILF-Client': 'web/2.0' };
    if (!isForm) headers['Content-Type'] = 'application/json';
    if (Api.token()) headers['Authorization'] = `Bearer ${Api.token()}`;

    const opts = { method, headers };
    if (body) opts.body = isForm ? body : JSON.stringify(body);

    /* DevTools: grouped log for every request */
    console.groupCollapsed(`[ILF API] ${method} ${path}`);
    if (body && !isForm) console.log('Payload:', body);

    try {
      const res  = await fetch(`${API_BASE}${path}`, opts);
      const data = await res.json();
      console.log('Status:', res.status, '| Response:', data);
      console.groupEnd();

      if (res.status === 401) {
        Api.clearAuth();
        window.location.href = '/index.html';
        return { ok: false, data: null };
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.error('Network error:', err.message);
      console.groupEnd();
      return { ok: false, status: 0, data: null, error: err.message };
    }
  },

  get:   (path)        => Api._req('GET',    path),
  post:  (path, body)  => Api._req('POST',   path, body),
  put:   (path, body)  => Api._req('PUT',    path, body),
  del:   (path)        => Api._req('DELETE', path),
  form:  (path, fd)    => Api._req('POST',   path, fd, true),

  /* ── Auth ──────────────────────────────────── */
  login:           (email, password)   => Api.post('/auth/login',    { email, password }),
  signup:          (name,email,pw)     => Api.post('/auth/signup',   { name, email, password:pw }),
  verifyOtp:       (email, otp, type)  => Api.post('/auth/verify-otp', { email, otp, type }),
  resendOtp:       (email, type)       => Api.post('/auth/resend-otp', { email, type }),
  forgotPassword:  (email)             => Api.post('/auth/forgot-password', { email }),
  resetPassword:   (email, otp, pw)    => Api.post('/auth/reset-password',  { email, otp, new_password: pw }),
  logout:          ()                  => Api.post('/auth/logout'),

  /* ── Dashboard ─────────────────────────────── */
  dashStats:   ()       => Api.get('/dashboard/stats'),
  dashMlSummary: ()     => Api.get('/dashboard/ml-summary'),

  /* ── Live monitor ──────────────────────────── */
  streamLogs:  (params) => Api.get(`/logs/stream?${new URLSearchParams(params)}`),

  /* ── Log explorer ──────────────────────────── */
  uploadLog:   (fd)     => Api.form('/logs/upload', fd),
  pipelineStatus: (id)  => Api.get(`/logs/pipeline/${id}`),

  /* ── ML analysis ───────────────────────────── */
  mlAnalyze:   (body)   => Api.post('/ml/analyze', body),
  mlAlgos:     ()       => Api.get('/ml/algorithms'),

  /* ── MITRE ─────────────────────────────────── */
  mitreCatalog:  (params) => Api.get(`/mitre/catalog?${new URLSearchParams(params)}`),
  mitreMap:      (body)   => Api.post('/mitre/map', body),
  mitreTechnique:(tid)    => Api.get(`/mitre/technique/${tid}`),
  mitreTactics:  ()       => Api.get('/mitre/tactics'),

  /* ── Reports ───────────────────────────────── */
  generateReport: (body)  => Api._reqBlob('POST', '/reports/generate', body),
  reportHistory:  ()      => Api.get('/reports/history'),

  /* ── Admin ─────────────────────────────────── */
  adminStats:     ()      => Api.get('/admin/stats'),
  adminUsers:     ()      => Api.get('/admin/users'),
  adminUpdateUser:(id, d) => Api.put(`/admin/users/${id}`, d),

  /* ── Profile ───────────────────────────────── */
  getProfile:     ()      => Api.get('/user/profile'),
  updateProfile:  (body)  => Api.put('/user/profile', body),

  /* ── Blob (for PDF download) ───────────────── */
  async _reqBlob(method, path, body) {
    const headers = {
      'Content-Type': 'application/json',
      'X-ILF-Client': 'web/2.0',
    };
    if (Api.token()) headers['Authorization'] = `Bearer ${Api.token()}`;
    console.log(`[ILF API] ${method} ${path} (blob)`);
    try {
      const res  = await fetch(`${API_BASE}${path}`, { method, headers, body: JSON.stringify(body) });
      const blob = await res.blob();
      return { ok: res.ok, blob };
    } catch(e) { return { ok: false, blob: null }; }
  },
};
