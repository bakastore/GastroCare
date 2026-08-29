import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChangePasswordPage } from '../ChangePasswordPage';
import * as AuthContextModule from '../../auth/AuthContext';
import { authApi } from '../../api/resources';
import { makeCurrentUser } from '../../test/currentUser';
import { NotificationProvider } from '../../components/NotificationProvider';

vi.mock('../../api/resources', () => ({
  authApi: { changePassword: vi.fn(), me: vi.fn(), login: vi.fn() },
}));

const refresh = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: makeCurrentUser({ mustChangePassword: true }),
    isInitializing: false,
    login: vi.fn(),
    logout: vi.fn(),
    refresh,
  });
});

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/change-password']}>
        <Routes>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/" element={<h1>Home</h1>} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

describe('ChangePasswordPage (DEC-018 T2)', () => {
  it('shows the forced-change hint', () => {
    renderPage();
    expect(
      screen.getByText(/đổi mật khẩu tạm thời trước khi tiếp tục/i),
    ).toBeInTheDocument();
  });

  it('rejects a mismatched confirmation without calling the API', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'temp-pass-1');
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'Brand-New-Pass1');
    await user.type(
      screen.getByLabelText('Xác nhận mật khẩu mới'),
      'different-pass',
    );
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/không khớp/i);
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('changes the password, stores the fresh token, refreshes and navigates home', async () => {
    vi.mocked(authApi.changePassword).mockResolvedValueOnce({
      accessToken: 'new.token.value',
    });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'temp-pass-1');
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'Brand-New-Pass1');
    await user.type(
      screen.getByLabelText('Xác nhận mật khẩu mới'),
      'Brand-New-Pass1',
    );
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    await waitFor(() =>
      expect(authApi.changePassword).toHaveBeenCalledWith(
        'temp-pass-1',
        'Brand-New-Pass1',
      ),
    );
    expect(window.localStorage.getItem('gastrocare.accessToken')).toBe(
      'new.token.value',
    );
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText('Đổi mật khẩu thành công')).toBeInTheDocument();
  });

  it('on API failure shows an error and an error toast, stays on the page', async () => {
    const { ApiError } = await import('../../api/client');
    vi.mocked(authApi.changePassword).mockRejectedValueOnce(
      new ApiError(401, 'Mật khẩu hiện tại không đúng'),
    );
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'wrong');
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'Brand-New-Pass1');
    await user.type(
      screen.getByLabelText('Xác nhận mật khẩu mới'),
      'Brand-New-Pass1',
    );
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(
      await screen.findAllByText('Mật khẩu hiện tại không đúng'),
    ).not.toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument();
  });
});
