import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PatientDetailPage } from '../PatientDetailPage';
import * as AuthContextModule from '../../auth/AuthContext';
import {
  careEpisodesApi,
  clinicalFormsApi,
  followUpTasksApi,
  investigationsApi,
  patientsApi,
  treatmentPathwaysApi,
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
  vi.mocked(treatmentPathwaysApi.list).mockResolvedValue([] as never);
  vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([] as never);
  vi.mocked(investigationsApi.list).mockResolvedValue([] as never);
  vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([] as never);
});

function renderPage(entry = '/patients/patient-1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/patients/:patientId" element={<PatientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openVisitMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: '+ Tạo lượt khám' }));
}

describe('PatientDetailPage — T9 per-patient navigation (DEC-020 Package B)', () => {
  it('Patient Dashboard is the default view', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Bệnh nhân' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chẩn đoán hiện tại' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bảng tổng quan' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The Case workspace itself is not shown until the Lâm sàng view.
    expect(screen.queryByRole('heading', { name: 'Case · Điều trị / theo dõi' })).toBeNull();
  });

  it('factual cards render "Chưa ghi nhận" safely when data is absent', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Chẩn đoán hiện tại' });
    expect(screen.getAllByText('Chưa ghi nhận').length).toBeGreaterThan(0);
    expect(screen.getByText('Chưa có Case')).toBeInTheDocument();
    // No invented diagnosis / score / abnormal classification.
    expect(screen.queryByText(/bất thường/i)).toBeNull();
  });

  it('switching to "Lâm sàng" reveals the Case workspace; "Lịch sử" shows the read-only timeline', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Lâm sàng' }));
    expect(await screen.findByRole('button', { name: '+ Tạo lượt khám' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Lịch sử' }));
    expect(
      await screen.findByRole('heading', { name: 'Dòng thời gian (chỉ đọc)' }),
    ).toBeInTheDocument();
  });

  it('deep-links via ?view=clinical straight to the Case workspace', async () => {
    renderPage('/patients/patient-1?view=clinical');
    expect(await screen.findByRole('button', { name: '+ Tạo lượt khám' })).toBeInTheDocument();
  });
});

describe('PatientDetailPage — unified visit entry (DEMO UI)', () => {
  it('no ACTIVE Hemorrhoid Case → offers "Khám trĩ" and "Khám khác"', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([] as never);
    const user = userEvent.setup();
    renderPage('/patients/patient-1?view=clinical');
    await openVisitMenu(user);

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
    const user = userEvent.setup();
    renderPage('/patients/patient-1?view=clinical');
    await openVisitMenu(user);

    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Khám trĩ' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Tiếp tục điều trị trĩ' })).toBeInTheDocument();
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
    const user = userEvent.setup();
    renderPage('/patients/patient-1?view=clinical');
    await openVisitMenu(user);
    expect(
      within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Khám trĩ' }),
    ).toBeInTheDocument();
  });

  it('has a "← Danh sách bệnh nhân" back link to /patients (NAV-03)', async () => {
    renderPage();
    expect(
      await screen.findByRole('link', { name: 'Danh sách bệnh nhân' }),
    ).toHaveAttribute('href', '/patients');
  });

  it('does not render the old parallel visit buttons', async () => {
    renderPage('/patients/patient-1?view=clinical');
    await screen.findByRole('button', { name: '+ Tạo lượt khám' });
    expect(
      screen.queryByRole('link', { name: '+ Lượt khám mới (ngoài đợt điều trị)' }),
    ).toBeNull();
    expect(screen.queryByRole('link', { name: '+ Lượt khám trĩ mới' })).toBeNull();
  });
});
