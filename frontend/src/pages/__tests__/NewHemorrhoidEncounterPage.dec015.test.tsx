import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NewHemorrhoidEncounterPage } from '../NewHemorrhoidEncounterPage';
import { NewEncounterPage } from '../NewEncounterPage';
import {
  cliniciansApi,
  encountersApi,
  facilitiesApi,
  roomsApi,
} from '../../api/resources';

// DEC-015 M2-A / F1-F2 — the initial Hemorrhoid Encounter entrypoint must
// explicitly send workflowKind = 'HEMORRHOID_INITIAL'; the generic
// new-encounter flow must never send workflowKind.
vi.mock('../../api/resources', () => ({
  encountersApi: { create: vi.fn() },
  facilitiesApi: { list: vi.fn() },
  cliniciansApi: { list: vi.fn() },
  roomsApi: { listByFacility: vi.fn() },
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'DOCTOR' } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(encountersApi.create).mockResolvedValue({
    id: 'enc-1',
    responsibleClinicianId: 'doc-1',
  } as never);
  vi.mocked(facilitiesApi.list).mockResolvedValue([]);
  vi.mocked(cliniciansApi.list).mockResolvedValue([]);
  vi.mocked(roomsApi.listByFacility).mockResolvedValue([]);
});

describe('DEC-015 — Encounter create discriminator (frontend entrypoints)', () => {
  it('F1: NewHemorrhoidEncounterPage sends workflowKind = HEMORRHOID_INITIAL', async () => {
    render(
      <MemoryRouter initialEntries={['/patients/p1/hemorrhoid/new-encounter']}>
        <Routes>
          <Route
            path="/patients/:patientId/hemorrhoid/new-encounter"
            element={<NewHemorrhoidEncounterPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    const user = userEvent.setup();

    await user.type(
      await screen.findByLabelText('Thời điểm khám'),
      '2026-09-01T09:00',
    );
    await user.click(screen.getByRole('button', { name: 'Tạo lượt khám' }));

    await waitFor(() => {
      expect(encountersApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'p1',
          workflowKind: 'HEMORRHOID_INITIAL',
        }),
      );
    });
    // never episode-bound
    expect(encountersApi.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ episodeId: expect.anything() }),
    );
  });

  it('F2: generic NewEncounterPage does NOT send workflowKind', async () => {
    render(
      <MemoryRouter initialEntries={['/patients/p1/encounters/new']}>
        <Routes>
          <Route
            path="/patients/:patientId/encounters/new"
            element={<NewEncounterPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Thời điểm khám'), '2026-09-01T09:00');
    await user.type(screen.getByLabelText('Lý do khám'), 'Đau thượng vị (synthetic)');
    await user.type(screen.getByLabelText('Ghi chú lâm sàng'), 'x');
    await user.type(screen.getByLabelText('Đánh giá'), 'x');
    await user.click(screen.getByRole('button', { name: 'Lưu và tạo kế hoạch chăm sóc' }));

    await waitFor(() => {
      expect(encountersApi.create).toHaveBeenCalled();
    });
    const arg = vi.mocked(encountersApi.create).mock.calls[0][0];
    expect(arg).not.toHaveProperty('workflowKind');
  });
});
