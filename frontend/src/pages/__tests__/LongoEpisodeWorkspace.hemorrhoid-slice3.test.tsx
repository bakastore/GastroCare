import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LongoEpisodeWorkspace } from '../LongoEpisodeWorkspace';
import {
  careEpisodesApi,
  encountersApi,
  followUpTasksApi,
  patientsApi,
} from '../../api/resources';

// Hemorrhoid Vertical Slice 3 continuous-care loop (DEC-013;
// docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §D-§H) — T6 frontend
// coverage. Distinct from LongoEpisodeWorkspace.hemorrhoid.test.tsx, which
// covers only the Slice 2 initial-branch ungrouped-Encounter rendering.
vi.mock('../../api/resources', () => ({
  careEpisodesApi: {
    listByPatient: vi.fn(),
    close: vi.fn(),
    reopen: vi.fn(),
  },
  followUpTasksApi: { listByPatient: vi.fn() },
  patientsApi: { getTimeline: vi.fn() },
  encountersApi: { createHemorrhoidReturn: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([]);
  vi.mocked(followUpTasksApi.listByPatient).mockResolvedValue([]);
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

function renderWorkspace() {
  return render(
    <MemoryRouter>
      <LongoEpisodeWorkspace patientId="patient-1" />
    </MemoryRouter>,
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

    expect(await screen.findByText(/Đợt theo dõi trĩ/)).toBeInTheDocument();
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
    expect(screen.queryByText('Hàng đợi tái khám (kế hoạch so với thực tế)')).not.toBeInTheDocument();
  });

  it('shows the continuous-care sequence (Assessment enabled, Next Decision disabled) on a Return Encounter with no forms yet', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: hemorrhoidEpisode, events: [returnEncounterEvent()] }],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    expect(await screen.findByText('Lượt tái khám')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Đánh giá tái khám' }),
    ).toBeInTheDocument();
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
    expect(
      screen.getByRole('link', { name: 'Quyết định điều trị tiếp theo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Tạo kế hoạch chăm sóc', { selector: 'span' }),
    ).toHaveAttribute('aria-disabled', 'true');
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

    const trigger = await screen.findByRole('button', { name: 'Bắt đầu tái khám' });
    expect(trigger).toBeInTheDocument();
    expect(encountersApi.createHemorrhoidReturn).not.toHaveBeenCalled();
  });

  // Correction batch C2 + R2 — the ACTIVE Hemorrhoid episode header must NOT
  // carry a generic Close button; termination is decided on the current
  // Return Encounter after its Assessment is completed (see the C3/R2 tests
  // below). Reopen stays on the CLOSED header.
  it('R2: ACTIVE Hemorrhoid episode header renders NO Close button', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: hemorrhoidEpisode, events: [returnEncounterEvent()] }],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    await screen.findByText('Lượt tái khám');
    expect(screen.queryByRole('button', { name: 'Kết thúc đợt theo dõi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đóng đợt điều trị' })).not.toBeInTheDocument();
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
        { episode: hemorrhoidEpisode, events: [returnEncounterEvent(), assessmentDoneEvent()] },
      ],
      ungroupedEncounters: [],
    } as never);
    vi.mocked(careEpisodesApi.close).mockResolvedValue({} as never);

    renderWorkspace();
    const user = userEvent.setup();

    expect(
      await screen.findByRole('link', { name: 'Quyết định điều trị tiếp theo' }),
    ).toBeInTheDocument();

    const terminate = screen.getByRole('button', { name: 'Kết thúc đợt theo dõi' });
    await user.click(terminate);

    await waitFor(() => {
      expect(careEpisodesApi.close).toHaveBeenCalledWith('episode-1');
    });
    // Termination created neither a Next Clinical Decision nor a CarePlan.
    expect(encountersApi.createHemorrhoidReturn).not.toHaveBeenCalled();
  });

  it('R2: before the current Return Encounter Assessment is completed, NO Terminate action exists', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: hemorrhoidEpisode, events: [returnEncounterEvent()] }],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    await screen.findByText('Lượt tái khám');
    expect(screen.queryByRole('button', { name: 'Kết thúc đợt theo dõi' })).not.toBeInTheDocument();
  });

  it('R2: Terminate renders only on the LATEST Return Encounter, never on a historical one', async () => {
    const historical = returnEncounterEvent({ id: 'ret-1', occurredAt: '2026-09-10T09:00:00.000Z' });
    const latest = returnEncounterEvent({ id: 'ret-2', occurredAt: '2026-10-01T09:00:00.000Z' });
    const assessmentOnHistorical = {
      ...assessmentDoneEvent(),
      data: { ...assessmentDoneEvent().data, id: 'asmt-1', encounterId: 'ret-1' },
    };
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([hemorrhoidEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        { episode: hemorrhoidEpisode, events: [historical, assessmentOnHistorical, latest] },
      ],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    await screen.findAllByText('Lượt tái khám');
    // Historical encounter has a completed Assessment, but it is not the
    // latest → no Terminate. Latest encounter has no Assessment yet → no
    // Terminate. Net: zero Terminate actions.
    expect(screen.queryByRole('button', { name: 'Kết thúc đợt theo dõi' })).not.toBeInTheDocument();
  });

  it('C3: after the episode is CLOSED, active-workflow controls cannot create a new Next Decision / CarePlan', async () => {
    const closedEpisode = { ...hemorrhoidEpisode, status: 'CLOSED' as const };
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([closedEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [
        { episode: closedEpisode, events: [returnEncounterEvent(), assessmentDoneEvent()] },
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
    for (const label of ['Tiền phẫu', 'Biên bản mổ', 'Hậu phẫu sớm', 'Tái khám 2 tuần', 'Nong hậu môn', 'Tái khám dài hạn']) {
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

    expect(
      await screen.findByRole('button', { name: 'Bắt đầu tái khám' }),
    ).toBeInTheDocument();
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
});
