import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LongoClinicalFormPage } from '../LongoClinicalFormPage';
import { HemorrhoidExaminationPage } from '../HemorrhoidExaminationPage';
import {
  clinicalFormsApi,
  cliniciansApi,
  encountersApi,
  patientsApi,
} from '../../api/resources';

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
    getVitalsCopyForward: vi.fn(),
  },
  patientsApi: { getById: vi.fn() },
  encountersApi: { getById: vi.fn() },
  cliniciansApi: { list: vi.fn() },
  facilitiesApi: { getById: vi.fn() },
  roomsApi: { getById: vi.fn() },
}));

const oneFieldTemplate = (key: string, label: string) => ({
  templateKey: key,
  version: 1,
  displayName: key,
  sections: [{ key: 'main', label, fields: [{ type: 'textarea', key: 'summary', label, required: true }] }],
  scoreInstruments: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([]);
  vi.mocked(clinicalFormsApi.getVitalsCopyForward).mockResolvedValue(null as never);
  vi.mocked(patientsApi.getById).mockResolvedValue({ id: 'p1', fullName: 'BN Một' } as never);
  vi.mocked(cliniciansApi.list).mockResolvedValue([] as never);
  vi.mocked(encountersApi.getById).mockResolvedValue({
    id: 'e1',
    patientId: 'p1',
    responsibleClinicianId: 'd1',
    roomId: null,
  } as never);
});

function renderLongoForm(templateKey: string) {
  return render(
    <MemoryRouter initialEntries={[`/patients/p1/encounters/e1/clinical-forms/${templateKey}`]}>
      <Routes>
        <Route
          path="/patients/:patientId/encounters/:encounterId/clinical-forms/:templateKey"
          element={<LongoClinicalFormPage />}
        />
        <Route
          path="/patients/:patientId/encounters/:encounterId/longo-forms/:templateKey"
          element={<LongoClinicalFormPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Contextual back navigation (NAV-03..05)', () => {
  it('Diagnosis returns to the patient record', async () => {
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue(
      oneFieldTemplate('HEMORRHOID_DIAGNOSIS', 'Chẩn đoán') as never,
    );
    renderLongoForm('HEMORRHOID_DIAGNOSIS');
    const back = await screen.findByRole('link', { name: 'Hồ sơ bệnh nhân' });
    expect(back).toHaveAttribute('href', '/patients/p1?view=clinical');
  });

  it('Treatment Decision returns to the patient record', async () => {
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue(
      oneFieldTemplate('HEMORRHOID_TREATMENT_DECISION', 'Quyết định điều trị') as never,
    );
    renderLongoForm('HEMORRHOID_TREATMENT_DECISION');
    expect(await screen.findByRole('link', { name: 'Hồ sơ bệnh nhân' })).toHaveAttribute(
      'href',
      '/patients/p1?view=clinical',
    );
  });

  it('a Longo pathway form returns to the treatment Case', async () => {
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue(
      oneFieldTemplate('LONGO_PREOP_ASSESSMENT', 'Đánh giá trước phẫu thuật Longo') as never,
    );
    renderLongoForm('LONGO_PREOP_ASSESSMENT');
    const back = await screen.findByRole('link', { name: 'Đợt điều trị' });
    const href = back.getAttribute('href') ?? '';
    expect(href.startsWith('/patients/p1')).toBe(true);
    expect(href).toContain('tab=');
    expect(href).toContain('#case-workspace');
    // DEC-020 Package B F3 — the Case workspace only renders under
    // ?view=clinical; this param must never be dropped from the back-link.
    expect(href).toContain('view=clinical');
    expect(screen.queryByRole('link', { name: 'Hồ sơ bệnh nhân' })).toBeNull();
  });

  it('direct URL load still resolves back target without browser history', async () => {
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue(
      oneFieldTemplate('HEMORRHOID_DIAGNOSIS', 'Chẩn đoán') as never,
    );
    // initialEntries has a single entry — no history stack to pop.
    renderLongoForm('HEMORRHOID_DIAGNOSIS');
    expect(await screen.findByRole('link', { name: 'Hồ sơ bệnh nhân' })).toHaveAttribute(
      'href',
      '/patients/p1?view=clinical',
    );
  });

  it('Hemorrhoid Examination returns to the patient record', async () => {
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue(
      oneFieldTemplate('HEMORRHOID_EXAMINATION', 'Khám') as never,
    );
    render(
      <MemoryRouter initialEntries={['/patients/p1/encounters/e1/hemorrhoid-examination']}>
        <Routes>
          <Route
            path="/patients/:patientId/encounters/:encounterId/hemorrhoid-examination"
            element={<HemorrhoidExaminationPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: 'Hồ sơ bệnh nhân' })).toHaveAttribute(
      'href',
      '/patients/p1?view=clinical',
    );
  });
});
