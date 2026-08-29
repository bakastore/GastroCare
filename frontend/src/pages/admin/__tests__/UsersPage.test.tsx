import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UsersPage } from '../UsersPage';
import { NotificationProvider } from '../../../components/NotificationProvider';
import { clinicAdminUsersApi } from '../../../api/resources';
import type { ClinicAdminUser } from '../../../api/resources';

vi.mock('../../../api/resources', () => ({
  clinicAdminUsersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    disable: vi.fn(),
    reactivate: vi.fn(),
    resetPassword: vi.fn(),
    getAudit: vi.fn(),
  },
}));

const row = (over: Partial<ClinicAdminUser> = {}): ClinicAdminUser => ({
  id: 'u1',
  email: 'doc@dec018.example.test',
  displayName: 'BS A',
  role: 'DOCTOR',
  status: 'ACTIVE',
  isClinicAdmin: false,
  mustChangePassword: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clinicAdminUsersApi.list).mockResolvedValue([row()]);
});

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

describe('UsersPage (DEC-018 T5)', () => {
  it('lists tenant users with role and status', async () => {
    renderPage();
    const cell = await screen.findByText('doc@dec018.example.test');
    const tr = cell.closest('tr') as HTMLElement;
    expect(within(tr).getByText('Bác sĩ')).toBeInTheDocument();
    expect(within(tr).getByText('Hoạt động')).toBeInTheDocument();
  });

  it('shows a persistent "+" add-user button with a tooltip; no create form is inline on the page', async () => {
    renderPage();
    await screen.findByText('doc@dec018.example.test');
    const add = screen.getByRole('button', { name: 'Thêm người dùng' });
    expect(add).toBeVisible();
    expect(add).toHaveAttribute('title', 'Thêm người dùng');
    // The create fields are not rendered until the modal is opened.
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('opens the create modal from "+", creates a user, closes the form and shows the one-time temp password', async () => {
    vi.mocked(clinicAdminUsersApi.create).mockResolvedValueOnce({
      user: row({ id: 'u2', email: 'new@dec018.example.test' }),
      temporaryPassword: 'Temp-9-Pass-XYZ',
    });
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('doc@dec018.example.test');

    await user.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByLabelText('Email'), 'new@dec018.example.test');
    await user.click(within(modal).getByRole('button', { name: 'Tạo người dùng' }));

    expect(await screen.findByTestId('temp-password')).toHaveTextContent(
      'Temp-9-Pass-XYZ',
    );
    // create modal is gone, temp-password modal remains
    expect(
      screen.queryByRole('heading', { name: 'Tạo người dùng' }),
    ).not.toBeInTheDocument();
    expect(clinicAdminUsersApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@dec018.example.test', role: 'DOCTOR' }),
    );
  });

  it('create modal: "Hủy" closes it without calling the API', async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('doc@dec018.example.test');

    await user.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(clinicAdminUsersApi.create).not.toHaveBeenCalled();
  });

  it('create modal: on error the message is shown and the modal stays open', async () => {
    const { ApiError } = await import('../../../api/client');
    vi.mocked(clinicAdminUsersApi.create).mockRejectedValueOnce(
      new ApiError(409, 'Email is already in use'),
    );
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('doc@dec018.example.test');

    await user.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByLabelText('Email'), 'dup@dec018.example.test');
    await user.click(within(modal).getByRole('button', { name: 'Tạo người dùng' }));

    expect(await within(modal).findByText('Email is already in use')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('disables a user via the row action — button shows processing, then a success toast', async () => {
    let resolve: (v: ClinicAdminUser) => void = () => {};
    vi.mocked(clinicAdminUsersApi.disable).mockImplementationOnce(
      () => new Promise((r) => (resolve = r)),
    );
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('doc@dec018.example.test');

    await user.click(screen.getByRole('button', { name: 'Vô hiệu hoá' }));
    // PROCESSING — the button is disabled and shows the processing label.
    const busy = screen.getByRole('button', { name: 'Đang xử lý…' });
    expect(busy).toBeDisabled();
    // DOUBLE-CLICK — a rapid second press does nothing.
    await user.click(busy);

    resolve(row({ status: 'DISABLED' }));
    expect(
      await screen.findByText('Đã vô hiệu hoá người dùng'),
    ).toBeInTheDocument();
    expect(clinicAdminUsersApi.disable).toHaveBeenCalledTimes(1);
    expect(clinicAdminUsersApi.disable).toHaveBeenCalledWith('u1');
  });

  it('surfaces a 409 last-admin error from the server as an error toast', async () => {
    const { ApiError } = await import('../../../api/client');
    vi.mocked(clinicAdminUsersApi.disable).mockRejectedValueOnce(
      new ApiError(409, 'A tenant must always retain at least one active Clinic Admin'),
    );
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('doc@dec018.example.test');

    await user.click(screen.getByRole('button', { name: 'Vô hiệu hoá' }));
    const toast = await screen.findByText(/at least one active Clinic Admin/i);
    expect(toast.closest('[role="alert"]')).toBeInTheDocument();
  });

  describe('reset password (T8-F1)', () => {
    it('SUCCESS — shows the modal with the temp password, a copy button, the one-time warning, and a close button', async () => {
      vi.mocked(clinicAdminUsersApi.resetPassword).mockResolvedValueOnce({
        user: row(),
        temporaryPassword: 'Reset-Temp-Pass-123',
      });
      renderPage();
      const user = userEvent.setup();
      // Override AFTER userEvent.setup(), which installs its own clipboard stub.
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      await screen.findByText('doc@dec018.example.test');

      await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

      const dialog = await screen.findByRole('dialog');
      expect(
        within(dialog).getByText('Đặt lại mật khẩu thành công'),
      ).toBeInTheDocument();
      expect(within(dialog).getByTestId('temp-password')).toHaveTextContent(
        'Reset-Temp-Pass-123',
      );
      expect(within(dialog).getByText(/chỉ hiển thị một lần/i)).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Sao chép' }));
      expect(writeText).toHaveBeenCalledWith('Reset-Temp-Pass-123');

      await user.click(
        within(dialog).getByRole('button', { name: 'Tôi đã ghi lại mật khẩu' }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ERROR — shows a clear error message and no modal', async () => {
      const { ApiError } = await import('../../../api/client');
      vi.mocked(clinicAdminUsersApi.resetPassword).mockRejectedValueOnce(
        new ApiError(500, 'Máy chủ lỗi'),
      );
      renderPage();
      const user = userEvent.setup();
      await screen.findByText('doc@dec018.example.test');

      await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

      expect(await screen.findByText('Máy chủ lỗi')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('DOUBLE-CLICK — a rapid second press does not trigger a second reset', async () => {
      let resolve: (v: {
        user: ClinicAdminUser;
        temporaryPassword: string;
      }) => void = () => {};
      vi.mocked(clinicAdminUsersApi.resetPassword).mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      );
      renderPage();
      const user = userEvent.setup();
      await screen.findByText('doc@dec018.example.test');

      const btn = screen.getByRole('button', { name: 'Đặt lại mật khẩu' });
      await user.click(btn);
      // While in-flight the button is disabled and shows a processing label.
      const busyBtn = screen.getByRole('button', { name: 'Đang xử lý…' });
      expect(busyBtn).toBeDisabled();
      await user.click(busyBtn);

      resolve({ user: row(), temporaryPassword: 'One-Reset-Only' });
      await screen.findByRole('dialog');
      expect(clinicAdminUsersApi.resetPassword).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit user (T8 — modal)', () => {
    async function openEditModal() {
      renderPage();
      const user = userEvent.setup();
      await screen.findByText('doc@dec018.example.test');
      await user.click(screen.getByRole('button', { name: 'Sửa' }));
      const modal = await screen.findByRole('dialog');
      return { user, modal };
    }

    it('"Sửa" opens a modal with a read-only email and the editable fields', async () => {
      const { modal } = await openEditModal();
      expect(
        within(modal).getByRole('heading', { name: 'Chỉnh sửa người dùng' }),
      ).toBeInTheDocument();
      const email = within(modal).getByLabelText('Email') as HTMLInputElement;
      expect(email).toHaveValue('doc@dec018.example.test');
      expect(email).toHaveAttribute('readonly');
      expect(within(modal).getByLabelText('Tên hiển thị')).toBeInTheDocument();
      expect(within(modal).getByLabelText('Vai trò')).toBeInTheDocument();
      // No inline editor row on the page.
      expect(document.getElementById('edit-role-u1')).toBeNull();
    });

    it('"Hủy" closes the modal without calling the API', async () => {
      const { user, modal } = await openEditModal();
      await user.click(within(modal).getByRole('button', { name: 'Hủy' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(clinicAdminUsersApi.update).not.toHaveBeenCalled();
    });

    it('"X" and "Esc" close the modal without saving', async () => {
      const { user, modal } = await openEditModal();
      await user.type(within(modal).getByLabelText('Tên hiển thị'), ' X');
      await user.click(within(modal).getByRole('button', { name: 'Đóng' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Reopen in the same render and close with Esc.
      await user.click(screen.getByRole('button', { name: 'Sửa' }));
      await screen.findByRole('dialog');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(clinicAdminUsersApi.update).not.toHaveBeenCalled();
    });

    it('saves changes — processing state, success toast, modal closes, no double-submit', async () => {
      let resolve: (v: ClinicAdminUser) => void = () => {};
      vi.mocked(clinicAdminUsersApi.update).mockImplementationOnce(
        () => new Promise((r) => (resolve = r)),
      );
      const { user, modal } = await openEditModal();
      await user.selectOptions(within(modal).getByLabelText('Vai trò'), 'NURSE');
      await user.click(
        within(modal).getByLabelText(/^Quyền quản trị cơ sở/),
      );

      await user.click(
        within(modal).getByRole('button', { name: 'Lưu thay đổi' }),
      );
      const busy = within(modal).getByRole('button', { name: 'Đang lưu…' });
      expect(busy).toBeDisabled();
      await user.click(busy);

      resolve(row({ role: 'NURSE', isClinicAdmin: true }));

      expect(
        await screen.findByText('Đã cập nhật người dùng'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(clinicAdminUsersApi.update).toHaveBeenCalledTimes(1);
      expect(clinicAdminUsersApi.update).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ role: 'NURSE', isClinicAdmin: true }),
      );
    });

    it('on save error the modal stays open with an error message + error toast (last-admin 409)', async () => {
      const { ApiError } = await import('../../../api/client');
      vi.mocked(clinicAdminUsersApi.update).mockRejectedValueOnce(
        new ApiError(
          409,
          'A tenant must always retain at least one active Clinic Admin',
        ),
      );
      const { user, modal } = await openEditModal();
      await user.click(
        within(modal).getByLabelText(/^Quyền quản trị cơ sở/),
      );
      await user.click(
        within(modal).getByRole('button', { name: 'Lưu thay đổi' }),
      );

      expect(
        await within(modal).findByText(/at least one active Clinic Admin/i),
      ).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
