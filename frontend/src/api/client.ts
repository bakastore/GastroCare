const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TOKEN_STORAGE_KEY = 'gastrocare.accessToken';

// CORE-02 local/synthetic use only: token kept in localStorage for the
// simplest reasonable session handling. NOT proven production-safe (see
// Owner Execution Contract section 7) — a hardened token storage strategy
// (httpOnly cookie, refresh rotation, etc.) is out of scope for this
// work package and would need its own review before any shared/production use.
export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class ApiError extends Error {
  status: number;
  /** Stable machine-readable error code from the response body, when the
   * backend provides one (e.g. HEMORRHOID_RECURRENCE_CHOICE_REQUIRED).
   * Callers branch on this + `status`, never on `message` wording. */
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Fired whenever a request comes back 401, so the app can drop to a safe
// logged-out state regardless of which screen triggered it.
type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;

export function onUnauthorized(listener: UnauthorizedListener): void {
  unauthorizedListener = listener;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; isAuthAttempt?: boolean } = {},
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Không thể kết nối máy chủ. Vui lòng thử lại.');
  }

  if (response.status === 401) {
    // A 401 on a credential-check request (POST /auth/login) means the email
    // or password was wrong — it is NOT an expired authenticated session, so
    // it must not trip the global logout/session-clearing handler or show the
    // "session expired" message. Every other 401 is an authenticated request
    // whose token is missing/expired/rejected → drop to a safe logged-out
    // state (see AuthProvider.onUnauthorized).
    if (options.isAuthAttempt) {
      throw new ApiError(401, 'Email hoặc mật khẩu không đúng.');
    }
    unauthorizedListener?.();
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    const rawMessage =
      payload && typeof payload === 'object' && 'message' in payload
        ? (payload as { message: unknown }).message
        : undefined;
    const message =
      (Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : rawMessage !== undefined
          ? String(rawMessage)
          : undefined) ?? 'Có lỗi xảy ra. Vui lòng thử lại.';
    const code =
      payload &&
      typeof payload === 'object' &&
      'code' in payload &&
      typeof (payload as { code: unknown }).code === 'string'
        ? (payload as { code: string }).code
        : undefined;
    throw new ApiError(response.status, message, code);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  // Credential-check POST (login): a 401 here is "wrong email/password", not an
  // expired session — see the 401 branch in request().
  postAuth: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body, isAuthAttempt: true }),
};
