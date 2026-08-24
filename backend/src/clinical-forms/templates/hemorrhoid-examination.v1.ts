import { ClinicalFormTemplate } from './types';
import {
  GOLIGHER_OPTIONS,
  CLOCK_FACE_OPTIONS,
} from './shared/anorectal-exam.section';

// HEMORRHOID_EXAMINATION v1 — Hemorrhoid Vertical Slice 1 (DEC-010).
//
// Implements EXACTLY the 29 approved GENERAL_HEMORRHOID_EXAM concepts from
// DEC-010's evidence classification (LONGO_ATOMIC_FIELD_DICTIONARY_v1.md,
// 118 concepts classified: 29 GENERAL_HEMORRHOID_EXAM / 4 LONGO_SPECIFIC /
// 51 SURGERY_SPECIFIC / 5 RESEARCH_ONLY / 21 DEFERRED_SEMANTICS / 8
// NOT_RELEVANT). No field beyond this list is added or inferred.
//
// All fields are `required: false` — DEC-010 locks that a fully empty
// examination must be allowed to go DRAFT -> COMPLETED. Do not add "at
// least one field required" validation anywhere.
//
// Field-type choices follow the repo's established "no fabricated medical
// vocabulary" rule (see longo-preop-assessment.v1.ts, T3/T4 comments):
//   - history* flags -> boolean presence, matching the existing
//     `anemiaPresent`-style pattern already used for comorbidity flags in
//     LONGO_PREOP_ASSESSMENT; no severity/frequency scale is invented.
//   - historyOtherPregnancyDietBowelHabit -> free text (explicitly an
//     "other" catch-all concept, no structured value set locked).
//   - weight/height/pulse/temperature/systolicBloodPressure/
//     diastolicBloodPressure -> plain number fields, no min/max (no
//     medical range is OWNER LOCKED anywhere in this codebase — see T4
//     comment "không tự đặt medical ranges").
//   - anemiaStatus -> boolean presence flag (reuses the exact
//     anemiaPresent pattern from LONGO_PREOP_ASSESSMENT — no severity
//     scale is locked, so none is fabricated here).
//   - otherGeneralFinding -> free text.
//   - hemorrhoidGoligherGrade -> single_choice reusing GOLIGHER_OPTIONS
//     (I/II/III/IV), the exact vocabulary already OWNER LOCKED and used by
//     createAnorectalExamSection(). Exactly one field per examination, not
//     per-lesion (DEC-010 generalization decision).
//   - internal/external/mixedHemorrhoidCount -> plain number, no min/max
//     (same "no invented range" rule as the reusable anorectal section's
//     HemorrhoidCount field).
//   - internal/external/mixedHemorrhoidLocation -> multi_select reusing
//     CLOCK_FACE_OPTIONS (1h-12h), the exact vocabulary already OWNER
//     LOCKED for hemorrhoid clock-face location.
//   - internal/external/mixedHemorrhoidSize -> free text, one per group
//     (DEC-010 generalization: the single evidence concept
//     "mainHemorrhoidSize" is split into a size field per hemorrhoid group,
//     mirroring the existing per-group count/location split). No size
//     range/unit is locked anywhere in the SSOT; per Owner instruction to
//     prefer omitting a fabricated enum/numeric scale over guessing, each
//     is captured as a clinician-authored free-text description rather
//     than an invented cm range or S/M/L bucket. The undifferentiated
//     single `mainHemorrhoidSize` field is intentionally NOT kept
//     alongside these — DEC-010 correction: no duplicate/legacy
//     undifferentiated capture field remains once the generalized
//     per-group replacement exists.
//   - prolapseSymptom (patient-reported) / prolapseObserved
//     (clinician-observed) -> two boolean fields, per DEC-010's explicit
//     generalization split of the single evidence concept
//     "hemorrhoidProlapse".
//   - hemorrhoidFibrosis -> boolean, mirroring the existing boolean
//     presence-flag pattern used throughout this framework for a binary
//     clinical finding.
//   - bleedingSymptom (patient-reported) / bleedingObserved
//     (clinician-observed) -> two boolean fields, per DEC-010's explicit
//     generalization split of "hemorrhoidBleeding".
//   - sphincterTone -> free text. No locked tone vocabulary (e.g.
//     normal/reduced/increased) exists anywhere in the SSOT; inventing one
//     would fabricate a clinical scale, so this stays free text.
//   - rectalMucosaFinding -> free text, mirroring the existing
//     MucosaAppearance free-text field in the reusable anorectal section.
//   - associatedAnorectalLesion -> free text.
//   - skinTagFinding -> free text, mirroring the existing boolean SkinTag
//     flag's sibling concept but here as a documented FINDING (not just a
//     presence flag) per the DEC-010 field name — captured as free text
//     since no structured skin-tag vocabulary is locked.
//
// No scoreInstruments: DEC-010 defines no derived score for this template,
// and none is fabricated (HDSS/SHS-HD/anal-dilation/Longo-difficulty
// scoring remain deferred — see DEC-010 "Deferred / out of Vertical Slice
// 1").
export const hemorrhoidExaminationV1: ClinicalFormTemplate = {
  templateKey: 'HEMORRHOID_EXAMINATION',
  version: 1,
  displayName: 'Khám trĩ',
  sections: [
    {
      key: 'history',
      label: 'Tiền sử',
      fields: [
        {
          type: 'boolean',
          key: 'historyConstipation',
          label: 'Tiền sử táo bón',
          required: false,
        },
        {
          type: 'boolean',
          key: 'historyPriorAnorectalSurgery',
          label: 'Tiền sử phẫu thuật vùng hậu môn - trực tràng',
          required: false,
        },
        {
          type: 'boolean',
          key: 'historyRespiratoryDisease',
          label: 'Tiền sử bệnh hô hấp',
          required: false,
        },
        {
          type: 'boolean',
          key: 'historyDiabetes',
          label: 'Tiền sử đái tháo đường',
          required: false,
        },
        {
          type: 'boolean',
          key: 'historyCirrhosis',
          label: 'Tiền sử xơ gan',
          required: false,
        },
        {
          type: 'textarea',
          key: 'historyOtherPregnancyDietBowelHabit',
          label: 'Tiền sử khác (thai kỳ / chế độ ăn / thói quen đại tiện)',
          required: false,
        },
      ],
    },
    {
      key: 'vitals',
      label: 'Sinh hiệu',
      fields: [
        { type: 'number', key: 'weight', label: 'Cân nặng', required: false, unit: 'kg' },
        { type: 'number', key: 'height', label: 'Chiều cao', required: false, unit: 'cm' },
        { type: 'number', key: 'pulse', label: 'Mạch', required: false, unit: 'bpm' },
        {
          type: 'number',
          key: 'temperature',
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
      key: 'generalFindings',
      label: 'Đánh giá toàn thân',
      fields: [
        {
          type: 'boolean',
          key: 'anemiaStatus',
          label: 'Có tình trạng thiếu máu',
          required: false,
        },
        {
          type: 'textarea',
          key: 'otherGeneralFinding',
          label: 'Ghi nhận toàn thân khác',
          required: false,
        },
      ],
    },
    {
      key: 'hemorrhoidMorphology',
      label: 'Đặc điểm búi trĩ',
      fields: [
        {
          type: 'single_choice',
          key: 'hemorrhoidGoligherGrade',
          label: 'Phân độ Goligher',
          required: false,
          options: GOLIGHER_OPTIONS,
        },
        {
          type: 'number',
          key: 'internalHemorrhoidCount',
          label: 'Số lượng búi trĩ nội',
          required: false,
        },
        {
          type: 'multi_select',
          key: 'internalHemorrhoidLocation',
          label: 'Vị trí búi trĩ nội (theo mặt đồng hồ)',
          required: false,
          options: CLOCK_FACE_OPTIONS,
        },
        {
          type: 'text',
          key: 'internalHemorrhoidSize',
          label: 'Kích thước búi trĩ nội',
          required: false,
        },
        {
          type: 'number',
          key: 'externalHemorrhoidCount',
          label: 'Số lượng búi trĩ ngoại',
          required: false,
        },
        {
          type: 'multi_select',
          key: 'externalHemorrhoidLocation',
          label: 'Vị trí búi trĩ ngoại (theo mặt đồng hồ)',
          required: false,
          options: CLOCK_FACE_OPTIONS,
        },
        {
          type: 'text',
          key: 'externalHemorrhoidSize',
          label: 'Kích thước búi trĩ ngoại',
          required: false,
        },
        {
          type: 'number',
          key: 'mixedHemorrhoidCount',
          label: 'Số lượng búi trĩ hỗn hợp',
          required: false,
        },
        {
          type: 'multi_select',
          key: 'mixedHemorrhoidLocation',
          label: 'Vị trí búi trĩ hỗn hợp (theo mặt đồng hồ)',
          required: false,
          options: CLOCK_FACE_OPTIONS,
        },
        {
          type: 'text',
          key: 'mixedHemorrhoidSize',
          label: 'Kích thước búi trĩ hỗn hợp',
          required: false,
        },
      ],
    },
    {
      key: 'prolapseAndBleeding',
      label: 'Sa búi trĩ và chảy máu',
      fields: [
        {
          type: 'boolean',
          key: 'prolapseSymptom',
          label: 'Sa búi trĩ (bệnh nhân khai)',
          required: false,
        },
        {
          type: 'boolean',
          key: 'prolapseObserved',
          label: 'Sa búi trĩ (bác sĩ ghi nhận khi khám)',
          required: false,
        },
        {
          type: 'boolean',
          key: 'hemorrhoidFibrosis',
          label: 'Xơ hóa búi trĩ',
          required: false,
        },
        {
          type: 'boolean',
          key: 'bleedingSymptom',
          label: 'Chảy máu (bệnh nhân khai)',
          required: false,
        },
        {
          type: 'boolean',
          key: 'bleedingObserved',
          label: 'Chảy máu (bác sĩ ghi nhận khi khám)',
          required: false,
        },
      ],
    },
    {
      key: 'anorectalExamFindings',
      label: 'Ghi nhận khám hậu môn - trực tràng khác',
      fields: [
        {
          type: 'text',
          key: 'sphincterTone',
          label: 'Trương lực cơ thắt hậu môn',
          required: false,
        },
        {
          type: 'textarea',
          key: 'rectalMucosaFinding',
          label: 'Tình trạng niêm mạc trực tràng',
          required: false,
        },
        {
          type: 'textarea',
          key: 'associatedAnorectalLesion',
          label: 'Tổn thương hậu môn - trực tràng phối hợp',
          required: false,
        },
        {
          type: 'textarea',
          key: 'skinTagFinding',
          label: 'Ghi nhận da thừa (mấu da)',
          required: false,
        },
      ],
    },
  ],
  scoreInstruments: [],
};
