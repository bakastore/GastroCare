import { ClinicalFormTemplate } from './types';
import { createAnorectalExamSection } from './shared/anorectal-exam.section';

// LONGO_PREOP_ASSESSMENT v1 — CORE-04 T4
// (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md v0.3.1, T4 field contract).
//
// This is the first of the six OWNER-LOCKED Longo template families to be
// implemented, and the first template for which the Longo episode-ancestry
// invariant (backend/src/clinical-forms/templates/longo-episode-invariant.ts,
// built in T2 as structural readiness) becomes live: create/complete/amend
// now reject unless the Encounter belongs to a CareEpisode of the same
// tenant/patient.
//
// Field groups, each mapped 1:1 to the locked contract bullets — nothing
// added "because it seems medically reasonable":
//   - history/comorbidity/general assessment -> free text (no structured
//     value set is locked for these)
//   - weight(kg)/height(cm)/pulse(bpm)/temperature(°C), blood pressure
//     split systolic/diastolic(mmHg) -> plain number fields, no min/max
//     (no medical range is OWNER LOCKED — fabricating one is explicitly
//     forbidden by the T4 contract)
//   - anemia -> a structured boolean presence flag + free-text note;
//     NEVER derived from Hb/Hct (no such derivation rule exists anywhere
//     in this codebase)
//   - paraclinical findings -> free text (no structured lab fields are
//     locked)
//   - rectoscopy -> the "minimal structured subsection" the SSOT
//     describes without naming any specific finding vocabulary is
//     represented as a single boolean ("was it performed"), paired with
//     free-text impression — this is deliberately the smallest possible
//     structured element so the full rectoscopy vocabulary
//     (DEFERRED_WITH_REASON) is never activated
//   - pre-op anorectal exam, Goligher I-IV, and clock-face hemorrhoid
//     location are all satisfied by reusing createAnorectalExamSection()
//     from T3 (namespaced "preop") — this is the exact reuse case that
//     factory exists for, and avoids declaring Goligher/clock-face a
//     second time
//   - a final general free-text field for anything not safely
//     standardized elsewhere
//
// No scoreInstruments: the contract defines no derived score for this
// template, and none is fabricated.
export const longoPreopAssessmentV1: ClinicalFormTemplate = {
  templateKey: 'LONGO_PREOP_ASSESSMENT',
  version: 1,
  displayName: 'Đánh giá trước phẫu thuật Longo',
  sections: [
    {
      key: 'history',
      label: 'Tiền sử và đánh giá toàn thân',
      fields: [
        {
          type: 'textarea',
          key: 'relevantHistory',
          label: 'Tiền sử liên quan',
          required: false,
        },
        {
          type: 'textarea',
          key: 'comorbidity',
          label: 'Bệnh đồng mắc',
          required: false,
        },
        {
          type: 'textarea',
          key: 'generalAssessment',
          label: 'Đánh giá toàn thân',
          required: false,
        },
      ],
    },
    {
      key: 'measurements',
      label: 'Sinh hiệu và đo lường',
      fields: [
        {
          type: 'number',
          key: 'weightKg',
          label: 'Cân nặng',
          required: false,
          unit: 'kg',
        },
        {
          type: 'number',
          key: 'heightCm',
          label: 'Chiều cao',
          required: false,
          unit: 'cm',
        },
        {
          type: 'number',
          key: 'pulseBpm',
          label: 'Mạch',
          required: false,
          unit: 'bpm',
        },
        {
          type: 'number',
          key: 'temperatureC',
          label: 'Nhiệt độ',
          required: false,
          unit: '°C',
        },
        {
          type: 'number',
          key: 'systolicBloodPressure',
          label: 'Huyết áp tâm thu',
          required: false,
          unit: 'mmHg',
        },
        {
          type: 'number',
          key: 'diastolicBloodPressure',
          label: 'Huyết áp tâm trương',
          required: false,
          unit: 'mmHg',
        },
      ],
    },
    {
      key: 'anemia',
      label: 'Thiếu máu',
      fields: [
        {
          type: 'boolean',
          key: 'anemiaPresent',
          label: 'Có tình trạng thiếu máu',
          required: false,
        },
        {
          type: 'textarea',
          key: 'anemiaNote',
          label: 'Ghi chú thiếu máu',
          required: false,
        },
      ],
    },
    {
      key: 'paraclinicalAndRectoscopy',
      label: 'Cận lâm sàng và nội soi trực tràng',
      fields: [
        {
          type: 'textarea',
          key: 'paraclinicalFindings',
          label: 'Kết quả cận lâm sàng',
          required: false,
        },
        {
          type: 'boolean',
          key: 'rectoscopyPerformed',
          label: 'Đã soi trực tràng',
          required: false,
        },
        {
          type: 'textarea',
          key: 'rectoscopyImpression',
          label: 'Nhận xét soi trực tràng',
          required: false,
        },
      ],
    },
    createAnorectalExamSection('preop'),
    {
      key: 'other',
      label: 'Ghi nhận khác',
      fields: [
        {
          type: 'textarea',
          key: 'additionalNotes',
          label: 'Ghi nhận thêm',
          required: false,
        },
      ],
    },
  ],
  scoreInstruments: [],
};
