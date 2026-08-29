import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, onUnauthorized, setStoredToken } from '../client';

describe('api client — 401 semantics', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Reset the module-level unauthorized listener between tests.
    onUnauthorized(() => {});
  });

  it('a 401 on POST /auth/login is a credential error, not an expired session', async () => {
    const onExpired = vi.fn();
    onUnauthorized(onExpired);
    vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Invalid credentials' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const err = await api
      .postAuth('/auth/login', { email: 'wrong@example.test', password: 'nope' })
      .catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).message).toBe('Email hoặc mật khẩu không đúng.');
    // The global logout/session-clearing handler must NOT fire for a bad login.
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('a 401 on an authenticated request clears the session and reports it as expired', async () => {
    const onExpired = vi.fn();
    onUnauthorized(onExpired);
    setStoredToken('header.payload.signature');
    vi.spyOn(window, 'fetch').mockResolvedValueOnce(new Response(null, { status: 401 }));

    const err = await api.get('/patients').catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).message).toBe('Phiên đăng nhập đã hết hạn.');
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
