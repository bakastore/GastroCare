import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LongoClinicalFormPage } from '../LongoClinicalFormPage';
import { clinicalFormsApi } from '../../api/resources';

// DEC-012 §6-7, §19 — HEMORRHOID_DIAGNOSIS / HEMORRHOID_TREATMENT_DECISION
// deliberately reuse this same schema-driven renderer (already proven for
// the six Longo templates) rather than a new page; this test only exercises
// the label mapping + the reused create/complete lifecycle for the two new
// templateKeys.
vi.mock('../../api/resources', () => ({
  clinicalFormsApi: {
    create: vi.fn(),
    getById: vi.fn(),
    listByPatient: vi.fn(),
    updateDraft: vi.fn(),
    complete: vi.fn(),
    amend: vi.fn(),
    getHistory: vi.fn(),
    getTemplate: vi.fn(),
  },
}));

function renderPage(templateKey: string) {
  return render(
    <MemoryRouter
      initialEntries={[`/patients/patient-1/encounters/enc-1/clinical-forms/${templateKey}`]}
    >
      <Routes>
        <Route
          path="/patients/:patientId/encounters/:encounterId/clinical-forms/:templateKey"
          element={<LongoClinicalFormPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([]);
});

describe('LongoClinicalFormPage reused for Hemorrhoid Diagnosis / Treatment Decision', () => {
  it('renders the Vietnamese "Chẩn đoán" title and a required diagnosisSummary field, and creates against the given Encounter', async () => {
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue({
      templateKey: 'HEMORRHOID_DIAGNOSIS',
      version: 1,
      displayName: 'HEMORRHOID_DIAGNOSIS',
      sections: [
        {
          key: 'main',
          label: 'Chẩn đoán',
          fields: [
            { type: 'textarea', key: 'diagnosisSummary', label: 'Tóm tắt chẩn đoán', required: true },
          ],
        },
      ],
      scoreInstruments: [],
    });

    renderPage('HEMORRHOID_DIAGNOSIS');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Chẩn đoán' })).toBeInTheDocument();

    vi.mocked(clinicalFormsApi.create).mockResolvedValue({
      id: 'diag-1',
      patientId: 'patient-1',
      encounterId: 'enc-1',
      templateKey: 'HEMORRHOID_DIAGNOSIS',
      templateVersion: 1,
      status: 'DRAFT',
      responses: {},
      computedScores: null,
      logicalGroupId: 'diag-1',
      revisionNumber: 1,
      previousSubmissionId: null,
      amendmentReason: null,
      amendedByUserId: null,
      completedByUserId: null,
      completedAt: null,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:00.000Z',
    });

    await user.click(screen.getByRole('button', { name: 'Bắt đầu biểu mẫu' }));
    await waitFor(() => {
      expect(clinicalFormsApi.create).toHaveBeenCalledWith({
        encounterId: 'enc-1',
        templateKey: 'HEMORRHOID_DIAGNOSIS',
        responses: {},
      });
    });
  });

  it('renders the Vietnamese "Quyết định điều trị" title for HEMORRHOID_TREATMENT_DECISION', async () => {
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue({
      templateKey: 'HEMORRHOID_TREATMENT_DECISION',
      version: 1,
      displayName: 'HEMORRHOID_TREATMENT_DECISION',
      sections: [
        {
          key: 'main',
          label: 'Quyết định điều trị',
          fields: [
            { type: 'textarea', key: 'decisionSummary', label: 'Tóm tắt quyết định', required: true },
          ],
        },
      ],
      scoreInstruments: [],
    });

    renderPage('HEMORRHOID_TREATMENT_DECISION');

    expect(
      await screen.findByRole('heading', { name: 'Quyết định điều trị' }),
    ).toBeInTheDocument();
  });

  it('a completed Diagnosis is read-only and the diagnosisSummary field is disabled', async () => {
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue({
      templateKey: 'HEMORRHOID_DIAGNOSIS',
      version: 1,
      displayName: 'HEMORRHOID_DIAGNOSIS',
      sections: [
        {
          key: 'main',
          label: 'Chẩn đoán',
          fields: [
            { type: 'textarea', key: 'diagnosisSummary', label: 'Tóm tắt chẩn đoán', required: true },
          ],
        },
      ],
      scoreInstruments: [],
    });
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      {
        id: 'diag-1',
        patientId: 'patient-1',
        encounterId: 'enc-1',
        templateKey: 'HEMORRHOID_DIAGNOSIS',
        templateVersion: 1,
        status: 'COMPLETED',
        responses: { diagnosisSummary: 'Trĩ nội độ II (synthetic)' },
        computedScores: null,
        logicalGroupId: 'diag-1',
        revisionNumber: 1,
        previousSubmissionId: null,
        amendmentReason: null,
        amendedByUserId: null,
        completedByUserId: 'doctor-1',
        completedAt: '2026-08-26T00:00:00.000Z',
        createdAt: '2026-08-26T00:00:00.000Z',
        updatedAt: '2026-08-26T00:00:00.000Z',
      },
    ]);
    vi.mocked(clinicalFormsApi.getHistory).mockResolvedValue({
      current: {} as never,
      revisions: [],
    });

    renderPage('HEMORRHOID_DIAGNOSIS');

    expect(await screen.findByLabelText('Tóm tắt chẩn đoán *')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sửa (tạo phiên bản mới)' })).toBeInTheDocument();
  });
});
