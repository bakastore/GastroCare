import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LongoEpisodeWorkspace } from '../LongoEpisodeWorkspace';
import {
  careEpisodesApi,
  followUpTasksApi,
  patientsApi,
} from '../../api/resources';

// Correction batch H — focused pure-component Longo regression for
// LongoEpisodeWorkspace. C2/C3/C4 changed this file (shared with the
// already-verified CORE-04 Longo baseline); this proves the Longo card
// keeps its exact wording/controls and that NO Hemorrhoid continuous-care
// label or action leaks into it. The full browser CORE-04 T15 pathway in
// frontend/e2e/gastrocare.spec.ts remains the end-to-end guarantee.
vi.mock('../../api/resources', () => ({
  careEpisodesApi: {
    listByPatient: vi.fn(),
    close: vi.fn(),
    reopen: vi.fn(),
  },
  followUpTasksApi: { listByPatient: vi.fn() },
  patientsApi: { getTimeline: vi.fn() },
}));

const longoEpisode = {
  id: 'longo-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  episodeType: 'LONGO_TREATMENT',
  status: 'ACTIVE' as const,
  startedAt: '2026-01-01T02:00:00.000Z',
  endedAt: null,
  createdAt: '2026-01-01T02:00:00.000Z',
};

const longoEncounterEvent = {
  type: 'ENCOUNTER' as const,
  timestamp: '2026-01-05T08:00:00.000Z',
  data: {
    id: 'longo-enc-1',
    reasonForVisit: 'Khám tiền phẫu Longo (synthetic)',
    occurredAt: '2026-01-05T08:00:00.000Z',
    carePlanId: null,
    carePlanStatus: null,
  },
};

const HEMORRHOID_LEAK_TEXT = [
  'Đợt theo dõi trĩ',
  'Kết thúc đợt theo dõi',
  'Mở lại đợt theo dõi',
  'Đánh giá tái khám',
  'Quyết định điều trị tiếp theo',
  'Bắt đầu tái khám',
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(followUpTasksApi.listByPatient).mockResolvedValue([]);
});

function renderWorkspace() {
  return render(
    <MemoryRouter>
      <LongoEpisodeWorkspace patientId="patient-1" />
    </MemoryRouter>,
  );
}

describe('LongoEpisodeWorkspace — Longo regression (correction batch H)', () => {
  it('ACTIVE LONGO_TREATMENT keeps Longo wording/controls and leaks no Hemorrhoid continuous-care action', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([longoEpisode] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: longoEpisode, events: [longoEncounterEvent] }],
      ungroupedEncounters: [],
    } as never);

    renderWorkspace();

    expect(await screen.findByText(/^Đợt điều trị Longo —/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '+ Lượt khám trong đợt điều trị' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đóng đợt điều trị' })).toBeInTheDocument();
    expect(
      screen.getByText('Hàng đợi tái khám (kế hoạch so với thực tế)'),
    ).toBeInTheDocument();
    // Longo form links render on the episode Encounter.
    for (const label of ['Tiền phẫu', 'Biên bản mổ', 'Hậu phẫu sớm', 'Tái khám 2 tuần', 'Nong hậu môn', 'Tái khám dài hạn']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    for (const leak of HEMORRHOID_LEAK_TEXT) {
      expect(screen.queryByText(leak)).not.toBeInTheDocument();
    }
  });

  it('CLOSED LONGO_TREATMENT reopens with a reason and shows no Hemorrhoid close/reopen wording', async () => {
    const closedLongo = { ...longoEpisode, status: 'CLOSED' as const };
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([closedLongo] as never);
    vi.mocked(patientsApi.getTimeline).mockResolvedValue({
      episodes: [{ episode: closedLongo, events: [longoEncounterEvent] }],
      ungroupedEncounters: [],
    } as never);
    vi.mocked(careEpisodesApi.reopen).mockResolvedValue({} as never);

    renderWorkspace();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Mở lại đợt điều trị' }));
    expect(screen.queryByRole('button', { name: 'Mở lại đợt theo dõi' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Lý do mở lại'), 'Ghi chép bổ sung (synthetic)');
    await user.click(screen.getByRole('button', { name: 'Xác nhận mở lại' }));

    await waitFor(() => {
      expect(careEpisodesApi.reopen).toHaveBeenCalledWith('longo-1', {
        reason: 'Ghi chép bổ sung (synthetic)',
      });
    });
  });
});
