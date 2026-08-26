import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CarePlanPage } from '../CarePlanPage';
import { carePlansApi, patientsApi } from '../../api/resources';

vi.mock('../../api/resources', () => ({
  carePlansApi: {
    getById: vi.fn(),
    updateDraft: vi.fn(),
    sign: vi.fn(),
    amend: vi.fn(),
  },
  patientsApi: {
    getTimeline: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(patientsApi.getTimeline).mockResolvedValue({
    episodes: [],
    ungroupedEncounters: [],
  });
});

function renderCarePlanPage() {
  return render(
    <MemoryRouter initialEntries={['/care-plans/plan-1']}>
      <Routes>
        <Route path="/care-plans/:carePlanId" element={<CarePlanPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CarePlanPage — sign/amend UI state', () => {
  it('DRAFT plans are editable and require an explicit confirmation to sign', async () => {
    vi.mocked(carePlansApi.getById).mockResolvedValue({
      id: 'plan-1',
      encounterId: 'enc-1',
      patientId: 'patient-1',
      status: 'DRAFT',
      instructions: 'Điều trị theo đơn',
      followUpDate: null,
      currentVersionId: null,
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    });

    renderCarePlanPage();
    const user = userEvent.setup();

    expect(await screen.findByLabelText('Điều trị / dặn dò')).toBeEnabled();

    // Signing requires an explicit confirm step, not a single click.
    await user.click(screen.getByRole('button', { name: 'Ký kế hoạch' }));
    expect(screen.getByText(/khóa nội dung hiện tại/i)).toBeInTheDocument();
    expect(carePlansApi.sign).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Xác nhận ký' }));
    await waitFor(() => {
      expect(carePlansApi.sign).toHaveBeenCalledWith('plan-1');
    });
  });

  it('SIGNED plans render immutable content (no editable draft textarea) and offer Amend', async () => {
    vi.mocked(carePlansApi.getById).mockResolvedValue({
      id: 'plan-1',
      encounterId: 'enc-1',
      patientId: 'patient-1',
      status: 'SIGNED',
      instructions: 'Điều trị theo đơn, tái khám 14 ngày',
      followUpDate: '2026-09-05T00:00:00.000Z',
      currentVersionId: 'version-1',
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    });

    renderCarePlanPage();

    await screen.findByText('Điều trị theo đơn, tái khám 14 ngày');
    expect(screen.queryByLabelText('Điều trị / dặn dò')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sửa (tạo phiên bản mới)' }),
    ).toBeInTheDocument();
  });

  it('Amend requires a reason before it can be submitted', async () => {
    vi.mocked(carePlansApi.getById).mockResolvedValue({
      id: 'plan-1',
      encounterId: 'enc-1',
      patientId: 'patient-1',
      status: 'SIGNED',
      instructions: 'Điều trị theo đơn',
      followUpDate: null,
      currentVersionId: 'version-1',
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    });

    renderCarePlanPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Sửa (tạo phiên bản mới)' }));
    expect(screen.getByLabelText('Lý do sửa')).toBeRequired();
  });
});
