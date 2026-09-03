import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HemorrhoidExaminationPage } from '../HemorrhoidExaminationPage';
import {
  clinicalFormsApi,
  cliniciansApi,
  encountersApi,
  facilitiesApi,
  patientsApi,
  roomsApi,
} from '../../api/resources';

// A3-UX-01 — clinical layout only. These tests pin the behaviour the UI
// correction must not regress: back-to-patient navigation, the full
// template-driven field set still rendering, and a COMPLETED submission
// staying non-editable.
vi.mock('../../api/resources', () => ({
  clinicalFormsApi: {
    getTemplate: vi.fn(),
    listByPatient: vi.fn(),
    getVitalsCopyForward: vi.fn(),
    create: vi.fn(),
    updateDraft: vi.fn(),
    complete: vi.fn(),
    amend: vi.fn(),
    getHistory: vi.fn(),
  },
  encountersApi: { getById: vi.fn(), handover: vi.fn() },
  cliniciansApi: { list: vi.fn() },
  facilitiesApi: { getById: vi.fn() },
  roomsApi: { getById: vi.fn() },
  patientsApi: { getById: vi.fn() },
}));

const CLOCK_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}h`,
}));

const TEMPLATE = {
  templateKey: 'HEMORRHOID_EXAMINATION',
  version: 1,
  displayName: 'HEMORRHOID_EXAMINATION',
  sections: [
    {
      key: 'history',
      label: 'Tiền sử',
      fields: [
        { type: 'boolean', key: 'historyConstipation', label: 'Tiền sử táo bón', required: false },
        {
          type: 'textarea',
          key: 'historyOther',
          label: 'Tiền sử khác',
          required: false,
        },
      ],
    },
    {
      key: 'vitals',
      label: 'Sinh hiệu',
      fields: [
        { type: 'number', key: 'weight', label: 'Cân nặng', required: false, unit: 'kg' },
        { type: 'number', key: 'pulse', label: 'Mạch', required: false, unit: 'bpm' },
      ],
    },
    {
      key: 'morphology',
      label: 'Đặc điểm búi trĩ',
      fields: [
        {
          type: 'single_choice',
          key: 'hemorrhoidGoligherGrade',
          label: 'Phân độ Goligher',
          required: false,
          options: [
            { value: 'I', label: 'Độ I' },
            { value: 'II', label: 'Độ II' },
          ],
        },
        {
          type: 'multi_select',
          key: 'internalHemorrhoidLocation',
          label: 'Vị trí búi trĩ nội (theo mặt đồng hồ)',
          required: false,
          options: CLOCK_OPTIONS,
        },
        { type: 'text', key: 'internalHemorrhoidSize', label: 'Kích thước búi trĩ nội', required: false },
        {
          type: 'multi_select',
          key: 'externalHemorrhoidLocation',
          label: 'Vị trí búi trĩ ngoại (theo mặt đồng hồ)',
          required: false,
          options: CLOCK_OPTIONS,
        },
      ],
    },
  ],
  scoreInstruments: [],
};

const ALL_FIELD_LABELS = [
  'Tiền sử táo bón',
  'Tiền sử khác',
  'Cân nặng (kg)',
  'Mạch (bpm)',
  'Phân độ Goligher',
  'Kích thước búi trĩ nội',
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue(TEMPLATE as never);
  vi.mocked(clinicalFormsApi.getVitalsCopyForward).mockResolvedValue(null as never);
  vi.mocked(clinicalFormsApi.getHistory).mockResolvedValue({ revisions: [] } as never);
  vi.mocked(encountersApi.getById).mockResolvedValue({
    id: 'enc-1',
    patientId: 'patient-1',
    responsibleClinicianId: 'doc-1',
    roomId: null,
  } as never);
  vi.mocked(cliniciansApi.list).mockResolvedValue([
    { id: 'doc-1', email: 'doctor.a@example.test' },
  ] as never);
  vi.mocked(facilitiesApi.getById).mockResolvedValue(null as never);
  vi.mocked(roomsApi.getById).mockResolvedValue(null as never);
  vi.mocked(patientsApi.getById).mockResolvedValue({
    id: 'patient-1',
    fullName: 'BN Khám Trĩ',
  } as never);
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/patients/patient-1/encounters/enc-1/hemorrhoid-examination']}>
      <Routes>
        <Route
          path="/patients/:patientId/encounters/:encounterId/hemorrhoid-examination"
          element={<HemorrhoidExaminationPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function completedSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    patientId: 'patient-1',
    encounterId: 'enc-1',
    templateKey: 'HEMORRHOID_EXAMINATION',
    status: 'COMPLETED',
    revisionNumber: 1,
    responses: {
      historyConstipation: true,
      historyOther: 'Ghi chú tiền sử tổng hợp',
      weight: 54,
      pulse: 78,
      hemorrhoidGoligherGrade: 'II',
      internalHemorrhoidSize: '1.5cm',
      internalHemorrhoidLocation: [1, 3, 7],
      externalHemorrhoidLocation: [],
    },
    ...overrides,
  };
}

describe('HemorrhoidExaminationPage — A3-UX-01 layout correction', () => {
  it('renders a "back to patient record" link pointing at the current patient', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([]);

    renderPage();

    const back = await screen.findByRole('link', { name: 'Hồ sơ bệnh nhân' });
    expect(back).toHaveAttribute('href', '/patients/patient-1?view=clinical');
    expect(await screen.findByRole('heading', { name: 'Khám trĩ' })).toBeInTheDocument();
  });

  it('renders every template-driven field (all sections)', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([completedSubmission()] as never);

    renderPage();

    // Section cards, not one raw list (context panel loads async).
    expect(await screen.findByRole('heading', { name: 'Bối cảnh lượt khám' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Tiền sử' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sinh hiệu' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Đặc điểm búi trĩ' })).toBeInTheDocument();
    for (const label of ALL_FIELD_LABELS) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('keeps a COMPLETED submission non-editable but its values readable', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([completedSubmission()] as never);

    renderPage();

    await screen.findByRole('heading', { name: 'Tiền sử' });

    // Status is in the header, not mixed into the form body.
    expect(screen.getByText('Đã hoàn tất (phiên bản 1)')).toBeInTheDocument();

    // Every field control is disabled...
    for (const label of ALL_FIELD_LABELS) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    // ...but the recorded values are still shown.
    expect(screen.getByLabelText('Cân nặng (kg)')).toHaveValue(54);
    expect(screen.getByLabelText('Kích thước búi trĩ nội')).toHaveValue('1.5cm');
    expect(screen.getByLabelText('Tiền sử khác')).toHaveValue('Ghi chú tiền sử tổng hợp');

    // No draft actions on a completed form; the amend entrypoint is present.
    expect(screen.queryByRole('button', { name: 'Hoàn tất' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sửa (tạo phiên bản mới)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Về hồ sơ bệnh nhân' })).toBeInTheDocument();
  });

  it('leaves a DRAFT submission editable', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      completedSubmission({ status: 'DRAFT' }),
    ] as never);

    renderPage();

    await screen.findByRole('heading', { name: 'Tiền sử' });
    expect(screen.getByText('Nháp')).toBeInTheDocument();
    expect(screen.getByLabelText('Cân nặng (kg)')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hoàn tất' })).toBeInTheDocument();
  });

  it('before the exam is started shows only the start/cancel actions', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByRole('button', { name: 'Bắt đầu phiếu khám trĩ' }),
    ).toBeInTheDocument();
    // The bottom "Về hồ sơ bệnh nhân" action only exists once a submission exists.
    expect(screen.queryByRole('button', { name: 'Về hồ sơ bệnh nhân' })).not.toBeInTheDocument();
    // The header back link is always available.
    expect(
      screen.getByRole('link', { name: 'Hồ sơ bệnh nhân' }),
    ).toHaveAttribute('href', '/patients/patient-1?view=clinical');
  });
});

describe('HemorrhoidExaminationPage — A3-UX-02 clock position control', () => {
  async function renderDraftClock() {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      completedSubmission({
        status: 'DRAFT',
        responses: { internalHemorrhoidLocation: [], externalHemorrhoidLocation: [] },
      }),
    ] as never);
    renderPage();
    await screen.findByRole('heading', { name: 'Đặc điểm búi trĩ' });
  }

  function clockGroup(name: RegExp) {
    return screen.getByRole('group', { name });
  }

  it('A — renders all 12 hour options 1h..12h as buttons, no listbox/scroll control', async () => {
    await renderDraftClock();
    const group = clockGroup(/Vị trí búi trĩ nội/);
    for (let h = 1; h <= 12; h++) {
      expect(within(group).getByRole('button', { name: `${h}h` })).toBeInTheDocument();
    }
    // B — a toggle-button group, not a <select multiple> listbox.
    expect(within(group).queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('C/D — multi-select: add 1h + 3h + 7h, then remove only 3h', async () => {
    await renderDraftClock();
    const user = userEvent.setup();
    const group = clockGroup(/Vị trí búi trĩ nội/);

    await user.click(within(group).getByRole('button', { name: '1h' }));
    await user.click(within(group).getByRole('button', { name: '3h' }));
    await user.click(within(group).getByRole('button', { name: '7h' }));

    for (const h of ['1h', '3h', '7h']) {
      expect(within(group).getByRole('button', { name: h })).toHaveAttribute('aria-pressed', 'true');
    }

    await user.click(within(group).getByRole('button', { name: '3h' }));
    expect(within(group).getByRole('button', { name: '1h' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: '3h' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: '7h' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('E — internal / external clocks are independent', async () => {
    await renderDraftClock();
    const user = userEvent.setup();
    const internal = clockGroup(/Vị trí búi trĩ nội/);
    const external = clockGroup(/Vị trí búi trĩ ngoại/);

    await user.click(within(internal).getByRole('button', { name: '1h' }));

    expect(within(internal).getByRole('button', { name: '1h' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(external).getByRole('button', { name: '1h' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('G — stored response keeps the existing number[] format', async () => {
    await renderDraftClock();
    const user = userEvent.setup();
    vi.mocked(clinicalFormsApi.updateDraft).mockResolvedValue({} as never);
    const group = clockGroup(/Vị trí búi trĩ nội/);

    await user.click(within(group).getByRole('button', { name: '7h' }));
    await user.click(within(group).getByRole('button', { name: '1h' }));
    await user.click(within(group).getByRole('button', { name: '3h' }));
    await user.click(screen.getByRole('button', { name: 'Lưu bản nháp' }));

    const [, payload] = vi.mocked(clinicalFormsApi.updateDraft).mock.calls.at(-1) as [
      string,
      { responses: Record<string, unknown> },
    ];
    // Insertion order preserved, values are numbers (not strings).
    expect(payload.responses.internalHemorrhoidLocation).toEqual([7, 1, 3]);
  });

  it('F — completed form: clock is read-only but selected hours stay identifiable', async () => {
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([completedSubmission()] as never);
    renderPage();
    await screen.findByRole('heading', { name: 'Đặc điểm búi trĩ' });

    const group = clockGroup(/Vị trí búi trĩ nội/);
    // Selected 1h / 3h / 7h from the stored responses.
    for (const h of ['1h', '3h', '7h']) {
      const btn = within(group).getByRole('button', { name: h });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    }
    for (const h of ['2h', '5h', '12h']) {
      const btn = within(group).getByRole('button', { name: h });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    }

    // Clicking a disabled button does nothing (no amend call).
    const user = userEvent.setup();
    await user.click(within(group).getByRole('button', { name: '5h' }));
    expect(within(group).getByRole('button', { name: '5h' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(clinicalFormsApi.amend).not.toHaveBeenCalled();
  });
});

// DEC-020 Package B — T4/T12: HEMORRHOID_EXAMINATION v2 renders through the
// same generic renderer. The v2 template groups fields into the eight
// source-form clinical sections, keeps aggregate INTERNAL/EXTERNAL/MIXED
// morphology (no repeatable Pile #1/#2/#3 UI) and introduces no ICD / VAS /
// automatic-abnormal / treatment-suggestion controls.
const TEMPLATE_V2 = {
  templateKey: 'HEMORRHOID_EXAMINATION',
  version: 2,
  displayName: 'Khám trĩ',
  sections: [
    { key: 'reasonAndSymptoms', label: 'Lý do khám / triệu chứng', fields: [
      { type: 'boolean', key: 'symptomAnalPain', label: 'Đau hậu môn', required: false },
    ] },
    { key: 'historyAndAllergy', label: 'Tiền sử / dị ứng', fields: [
      { type: 'boolean', key: 'allergyDrug', label: 'Dị ứng thuốc', required: false },
    ] },
    { key: 'generalExamAndVitals', label: 'Toàn thân / sinh hiệu', fields: [
      { type: 'number', key: 'respiratoryRate', label: 'Nhịp thở', required: false, unit: 'lần/phút' },
      { type: 'number', key: 'spo2', label: 'SpO2', required: false, unit: '%' },
    ] },
    { key: 'digitalRectalExam', label: 'Thăm trực tràng', fields: [
      { type: 'boolean', key: 'palpableTumor', label: 'Sờ thấy u', required: false },
    ] },
    { key: 'hemorrhoidMorphology', label: 'Đặc điểm búi trĩ', fields: [
      { type: 'single_choice', key: 'hemorrhoidGoligherGrade', label: 'Phân độ Goligher (một giá trị chung)', required: false, options: [{ value: 'I', label: 'Độ I' }] },
      { type: 'multi_select', key: 'internalHemorrhoidLocation', label: 'Vị trí búi trĩ nội (theo mặt đồng hồ)', required: false, options: CLOCK_OPTIONS },
    ] },
    { key: 'prolapseAndBleeding', label: 'Sa / chảy máu', fields: [
      { type: 'boolean', key: 'prolapseSymptom', label: 'Sa búi trĩ (bệnh nhân khai)', required: false },
    ] },
    { key: 'otherAnorectalFindings', label: 'Ghi nhận hậu môn-trực tràng khác', fields: [
      { type: 'textarea', key: 'otherAnorectalFinding', label: 'Ghi nhận hậu môn - trực tràng khác (mô tả tự do)', required: false },
    ] },
    { key: 'relatedInvestigations', label: 'Cận lâm sàng liên quan', fields: [
      { type: 'boolean', key: 'cbcNotedOnForm', label: 'Tổng phân tích tế bào máu ngoại vi (ghi nhận trên phiếu)', required: false },
    ] },
  ],
  scoreInstruments: [],
};

describe('HemorrhoidExaminationPage — v2 (DEC-020 Package B)', () => {
  it('renders the eight source-form clinical sections and no Pile-repeatable / ICD / VAS UI', async () => {
    vi.mocked(clinicalFormsApi.getTemplate).mockResolvedValue(TEMPLATE_V2 as never);
    vi.mocked(clinicalFormsApi.listByPatient).mockResolvedValue([
      {
        id: 'sub-v2',
        patientId: 'patient-1',
        encounterId: 'enc-1',
        templateKey: 'HEMORRHOID_EXAMINATION',
        templateVersion: 2,
        status: 'DRAFT',
        revisionNumber: 1,
        responses: {},
      },
    ] as never);

    renderPage();

    for (const label of [
      'Lý do khám / triệu chứng',
      'Tiền sử / dị ứng',
      'Toàn thân / sinh hiệu',
      'Thăm trực tràng',
      'Đặc điểm búi trĩ',
      'Sa / chảy máu',
      'Ghi nhận hậu môn-trực tràng khác',
      'Cận lâm sàng liên quan',
    ]) {
      expect(await screen.findByRole('heading', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Nhịp thở (lần/phút)')).toBeInTheDocument();
    expect(screen.getByLabelText('SpO2 (%)')).toBeInTheDocument();
    // Aggregate-by-type: exactly one Goligher control, no per-lesion "Pile #" row.
    expect(screen.getByLabelText('Phân độ Goligher (một giá trị chung)')).toBeInTheDocument();
    expect(screen.queryByText(/Pile #/i)).toBeNull();
    expect(screen.queryByText(/Búi trĩ #\d/i)).toBeNull();
    expect(screen.queryByLabelText(/ICD/i)).toBeNull();
    expect(screen.queryByLabelText(/VAS/i)).toBeNull();
  });
});
