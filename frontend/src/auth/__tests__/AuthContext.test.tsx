import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import { authApi } from '../../api/resources';
import { getStoredToken } from '../../api/client';

vi.mock('../../api/resources', () => ({
  authApi: { login: vi.fn() },
}));

function fakeToken(overrides: Record<string, unknown> = {}) {
  const payload = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    email: 'doctor.a@example.test',
    role: 'DOCTOR',
    exp: Math.floor(Date.now() / 1000) + 900,
    ...overrides,
  };
  return 'eyJhbGciOiJIUzI1NiJ9.' + btoa(JSON.stringify(payload)) + '.signature';
}

function Probe() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user-state">{user ? user.email : 'anonymous'}</span>
      <button onClick={() => login('doctor.a@example.test', 'password123')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('AuthContext — session/logout hardening', () => {
  it('clears the stored token and user state on logout', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({ accessToken: fakeToken() });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    const user = userEvent.setup();

    await user.click(screen.getByText('login'));
    await waitFor(() => {
      expect(screen.getByTestId('user-state')).toHaveTextContent('doctor.a@example.test');
    });
    expect(getStoredToken()).not.toBeNull();

    await user.click(screen.getByText('logout'));
    expect(screen.getByTestId('user-state')).toHaveTextContent('anonymous');
    expect(getStoredToken()).toBeNull();
  });

  it('drops back to a safe logged-out state when a real API call comes back 401', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({ accessToken: fakeToken() });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    const user = userEvent.setup();

    await user.click(screen.getByText('login'));
    await waitFor(() => {
      expect(screen.getByTestId('user-state')).toHaveTextContent('doctor.a@example.test');
    });
    expect(getStoredToken()).not.toBeNull();

    // A real 401 from the backend (e.g. the token expired mid-session)
    // must be treated the same way as an explicit logout by the app shell.
    const { api } = await import('../../api/client');
    vi.spyOn(window, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401 }),
    );
    await expect(api.get('/patients')).rejects.toThrow();

    await waitFor(() => {
      expect(screen.getByTestId('user-state')).toHaveTextContent('anonymous');
    });
    expect(getStoredToken()).toBeNull();
  });

  it('an expired token found in storage on load is treated as logged out, not as a crash', async () => {
    window.localStorage.setItem(
      'gastrocare.accessToken',
      fakeToken({ exp: Math.floor(Date.now() / 1000) - 10 }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-state')).toHaveTextContent('anonymous');
    });
    expect(getStoredToken()).toBeNull();
  });
});
