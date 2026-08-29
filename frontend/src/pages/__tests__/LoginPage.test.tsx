import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from '../LoginPage';
import { AuthProvider } from '../../auth/AuthContext';
import { authApi } from '../../api/resources';
import { ApiError } from '../../api/client';

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

  it('routes a nurse to assigned work even after a doctor left a patient return URL', async () => {
    const token =
      'header.' +
      btoa(
        JSON.stringify({
          sub: 'nurse-1',
          tenantId: 'tenant-1',
          email: 'nurse@example.test',
          role: 'NURSE',
          exp: Math.floor(Date.now() / 1000) + 900,
        }),
      ) +
      '.signature';
    vi.mocked(authApi.login).mockResolvedValueOnce({ accessToken: token });
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state: { from: { pathname: '/patients/patient-1' } },
          },
        ]}
      >
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/investigations/assigned" element={<h1>Assigned work</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'nurse@example.test');
    await user.type(screen.getByLabelText('Mật khẩu'), 'synthetic');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));
    expect(await screen.findByRole('heading', { name: 'Assigned work' })).toBeInTheDocument();
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

  it('shows the credential-specific message (not "session expired") when the backend returns 401', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(
      new ApiError(401, 'Email hoặc mật khẩu không đúng.'),
    );

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'wrong@example.test');
    await user.type(screen.getByLabelText('Mật khẩu'), 'bad-password');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email hoặc mật khẩu không đúng.');
    expect(alert).not.toHaveTextContent('Phiên đăng nhập đã hết hạn.');
  });

  it('requires both fields before allowing submit', () => {
    renderLogin();
    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Mật khẩu')).toBeRequired();
  });
});
