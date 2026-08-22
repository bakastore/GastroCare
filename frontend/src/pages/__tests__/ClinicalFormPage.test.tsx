import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ClinicalFormPage } from '../ClinicalFormPage';
import { clinicalFormsApi } from '../../api/resources';

vi.mock('../../api/resources', () => ({
  clinicalFormsApi: {
    create: vi.fn(),
    getById: vi.fn(),
    listByPatient: vi.fn(),
    updateDraft: vi.fn(),
    complete: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderClinicalFormPage() {
  return render(
    <MemoryRouter initialEntries={['/patients/patient-1/encounters/enc-1/clinical-forms/hemorrhoid-longo-followup']}>
      <Routes>
        <Route
          path="/patients/:patientId/encounters/:encounterId/clinical-forms/hemorrhoid-longo-followup"
          element={<ClinicalFormPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ClinicalFormPage — HEMORRHOID_LONGO_FOLLOWUP lifecycle UI', () => {
  it('offers to start a new form when no submission exists yet for this Encounter', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([]);

    renderClinicalFormPage();
    const user = userEvent.setup();

    const startButton = await screen.findByRole('button', { name: 'Bắt đầu phiếu khám lại' });
    vi.mocked(clinicalFormsApi.create).mockResolvedValue({
      id: 'form-1',
      patientId: 'patient-1',
      encounterId: 'enc-1',
      templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
      templateVersion: 1,
      status: 'DRAFT',
      responses: {},
      computedScores: null,
      submittedAt: null,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    });

    await user.click(startButton);
    await waitFor(() => {
      expect(clinicalFormsApi.create).toHaveBeenCalledWith({
        encounterId: 'enc-1',
        templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
        responses: {},
      });
    });
  });

  it('DRAFT submissions are editable and show a live Wexner subtotal as items are answered', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      {
        id: 'form-1',
        patientId: 'patient-1',
        encounterId: 'enc-1',
        templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
        templateVersion: 1,
        status: 'DRAFT',
        responses: { visitNumber: 1, monthsPostOp: 1, vasPain: 2 },
        computedScores: null,
        submittedAt: null,
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
      },
    ]);

    renderClinicalFormPage();
    const user = userEvent.setup();

    expect(await screen.findByLabelText('Đau (thang điểm VAS, 0-10)')).toBeEnabled();

    // Before all Wexner items are answered, the subtotal placeholder shows.
    expect(screen.getByText(/Tổng điểm Wexner \(tạm tính\):/)).toHaveTextContent('— / 20');

    for (const label of [
      'Đại tiện không tự chủ với phân rắn',
      'Đại tiện không tự chủ với phân lỏng',
      'Không tự chủ với hơi',
      'Phải mang băng vệ sinh/tã',
      'Thay đổi lối sống do rối loạn tự chủ',
    ]) {
      await user.selectOptions(screen.getByLabelText(label), '1');
    }

    expect(screen.getByText(/Tổng điểm Wexner \(tạm tính\):/)).toHaveTextContent('5 / 20');

    vi.mocked(clinicalFormsApi.complete).mockResolvedValue({
      id: 'form-1',
      patientId: 'patient-1',
      encounterId: 'enc-1',
      templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
      templateVersion: 1,
      status: 'COMPLETED',
      responses: {},
      computedScores: { wexner: 5 },
      submittedAt: '2026-08-22T00:00:00.000Z',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    });

    await user.click(screen.getByRole('button', { name: 'Hoàn tất phiếu khám lại' }));
    // Regression guard: completion must persist the in-editor values first —
    // completing without saving would validate/score a stale (possibly
    // incomplete) prior draft on the server, not what the doctor just filled
    // in.
    await waitFor(() => {
      expect(clinicalFormsApi.updateDraft).toHaveBeenCalledWith('form-1', {
        responses: {
          visitNumber: 1,
          monthsPostOp: 1,
          vasPain: 2,
          wexnerSolidStool: 1,
          wexnerLiquidStool: 1,
          wexnerGas: 1,
          wexnerPadWearing: 1,
          wexnerLifestyleAlteration: 1,
        },
      });
    });
    await waitFor(() => {
      expect(clinicalFormsApi.complete).toHaveBeenCalledWith('form-1');
    });
  });

  it('COMPLETED submissions render read-only (no editable inputs, no save/complete actions)', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      {
        id: 'form-1',
        patientId: 'patient-1',
        encounterId: 'enc-1',
        templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
        templateVersion: 1,
        status: 'COMPLETED',
        responses: { visitNumber: 1, monthsPostOp: 1, vasPain: 2 },
        computedScores: { wexner: 3 },
        submittedAt: '2026-08-22T00:00:00.000Z',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
      },
    ]);

    renderClinicalFormPage();

    expect(await screen.findByLabelText('Đau (thang điểm VAS, 0-10)')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Lưu bản nháp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hoàn tất phiếu khám lại' })).not.toBeInTheDocument();
    expect(screen.getByText('Tổng điểm Wexner (tạm tính): 3 / 20')).toBeInTheDocument();
  });
});
