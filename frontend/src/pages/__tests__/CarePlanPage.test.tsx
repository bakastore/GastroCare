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

  // Correction batch C1 — the dirty-draft sign guard. signPlan() only signs
  // the persisted server state, so a DRAFT with unsaved edits must not be
  // signable until "Lưu bản nháp" clears the dirty flag.
  it('C1: editing a DRAFT field disables signing and shows an unsaved-changes hint', async () => {
    vi.mocked(carePlansApi.getById).mockResolvedValue({
      id: 'plan-1',
      encounterId: 'enc-1',
      patientId: 'patient-1',
      status: 'DRAFT',
      instructions: 'Điều trị theo đơn',
      followUpDate: '2026-09-05T00:00:00.000Z',
      currentVersionId: null,
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    });

    renderCarePlanPage();
    const user = userEvent.setup();

    await screen.findByLabelText('Điều trị / dặn dò');
    // Clean persisted draft: signing is available.
    expect(screen.getByRole('button', { name: 'Ký kế hoạch' })).toBeEnabled();

    await user.type(screen.getByLabelText('Điều trị / dặn dò'), ' - thêm dặn dò');

    // Dirty: sign button disabled + hint, sign API never called.
    expect(screen.getByRole('button', { name: 'Ký kế hoạch' })).toBeDisabled();
    expect(
      screen.getByText('Có thay đổi chưa lưu. Hãy lưu bản nháp trước khi ký.'),
    ).toBeInTheDocument();
    expect(carePlansApi.sign).not.toHaveBeenCalled();

    // Save clears the dirty state → signing becomes available again.
    vi.mocked(carePlansApi.updateDraft).mockResolvedValue({} as never);
    await user.click(screen.getByRole('button', { name: 'Lưu bản nháp' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ký kế hoạch' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Ký kế hoạch' }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận ký' }));
    await waitFor(() => {
      expect(carePlansApi.sign).toHaveBeenCalledWith('plan-1');
    });
  });

  it('R1: while "Lưu bản nháp" is in flight, draft fields are disabled and signing is unavailable; both recover after it resolves', async () => {
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

    let resolveSave!: (v: unknown) => void;
    vi.mocked(carePlansApi.updateDraft).mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }) as never,
    );

    renderCarePlanPage();
    const user = userEvent.setup();

    const textarea = await screen.findByLabelText('Điều trị / dặn dò');
    await user.type(textarea, ' - sửa');
    await user.click(screen.getByRole('button', { name: 'Lưu bản nháp' }));

    // Save in flight: fields disabled, no visible mutation possible, signing blocked.
    expect(screen.getByLabelText('Điều trị / dặn dò')).toBeDisabled();
    expect(screen.getByLabelText('Ngày tái khám (tùy chọn)')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ký kế hoạch' })).toBeDisabled();
    expect(carePlansApi.sign).not.toHaveBeenCalled();

    // Resolve the save.
    resolveSave({});
    await waitFor(() => {
      expect(screen.getByLabelText('Điều trị / dặn dò')).toBeEnabled();
    });

    // Signing is now available and signs the saved visible state.
    expect(screen.getByRole('button', { name: 'Ký kế hoạch' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Ký kế hoạch' }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận ký' }));
    await waitFor(() => {
      expect(carePlansApi.sign).toHaveBeenCalledWith('plan-1');
    });
  });

  it('C1: editing a field after opening the sign confirmation cannot sign stale server data', async () => {
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

    await screen.findByLabelText('Điều trị / dặn dò');
    await user.click(screen.getByRole('button', { name: 'Ký kế hoạch' }));
    expect(screen.getByRole('button', { name: 'Xác nhận ký' })).toBeInTheDocument();

    // Change a field while the confirmation is open.
    await user.type(screen.getByLabelText('Điều trị / dặn dò'), ' - sửa nữa');

    // The confirm button is gone; signing is blocked with the hint.
    expect(screen.queryByRole('button', { name: 'Xác nhận ký' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Có thay đổi chưa lưu. Hãy lưu bản nháp trước khi ký.'),
    ).toBeInTheDocument();
    expect(carePlansApi.sign).not.toHaveBeenCalled();
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
