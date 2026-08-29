import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { clinicAdminUsersApi } from '../../api/resources';
import type {
  ClinicAdminUser,
  ClinicAdminUserAuditEntry,
} from '../../api/resources';
import { useApiQuery } from '../../api/useApiQuery';
import { ErrorState, LoadingState } from '../../components/AsyncStates';
import { PageHeader } from '../../components/PageHeader';
import { useNotification } from '../../components/NotificationProvider';
import type { NotificationApi } from '../../components/NotificationProvider';
import { ApiError } from '../../api/client';

const ROLE_LABEL: Record<string, string> = {
  DOCTOR: 'Bác sĩ',
  NURSE: 'Điều dưỡng',
  RECEPTIONIST: 'Lễ tân',
};

interface TempPasswordResult {
  title: string;
  email: string;
  password: string;
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

// DEC-018 T5 — functional Clinic Admin user management. Authority for showing
// this page comes from GET /auth/me (RequireClinicAdmin); every action here
// is re-authorized server-side. Every mutation reports PROCESSING (disabled
// button + "Đang xử lý…"), SUCCESS (toast) and ERROR (toast / inline).
export function UsersPage() {
  const notify = useNotification();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const query = useApiQuery(
    () => clinicAdminUsersApi.list(appliedSearch || undefined),
    [appliedSearch],
  );
  const [tempPassword, setTempPassword] = useState<TempPasswordResult | null>(
    null,
  );
  const [auditFor, setAuditFor] = useState<ClinicAdminUser | null>(null);
  const [editUser, setEditUser] = useState<ClinicAdminUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <PageHeader
        title="Người dùng"
        subtitle="Quản lý tài khoản trong cơ sở: tạo mới, đổi vai trò, cấp/thu quyền quản trị, đặt lại mật khẩu, vô hiệu hoá / kích hoạt lại."
      />

      {tempPassword && (
        <TempPasswordModal
          result={tempPassword}
          onClose={() => setTempPassword(null)}
        />
      )}

      {showCreate && (
        <CreateUserModal
          notify={notify}
          onClose={() => setShowCreate(false)}
          onCreated={(email, password) => {
            setShowCreate(false);
            notify.success('Tạo người dùng thành công');
            setTempPassword({
              title: 'Tạo người dùng thành công',
              email,
              password,
            });
            query.reload();
          }}
        />
      )}

      <div className="user-toolbar">
        <form
          className="inline-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setAppliedSearch(search.trim());
          }}
        >
          <label htmlFor="user-search">Tìm kiếm</label>
          <input
            id="user-search"
            type="search"
            value={search}
            placeholder="email hoặc tên hiển thị"
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-ghost">
            Tìm
          </button>
        </form>
        <button
          type="button"
          className="btn btn-primary btn-icon"
          title="Thêm người dùng"
          aria-label="Thêm người dùng"
          onClick={() => setShowCreate(true)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {query.isLoading && <LoadingState />}
      {query.error && <ErrorState message={query.error} />}

      {!query.isLoading && !query.error && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên hiển thị</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Quản trị</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {(query.data ?? []).map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  notify={notify}
                  reload={query.reload}
                  onEdit={() => setEditUser(u)}
                  onResetResult={(email, password) =>
                    setTempPassword({
                      title: 'Đặt lại mật khẩu thành công',
                      email,
                      password,
                    })
                  }
                  onViewAudit={() => setAuditFor(u)}
                />
              ))}
              {(query.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6}>Không có người dùng nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          notify={notify}
          reload={query.reload}
          onClose={() => setEditUser(null)}
        />
      )}

      {auditFor && (
        <AuditPanel user={auditFor} onClose={() => setAuditFor(null)} />
      )}
    </div>
  );
}

// DEC-018 — one-time temporary-password handoff. The value lives only in this
// component's props (React state upstream); it is never written to
// localStorage / sessionStorage / logs / audit. "Sao chép" copies to the OS
// clipboard on an explicit click — the intended handoff, not persistence.
function TempPasswordModal({
  result,
  onClose,
}: {
  result: TempPasswordResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(result.password);
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-password-title"
    >
      <div className="modal-card">
        <h2 id="temp-password-title">{result.title}</h2>
        <p>
          Tài khoản <strong>{result.email}</strong> — mật khẩu tạm:
        </p>
        <p>
          <code data-testid="temp-password">{result.password}</code>
        </p>
        <button type="button" className="btn btn-ghost" onClick={copy}>
          Sao chép
        </button>
        {copied && <span role="status"> Đã sao chép</span>}
        {copyFailed && (
          <span role="status"> Không sao chép được — hãy ghi lại thủ công</span>
        )}
        <p className="form-error" role="alert">
          Mật khẩu này chỉ hiển thị một lần. Hãy bàn giao cho người dùng ngay
          bây giờ.
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Tôi đã ghi lại mật khẩu
        </button>
      </div>
    </div>
  );
}

function CreateUserModal({
  notify,
  onCreated,
  onClose,
}: {
  notify: NotificationApi;
  onCreated: (email: string, password: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('DOCTOR');
  const [isClinicAdmin, setIsClinicAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await clinicAdminUsersApi.create({
        email: email.trim(),
        role,
        displayName: displayName.trim() || undefined,
        isClinicAdmin,
      });
      // Success — parent closes this modal and shows the temp-password modal.
      onCreated(res.user.email, res.temporaryPassword);
    } catch (err) {
      // Error — keep the modal open, show a clear message + toast.
      const message = errMessage(err, 'Không tạo được người dùng.');
      setError(message);
      notify.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-title"
    >
      <form className="modal-card" onSubmit={handleSubmit}>
        <h2 id="create-user-title">Tạo người dùng</h2>

        <label htmlFor="new-user-email">Email</label>
        <input
          id="new-user-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="new-user-name">Tên hiển thị</label>
        <input
          id="new-user-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <label htmlFor="new-user-role">Vai trò</label>
        <select
          id="new-user-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="DOCTOR">Bác sĩ</option>
          <option value="NURSE">Điều dưỡng</option>
          <option value="RECEPTIONIST">Lễ tân</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={isClinicAdmin}
            onChange={(e) => setIsClinicAdmin(e.target.checked)}
          />{' '}
          Quyền quản trị cơ sở
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Tạo người dùng'}
          </button>
        </div>
      </form>
    </div>
  );
}

type RowAction = 'disable' | 'reactivate' | 'reset';

function UserRow({
  user,
  notify,
  reload,
  onEdit,
  onResetResult,
  onViewAudit,
}: {
  user: ClinicAdminUser;
  notify: NotificationApi;
  reload: () => void;
  onEdit: () => void;
  onResetResult: (email: string, password: string) => void;
  onViewAudit: () => void;
}) {
  const [pending, setPending] = useState<RowAction | null>(null);

  // Runs a row mutation with PROCESSING / SUCCESS / ERROR feedback and a
  // double-click guard (no second action while one is pending).
  async function perform<T>(
    action: RowAction,
    fn: () => Promise<T>,
    successMsg: string,
    errFallback: string,
    onOk?: (result: T) => void,
  ) {
    if (pending) return;
    setPending(action);
    try {
      const result = await fn();
      onOk?.(result);
      notify.success(successMsg);
      reload();
    } catch (err) {
      notify.error(errMessage(err, errFallback));
    } finally {
      setPending(null);
    }
  }

  const label = (action: RowAction, idle: string) =>
    pending === action ? 'Đang xử lý…' : idle;

  return (
    <tr>
      <td>{user.displayName ?? '—'}</td>
      <td>{user.email}</td>
      <td>{ROLE_LABEL[user.role] ?? user.role}</td>
      <td>{user.status === 'ACTIVE' ? 'Hoạt động' : 'Vô hiệu hoá'}</td>
      <td>{user.isClinicAdmin ? 'Có' : '—'}</td>
      <td className="row-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending !== null}
          onClick={onEdit}
        >
          Sửa
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending !== null}
          aria-busy={pending === 'reset'}
          onClick={() =>
            perform(
              'reset',
              () => clinicAdminUsersApi.resetPassword(user.id),
              'Đặt lại mật khẩu thành công',
              'Không đặt lại được mật khẩu.',
              (res) => onResetResult(res.user.email, res.temporaryPassword),
            )
          }
        >
          {label('reset', 'Đặt lại mật khẩu')}
        </button>
        {user.status === 'ACTIVE' ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending !== null}
            aria-busy={pending === 'disable'}
            onClick={() =>
              perform(
                'disable',
                () => clinicAdminUsersApi.disable(user.id),
                'Đã vô hiệu hoá người dùng',
                'Không vô hiệu hoá được.',
              )
            }
          >
            {label('disable', 'Vô hiệu hoá')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending !== null}
            aria-busy={pending === 'reactivate'}
            onClick={() =>
              perform(
                'reactivate',
                () => clinicAdminUsersApi.reactivate(user.id),
                'Đã kích hoạt lại người dùng',
                'Không kích hoạt lại được.',
              )
            }
          >
            {label('reactivate', 'Kích hoạt lại')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending !== null}
          onClick={onViewAudit}
        >
          Nhật ký
        </button>
      </td>
    </tr>
  );
}

// DEC-018 — Edit user in a modal styled like Create User / Temp Password.
// Email is read-only; only displayName / role / isClinicAdmin are editable
// (backend enforces the same). Hủy / X / Esc close without saving. Save shows
// "Đang lưu…", is double-click guarded, closes + toasts on success, and keeps
// the modal open with an error message on failure (incl. the last-Clinic-Admin
// 409, which is enforced unchanged server-side).
function EditUserModal({
  user,
  notify,
  reload,
  onClose,
}: {
  user: ClinicAdminUser;
  notify: NotificationApi;
  reload: () => void;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [role, setRole] = useState<ClinicAdminUser['role']>(user.role);
  const [isClinicAdmin, setIsClinicAdmin] = useState(user.isClinicAdmin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const dirty =
    (displayName.trim() || null) !== (user.displayName ?? null) ||
    role !== user.role ||
    isClinicAdmin !== user.isClinicAdmin;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await clinicAdminUsersApi.update(user.id, {
        displayName: displayName.trim(),
        role,
        isClinicAdmin,
      });
      notify.success('Đã cập nhật người dùng');
      reload();
      onClose();
    } catch (err) {
      const message = errMessage(err, 'Không cập nhật được người dùng.');
      setError(message);
      notify.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-title"
    >
      <form className="modal-card" onSubmit={handleSubmit}>
        <button
          type="button"
          className="modal-x"
          aria-label="Đóng"
          onClick={onClose}
          disabled={busy}
        >
          ×
        </button>
        <h2 id="edit-user-title">Chỉnh sửa người dùng</h2>

        <label htmlFor="edit-user-email">Email</label>
        <input id="edit-user-email" type="email" value={user.email} readOnly />

        <label htmlFor="edit-user-name">Tên hiển thị</label>
        <input
          id="edit-user-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <label htmlFor="edit-user-role">Vai trò</label>
        <select
          id="edit-user-role"
          value={role}
          onChange={(e) =>
            setRole(e.target.value as ClinicAdminUser['role'])
          }
        >
          <option value="DOCTOR">Bác sĩ</option>
          <option value="NURSE">Điều dưỡng</option>
          <option value="RECEPTIONIST">Lễ tân</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={isClinicAdmin}
            onChange={(e) => setIsClinicAdmin(e.target.checked)}
          />{' '}
          Quyền quản trị cơ sở
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !dirty}
            aria-busy={busy}
          >
            {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AuditPanel({
  user,
  onClose,
}: {
  user: ClinicAdminUser;
  onClose: () => void;
}) {
  const query = useApiQuery(
    () => clinicAdminUsersApi.getAudit(user.id),
    [user.id],
  );
  const rows = useMemo<ClinicAdminUserAuditEntry[]>(
    () => query.data ?? [],
    [query.data],
  );

  return (
    <section className="clinical-section">
      <h2>Nhật ký quản trị — {user.email}</h2>
      <button type="button" className="btn btn-ghost" onClick={onClose}>
        Đóng
      </button>
      {query.isLoading && <LoadingState />}
      {query.error && <ErrorState message={query.error} />}
      {!query.isLoading && !query.error && (
        <ul>
          {rows.length === 0 && <li>Chưa có sự kiện.</li>}
          {rows.map((e) => (
            <li key={e.id}>
              <code>{e.action}</code> — {new Date(e.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
