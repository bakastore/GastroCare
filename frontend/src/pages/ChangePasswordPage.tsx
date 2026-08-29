import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/resources';
import { useNotification } from '../components/NotificationProvider';
import { ApiError, setStoredToken } from '../api/client';

export function ChangePasswordPage() {
  const { user, refresh, logout } = useAuth();
  const notify = useNotification();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // A user who is NOT forced to change can still reach this page voluntarily;
  // that is fine. It only becomes mandatory when mustChangePassword is set.

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    if (newPassword !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword.length < 10) {
      setError('Mật khẩu mới phải có ít nhất 10 ký tự.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { accessToken } = await authApi.changePassword(
        currentPassword,
        newPassword,
      );
      setStoredToken(accessToken);
      await refresh();
      notify.success('Đổi mật khẩu thành công');
      navigate('/', { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Không đổi được mật khẩu.';
      setError(message);
      notify.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1>GastroCare</h1>
        <p className="auth-subtitle">Đổi mật khẩu</p>
        {user.mustChangePassword && (
          <p className="form-hint">
            Bạn cần đổi mật khẩu tạm thời trước khi tiếp tục.
          </p>
        )}

        <label htmlFor="currentPassword">Mật khẩu hiện tại</label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />

        <label htmlFor="newPassword">Mật khẩu mới</label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Đang xử lý…' : 'Đổi mật khẩu'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          Đăng xuất
        </button>
      </form>
    </div>
  );
}
