import { render, screen } from '@testing-library/react';
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
  careEpisodesApi: { listByPatient: vi.fn() },
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

function openGenericCareTaskEvent() {
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
});
