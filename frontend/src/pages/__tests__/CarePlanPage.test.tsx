import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CarePlanPage } from '../CarePlanPage';
import { carePlansApi, careTasksApi, patientsApi } from '../../api/resources';

vi.mock('../../api/resources', () => ({
  carePlansApi: {
    getById: vi.fn(),
    updateDraft: vi.fn(),
    sign: vi.fn(),
    amend: vi.fn(),
  },
  careTasksApi: {
    list: vi.fn(),
  },
  patientsApi: {
    getTimeline: vi.fn(),
  },
}));

const openGenericTask = {
  id: 'task-1',
  patientId: 'patient-1',
  carePlanId: 'plan-1',
  status: 'OPEN' as const,
  dueDate: '2026-09-05T00:00:00.000Z',
  createdAt: '2026-08-21T00:00:00.000Z',
  completedAt: null,
  cancelledAt: null,
  overdue: false,
  sourceEncounterId: null,
  timepointCode: null,
  completedByEncounterId: null,
  scheduleReviewRequired: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(patientsApi.getTimeline).mockResolvedValue({
    episodes: [],
    ungroupedEncounters: [],
  });
  vi.mocked(careTasksApi.list).mockResolvedValue([]);
});

function renderCarePlanPage() {
  return render(
    <MemoryRouter initialEntries={['/care-plans/plan-1']}>
      <Routes>
        <Route path="/care-plans/:carePlanId" element={<CarePlanPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CarePlanPage — sign/amend UI state', () => {
  it('DRAFT plans are editable and require an explicit confirmation to sign', async () => {
    vi.mocked(carePlansApi.getById).mockResolvedValue({
      id: 'plan-1',
      encounterId: 'enc-1',
      patientId: 'patient-1',
      status: 'DRAFT',
      instructions: 'Điều trị theo đơn',
      followUpDate: null,
      currentVersionId: null,
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    });

    renderCarePlanPage();
    const user = userEvent.setup();

    expect(await screen.findByLabelText('Điều trị / dặn dò')).toBeEnabled();

    // Signing requires an explicit confirm step, not a single click.
    await user.click(screen.getByRole('button', { name: 'Ký kế hoạch' }));
    expect(screen.getByText(/khóa nội dung hiện tại/i)).toBeInTheDocument();
    expect(carePlansApi.sign).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Xác nhận ký' }));
    await waitFor(() => {
      expect(carePlansApi.sign).toHaveBeenCalledWith('plan-1');
    });
  });

  it('SIGNED plans render immutable content (no editable draft textarea) and offer Amend', async () => {
    vi.mocked(carePlansApi.getById).mockResolvedValue({
      id: 'plan-1',
      encounterId: 'enc-1',
      patientId: 'patient-1',
      status: 'SIGNED',
      instructions: 'Điều trị theo đơn, tái khám 14 ngày',
      followUpDate: '2026-09-05T00:00:00.000Z',
      currentVersionId: 'version-1',
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    });

    renderCarePlanPage();

    await screen.findByText('Điều trị theo đơn, tái khám 14 ngày');
    expect(screen.queryByLabelText('Điều trị / dặn dò')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sửa (tạo phiên bản mới)' }),
    ).toBeInTheDocument();
  });

  it('Amend requires a reason before it can be submitted', async () => {
    vi.mocked(carePlansApi.getById).mockResolvedValue({
      id: 'plan-1',
      encounterId: 'enc-1',
      patientId: 'patient-1',
      status: 'SIGNED',
      instructions: 'Điều trị theo đơn',
      followUpDate: null,
      currentVersionId: 'version-1',
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    });

    renderCarePlanPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Sửa (tạo phiên bản mới)' }));
    expect(screen.getByLabelText('Lý do sửa')).toBeRequired();
  });

  it('displays the current OPEN generic CareTask due date distinctly from the signed CarePlan.followUpDate', async () => {
    vi.mocked(carePlansApi.getById).mockResolvedValue({
      id: 'plan-1',
      encounterId: 'enc-1',
      patientId: 'patient-1',
      status: 'SIGNED',
      instructions: 'Điều trị theo đơn',
      followUpDate: '2026-09-05T00:00:00.000Z',
      currentVersionId: 'version-1',
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    });
    vi.mocked(careTasksApi.list).mockResolvedValue([
      { ...openGenericTask, dueDate: '2026-09-20T00:00:00.000Z' },
    ]);

    renderCarePlanPage();

    expect(await screen.findByText(/Ngày hẹn hiện tại:/)).toBeInTheDocument();
    // Signed clinical intent (5/9) and current operational schedule (20/9)
    // must both be visible and distinguishable.
    expect(screen.getByText(/5\/9\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/20\/9\/2026/)).toBeInTheDocument();
  });

  it('CD-08: changing followUpDate while an OPEN generic task exists requires a reconciliation action before submit', async () => {
    vi.mocked(carePlansApi.getById).mockResolvedValue({
      id: 'plan-1',
      encounterId: 'enc-1',
      patientId: 'patient-1',
      status: 'SIGNED',
      instructions: 'Điều trị theo đơn',
      followUpDate: '2026-09-05T00:00:00.000Z',
      currentVersionId: 'version-1',
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    });
    vi.mocked(careTasksApi.list).mockResolvedValue([openGenericTask]);

    renderCarePlanPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Sửa (tạo phiên bản mới)' }));
    await user.type(screen.getByLabelText('Lý do sửa'), 'Đổi lịch tái khám (synthetic)');

    // No reconciliation control until the date actually changes.
    expect(screen.queryByLabelText('Xử lý nhiệm vụ tái khám')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Ngày tái khám mới (tùy chọn)'));
    await user.type(screen.getByLabelText('Ngày tái khám mới (tùy chọn)'), '2026-09-20');

    expect(screen.getByLabelText('Xử lý nhiệm vụ tái khám')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu phiên bản mới' })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Xử lý nhiệm vụ tái khám'), 'RESCHEDULE');
    expect(screen.getByRole('button', { name: 'Lưu phiên bản mới' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Lưu phiên bản mới' }));
    await waitFor(() => {
      expect(carePlansApi.amend).toHaveBeenCalledWith(
        'plan-1',
        expect.objectContaining({
          followUpDate: '2026-09-20',
          followUpTaskAction: 'RESCHEDULE',
        }),
      );
    });
  });

  it('CD-08: KEEP_WITH_REASON requires a non-blank reason before submit is enabled', async () => {
    vi.mocked(carePlansApi.getById).mockResolvedValue({
      id: 'plan-1',
      encounterId: 'enc-1',
      patientId: 'patient-1',
      status: 'SIGNED',
      instructions: 'Điều trị theo đơn',
      followUpDate: '2026-09-05T00:00:00.000Z',
      currentVersionId: 'version-1',
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    });
    vi.mocked(careTasksApi.list).mockResolvedValue([openGenericTask]);

    renderCarePlanPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Sửa (tạo phiên bản mới)' }));
    await user.type(screen.getByLabelText('Lý do sửa'), 'x');
    await user.clear(screen.getByLabelText('Ngày tái khám mới (tùy chọn)'));
    await user.type(screen.getByLabelText('Ngày tái khám mới (tùy chọn)'), '2026-09-20');
    await user.selectOptions(
      screen.getByLabelText('Xử lý nhiệm vụ tái khám'),
      'KEEP_WITH_REASON',
    );

    expect(screen.getByRole('button', { name: 'Lưu phiên bản mới' })).toBeDisabled();
    await user.type(screen.getByLabelText('Lý do giữ nguyên'), 'BN xin giữ lịch cũ (synthetic)');
    expect(screen.getByRole('button', { name: 'Lưu phiên bản mới' })).toBeEnabled();
  });
});
