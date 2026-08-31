import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UserDetailPage } from '../UserDetailPage';
import { NotificationProvider } from '../../../components/NotificationProvider';
import {
  clinicAdminUsersApi,
  facilitiesApi,
  staffApi,
} from '../../../api/resources';

vi.mock('../../../api/resources', () => ({
  clinicAdminUsersApi: { getById: vi.fn(), getAudit: vi.fn() },
  facilitiesApi: { list: vi.fn() },
  staffApi: {
    getProfile: vi.fn(),
    putProfile: vi.fn(),
    listCredentials: vi.fn(),
    addCredential: vi.fn(),
    updateCredential: vi.fn(),
    deleteCredential: vi.fn(),
    listEmployment: vi.fn(),
    addEmployment: vi.fn(),
    deleteEmployment: vi.fn(),
    listAssignments: vi.fn(),
    addAssignment: vi.fn(),
    patchAssignment: vi.fn(),
    getStaffAudit: vi.fn(),
  },
}));

const account = {
  id: 'u1',
  email: 'doc@dec019.example.test',
  displayName: 'BS A',
  role: 'DOCTOR' as const,
  status: 'ACTIVE' as const,
  isClinicAdmin: false,
  mustChangePassword: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const profile = {
  id: 'p1',
  authUserId: 'u1',
  fullName: 'Nguyen Van A',
  professionalTitle: 'BS CKI',
  workPhone: null,
  primarySpecialty: 'GASTROENTEROLOGY' as const,
  secondarySpecialties: [],
  specialtyOtherLabel: null,
  biography: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clinicAdminUsersApi.getById).mockResolvedValue(account);
  vi.mocked(clinicAdminUsersApi.getAudit).mockResolvedValue([]);
  vi.mocked(facilitiesApi.list).mockResolvedValue([
    { id: 'f1', name: 'CS 1', tenantId: 't', createdAt: '' },
    { id: 'f2', name: 'CS 2', tenantId: 't', createdAt: '' },
  ] as never);
  vi.mocked(staffApi.getProfile).mockResolvedValue({ userId: 'u1', profile });
  vi.mocked(staffApi.listCredentials).mockResolvedValue([]);
  vi.mocked(staffApi.listEmployment).mockResolvedValue([]);
  vi.mocked(staffApi.listAssignments).mockResolvedValue([]);
  vi.mocked(staffApi.getStaffAudit).mockResolvedValue([]);
});

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/clinic-admin/users/u1']}>
        <Routes>
          <Route path="/clinic-admin/users/:id" element={<UserDetailPage />} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

describe('UserDetailPage', () => {
  it('shows account summary and the five tabs', async () => {
    renderPage();
    expect(await screen.findByText('doc@dec019.example.test')).toBeInTheDocument();
    for (const t of ['Tổng quan', 'Chuyên môn', 'Chứng chỉ', 'Công tác', 'Nhật ký']) {
      expect(screen.getByRole('tab', { name: t })).toBeInTheDocument();
    }
  });

  it('saves the basic profile and shows a success toast', async () => {
    vi.mocked(staffApi.putProfile).mockResolvedValue(profile);
    renderPage();
    const phone = await screen.findByLabelText('Điện thoại công việc');
    await userEvent.type(phone, '0912345678');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() =>
      expect(staffApi.putProfile).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ workPhone: '0912345678' }),
      ),
    );
    expect(await screen.findByText('Đã cập nhật hồ sơ')).toBeInTheDocument();
  });

  it('credentials tab: effective status column and hard-delete confirm', async () => {
    vi.mocked(staffApi.listCredentials).mockResolvedValue([
      {
        id: 'c1',
        staffProfileId: 'p1',
        credentialType: 'CERTIFICATE',
        name: 'Old cert',
        credentialNumber: null,
        issuingOrganization: null,
        issueDate: '2010-01-01',
        expiryDate: '2011-01-01',
        status: 'ACTIVE',
        effectiveStatus: 'EXPIRED',
        note: null,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(staffApi.deleteCredential).mockResolvedValue({ deleted: true });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await userEvent.click(await screen.findByRole('tab', { name: 'Chứng chỉ' }));
    expect(await screen.findByTestId('cred-eff-c1')).toHaveTextContent('Hết hạn');
    await userEvent.click(screen.getByRole('button', { name: 'Xoá' }));
    await waitFor(() =>
      expect(staffApi.deleteCredential).toHaveBeenCalledWith('u1', 'c1'),
    );
    confirmSpy.mockRestore();
  });

  it('audit tab merges DEC-018 + DEC-019 events ordered by seq', async () => {
    vi.mocked(clinicAdminUsersApi.getAudit).mockResolvedValue([
      { id: 'a', seq: 1, action: 'USER_CREATED', actorId: 'x', createdAt: '2026-08-01T00:00:00Z', metadata: null },
    ]);
    vi.mocked(staffApi.getStaffAudit).mockResolvedValue([
      { id: 'b', seq: 2, action: 'STAFF_PROFILE_CREATED', actorId: 'x', entityType: 'StaffProfile', entityId: 'p1', createdAt: '2026-08-02T00:00:00Z', metadata: null },
    ]);
    renderPage();
    await userEvent.click(await screen.findByRole('tab', { name: 'Nhật ký' }));
    const rows = await screen.findAllByRole('row');
    // header + 2 data rows
    const body = rows.slice(1);
    expect(within(body[0]).getByText('USER_CREATED')).toBeInTheDocument();
    expect(within(body[1]).getByText('STAFF_PROFILE_CREATED')).toBeInTheDocument();
  });

  it('prevents duplicate submit while a mutation is in flight', async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(staffApi.putProfile).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as never,
    );
    renderPage();
    const btn = await screen.findByRole('button', { name: 'Lưu hồ sơ' });
    await userEvent.click(btn);
    expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
    resolve(profile);
  });
});
