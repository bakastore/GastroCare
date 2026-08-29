import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TreatmentCasesPage } from '../TreatmentCasesPage';
import { careEpisodesApi, careTasksApi, patientsApi } from '../../api/resources';

vi.mock('../../api/resources', () => ({
  patientsApi: { list: vi.fn() },
  careEpisodesApi: { listByPatient: vi.fn() },
  careTasksApi: { list: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(patientsApi.list).mockResolvedValue([
    { id: 'p1', fullName: 'BN Một' },
    { id: 'p2', fullName: 'BN Hai' },
  ] as never);
  vi.mocked(careEpisodesApi.listByPatient).mockImplementation((id: string) =>
    Promise.resolve(
      id === 'p1'
        ? ([
            {
              id: 'e1',
              patientId: 'p1',
              episodeType: 'HEMORRHOID_TREATMENT',
              status: 'ACTIVE',
              startedAt: '2026-08-10T00:00:00.000Z',
              endedAt: null,
              createdAt: '2026-08-10T00:00:00.000Z',
            },
          ] as never)
        : ([
            {
              id: 'e2',
              patientId: 'p2',
              episodeType: 'HEMORRHOID_TREATMENT',
              status: 'CLOSED',
              startedAt: '2026-06-01T00:00:00.000Z',
              endedAt: '2026-07-01T00:00:00.000Z',
              createdAt: '2026-06-01T00:00:00.000Z',
            },
          ] as never),
    ),
  );
  vi.mocked(careTasksApi.list).mockResolvedValue([
    {
      id: 't1',
      patientId: 'p1',
      status: 'OPEN',
      dueDate: '2026-09-15T00:00:00.000Z',
      sourceEpisodeId: 'e1',
      timepointCode: 'MONTH_1',
    },
  ] as never);
});

function renderPage() {
  return render(
    <MemoryRouter>
      <TreatmentCasesPage />
    </MemoryRouter>,
  );
}

describe('TreatmentCasesPage — Đợt điều trị', () => {
  it('defaults to "Đang điều trị" and shows only the active case with real fields', async () => {
    renderPage();
    const row = await screen.findByRole('row', { name: /BN Một/ });
    expect(within(row).getByText('Điều trị trĩ')).toBeInTheDocument();
    expect(within(row).getByText('Đang điều trị')).toBeInTheDocument();
    // start date + a next-follow-up date (derived from the tenant-wide
    // care-tasks list) — two date cells, not one.
    expect(within(row).getAllByText(/\d{1,2}\/\d{1,2}\/2026/)).toHaveLength(2);
    expect(within(row).getByRole('link', { name: 'Mở đợt điều trị' })).toHaveAttribute(
      'href',
      '/patients/p1',
    );
    expect(screen.queryByRole('row', { name: /BN Hai/ })).toBeNull();
  });

  it('"Đã kết thúc" filter shows the closed case only', async () => {
    renderPage();
    await screen.findByRole('row', { name: /BN Một/ });
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Đã kết thúc' }));
    expect(await screen.findByRole('row', { name: /BN Hai/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /BN Một/ })).toBeNull();
  });

  it('"Tất cả" shows both', async () => {
    renderPage();
    await screen.findByRole('row', { name: /BN Một/ });
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Tất cả' }));
    expect(await screen.findByRole('row', { name: /BN Hai/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /BN Một/ })).toBeInTheDocument();
  });
});
