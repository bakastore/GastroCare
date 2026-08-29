import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PatientDetailPage } from '../PatientDetailPage';
import * as AuthContextModule from '../../auth/AuthContext';
import {
  careEpisodesApi,
  followUpTasksApi,
  patientsApi,
} from '../../api/resources';

vi.mock('../../api/resources', () => ({
  patientsApi: { getById: vi.fn(), getTimeline: vi.fn() },
  careEpisodesApi: { listByPatient: vi.fn(), close: vi.fn(), reopen: vi.fn() },
  followUpTasksApi: { listByPatient: vi.fn() },
  encountersApi: {},
  treatmentPathwaysApi: { list: vi.fn(), create: vi.fn() },
  investigationsApi: { list: vi.fn(), assignees: vi.fn(), create: vi.fn() },
  clinicalFormsApi: { listByPatient: vi.fn() },
  careTasksApi: { list: vi.fn() },
}));

function mockDoctor() {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: {
      userId: 'u1',
      tenantId: 't1',
      email: 'doctor@example.test',
      displayName: null,
      role: 'DOCTOR',
      isClinicAdmin: false,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
    isInitializing: false,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDoctor();
  vi.mocked(patientsApi.getById).mockResolvedValue({
    id: 'patient-1',
    fullName: 'BN Tổng Hợp',
    dateOfBirth: '1980-01-01',
    gender: 'MALE',
    phone: '0900000000',
  } as never);
  vi.mocked(patientsApi.getTimeline).mockResolvedValue({
    episodes: [],
    ungroupedEncounters: [],
  } as never);
  vi.mocked(followUpTasksApi.listByPatient).mockResolvedValue([] as never);
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/patients/patient-1']}>
      <Routes>
        <Route path="/patients/:patientId" element={<PatientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openVisitMenu() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '+ Tạo lượt khám' }));
  return user;
}

describe('PatientDetailPage — unified visit entry (DEMO UI)', () => {
  it('no ACTIVE Hemorrhoid Case → offers "Khám trĩ" and "Khám khác"', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([] as never);
    renderPage();
    await openVisitMenu();

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Khám trĩ' })).toHaveAttribute(
      'href',
      '/patients/patient-1/hemorrhoid/new-encounter',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Khám khác' })).toHaveAttribute(
      'href',
      '/patients/patient-1/encounters/new',
    );
    expect(within(menu).queryByRole('menuitem', { name: 'Tiếp tục điều trị trĩ' })).toBeNull();
  });

  it('ACTIVE Hemorrhoid Case → NO new Hemorrhoid Initial action, offers continue + Khám khác', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([
      {
        id: 'episode-1',
        patientId: 'patient-1',
        episodeType: 'HEMORRHOID_TREATMENT',
        status: 'ACTIVE',
        startedAt: '2026-08-01T00:00:00.000Z',
        endedAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ] as never);
    renderPage();
    await openVisitMenu();

    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Khám trĩ' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Tiếp tục điều trị trĩ' })).toBeInTheDocument();
    // "Khám khác" still routes to the unchanged generic Encounter flow.
    expect(within(menu).getByRole('menuitem', { name: 'Khám khác' })).toHaveAttribute(
      'href',
      '/patients/patient-1/encounters/new',
    );
  });

  it('a CLOSED Hemorrhoid Case is not "active" → "Khám trĩ" is offered again', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([
      {
        id: 'episode-1',
        patientId: 'patient-1',
        episodeType: 'HEMORRHOID_TREATMENT',
        status: 'CLOSED',
        startedAt: '2026-06-01T00:00:00.000Z',
        endedAt: '2026-07-01T00:00:00.000Z',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ] as never);
    renderPage();
    await openVisitMenu();
    expect(
      within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Khám trĩ' }),
    ).toBeInTheDocument();
  });

  it('has a "← Danh sách bệnh nhân" back link to /patients (NAV-03)', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([] as never);
    renderPage();
    expect(
      await screen.findByRole('link', { name: 'Danh sách bệnh nhân' }),
    ).toHaveAttribute('href', '/patients');
  });

  it('does not render the old parallel visit buttons', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([] as never);
    renderPage();
    await screen.findByRole('button', { name: '+ Tạo lượt khám' });
    expect(
      screen.queryByRole('link', { name: '+ Lượt khám mới (ngoài đợt điều trị)' }),
    ).toBeNull();
    expect(screen.queryByRole('link', { name: '+ Lượt khám trĩ mới' })).toBeNull();
  });
});
