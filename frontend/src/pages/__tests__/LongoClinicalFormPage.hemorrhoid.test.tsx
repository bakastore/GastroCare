import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LongoClinicalFormPage } from '../LongoClinicalFormPage';
import { clinicalFormsApi, patientsApi } from '../../api/resources';

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
  patientsApi: { getById: vi.fn() },
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
  vi.mocked(patientsApi.getById).mockResolvedValue({
    id: 'patient-1',
    fullName: 'BN Longo',
  } as never);
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
            {
              type: 'textarea',
              key: 'diagnosisSummary',
              label: 'Tóm tắt chẩn đoán',
              required: true,
            },
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
            {
              type: 'textarea',
              key: 'decisionSummary',
              label: 'Tóm tắt quyết định',
              required: true,
            },
          ],
        },
      ],
      scoreInstruments: [],
    });

    renderPage('HEMORRHOID_TREATMENT_DECISION');

    expect(await screen.findByRole('heading', { name: 'Quyết định điều trị' })).toBeInTheDocument();
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
            {
              type: 'textarea',
              key: 'diagnosisSummary',
              label: 'Tóm tắt chẩn đoán',
              required: true,
            },
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
  it('DEC016: existing v1 decision uses version 1 and never renders v2 modality fields', async () => {
    const key = 'HEMORRHOID_TREATMENT_DECISION';
    vi.mocked(clinicalFormsApi.getTemplate).mockImplementation(async (_key, version) => ({
      templateKey: key,
      version: version ?? 2,
      displayName: 'Quyết định điều trị',
      scoreInstruments: [],
      sections: [
        {
          key: 'main',
          label: 'Quyết định điều trị',
          fields:
            version === 1
              ? [
                  {
                    type: 'textarea',
                    key: 'decisionSummary',
                    label: 'Tóm tắt quyết định',
                    required: true,
                  },
                ]
              : [
                  {
                    type: 'multi_select',
                    key: 'treatmentModalities',
                    label: 'Phương thức v2',
                    required: true,
                    options: [{ value: 'MEDICAL', label: 'Nội khoa' }],
                  },
                ],
        },
      ],
    }));
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      {
        id: 'legacy-1',
        patientId: 'patient-1',
        encounterId: 'enc-1',
        templateKey: key,
        templateVersion: 1,
        status: 'COMPLETED',
        responses: { decisionSummary: 'Synthetic legacy v1' },
        logicalGroupId: 'legacy-1',
        revisionNumber: 1,
      } as never,
    ]);
    vi.mocked(clinicalFormsApi.getHistory).mockResolvedValue({
      current: {} as never,
      revisions: [],
    });
    renderPage(key);
    expect(await screen.findByDisplayValue('Synthetic legacy v1')).toBeDisabled();
    expect(clinicalFormsApi.getTemplate).toHaveBeenCalledWith(key, 1);
    expect(screen.queryByText('Phương thức v2')).not.toBeInTheDocument();
  });

  // DEC-021 §3.2 — explicit `?version=3` Treatment Decision v3 flow.
  function renderV3() {
    return render(
      <MemoryRouter
        initialEntries={[
          '/patients/patient-1/encounters/enc-1/longo-forms/HEMORRHOID_TREATMENT_DECISION?version=3',
        ]}
      >
        <Routes>
          <Route
            path="/patients/:patientId/encounters/:encounterId/longo-forms/:templateKey"
            element={<LongoClinicalFormPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('?version=3 fetches Treatment Decision v3 and creates with templateVersion: 3', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([]);
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue({
      templateKey: 'HEMORRHOID_TREATMENT_DECISION',
      version: 3,
      displayName: 'Quyết định điều trị',
      sections: [
        {
          key: 'treatmentDecision',
          label: 'Quyết định điều trị',
          fields: [
            {
              type: 'single_choice',
              key: 'patientDecision',
              label: 'Quyết định của bệnh nhân',
              required: true,
              options: [{ value: 'ACCEPTED', label: 'Đồng ý điều trị' }],
            },
          ],
        },
      ],
      scoreInstruments: [],
    } as never);
    vi.mocked(clinicalFormsApi.create).mockResolvedValue({
      id: 'v3-1',
      templateKey: 'HEMORRHOID_TREATMENT_DECISION',
      templateVersion: 3,
      status: 'DRAFT',
      responses: {},
      revisionNumber: 1,
    } as never);

    renderV3();
    const user = userEvent.setup();
    expect(
      await screen.findByRole('heading', { name: 'Quyết định điều trị' }),
    ).toBeInTheDocument();
    expect(clinicalFormsApi.getTemplate).toHaveBeenCalledWith(
      'HEMORRHOID_TREATMENT_DECISION',
      3,
    );

    await user.click(screen.getByRole('button', { name: 'Bắt đầu biểu mẫu' }));
    await waitFor(() => {
      expect(clinicalFormsApi.create).toHaveBeenCalledWith({
        encounterId: 'enc-1',
        templateKey: 'HEMORRHOID_TREATMENT_DECISION',
        responses: {},
        templateVersion: 3,
      });
    });
  });

  it('version-aware lookup: a same-key v2 completed submission does not shadow the v3 start flow', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      {
        id: 'v2-existing',
        encounterId: 'enc-1',
        templateKey: 'HEMORRHOID_TREATMENT_DECISION',
        templateVersion: 2,
        status: 'COMPLETED',
        responses: {},
        revisionNumber: 1,
      } as never,
    ]);
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue({
      templateKey: 'HEMORRHOID_TREATMENT_DECISION',
      version: 3,
      displayName: 'Quyết định điều trị',
      sections: [
        {
          key: 'treatmentDecision',
          label: 'Quyết định điều trị',
          fields: [
            {
              type: 'textarea',
              key: 'decisionSummary',
              label: 'Diễn giải',
              required: true,
            },
          ],
        },
      ],
      scoreInstruments: [],
    } as never);

    renderV3();
    // The v3 chain is empty (the v2 submission is filtered out), so the
    // "start form" button is shown rather than the v2 editor.
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu biểu mẫu' }),
    ).toBeInTheDocument();
    expect(clinicalFormsApi.getTemplate).toHaveBeenCalledWith(
      'HEMORRHOID_TREATMENT_DECISION',
      3,
    );
  });
});
