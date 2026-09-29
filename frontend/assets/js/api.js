
/*
 * api.js — ILF API Client
 *
 * JWT authentication:
 * - Access token: short-lived API token
 * - Refresh token: used to obtain a new access token
 * - Automatic access-token refresh on 401
 * - Refresh-token rotation supported by backend
 * - Current-session logout
 * - Logout all sessions
 *
 * No classes.
 */

const API_BASE = 'http://localhost:5000/api';

const Api = {

  /* =========================================================
   * TOKEN STORAGE
   * ========================================================= */

  accessToken: () => {
    return localStorage.getItem('ilf_access_token') || '';
  },

  refreshToken: () => {
    return localStorage.getItem('ilf_refresh_token') || '';
  },

  /*
   * Backward compatibility.
   * Existing frontend pages may still call Api.token().
   */
  token: () => {
    return Api.accessToken();
  },

  user: () => {
    try {
      return JSON.parse(
        localStorage.getItem('ilf_user') || '{}'
      );
    } catch {
      return {};
    }
  },

  setAuth: (accessToken, refreshToken, user) => {
    if (accessToken) {
      localStorage.setItem(
        'ilf_access_token',
        accessToken
      );
    }

    if (refreshToken) {
      localStorage.setItem(
        'ilf_refresh_token',
        refreshToken
      );
    }

    if (user) {
      localStorage.setItem(
        'ilf_user',
        JSON.stringify(user)
      );
    }
  },

  clearAuth: () => {
    localStorage.removeItem('ilf_access_token');
    localStorage.removeItem('ilf_refresh_token');

    /*
     * Remove old JWT storage key too.
     */
    localStorage.removeItem('ilf_token');

    localStorage.removeItem('ilf_user');
  },


  /* =========================================================
   * LEGACY TOKEN MIGRATION
   * ========================================================= */

  migrateLegacyToken: () => {
    const oldToken =
      localStorage.getItem('ilf_token');

    const newToken =
      localStorage.getItem('ilf_access_token');

    if (!newToken && oldToken) {
      localStorage.setItem(
        'ilf_access_token',
        oldToken
      );

      localStorage.removeItem('ilf_token');
    }
  },


  /* =========================================================
   * AUTHORIZATION HEADERS
   * ========================================================= */

  authHeaders: () => {
    const headers = {
      'X-ILF-Client': 'web/2.0',
    };

    const token = Api.accessToken();

    if (token) {
      headers['Authorization'] =
        `Bearer ${token}`;
    }

    return headers;
  },


  /* =========================================================
   * REFRESH ACCESS TOKEN
   * ========================================================= */

  refreshAccessToken: async () => {

    const refreshToken =
      Api.refreshToken();

    if (!refreshToken) {
      return {
        ok: false,
        status: 401,
        data: null,
      };
    }

    try {

      const response = await fetch(
        `${API_BASE}/auth/refresh`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'X-ILF-Client':
              'web/2.0',
          },

          body: JSON.stringify({
            refresh_token:
              refreshToken,
          }),
        }
      );

      let data = null;

      const contentType =
        response.headers.get(
          'content-type'
        ) || '';

      if (
        contentType.includes(
          'application/json'
        )
      ) {
        data = await response.json();
      }

      if (!response.ok) {

        Api.clearAuth();

        return {
          ok: false,
          status: response.status,
          data,
        };
      }

      /*
       * Backend response:
       *
       * access_token
       * refresh_token
       * user
       */

      if (data && data.access_token) {
        localStorage.setItem(
          'ilf_access_token',
          data.access_token
        );
      }

      /*
       * Refresh-token rotation.
       *
       * Backend generates a new refresh token
       * during every successful refresh.
       */
      if (data && data.refresh_token) {
        localStorage.setItem(
          'ilf_refresh_token',
          data.refresh_token
        );
      }

      if (data && data.user) {
        localStorage.setItem(
          'ilf_user',
          JSON.stringify(data.user)
        );
      }

      return {
        ok: true,
        status: response.status,
        data,
      };

    } catch (error) {

      console.error(
        '[ILF JWT] Refresh request failed:',
        error.message
      );

      return {
        ok: false,
        status: 0,
        data: null,
        error: error.message,
      };
    }
  },


  /* =========================================================
   * CORE REQUEST
   * ========================================================= */

  _req: async (
    method,
    path,
    body = null,
    isForm = false,
    retry = true
  ) => {

    /*
     * Migrate old token storage before
     * every request.
     */
    Api.migrateLegacyToken();

    const headers = {
      ...Api.authHeaders(),
    };

    /*
     * Do not set Content-Type for FormData.
     * Browser must set multipart boundary itself.
     */
    if (!isForm) {
      headers['Content-Type'] =
        'application/json';
    }

    const options = {
      method,
      headers,
    };

    if (
      body !== null &&
      body !== undefined
    ) {
      options.body = isForm
        ? body
        : JSON.stringify(body);
    }

    console.groupCollapsed(
      `[ILF API] ${method} ${path}`
    );

    if (body && !isForm) {
      console.log(
        'Payload:',
        body
      );
    }

    try {

      /*
       * -----------------------------------------------------
       * FIRST REQUEST
       * -----------------------------------------------------
       */

      let response = await fetch(
        `${API_BASE}${path}`,
        options
      );


      /*
       * -----------------------------------------------------
       * ACCESS TOKEN EXPIRED
       * -----------------------------------------------------
       *
       * Try refresh exactly once.
       */

      if (
        response.status === 401 &&
        retry &&
        Api.refreshToken()
      ) {

        console.log(
          '[ILF JWT] Access token expired/invalid.'
        );

        console.log(
          '[ILF JWT] Attempting refresh...'
        );

        const refreshResult =
          await Api.refreshAccessToken();

        if (refreshResult.ok) {

          console.log(
            '[ILF JWT] Access token refreshed.'
          );

          /*
           * Rebuild Authorization header
           * using the new access token.
           */

          const retryHeaders = {
            ...headers,
            ...Api.authHeaders(),
          };

          const retryOptions = {
            ...options,
            headers: retryHeaders,
          };

          /*
           * Retry original request once.
           */

          response = await fetch(
            `${API_BASE}${path}`,
            retryOptions
          );

        } else {

          console.warn(
            '[ILF JWT] Refresh failed.'
          );

          Api.clearAuth();

          console.groupEnd();

          window.location.href =
            '/signin.html';

          return {
            ok: false,
            status: 401,
            data: null,
          };
        }
      }


      /*
       * -----------------------------------------------------
       * RESPONSE PARSING
       * -----------------------------------------------------
       */

      let data = null;

      const contentType =
        response.headers.get(
          'content-type'
        ) || '';

      if (
        contentType.includes(
          'application/json'
        )
      ) {
        data = await response.json();
      } else {
        data = await response.text();
      }


      console.log(
        'Status:',
        response.status,
        '| Response:',
        data
      );

      console.groupEnd();


      /*
       * -----------------------------------------------------
       * FINAL 401
       * -----------------------------------------------------
       *
       * This happens when:
       *
       * - original request returned 401
       * - refresh was attempted
       * - refreshed request still returned 401
       *
       * Do not refresh again.
       */

      if (
        response.status === 401 &&
        retry === false
      ) {

        Api.clearAuth();

        window.location.href =
          '/signin.html';

        return {
          ok: false,
          status: 401,
          data: null,
        };
      }


      /*
       * Normal response.
       */

      return {
        ok: response.ok,
        status: response.status,
        data,
      };

    } catch (error) {

      console.error(
        '[ILF API] Network error:',
        error.message
      );

      console.groupEnd();

      return {
        ok: false,
        status: 0,
        data: null,
        error: error.message,
      };
    }
  },


  /* =========================================================
   * HTTP METHODS
   * ========================================================= */

  get: (path) => {
    return Api._req(
      'GET',
      path
    );
  },

  post: (path, body) => {
    return Api._req(
      'POST',
      path,
      body
    );
  },

  put: (path, body) => {
    return Api._req(
      'PUT',
      path,
      body
    );
  },

  del: (path) => {
    return Api._req(
      'DELETE',
      path
    );
  },

  form: (path, formData) => {
    return Api._req(
      'POST',
      path,
      formData,
      true
    );
  },


  /* =========================================================
   * AUTH
   * ========================================================= */

  login: (email, password) => {
    return Api.post(
      '/auth/login',
      {
        email,
        password,
      }
    );
  },

  signup: (name, email, password) => {
    return Api.post(
      '/auth/signup',
      {
        name,
        email,
        password,
      }
    );
  },

  refresh: () => {
    return Api.refreshAccessToken();
  },

  logout: async () => {

    const refreshToken =
      Api.refreshToken();

    try {

      /*
       * Revoke current refresh session
       * on the backend.
       *
       * retry=false prevents another refresh
       * if the access token is already expired.
       */

      const result = await Api._req(
        'POST',
        '/auth/logout',
        {
          refresh_token:
            refreshToken,
        },
        false,
        false
      );

      /*
       * Always clear local authentication.
       */
      Api.clearAuth();

      return result;

    } catch (error) {

      /*
       * Local logout must work even if
       * backend is unavailable.
       */

      Api.clearAuth();

      return {
        ok: false,
        status: 0,
        data: null,
        error: error.message,
      };
    }
  },

  logoutAll: async () => {

    try {

      const result = await Api._req(
        'POST',
        '/auth/logout-all',
        null,
        false,
        false
      );

      Api.clearAuth();

      return result;

    } catch (error) {

      Api.clearAuth();

      return {
        ok: false,
        status: 0,
        data: null,
        error: error.message,
      };
    }
  },


  /* =========================================================
   * PASSWORD / ACCOUNT
   * ========================================================= */

  verifyOtp: (email, otp, type) => {
    return Api.post(
      '/auth/verify-otp',
      {
        email,
        otp,
        type,
      }
    );
  },

  resendOtp: (email, type) => {
    return Api.post(
      '/auth/resend-otp',
      {
        email,
        type,
      }
    );
  },

  forgotPassword: (email) => {
    return Api.post(
      '/auth/forgot-password',
      {
        email,
      }
    );
  },

  resetPassword: (
    email,
    otp,
    password
  ) => {
    return Api.post(
      '/auth/reset-password',
      {
        email,
        otp,
        new_password: password,
      }
    );
  },


  /* =========================================================
   * DASHBOARD
   * ========================================================= */

  dashStats: () => {
    return Api.get(
      '/dashboard/stats'
    );
  },

  dashMlSummary: () => {
    return Api.get(
      '/dashboard/ml-summary'
    );
  },


  /* =========================================================
   * LIVE MONITOR
   * ========================================================= */

  streamLogs: (params = {}) => {
    return Api.get(
      `/logs/stream?${new URLSearchParams(params)}`
    );
  },


  /* =========================================================
   * LOG EXPLORER
   * ========================================================= */

  uploadLog: (formData) => {
    return Api.form(
      '/logs/upload',
      formData
    );
  },

  pipelineStatus: (id) => {
    return Api.get(
      `/logs/pipeline/${id}`
    );
  },


  /* =========================================================
   * ML ANALYSIS
   * ========================================================= */

  mlAnalyze: (body) => {
    return Api.post(
      '/ml/analyze',
      body
    );
  },

  mlAlgos: () => {
    return Api.get(
      '/ml/algorithms'
    );
  },


  /* =========================================================
   * MITRE
   * ========================================================= */

  mitreCatalog: (params = {}) => {
    return Api.get(
      `/mitre/catalog?${new URLSearchParams(params)}`
    );
  },

  mitreMap: (body) => {
    return Api.post(
      '/mitre/map',
      body
    );
  },

  mitreTechnique: (tid) => {
    return Api.get(
      `/mitre/technique/${tid}`
    );
  },

  mitreTactics: () => {
    return Api.get(
      '/mitre/tactics'
    );
  },


  /* =========================================================
   * REPORTS
   * ========================================================= */

  generateReport: (body) => {
    return Api._reqBlob(
      'POST',
      '/reports/generate',
      body
    );
  },

  reportHistory: () => {
    return Api.get(
      '/reports/history'
    );
  },


  /* =========================================================
   * ADMIN
   * ========================================================= */

  adminStats: () => {
    return Api.get(
      '/admin/stats'
    );
  },

  adminUsers: () => {
    return Api.get(
      '/admin/users'
    );
  },

  adminUpdateUser: (id, data) => {
    return Api.put(
      `/admin/users/${id}`,
      data
    );
  },


  /* =========================================================
   * PROFILE
   * ========================================================= */

  getProfile: () => {
    return Api.get(
      '/user/profile'
    );
  },

  updateProfile: (body) => {
    return Api.put(
      '/user/profile',
      body
    );
  },


  /* =========================================================
   * BLOB / PDF REQUEST
   * ========================================================= */

  _reqBlob: async (
    method,
    path,
    body,
    retry = true
  ) => {

    const headers = {
      'Content-Type':
        'application/json',

      'X-ILF-Client':
        'web/2.0',

      ...Api.authHeaders(),
    };

    try {

      /*
       * First PDF request.
       */

      let response = await fetch(
        `${API_BASE}${path}`,
        {
          method,
          headers,
          body: JSON.stringify(body),
        }
      );


      /*
       * Access token expired.
       * Refresh once.
       */

      if (
        response.status === 401 &&
        retry &&
        Api.refreshToken()
      ) {

        console.log(
          '[ILF JWT] PDF request received 401.'
        );

        const refreshResult =
          await Api.refreshAccessToken();

        if (!refreshResult.ok) {

          Api.clearAuth();

          window.location.href =
            '/signin.html';

          return {
            ok: false,
            status: 401,
            blob: null,
          };
        }

        /*
         * Retry PDF request using
         * the new access token.
         */

        response = await fetch(
          `${API_BASE}${path}`,
          {
            method,

            headers: {
              ...headers,
              ...Api.authHeaders(),
            },

            body: JSON.stringify(body),
          }
        );
      }


      /*
       * Read response as Blob.
       */

      const blob =
        await response.blob();


      /*
       * If authentication is still invalid
       * after the refresh attempt.
       */

      if (
        response.status === 401 &&
        retry === false
      ) {

        Api.clearAuth();

        window.location.href =
          '/signin.html';

        return {
          ok: false,
          status: 401,
          blob: null,
        };
      }


      return {
        ok: response.ok,
        status: response.status,
        blob,
      };

    } catch (error) {

      console.error(
        '[ILF API] Blob request failed:',
        error.message
      );

      return {
        ok: false,
        status: 0,
        blob: null,
        error: error.message,
      };
    }
  },
};


/* =========================================================
 * INITIAL TOKEN MIGRATION
 * ========================================================= */

Api.migrateLegacyToken();
