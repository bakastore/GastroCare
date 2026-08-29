import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LongoEpisodeWorkspace } from '../LongoEpisodeWorkspace';
import { careEpisodesApi, followUpTasksApi, patientsApi } from '../../api/resources';

// F2 (ChatGPT T6 review) — an Encounter is 1:1 with CarePlan; once one
// exists (DRAFT or SIGNED) the sequence must offer to view it via
// /care-plans/:id, never re-offer creation. Backed by the Timeline
// projection's carePlanId/carePlanStatus (patients.service.ts), not a new
// API call.
vi.mock('../../api/resources', () => ({
  careEpisodesApi: { listByPatient: vi.fn() },
  followUpTasksApi: { listByPatient: vi.fn() },
  patientsApi: { getTimeline: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([]);
  vi.mocked(followUpTasksApi.listByPatient).mockResolvedValue([]);
});

function encounterEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    type: 'ENCOUNTER' as const,
    timestamp: '2026-09-01T09:00:00.000Z',
    data: {
      id: 'enc-1',
      reasonForVisit: 'Khám trĩ (synthetic)',
      occurredAt: '2026-09-01T09:00:00.000Z',
      carePlanId: null,
      carePlanStatus: null,
      // DEC-015 — these fixtures represent the initial Hemorrhoid workflow
      // (they submit HEMORRHOID_DIAGNOSIS/TREATMENT_DECISION below).
      workflowKind: 'HEMORRHOID_INITIAL',
      ...overrides,
    },
  };
}

function diagnosisDoneEvent() {
  return {
    type: 'CLINICAL_FORM_SUBMITTED' as const,
    timestamp: '2026-09-01T09:05:00.000Z',
    data: {
      id: 'diag-1',
      encounterId: 'enc-1',
      templateKey: 'HEMORRHOID_DIAGNOSIS',
      revisionNumber: 1,
      summary: 'Trĩ nội độ II (synthetic)',
    },
  };
}

function treatmentDoneEvent() {
  return {
    type: 'CLINICAL_FORM_SUBMITTED' as const,
    timestamp: '2026-09-01T09:10:00.000Z',
    data: {
      id: 'treat-1',
      encounterId: 'enc-1',
      templateKey: 'HEMORRHOID_TREATMENT_DECISION',
      revisionNumber: 1,
      summary: 'Điều trị nội khoa (synthetic)',
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

describe('LongoEpisodeWorkspace — F2 CarePlan duplicate-create prevention', () => {
  it('offers "Tạo kế hoạch chăm sóc" once Treatment Decision is done and no CarePlan exists yet', async () => {
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [],
      ungroupedEncounters: [encounterEvent(), diagnosisDoneEvent(), treatmentDoneEvent()],
    });

    renderWorkspace();

    expect(
      await screen.findByRole('link', { name: 'Tạo kế hoạch chăm sóc' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Xem kế hoạch chăm sóc' })).not.toBeInTheDocument();
  });

  it('offers "Xem kế hoạch chăm sóc" instead of create once a DRAFT CarePlan already exists', async () => {
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [],
      ungroupedEncounters: [
        encounterEvent({ carePlanId: 'plan-1', carePlanStatus: 'DRAFT' }),
        diagnosisDoneEvent(),
        treatmentDoneEvent(),
      ],
    });

    renderWorkspace();

    const viewLink = await screen.findByRole('link', { name: 'Xem kế hoạch chăm sóc' });
    expect(viewLink).toHaveAttribute('href', '/care-plans/plan-1');
    expect(screen.queryByRole('link', { name: 'Tạo kế hoạch chăm sóc' })).not.toBeInTheDocument();
  });

  it('offers "Xem kế hoạch chăm sóc" once a SIGNED CarePlan already exists', async () => {
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [],
      ungroupedEncounters: [
        encounterEvent({ carePlanId: 'plan-1', carePlanStatus: 'SIGNED' }),
        diagnosisDoneEvent(),
        treatmentDoneEvent(),
      ],
    });

    renderWorkspace();

    expect(await screen.findByRole('link', { name: 'Xem kế hoạch chăm sóc' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tạo kế hoạch chăm sóc' })).not.toBeInTheDocument();
  });
});
