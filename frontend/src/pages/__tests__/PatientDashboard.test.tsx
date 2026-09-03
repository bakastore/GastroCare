import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PatientDashboard } from '../PatientDashboard';
import {
  careEpisodesApi,
  clinicalFormsApi,
  followUpTasksApi,
  investigationsApi,
  patientsApi,
} from '../../api/resources';

vi.mock('../../api/resources', () => ({
  patientsApi: { getById: vi.fn(), getTimeline: vi.fn() },
  careEpisodesApi: { listByPatient: vi.fn() },
  followUpTasksApi: { listByPatient: vi.fn() },
  clinicalFormsApi: { listByPatient: vi.fn() },
  investigationsApi: { list: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(patientsApi.getById).mockResolvedValue({
    id: 'p1',
    fullName: 'BN Trĩ',
    dateOfBirth: '1975-03-03',
    gender: 'FEMALE',
    phone: '0900000123',
  } as never);
  vi.mocked(patientsApi.getTimeline).mockResolvedValue({
    episodes: [],
    ungroupedEncounters: [
      {
        type: 'ENCOUNTER',
        timestamp: '2026-08-20T02:00:00.000Z',
        data: { id: 'e1', occurredAt: '2026-08-20T02:00:00.000Z', reasonForVisit: 'Đau hậu môn' },
      },
    ],
  } as never);
  vi.mocked(followUpTasksApi.listByPatient).mockResolvedValue([] as never);
  vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([] as never);
  vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([] as never);
  vi.mocked(investigationsApi.list).mockResolvedValue([] as never);
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <PatientDashboard patientId="p1" />
    </MemoryRouter>,
  );
}

describe('PatientDashboard — factual current state only (DEC-020 Package B T8)', () => {
  it('shows patient identity and latest encounter from existing projections', async () => {
    renderDashboard();
    expect(await screen.findByText('BN Trĩ')).toBeInTheDocument();
    expect(screen.getByText(/Đau hậu môn/)).toBeInTheDocument();
  });

  it('renders "Chưa ghi nhận" / "không có sẵn" rather than manufacturing a conclusion', async () => {
    renderDashboard();
    await screen.findByRole('heading', { name: 'Chẩn đoán hiện tại' });
    expect(screen.getAllByText('Chưa ghi nhận').length).toBeGreaterThan(0);
    expect(screen.getByText('Chưa ghi nhận / không có sẵn')).toBeInTheDocument();
    expect(screen.getByText('Chưa có Case')).toBeInTheDocument();
  });

  it('renders a recorded diagnosis verbatim without classification', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      {
        id: 'd1',
        templateKey: 'HEMORRHOID_DIAGNOSIS',
        status: 'COMPLETED',
        completedAt: '2026-08-21T02:00:00.000Z',
        createdAt: '2026-08-21T01:00:00.000Z',
        revisionNumber: 1,
        responses: { diagnosisSummary: 'Trĩ nội độ III; da thừa hậu môn' },
      },
    ] as never);
    renderDashboard();
    expect(
      await screen.findByText('Trĩ nội độ III; da thừa hậu môn'),
    ).toBeInTheDocument();
    // No Primary/Comorbid classification, no ICD label injected.
    expect(screen.queryByText(/ICD/i)).toBeNull();
    expect(screen.queryByText(/Chẩn đoán chính/i)).toBeNull();
  });

  it('Investigation card shows only factual counts + defers the reviewed state to Package C', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockResolvedValue([
      {
        id: 'ep1',
        patientId: 'p1',
        episodeType: 'HEMORRHOID_TREATMENT',
        status: 'ACTIVE',
        startedAt: '2026-08-01T00:00:00.000Z',
        endedAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ] as never);
    vi.mocked(investigationsApi.list).mockResolvedValue([
      { id: 'i1', orders: [{ id: 'o1' }], results: [] },
      { id: 'i2', orders: [{ id: 'o2' }], results: [{ id: 'r1' }] },
    ] as never);
    renderDashboard();
    expect(await screen.findByText('Trạng thái bác sĩ đã đọc')).toBeInTheDocument();
    expect(
      screen.getByText(/chưa có trong mô hình dữ liệu — Package C/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/bất thường/i)).toBeNull();
  });
});

describe('PatientDashboard — F1: a load failure is not shown as "no data"', () => {
  it('a failed episodes query renders an explicit error + retry, not "Chưa có Case"', async () => {
    vi.mocked(careEpisodesApi.listByPatient).mockRejectedValue(new Error('boom'));
    renderDashboard();
    const card = (await screen.findByRole('heading', { name: 'Case hiện tại' })).closest(
      '.dashboard-card',
    ) as HTMLElement;
    expect(await within(card).findByRole('alert')).toHaveTextContent('Không tải được dữ liệu.');
    expect(within(card).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(within(card).queryByText('Chưa có Case')).toBeNull();
  });

  it('a failed follow-up-tasks query renders an error, not "Không có nhiệm vụ theo dõi đang mở."', async () => {
    vi.mocked(followUpTasksApi.listByPatient).mockRejectedValue(new Error('boom'));
    renderDashboard();
    const card = (
      await screen.findByRole('heading', { name: 'Nhiệm vụ theo dõi sắp tới' })
    ).closest('.dashboard-card') as HTMLElement;
    expect(await within(card).findByRole('alert')).toHaveTextContent('Không tải được dữ liệu.');
    expect(within(card).queryByText('Không có nhiệm vụ theo dõi đang mở.')).toBeNull();
  });

  it('a failed clinical-forms query renders an error in the diagnosis card, not "Chưa ghi nhận"', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockRejectedValue(new Error('boom'));
    renderDashboard();
    const card = (
      await screen.findByRole('heading', { name: 'Chẩn đoán hiện tại' })
    ).closest('.dashboard-card') as HTMLElement;
    expect(await within(card).findByRole('alert')).toHaveTextContent('Không tải được dữ liệu.');
    expect(within(card).queryByText('Chưa ghi nhận')).toBeNull();
  });
});

describe('PatientDashboard — F2: amendment revisions of one exam are one visit', () => {
  it('two COMPLETED revisions of the same logical exam are not shown as prior-vs-current visits', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      {
        id: 'ex-r1',
        templateKey: 'HEMORRHOID_EXAMINATION',
        status: 'COMPLETED',
        logicalGroupId: 'grp-1',
        encounterId: 'enc-1',
        revisionNumber: 1,
        templateVersion: 2,
        completedAt: '2026-08-10T02:00:00.000Z',
        createdAt: '2026-08-10T01:00:00.000Z',
        responses: { pulse: 70 },
      },
      {
        id: 'ex-r2',
        templateKey: 'HEMORRHOID_EXAMINATION',
        status: 'COMPLETED',
        logicalGroupId: 'grp-1',
        encounterId: 'enc-1',
        revisionNumber: 2,
        templateVersion: 2,
        completedAt: '2026-08-12T02:00:00.000Z',
        createdAt: '2026-08-12T01:00:00.000Z',
        responses: { pulse: 88 },
      },
    ] as never);
    renderDashboard();
    const card = (
      await screen.findByRole('heading', { name: 'Tóm tắt khám gần nhất' })
    ).closest('.dashboard-card') as HTMLElement;
    // Only the latest revision (rev 2, pulse 88) counts; there is no prior VISIT.
    expect(within(card).getByText('· bản 2', { exact: false })).toBeInTheDocument();
    const headerRow = within(card).getAllByRole('row')[0];
    expect(headerRow).not.toHaveTextContent('Lần trước (');
    const pulseRow = within(card).getAllByRole('row')[1];
    // "Lần trước" column shows "—", "Lần này" shows 88 — not 70 vs 88.
    expect(pulseRow).toHaveTextContent('88');
    expect(pulseRow).not.toHaveTextContent('70');
  });

  it('two distinct logical exams ARE shown as prior vs current', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      {
        id: 'a',
        templateKey: 'HEMORRHOID_EXAMINATION',
        status: 'COMPLETED',
        logicalGroupId: 'grp-a',
        encounterId: 'enc-a',
        revisionNumber: 1,
        templateVersion: 2,
        completedAt: '2026-07-01T02:00:00.000Z',
        createdAt: '2026-07-01T01:00:00.000Z',
        responses: { pulse: 60 },
      },
      {
        id: 'b',
        templateKey: 'HEMORRHOID_EXAMINATION',
        status: 'COMPLETED',
        logicalGroupId: 'grp-b',
        encounterId: 'enc-b',
        revisionNumber: 1,
        templateVersion: 2,
        completedAt: '2026-08-01T02:00:00.000Z',
        createdAt: '2026-08-01T01:00:00.000Z',
        responses: { pulse: 90 },
      },
    ] as never);
    renderDashboard();
    const card = (
      await screen.findByRole('heading', { name: 'Tóm tắt khám gần nhất' })
    ).closest('.dashboard-card') as HTMLElement;
    const pulseRow = within(card).getAllByRole('row')[1];
    expect(pulseRow).toHaveTextContent('60');
    expect(pulseRow).toHaveTextContent('90');
  });
});
