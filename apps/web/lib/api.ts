const API_ORIGIN =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}`
    : 'http://localhost';

/**
 * Resolve the API base URL.
 *
 * - NEXT_PUBLIC_API_URL (set in Vercel/Render/Netlify env) is the source of
 *   truth in every environment.
 * - In development the Next.js rewrites proxy /api -> localhost:4000, so the
 *   same-origin /api prefix works without any env.
 * - In production WITHOUT the env var there is no correct default — the old
 *   `${origin}:4000` fallback silently dialed a dead port on hosted deploys
 *   (the login failure). Fail loudly instead so the misconfiguration is
 *   obvious in the console rather than as a mysterious network error.
 */
const isDev =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL
  : isDev
    ? `${API_ORIGIN}/api/v1`
    : 'MISSING_NEXT_PUBLIC_API_URL';

function assertConfigured(): void {
  if (BASE_URL === 'MISSING_NEXT_PUBLIC_API_URL') {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not set. Add it to the deployment environment ' +
        '(e.g. https://workspace-api-m9q7.onrender.com/api/v1 on Vercel).',
    );
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearSession();
    throw new Error('Session expired');
  }

  const json = await res.json();
  const payload = json && typeof json === 'object' && 'data' in json ? json.data : json;
  const accessToken = payload.tokens?.accessToken || payload.accessToken;
  const newRefresh = payload.tokens?.refreshToken || payload.refreshToken;
  localStorage.setItem('accessToken', accessToken);
  if (newRefresh) {
    localStorage.setItem('refreshToken', newRefresh);
  }
  return accessToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  assertConfigured();
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        refreshQueue.forEach((q) => q.resolve(newToken));
        refreshQueue = [];

        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
      } catch (err) {
        isRefreshing = false;
        refreshQueue.forEach((q) => q.reject(err));
        refreshQueue = [];
        clearSession();
        window.location.href = '/auth/login';
        throw err;
      }
    } else {
      const newToken = await new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      });
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.code || 'UNKNOWN',
      body.message || 'An error occurred',
    );
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json();
  // Unwrap global ResponseInterceptor: { success, data, message }
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

async function requestFormData<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  assertConfigured();
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  // Form-data uploads must participate in the same refresh flow as JSON
  // requests — otherwise every upload fails with a 401 after token expiry.
  if (res.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        refreshQueue.forEach((q) => q.resolve(newToken));
        refreshQueue = [];

        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${BASE_URL}${path}`, {
          method: 'POST',
          headers,
          body: formData,
        });
      } catch (err) {
        isRefreshing = false;
        refreshQueue.forEach((q) => q.reject(err));
        refreshQueue = [];
        clearSession();
        window.location.href = '/auth/login';
        throw err;
      }
    } else {
      const newToken = await new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      });
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: formData,
      });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.code || 'UNKNOWN',
      body.message || 'An error occurred',
    );
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  postFormData: <T>(path: string, formData: FormData) =>
    requestFormData<T>(path, formData),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
