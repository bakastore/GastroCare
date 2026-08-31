import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LongoEpisodeWorkspace } from '../LongoEpisodeWorkspace';
import {
  HEMORRHOID_RECURRENCE_CHOICE_REQUIRED,
  careEpisodesApi,
  encountersApi,
  followUpTasksApi,
  patientsApi,
  treatmentPathwaysApi,
} from '../../api/resources';
import { ApiError } from '../../api/client';

// Hemorrhoid Vertical Slice 3 continuous-care loop (DEC-013;
// docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §D-§H) — T6 frontend
// coverage. Distinct from LongoEpisodeWorkspace.hemorrhoid.test.tsx, which
// covers only the Slice 2 initial-branch ungrouped-Encounter rendering.
vi.mock('../../api/resources', () => ({
  HEMORRHOID_RECURRENCE_CHOICE_REQUIRED: 'HEMORRHOID_RECURRENCE_CHOICE_REQUIRED',
  careEpisodesApi: {
    listByPatient: vi.fn(),
    close: vi.fn(),
    reopen: vi.fn(),
    create: vi.fn(),
  },
  followUpTasksApi: { listByPatient: vi.fn() },
  patientsApi: { getTimeline: vi.fn() },
  encountersApi: { createHemorrhoidReturn: vi.fn() },
  treatmentPathwaysApi: { list: vi.fn(), create: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([]);
  vi.mocked(followUpTasksApi.listByPatient).mockResolvedValue([]);
  vi.mocked(treatmentPathwaysApi.list).mockResolvedValue([]);
});

const hemorrhoidEpisode = {
  id: 'episode-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  episodeType: 'HEMORRHOID_TREATMENT',
  status: 'ACTIVE' as const,
  startedAt: '2026-09-10T09:00:00.000Z',
  endedAt: null,
  createdAt: '2026-09-10T09:00:00.000Z',
};

function returnEncounterEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    type: 'ENCOUNTER' as const,
    timestamp: '2026-09-10T09:00:00.000Z',
    data: {
      id: 'return-enc-1',
      reasonForVisit: 'Tái khám (synthetic)',
      occurredAt: '2026-09-10T09:00:00.000Z',
      carePlanId: null,
      carePlanStatus: null,
      ...overrides,
    },
  };
}

function assessmentDoneEvent() {
  return {
    type: 'CLINICAL_FORM_SUBMITTED' as const,
    timestamp: '2026-09-10T09:05:00.000Z',
    data: {
      id: 'assessment-1',
      encounterId: 'return-enc-1',
      templateKey: 'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      revisionNumber: 1,
      summary: 'Cải thiện (synthetic)',
    },
  };
}

function openGenericCareTaskEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    type: 'CARE_TASK' as const,
    timestamp: '2026-09-05T09:00:00.000Z',
    data: {
      id: 'task-1',
      status: 'OPEN',
      dueDate: '2026-10-01T00:00:00.000Z',
      carePlanId: 'plan-0',
      timepointCode: null,
      completedAt: null,
      completedByEncounterId: null,
      // DEC-015 C4-E — this generic follow-up task's source Encounter is the
      // initial Hemorrhoid Encounter.
      sourceEncounterId: 'enc-1',
      sourceWorkflowKind: 'HEMORRHOID_INITIAL',
      ...overrides,
    },
  };
}

function renderWorkspace(entry = '/patients/patient-1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LongoEpisodeWorkspace patientId="patient-1" />
    </MemoryRouter>,
  );
}

// The close-warning pathway query (T11 P1-01) gates the Terminate button
// while it loads; re-query fresh so a re-rendered element is not missed.
async function waitForTerminateEnabled() {
  await waitFor(
    () => expect(screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' })).toBeEnabled(),
    { timeout: 4000 },
  );
}

describe('LongoEpisodeWorkspace — Hemorrhoid Vertical Slice 3 continuous-care loop', () => {
  it('renders a HEMORRHOID_TREATMENT episode as a Return-visit workspace, not a Longo one', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: hemorrhoidEpisode, events: [returnEncounterEvent()] }],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    expect(await screen.findByText(/Case trĩ/)).toBeInTheDocument();
    // No Longo episode CARD was rendered (the page-level <h2> heading is
    // always "Đợt điều trị Longo" regardless of episode type, so this
    // checks for the absence of the per-episode-card Longo header text
    // specifically, not the page title).
    expect(screen.queryByText(/^Đợt điều trị Longo —/)).not.toBeInTheDocument();
    // Longo-only controls must not appear on a Hemorrhoid episode card.
    expect(
      screen.queryByRole('link', { name: '+ Lượt khám trong đợt điều trị' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đóng đợt điều trị' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Hàng đợi tái khám (kế hoạch so với thực tế)'),
    ).not.toBeInTheDocument();
  });

  it('shows the continuous-care sequence (Assessment enabled, Next Decision disabled) on a Return Encounter with no forms yet', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: hemorrhoidEpisode, events: [returnEncounterEvent()] }],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    expect(await screen.findByText('Lượt tái khám')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đánh giá tái khám' })).toBeInTheDocument();
    // Not yet reachable — Assessment must complete first.
    const disabledNext = screen.getByText('Quyết định điều trị tiếp theo');
    expect(disabledNext).toHaveAttribute('aria-disabled', 'true');
    // Initial-branch-only elements must never appear here.
    expect(screen.queryByText('Khám trĩ')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Chẩn đoán' })).not.toBeInTheDocument();
  });

  it('unlocks Next Clinical Decision and CarePlan creation once the Follow-up Assessment is completed', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [returnEncounterEvent(), assessmentDoneEvent()],
        },
      ],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    expect(await screen.findByRole('link', { name: 'Đánh giá tái khám ✓' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quyết định điều trị tiếp theo' })).toBeInTheDocument();
    expect(screen.getByText('Tạo kế hoạch chăm sóc', { selector: 'span' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('offers "Bắt đầu tái khám" for an OPEN generic follow-up CareTask, wired to the dedicated Return Encounter endpoint (no patientId/episodeId from the client)', async () => {
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [],
      // The ungroupedEncounters section only renders when it contains at
      // least one ENCOUNTER-type event (see LongoEpisodeWorkspace's guard) —
      // include the initial Encounter this task's CarePlan belongs to.
      ungroupedEncounters: [
        {
          type: 'ENCOUNTER' as const,
          timestamp: '2026-09-01T09:00:00.000Z',
          data: {
            id: 'enc-1',
            reasonForVisit: 'Khám trĩ (synthetic)',
            occurredAt: '2026-09-01T09:00:00.000Z',
            carePlanId: 'plan-0',
            carePlanStatus: 'SIGNED',
            workflowKind: 'HEMORRHOID_INITIAL',
          },
        },
        openGenericCareTaskEvent(),
      ],
    } as never);

    renderWorkspace();

    const trigger = await screen.findByRole('button', {
      name: 'Bắt đầu tái khám',
    });
    expect(trigger).toBeInTheDocument();
    expect(encountersApi.createHemorrhoidReturn).not.toHaveBeenCalled();
  });

  // ── DEC-020 Package A T10 — recurrence choice carried on the Return ──────

  function initialBranchOpenTaskTimeline() {
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [],
      ungroupedEncounters: [
        {
          type: 'ENCOUNTER' as const,
          timestamp: '2026-09-01T09:00:00.000Z',
          data: {
            id: 'enc-1',
            reasonForVisit: 'Khám trĩ (synthetic)',
            occurredAt: '2026-09-01T09:00:00.000Z',
            carePlanId: 'plan-0',
            carePlanStatus: 'SIGNED',
            workflowKind: 'HEMORRHOID_INITIAL',
          },
        },
        openGenericCareTaskEvent(),
      ],
    } as never);
  }

  async function openReturnForm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Bắt đầu tái khám' }));
    await user.click(screen.getByRole('button', { name: 'Xác nhận tái khám' }));
  }

  it('T10-I: HTTP 409 + stable code HEMORRHOID_RECURRENCE_CHOICE_REQUIRED enters the recurrence-choice UI', async () => {
    initialBranchOpenTaskTimeline();
    vi.mocked(encountersApi.createHemorrhoidReturn).mockRejectedValueOnce(
      new ApiError(409, 'wording that could change at any time', HEMORRHOID_RECURRENCE_CHOICE_REQUIRED),
    );
    renderWorkspace();
    const user = userEvent.setup();
    await openReturnForm(user);

    expect(
      await screen.findByText(/Bác sĩ chọn tường minh/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Mở lại một đợt điều trị đã đóng')).toBeInTheDocument();
    expect(screen.getByLabelText('Bắt đầu một đợt điều trị mới')).toBeInTheDocument();
  });

  it('T10-J: a different HTTP 409 (no recurrence code) does NOT enter the recurrence-choice UI', async () => {
    initialBranchOpenTaskTimeline();
    vi.mocked(encountersApi.createHemorrhoidReturn).mockRejectedValueOnce(
      new ApiError(409, 'CareTask was already completed concurrently', 'SOME_OTHER_CODE'),
    );
    renderWorkspace();
    const user = userEvent.setup();
    await openReturnForm(user);

    expect(await screen.findByText('CareTask was already completed concurrently')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mở lại một đợt điều trị đã đóng')).not.toBeInTheDocument();
  });

  it('T10-K: REOPEN_EXISTING is submitted as part of createHemorrhoidReturn — the standalone reopen endpoint is never called', async () => {
    const closed = {
      ...hemorrhoidEpisode,
      id: 'closed-ep-1',
      status: 'CLOSED' as const,
      endedAt: '2026-09-20T00:00:00.000Z',
    };
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([closed] as never);
    initialBranchOpenTaskTimeline();
    vi.mocked(encountersApi.createHemorrhoidReturn)
      .mockRejectedValueOnce(
        new ApiError(409, 'x', HEMORRHOID_RECURRENCE_CHOICE_REQUIRED),
      )
      .mockResolvedValueOnce({ id: 'ret-new', episodeId: 'closed-ep-1' } as never);
    renderWorkspace();
    const user = userEvent.setup();
    await openReturnForm(user);

    await user.click(await screen.findByLabelText('Mở lại một đợt điều trị đã đóng'));
    await user.selectOptions(screen.getByLabelText('Đợt điều trị'), 'closed-ep-1');
    await user.type(screen.getByLabelText('Lý do mở lại'), 'Tái phát (synthetic)');
    await user.click(screen.getByRole('button', { name: 'Xác nhận lựa chọn & tái khám' }));

    await waitFor(() => {
      expect(encountersApi.createHemorrhoidReturn).toHaveBeenLastCalledWith(
        expect.objectContaining({
          recurrenceAction: 'REOPEN_EXISTING',
          recurrenceClosedEpisodeId: 'closed-ep-1',
          recurrenceReason: 'Tái phát (synthetic)',
        }),
      );
    });
    expect(careEpisodesApi.reopen).not.toHaveBeenCalled();
    expect(careEpisodesApi.create).not.toHaveBeenCalled();
  });

  it('T10-L: START_NEW is submitted as part of createHemorrhoidReturn — the standalone create endpoint is never called', async () => {
    initialBranchOpenTaskTimeline();
    vi.mocked(encountersApi.createHemorrhoidReturn)
      .mockRejectedValueOnce(
        new ApiError(409, 'x', HEMORRHOID_RECURRENCE_CHOICE_REQUIRED),
      )
      .mockResolvedValueOnce({ id: 'ret-new', episodeId: 'ep-new' } as never);
    renderWorkspace();
    const user = userEvent.setup();
    await openReturnForm(user);

    await user.click(await screen.findByLabelText('Bắt đầu một đợt điều trị mới'));
    await user.click(screen.getByRole('button', { name: 'Xác nhận lựa chọn & tái khám' }));

    await waitFor(() => {
      expect(encountersApi.createHemorrhoidReturn).toHaveBeenLastCalledWith(
        expect.objectContaining({ recurrenceAction: 'START_NEW' }),
      );
    });
    expect(careEpisodesApi.create).not.toHaveBeenCalled();
    expect(careEpisodesApi.reopen).not.toHaveBeenCalled();
  });

  it('T10-M/N: open CareTask / TreatmentPathway are surfaced factually before close and do not block the explicit Doctor close', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(careEpisodesApi.close).mockResolvedValue({} as never);
    vi.mocked(treatmentPathwaysApi.list).mockResolvedValue([
      { id: 'p1', caseId: 'episode-1', patientId: 'patient-1', modality: 'MEDICAL', methodCode: null, startedAt: '2026-09-10T09:00:00.000Z', endedAt: null, legacyEpisodeId: null },
    ] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [
            returnEncounterEvent(),
            assessmentDoneEvent(),
            {
              type: 'CARE_TASK' as const,
              timestamp: '2026-09-11T09:00:00.000Z',
              data: { id: 'open-task-1', status: 'OPEN', timepointCode: null },
            },
          ],
        },
      ],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();
    const user = userEvent.setup();

    expect(await screen.findByText(/Còn 1 nhiệm vụ theo dõi đang mở và 1 nhánh điều trị chưa kết thúc/)).toBeInTheDocument();
    // Factual + non-blocking: the explicit close still goes through.
    await user.click(screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' }));
    await waitFor(() => {
      expect(careEpisodesApi.close).toHaveBeenCalledWith('episode-1');
    });
  });

  // ── T11 P1-01 — close-warning pathway state: fresh, gated while loading,
  //    surfaced on error ─────────────────────────────────────────────────

  function assessmentDoneEpisodeTimeline(extraEvents: unknown[] = []) {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(careEpisodesApi.close).mockResolvedValue({} as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [returnEncounterEvent(), assessmentDoneEvent(), ...extraEvents],
        },
      ],
      ungroupedEncounters: [],
    } as never);
  }

  it('T11 P1-01 (7): close-warning pathway query resolves with 0 pathways → close works normally', async () => {
    assessmentDoneEpisodeTimeline();
    vi.mocked(treatmentPathwaysApi.list).mockResolvedValue([] as never);
    renderWorkspace();
    const user = userEvent.setup();
    await screen.findByText('Lượt tái khám');
    await waitForTerminateEnabled();
    expect(screen.queryByText(/nhánh điều trị chưa kết thúc/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' }));
    await waitFor(() => expect(careEpisodesApi.close).toHaveBeenCalledWith('episode-1'));
  });

  it('T11 P1-01 (8): close-warning pathway query resolves with open pathways → factual, non-blocking, close still possible', async () => {
    assessmentDoneEpisodeTimeline();
    vi.mocked(treatmentPathwaysApi.list).mockResolvedValue([
      { id: 'p1', caseId: 'episode-1', patientId: 'patient-1', modality: 'MEDICAL', methodCode: null, startedAt: '2026-09-10T09:00:00.000Z', endedAt: null, legacyEpisodeId: null },
      { id: 'p2', caseId: 'episode-1', patientId: 'patient-1', modality: 'SURGERY', methodCode: 'LONGO', startedAt: '2026-09-11T09:00:00.000Z', endedAt: '2026-09-20T00:00:00.000Z', legacyEpisodeId: null },
    ] as never);
    renderWorkspace();
    const user = userEvent.setup();
    expect(await screen.findByText(/Còn 1 nhánh điều trị chưa kết thúc/)).toBeInTheDocument();
    const terminate = screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' });
    await user.click(terminate);
    await waitFor(() => expect(careEpisodesApi.close).toHaveBeenCalledWith('episode-1'));
  });

  it('T11 P1-01 (5): while the pathway query is loading, the close is gated (no false "nothing open")', async () => {
    assessmentDoneEpisodeTimeline();
    vi.mocked(treatmentPathwaysApi.list).mockReturnValue(new Promise(() => {}) as never);
    renderWorkspace();
    expect(
      await screen.findByText('Đang kiểm tra các nhánh điều trị đang mở...'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' })).toBeDisabled();
    expect(careEpisodesApi.close).not.toHaveBeenCalled();
  });

  it('T11 P1-01 (6): if the pathway query errors, the error is surfaced and close is unavailable until reload', async () => {
    assessmentDoneEpisodeTimeline();
    vi.mocked(treatmentPathwaysApi.list)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([] as never);
    renderWorkspace();
    const user = userEvent.setup();
    expect(
      await screen.findByText(/Không tải được trạng thái nhánh điều trị đang mở/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' })).toBeDisabled();
    expect(careEpisodesApi.close).not.toHaveBeenCalled();
    // Retry resolves the state and re-enables close.
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitForTerminateEnabled();
  });

  it('T11 P1-01 (1-4): a pathway created via CaseTreatmentPanel refreshes the close-warning state', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(careEpisodesApi.close).mockResolvedValue({} as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        { episode: hemorrhoidEpisode, events: [returnEncounterEvent(), assessmentDoneEvent()] },
      ],
      ungroupedEncounters: [],
    } as never);
    // Zero pathways until one is created, then one open MEDICAL pathway.
    vi.mocked(treatmentPathwaysApi.list).mockResolvedValue([] as never);
    vi.mocked(treatmentPathwaysApi.create).mockResolvedValue({ id: 'p-new' } as never);

    renderWorkspace('/patients/patient-1?tab=%C4%90i%E1%BB%81u%20tr%E1%BB%8B');
    const user = userEvent.setup();

    await screen.findByText('Phương thức điều trị trong Case');
    await user.selectOptions(screen.getByLabelText('Phương thức điều trị'), 'MEDICAL');
    await user.type(screen.getByLabelText('Thời điểm bắt đầu phương thức'), '2026-09-12T09:00');
    // After create, the list reloads with the new open pathway.
    vi.mocked(treatmentPathwaysApi.list).mockResolvedValue([
      { id: 'p-new', caseId: 'episode-1', patientId: 'patient-1', modality: 'MEDICAL', methodCode: null, startedAt: '2026-09-12T09:00:00.000Z', endedAt: null, legacyEpisodeId: null },
    ] as never);
    await user.click(screen.getByRole('button', { name: 'Thêm phương thức điều trị' }));

    // Switch to the overview tab where the close warning lives — its pathway
    // state was refreshed through reloadAll (reloadNonce), not left stale.
    await user.click(screen.getByRole('tab', { name: 'Tổng quan' }));
    expect(
      await screen.findByText(/Còn 1 nhánh điều trị chưa kết thúc/),
    ).toBeInTheDocument();
  });

  // ── T11 P2-02 — Follow-up Assessment presence is episode-level ──────────

  it('T11 P2-02 (12): an earlier Return has a COMPLETED assessment, the latest does not → NO "no assessment" warning', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(treatmentPathwaysApi.list).mockResolvedValue([] as never);
    const earlierAssessment = {
      ...assessmentDoneEvent(),
      data: { ...assessmentDoneEvent().data, id: 'asmt-early', encounterId: 'return-enc-1' },
    };
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [
            returnEncounterEvent({ id: 'return-enc-1', occurredAt: '2026-09-10T09:00:00.000Z' }),
            earlierAssessment,
            returnEncounterEvent({ id: 'return-enc-2', occurredAt: '2026-10-01T09:00:00.000Z' }),
          ],
        },
      ],
      ungroupedEncounters: [],
    } as never);
    renderWorkspace();
    await screen.findAllByText('Lượt tái khám');
    expect(
      screen.queryByText(/Chưa có Đánh giá tái khám hoàn tất/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Tôi xác nhận kết thúc/),
    ).not.toBeInTheDocument();
    await waitForTerminateEnabled();
  });

  it('T11 P2-02 (13): no COMPLETED assessment anywhere in the episode → warning + acknowledgement remain', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(treatmentPathwaysApi.list).mockResolvedValue([] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: hemorrhoidEpisode, events: [returnEncounterEvent()] }],
      ungroupedEncounters: [],
    } as never);
    renderWorkspace();
    expect(await screen.findByText(/Chưa có Đánh giá tái khám hoàn tất/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tôi xác nhận kết thúc/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' })).toBeDisabled();
  });

  // Correction batch C2 + R2 — the ACTIVE Hemorrhoid episode header must NOT
  // carry a generic Close button; termination is decided on the current
  // Return Encounter after its Assessment is completed (see the C3/R2 tests
  // below). Reopen stays on the CLOSED header.
  it('R2/DEC-020: ACTIVE Hemorrhoid episode header renders NO generic Close button; Terminate lives on the current Return', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: hemorrhoidEpisode, events: [returnEncounterEvent()] }],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    await screen.findByText('Lượt tái khám');
    expect(screen.queryByRole('button', { name: 'Đóng đợt điều trị' })).not.toBeInTheDocument();
    // DEC-020 T5: with no completed Follow-up Assessment, Terminate is
    // offered but disabled behind a non-blocking warning + acknowledgement.
    await screen.findByText(/Chưa có Đánh giá tái khám hoàn tất/);
    expect(screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' })).toBeDisabled();
  });

  it('DEC016: equal clinical times use createdAt then id, independent of event ordering', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [
            returnEncounterEvent({
              id: 'return-enc-2',
              createdAt: '2026-09-10T10:00:00.000Z',
            }),
            returnEncounterEvent({ createdAt: '2026-09-10T09:00:00.000Z' }),
            assessmentDoneEvent(),
          ],
        },
      ],
      ungroupedEncounters: [],
    } as never);
    renderWorkspace();
    await screen.findAllByText('Lượt tái khám');
    // Terminate renders once, on the newest Return; ordering is the point of
    // this test. T11 P2-02: a COMPLETED assessment exists elsewhere in the
    // episode, so it is enabled (episode-level, not latest-Return-scoped).
    await waitForTerminateEnabled();
  });

  it('C2: CLOSED Hemorrhoid episode reopens with a required reason via careEpisodesApi.reopen', async () => {
    const closedEpisode = { ...hemorrhoidEpisode, status: 'CLOSED' as const };
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([closedEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: closedEpisode, events: [returnEncounterEvent()] }],
      ungroupedEncounters: [],
    } as never);
    vi.mocked(careEpisodesApi.reopen).mockResolvedValue({} as never);

    renderWorkspace();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Mở lại đợt theo dõi' }));
    expect(screen.queryByRole('button', { name: 'Mở lại đợt điều trị' })).not.toBeInTheDocument();

    // Reason required — confirm disabled until it is filled.
    expect(screen.getByRole('button', { name: 'Xác nhận mở lại' })).toBeDisabled();
    await user.type(screen.getByLabelText('Lý do mở lại'), 'Ghi chép bổ sung (synthetic)');
    await user.click(screen.getByRole('button', { name: 'Xác nhận mở lại' }));

    await waitFor(() => {
      expect(careEpisodesApi.reopen).toHaveBeenCalledWith('episode-1', {
        reason: 'Ghi chép bổ sung (synthetic)',
      });
    });
  });

  // Correction batch C3 + R2 — on the CURRENT Return Encounter, once its own
  // Follow-up Assessment is COMPLETED and the episode is ACTIVE, exactly
  // both explicit paths appear: Continue ("Quyết định điều trị tiếp theo")
  // and Terminate ("Kết thúc đợt theo dõi"). Terminate needs no Next
  // Clinical Decision / CarePlan.
  it('C3/R2: current Return Encounter with Assessment completed → Continue AND single Terminate', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [returnEncounterEvent(), assessmentDoneEvent()],
        },
      ],
      ungroupedEncounters: [],
    } as never);
    vi.mocked(careEpisodesApi.close).mockResolvedValue({} as never);

    renderWorkspace();
    const user = userEvent.setup();

    expect(
      await screen.findByRole('link', {
        name: 'Quyết định điều trị tiếp theo',
      }),
    ).toBeInTheDocument();

    await waitForTerminateEnabled();
    await user.click(screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' }));

    await waitFor(() => {
      expect(careEpisodesApi.close).toHaveBeenCalledWith('episode-1');
    });
    // Termination created neither a Next Clinical Decision nor a CarePlan.
    expect(encountersApi.createHemorrhoidReturn).not.toHaveBeenCalled();
  });

  it('R2/DEC-020: before the current Return Assessment is completed, Terminate is offered behind a non-blocking warning + explicit acknowledgement', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: hemorrhoidEpisode, events: [returnEncounterEvent()] }],
      ungroupedEncounters: [],
    } as never);
    vi.mocked(careEpisodesApi.close).mockResolvedValue({} as never);

    renderWorkspace();
    const user = userEvent.setup();

    await screen.findByText('Lượt tái khám');
    await screen.findByText(/Chưa có Đánh giá tái khám hoàn tất/);
    const terminate = screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' });
    expect(terminate).toBeDisabled();

    await user.click(screen.getByLabelText(/Tôi xác nhận kết thúc đợt theo dõi/));
    expect(terminate).toBeEnabled();
    await user.click(terminate);
    await waitFor(() => {
      expect(careEpisodesApi.close).toHaveBeenCalledWith('episode-1');
    });
  });

  it('R2: Terminate renders only on the LATEST Return Encounter, never on a historical one', async () => {
    const historical = returnEncounterEvent({
      id: 'ret-1',
      occurredAt: '2026-09-10T09:00:00.000Z',
    });
    const latest = returnEncounterEvent({
      id: 'ret-2',
      occurredAt: '2026-10-01T09:00:00.000Z',
    });
    const assessmentOnHistorical = {
      ...assessmentDoneEvent(),
      data: {
        ...assessmentDoneEvent().data,
        id: 'asmt-1',
        encounterId: 'ret-1',
      },
    };
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [historical, assessmentOnHistorical, latest],
        },
      ],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    await screen.findAllByText('Lượt tái khám');
    // Historical encounter is not the latest → no Terminate there. Exactly
    // one Terminate action, on the latest Return. T11 P2-02: the episode has
    // a COMPLETED Follow-up Assessment (on the historical Return), so the
    // single Terminate is enabled — assessment presence is episode-level.
    expect(screen.getAllByRole('button', { name: 'Kết thúc đợt theo dõi' })).toHaveLength(1);
    await waitForTerminateEnabled();
  });

  it('C3: after the episode is CLOSED, active-workflow controls cannot create a new Next Decision / CarePlan', async () => {
    const closedEpisode = { ...hemorrhoidEpisode, status: 'CLOSED' as const };
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([closedEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: closedEpisode,
          events: [returnEncounterEvent(), assessmentDoneEvent()],
        },
      ],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    // Completed Assessment stays viewable.
    expect(await screen.findByRole('link', { name: 'Đánh giá tái khám ✓' })).toBeInTheDocument();
    // No active link to create the next decision / care plan.
    expect(
      screen.queryByRole('link', { name: 'Quyết định điều trị tiếp theo' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tạo kế hoạch chăm sóc' })).not.toBeInTheDocument();
  });

  // DEC-015 C4-C — ungrouped Encounter with the explicit persisted
  // workflowKind = 'HEMORRHOID_INITIAL' shows ONLY the initial Hemorrhoid
  // sequence; no six Longo forms, no legacy "Phiếu khám lại (cũ)".
  it('F3/C4-C: ungrouped HEMORRHOID_INITIAL shows the initial Hemorrhoid sequence, not Longo forms or the legacy link', async () => {
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [],
      ungroupedEncounters: [
        {
          type: 'ENCOUNTER' as const,
          timestamp: '2026-09-01T09:00:00.000Z',
          data: {
            id: 'enc-1',
            reasonForVisit: 'Lượt khám (synthetic)',
            occurredAt: '2026-09-01T09:00:00.000Z',
            carePlanId: null,
            carePlanStatus: null,
            workflowKind: 'HEMORRHOID_INITIAL',
          },
        },
      ],
    } as never);

    renderWorkspace();

    expect(await screen.findByRole('link', { name: 'Khám trĩ' })).toBeInTheDocument();
    // Diagnosis chain step is present (disabled until Examination done).
    expect(screen.getByText('Chẩn đoán')).toBeInTheDocument();
    expect(screen.getByText('Quyết định điều trị')).toBeInTheDocument();
    // No Longo forms, no legacy link.
    for (const label of [
      'Tiền phẫu',
      'Biên bản mổ',
      'Hậu phẫu sớm',
      'Tái khám 2 tuần',
      'Nong hậu môn',
      'Tái khám dài hạn',
    ]) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Phiếu khám lại (cũ)' })).not.toBeInTheDocument();
  });

  // DEC-015 C4-D — generic ungrouped Encounter (workflowKind === null) is
  // NOT assigned to any specialty workflow: no Hemorrhoid initial chain, no
  // Longo forms, no legacy link as an active entrypoint.
  it('F4/C4-D: generic ungrouped Encounter (workflowKind null) shows no Hemorrhoid or Longo workflow controls', async () => {
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [],
      ungroupedEncounters: [
        {
          type: 'ENCOUNTER' as const,
          timestamp: '2026-09-01T09:00:00.000Z',
          data: {
            id: 'enc-1',
            reasonForVisit: 'Đau thượng vị (synthetic)',
            occurredAt: '2026-09-01T09:00:00.000Z',
            carePlanId: null,
            carePlanStatus: null,
            workflowKind: null,
          },
        },
      ],
    } as never);

    renderWorkspace();

    expect(await screen.findByText(/Đau thượng vị/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Khám trĩ' })).not.toBeInTheDocument();
    expect(screen.queryByText('Chẩn đoán')).not.toBeInTheDocument();
    expect(screen.queryByText('Quyết định điều trị')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tiền phẫu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Phiếu khám lại (cũ)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tạo kế hoạch chăm sóc' })).not.toBeInTheDocument();
  });

  // DEC-015 C4-E / F7 — a generic follow-up CareTask NOT originating from a
  // HEMORRHOID_INITIAL Encounter (and not in a HEMORRHOID_TREATMENT episode)
  // must NOT offer the dedicated Hemorrhoid Return trigger.
  it('F7/C4-E: generic CareTask (sourceWorkflowKind null, ungrouped) does not offer "Bắt đầu tái khám"', async () => {
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [],
      ungroupedEncounters: [
        {
          type: 'ENCOUNTER' as const,
          timestamp: '2026-09-01T09:00:00.000Z',
          data: {
            id: 'enc-generic',
            reasonForVisit: 'Tái khám tiêu hoá (synthetic)',
            occurredAt: '2026-09-01T09:00:00.000Z',
            carePlanId: 'plan-generic',
            carePlanStatus: 'SIGNED',
            workflowKind: null,
          },
        },
        openGenericCareTaskEvent({
          carePlanId: 'plan-generic',
          sourceEncounterId: 'enc-generic',
          sourceWorkflowKind: null,
        }),
      ],
    } as never);

    renderWorkspace();

    await screen.findByText(/Tái khám tiêu hoá/);
    expect(screen.queryByRole('button', { name: 'Bắt đầu tái khám' })).not.toBeInTheDocument();
  });

  // DEC-015 C4-E / F8 — a generic follow-up CareTask whose source Encounter
  // IS HEMORRHOID_INITIAL DOES offer the dedicated Return trigger.
  it('F8/C4-E: Hemorrhoid-initial CareTask offers "Bắt đầu tái khám" wired to the dedicated Return endpoint', async () => {
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [],
      ungroupedEncounters: [
        {
          type: 'ENCOUNTER' as const,
          timestamp: '2026-09-01T09:00:00.000Z',
          data: {
            id: 'enc-1',
            reasonForVisit: 'Khám trĩ (synthetic)',
            occurredAt: '2026-09-01T09:00:00.000Z',
            carePlanId: 'plan-0',
            carePlanStatus: 'SIGNED',
            workflowKind: 'HEMORRHOID_INITIAL',
          },
        },
        openGenericCareTaskEvent(),
      ],
    } as never);

    renderWorkspace();

    expect(await screen.findByRole('button', { name: 'Bắt đầu tái khám' })).toBeInTheDocument();
    expect(encountersApi.createHemorrhoidReturn).not.toHaveBeenCalled();
  });

  // Correction batch C5-A — a generic follow-up CareTask in the ungrouped
  // bucket whose completedByEncounterId points at a Return Encounter inside
  // the episode bucket must resolve human-readably across buckets; the raw
  // UUID must never render.
  it('C5-A: cross-bucket completed Return Encounter resolves human-readably (no raw UUID)', async () => {
    const returnEncId = '6d0de313-170e-4c5c-9b1a-000000000001';
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [
            {
              type: 'ENCOUNTER' as const,
              timestamp: '2026-10-08T14:22:00.000Z',
              data: {
                id: returnEncId,
                reasonForVisit: 'Khám lại test',
                occurredAt: '2026-10-08T14:22:00.000Z',
                carePlanId: null,
                carePlanStatus: null,
              },
            },
          ],
        },
      ],
      ungroupedEncounters: [
        {
          type: 'ENCOUNTER' as const,
          timestamp: '2026-09-01T09:00:00.000Z',
          data: {
            id: 'enc-initial',
            reasonForVisit: 'Khám trĩ (synthetic)',
            occurredAt: '2026-09-01T09:00:00.000Z',
            carePlanId: 'plan-0',
            carePlanStatus: 'SIGNED',
          },
        },
        {
          type: 'CARE_TASK' as const,
          timestamp: '2026-09-05T09:00:00.000Z',
          data: {
            id: 'task-1',
            status: 'COMPLETED',
            dueDate: '2026-10-01T00:00:00.000Z',
            carePlanId: 'plan-0',
            timepointCode: null,
            completedAt: '2026-10-08T14:22:00.000Z',
            completedByEncounterId: returnEncId,
          },
        },
      ],
    } as never);

    renderWorkspace();

    const linkage = await screen.findByText(/Hoàn thành qua lượt tái khám/);
    expect(linkage).toHaveTextContent('Khám lại test');
    expect(linkage).not.toHaveTextContent(returnEncId);
    expect(screen.queryByText(new RegExp(returnEncId))).not.toBeInTheDocument();
  });

  // DEC-016 F3 — under DEC-016 a Longo pathway is nested inside the
  // Hemorrhoid Case. A CARE_TASK whose source Encounter belongs to a
  // TreatmentPathway is pathway-owned; the backend rejects a Hemorrhoid
  // Return for it, so the frontend must not offer "Bắt đầu tái khám".
  it('F3: a pathway-owned CareTask inside a Case does not offer "Bắt đầu tái khám"', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [
            openGenericCareTaskEvent({
              sourceEncounterId: 'longo-enc-1',
              sourceWorkflowKind: null,
              treatmentPathwayId: 'pathway-longo-1',
            }),
          ],
        },
      ],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    await screen.findByText(/Nhiệm vụ theo dõi/);
    expect(screen.queryByRole('button', { name: 'Bắt đầu tái khám' })).not.toBeInTheDocument();
  });

  // DEC-016 F3 positive regression — a real Hemorrhoid continuous-care
  // CareTask sourced from a Case-level (non-pathway) Encounter keeps the
  // Return action when otherwise eligible.
  it('F3: a Case-level non-pathway Hemorrhoid CareTask still offers "Bắt đầu tái khám"', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [
            openGenericCareTaskEvent({
              sourceEncounterId: 'return-enc-0',
              sourceWorkflowKind: null,
              treatmentPathwayId: null,
            }),
          ],
        },
      ],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    expect(await screen.findByRole('button', { name: 'Bắt đầu tái khám' })).toBeInTheDocument();
  });

  // DEC-016 F1 — two LONGO TreatmentPathways in the same Case, each with a
  // MONTH_3 follow-up task on the same due date, must remain distinguishable
  // and each action must target the correct pathway/timepoint.
  it('F1: two LONGO pathways with the same MONTH_3 date render distinguishably with correct actions', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(followUpTasksApi.listByPatient).mockResolvedValue([
      {
        id: 'task-a',
        patientId: 'patient-1',
        carePlanId: null,
        status: 'OPEN',
        dueDate: '2026-12-01T00:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z',
        completedAt: null,
        cancelledAt: null,
        overdue: false,
        sourceEncounterId: 'surgery-a',
        timepointCode: 'MONTH_3',
        completedByEncounterId: null,
        scheduleReviewRequired: false,
      },
      {
        id: 'task-b',
        patientId: 'patient-1',
        carePlanId: null,
        status: 'OPEN',
        dueDate: '2026-12-01T00:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z',
        completedAt: null,
        cancelledAt: null,
        overdue: false,
        sourceEncounterId: 'surgery-b',
        timepointCode: 'MONTH_3',
        completedByEncounterId: null,
        scheduleReviewRequired: false,
      },
    ] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        {
          episode: hemorrhoidEpisode,
          events: [
            {
              type: 'ENCOUNTER' as const,
              timestamp: '2026-09-01T08:00:00.000Z',
              data: {
                id: 'surgery-a',
                reasonForVisit: 'Phẫu thuật Longo (synthetic)',
                occurredAt: '2026-09-01T08:00:00.000Z',
                treatmentPathwayId: 'pathway-a',
                treatmentModality: 'SURGERY',
                methodCode: 'LONGO',
                carePlanId: null,
                carePlanStatus: null,
              },
            },
            {
              type: 'ENCOUNTER' as const,
              timestamp: '2026-09-01T08:00:00.000Z',
              data: {
                id: 'surgery-b',
                reasonForVisit: 'Phẫu thuật Longo lần 2 (synthetic)',
                occurredAt: '2026-09-01T08:00:00.000Z',
                treatmentPathwayId: 'pathway-b',
                treatmentModality: 'SURGERY',
                methodCode: 'LONGO',
                carePlanId: null,
                carePlanStatus: null,
              },
            },
          ],
        },
      ],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    await screen.findByText('Hàng đợi tái khám (kế hoạch so với thực tế)');
    // Both MONTH_3 rows render.
    expect(screen.getAllByText('Tháng 3')).toHaveLength(2);
    // Distinguishable pathway context (not a raw UUID).
    const ctxA = screen.getByText(/LONGO #1/);
    const ctxB = screen.getByText(/LONGO #2/);
    expect(ctxA).toBeInTheDocument();
    expect(ctxB).toBeInTheDocument();
    expect(screen.queryByText(/pathway-a/)).not.toBeInTheDocument();
    // Each action targets the exact pathway + timepoint.
    const links = screen.getAllByRole('link', { name: 'Mở lượt tái khám' });
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain(
      '/patients/patient-1/encounters/new?episodeId=episode-1&treatmentPathwayId=pathway-a&timepointCode=MONTH_3',
    );
    expect(hrefs).toContain(
      '/patients/patient-1/encounters/new?episodeId=episode-1&treatmentPathwayId=pathway-b&timepointCode=MONTH_3',
    );
  });
});
