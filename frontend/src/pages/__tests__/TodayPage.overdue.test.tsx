import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TodayPage } from '../TodayPage';
import { careTasksApi, patientsApi } from '../../api/resources';

vi.mock('../../api/resources', () => ({
  careTasksApi: { list: vi.fn() },
  patientsApi: { list: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(patientsApi.list).mockResolvedValue([
    {
      id: 'patient-1',
      fullName: 'Nguyễn Văn Minh',
      dateOfBirth: '1984-03-15',
      gender: 'MALE',
      phone: '0901234567',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ]);
});

describe('TodayPage — overdue is derived from the API response', () => {
  it('shows "Quá hạn" only when the API-provided overdue flag is true, not from a stored status', async () => {
    vi.mocked(careTasksApi.list).mockResolvedValue([
      {
        id: 'task-1',
        patientId: 'patient-1',
        carePlanId: 'plan-1',
        status: 'OPEN',
        dueDate: '2020-01-01T00:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
        completedAt: null,
        cancelledAt: null,
        overdue: true,
        sourceEncounterId: null,
        timepointCode: null,
        completedByEncounterId: null,
        scheduleReviewRequired: false,
      },
    ]);

    render(
      <MemoryRouter>
        <TodayPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Quá hạn')).toBeInTheDocument();
  });

  it('shows "Đang chờ" (not overdue) when the API says overdue is false, even for an OPEN task', async () => {
    vi.mocked(careTasksApi.list).mockResolvedValue([
      {
        id: 'task-2',
        patientId: 'patient-1',
        carePlanId: 'plan-1',
        status: 'OPEN',
        dueDate: '2099-01-01T00:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
        completedAt: null,
        cancelledAt: null,
        overdue: false,
        sourceEncounterId: null,
        timepointCode: null,
        completedByEncounterId: null,
        scheduleReviewRequired: false,
      },
    ]);

    render(
      <MemoryRouter>
        <TodayPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Đang chờ')).toBeInTheDocument();
    expect(screen.queryByText('Quá hạn')).not.toBeInTheDocument();
  });
});
