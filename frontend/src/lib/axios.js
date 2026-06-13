import axios from 'axios';
import { queryClient } from './queryClient';

// All backend routes are mounted under /api; Vite proxies this to :5000 in dev.
// We use bearer-in-localStorage, so withCredentials stays OFF — flipping it on
// would trigger CORS preflights and tell the server to look for a CSRF cookie
// that we never set.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: false,
  timeout: 30000,
});

// CSRF token cache. We only fetch one and reuse it, but a hard logout/login or
// 401 must invalidate the cache or stale tokens will be sent and rejected.
let csrfToken = null;
function clearCsrf() {
  csrfToken = null;
}

// Listen for the auth store's "logout" event instead of importing it. This
// keeps the module graph acyclic — auth.js doesn't import axios.js either,
// so a future refactor can't reintroduce a half-initialized export bug.
if (typeof window !== 'undefined') {
  window.addEventListener('internops:auth', (e) => {
    if (e.detail?.type === 'logout') clearCsrf();
  });
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await api.get('/auth/csrf-token');
    csrfToken = res.data.csrfToken;
  } catch {
    // Last-resort fallback so non-mutating calls keep working; mutating calls
    // will be rejected by the server with 403 and the user can retry.
    csrfToken = Math.random().toString(36).slice(2);
  }
  return csrfToken;
}

api.interceptors.request.use(async (config) => {
  // Read the token from localStorage each call — cheap, and stays in sync
  // even if the user opens a second tab and logs out there.
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    config.headers['X-CSRF-Token'] = await getCsrfToken();
  }
  return config;
});

// On 401: invalidate CSRF, clear the query cache, and bounce to /login.
// We don't import the auth store here (avoids the cycle); we just clear
// localStorage directly. A full app reset is fine on 401 since the session
// is already invalid server-side.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearCsrf();
      try {
        localStorage.removeItem('accessToken');
      } catch {}
      try {
        localStorage.removeItem('user');
      } catch {}
      queryClient.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export { clearCsrf };
export default api;
