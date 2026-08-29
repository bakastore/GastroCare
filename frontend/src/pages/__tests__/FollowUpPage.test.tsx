import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FollowUpPage } from '../FollowUpPage';
import { careTasksApi, patientsApi } from '../../api/resources';

vi.mock('../../api/resources', () => ({
  careTasksApi: {
    list: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
    reschedule: vi.fn(),
  },
  patientsApi: {
    list: vi.fn(),
    getTimeline: vi.fn(),
  },
}));

const openTask = {
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
  vi.mocked(careTasksApi.list).mockResolvedValue([openTask]);
  vi.mocked(patientsApi.list).mockResolvedValue([
    {
      id: 'patient-1',
      fullName: 'Bệnh nhân Synthetic',
      dateOfBirth: '1980-01-01',
      gender: 'MALE',
      phone: '0900000000',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ]);
});

function renderFollowUpPage() {
  return render(
    <MemoryRouter>
      <FollowUpPage />
    </MemoryRouter>,
  );
}

describe('FollowUpPage — explicit Return Encounter completion + reschedule', () => {
  it('plain completion (no Encounter) still works and stays the default action', async () => {
    vi.mocked(careTasksApi.complete).mockResolvedValue({
      ...openTask,
      status: 'COMPLETED',
    });

    renderFollowUpPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Hoàn thành' }));
    await waitFor(() => {
      expect(careTasksApi.complete).toHaveBeenCalledWith('task-1', undefined);
    });
  });

  it('explicit Return Encounter completion requires picking an Encounter from the patient Timeline', async () => {
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [],
      ungroupedEncounters: [
        {
          type: 'ENCOUNTER',
          timestamp: '2026-09-10T08:00:00.000Z',
          data: {
            id: 'encounter-return-1',
            reasonForVisit: 'Tái khám sau điều trị (synthetic)',
            occurredAt: '2026-09-10T08:00:00.000Z',
          },
        },
      ],
    });
    vi.mocked(careTasksApi.complete).mockResolvedValue({
      ...openTask,
      status: 'COMPLETED',
      completedByEncounterId: 'encounter-return-1',
    });

    renderFollowUpPage();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: 'Hoàn thành qua lượt tái khám' }),
    );

    const confirmButton = await screen.findByRole('button', { name: 'Xác nhận hoàn thành' });
    expect(confirmButton).toBeDisabled();

    const select = await screen.findByLabelText('Lượt tái khám');
    await user.selectOptions(select, 'encounter-return-1');
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    await waitFor(() => {
      expect(careTasksApi.complete).toHaveBeenCalledWith('task-1', 'encounter-return-1');
    });
  });

  it('generic reschedule updates only CareTask.dueDate via the T5 reschedule API', async () => {
    vi.mocked(careTasksApi.reschedule).mockResolvedValue({
      ...openTask,
      dueDate: '2026-09-20T00:00:00.000Z',
    });

    renderFollowUpPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Dời lịch' }));
    const input = await screen.findByLabelText('Ngày hẹn mới');
    await user.clear(input);
    await user.type(input, '2026-09-20');
    await user.click(screen.getByRole('button', { name: 'Xác nhận dời lịch' }));

    await waitFor(() => {
      expect(careTasksApi.reschedule).toHaveBeenCalledWith('task-1', '2026-09-20');
    });
  });

  it('F4 — a Longo timepoint task (timepointCode set) does not show the generic Return Encounter / reschedule actions', async () => {
    vi.mocked(careTasksApi.list).mockResolvedValue([
      {
        ...openTask,
        id: 'longo-task-1',
        carePlanId: null,
        timepointCode: 'TWO_WEEK',
        sourceEncounterId: 'enc-source-1',
        sourceEpisodeId: 'case-1',
        treatmentPathwayId: 'pathway-1',
      },
    ]);

    renderFollowUpPage();

    await screen.findByRole('link', { name: 'Mở lượt tái khám Longo' });
    expect(
      screen.queryByRole('button', { name: 'Hoàn thành qua lượt tái khám' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dời lịch' })).not.toBeInTheDocument();
    // Cancel (not a completion) remains intact.
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  });

  describe('DEC-016 F2 — Longo timepoint task offers the pathway workflow, not generic completion', () => {
    const longoTask = {
      ...openTask,
      id: 'longo-task-1',
      carePlanId: null,
      timepointCode: 'MONTH_3' as const,
      sourceEncounterId: 'enc-source-1',
      sourceEpisodeId: 'case-1',
      treatmentPathwayId: 'pathway-1',
    };

    it('A — a generic OPEN CareTask keeps the generic "Hoàn thành" action', async () => {
      vi.mocked(careTasksApi.complete).mockResolvedValue({ ...openTask, status: 'COMPLETED' });
      renderFollowUpPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Hoàn thành' }));
      await waitFor(() => {
        expect(careTasksApi.complete).toHaveBeenCalledWith('task-1', undefined);
      });
    });

    it('B — a Longo OPEN timepoint task does NOT render generic "Hoàn thành"', async () => {
      vi.mocked(careTasksApi.list).mockResolvedValue([longoTask]);
      renderFollowUpPage();
      await screen.findByRole('link', { name: 'Mở lượt tái khám Longo' });
      expect(screen.queryByRole('button', { name: 'Hoàn thành' })).not.toBeInTheDocument();
    });

    it('C — the Longo workflow action targets the exact pathway and timepoint', async () => {
      vi.mocked(careTasksApi.list).mockResolvedValue([longoTask]);
      renderFollowUpPage();
      const link = await screen.findByRole('link', { name: 'Mở lượt tái khám Longo' });
      expect(link).toHaveAttribute(
        'href',
        '/patients/patient-1/encounters/new?episodeId=case-1&treatmentPathwayId=pathway-1&timepointCode=MONTH_3',
      );
    });

    it('D — the Longo workflow action never calls generic careTasksApi.complete', async () => {
      vi.mocked(careTasksApi.list).mockResolvedValue([longoTask]);
      renderFollowUpPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('link', { name: 'Mở lượt tái khám Longo' }));
      expect(careTasksApi.complete).not.toHaveBeenCalled();
    });
  });
});
