import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from '../LoginPage';
import { AuthProvider } from '../../auth/AuthContext';
import { authApi } from '../../api/resources';

vi.mock('../../api/resources', () => ({
  authApi: { login: vi.fn() },
}));

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  it('submits email/password and lets the user through on success', async () => {
    const fakeToken =
      'eyJhbGciOiJIUzI1NiJ9.' +
      btoa(
        JSON.stringify({
          sub: 'user-1',
          tenantId: 'tenant-1',
          email: 'doctor.a@example.test',
          role: 'DOCTOR',
          exp: Math.floor(Date.now() / 1000) + 900,
        }),
      ) +
      '.signature';
    vi.mocked(authApi.login).mockResolvedValueOnce({ accessToken: fakeToken });

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'doctor.a@example.test');
    await user.type(screen.getByLabelText('Mật khẩu'), 'password123');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('doctor.a@example.test', 'password123');
    });
  });

  it('shows a validation/error message on invalid credentials without leaking internals', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'wrong@example.test');
    await user.type(screen.getByLabelText('Mật khẩu'), 'bad-password');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Đăng nhập thất bại.');
  });

  it('requires both fields before allowing submit', () => {
    renderLogin();
    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Mật khẩu')).toBeRequired();
  });
});
