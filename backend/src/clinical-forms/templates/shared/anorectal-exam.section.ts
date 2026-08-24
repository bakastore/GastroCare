import { SectionDef } from '../types';

// ANORECTAL_EXAM — OWNER LOCKED as reusable section building blocks, NOT an
// independent entity (docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md §15):
// "shared definition + stage context + independent observation". Each
// stage (pre-op, post-anesthesia, outcome) that reuses this factory gets
// its own namespaced fields and its own independent row of responses —
// nothing here overwrites another stage's observation.
//
// Only concepts explicitly locked in the SSOT are included:
//   - Goligher grade I-IV (§13.6, Owner/clinician-validated)
//   - hemorrhoid clock-face location, 1h-12h, multi-select (§13.7)
//   - hemorrhoid count (§14.1 lists it as STRUCTURED; no range is locked
//     anywhere, so it is a plain optional number with no min/max — per T3
//     rule, this framework must not invent a medical range)
//   - prolapse, bleeding, skin tag (§15, named directly as reusable fields
//     with clear semantics)
//   - mucosa appearance (§15 names "mucosa" as reusable; no structured
//     value set is locked, so it is captured as free text)
//   - other finding (§14.2 locks "other finding" as FREE TEXT)
//
// Deliberately NOT included (still DEFERRED_WITH_REASON per §20): full
// rectoscopy vocabulary, exact post-anesthesia field equivalence, anal
// dilation 0-3 definitions, HDSS, SHS-HD, Longo difficulty items.
//
// All fields default to `required: false` — this is technical scaffolding,
// not a finished form. A consuming T4-T9 template decides its own
// per-field requirements when it composes this section (out of scope for
// T3).

const GOLIGHER_OPTIONS = [
  { value: 'I', label: 'Độ I' },
  { value: 'II', label: 'Độ II' },
  { value: 'III', label: 'Độ III' },
  { value: 'IV', label: 'Độ IV' },
];

const CLOCK_FACE_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 1;
  return { value: hour, label: `${hour}h` };
});

export function createAnorectalExamSection(keyPrefix: string): SectionDef {
  return {
    key: `${keyPrefix}AnorectalExamSection`,
    label: 'Khám hậu môn - trực tràng',
    fields: [
      {
        type: 'single_choice',
        key: `${keyPrefix}GoligherGrade`,
        label: 'Phân độ Goligher',
        required: false,
        options: GOLIGHER_OPTIONS,
      },
      {
        type: 'multi_select',
        key: `${keyPrefix}HemorrhoidLocation`,
        label: 'Vị trí búi trĩ (theo mặt đồng hồ)',
        required: false,
        options: CLOCK_FACE_OPTIONS,
      },
      {
        type: 'number',
        key: `${keyPrefix}HemorrhoidCount`,
        label: 'Số lượng búi trĩ',
        required: false,
      },
      {
        type: 'boolean',
        key: `${keyPrefix}Prolapse`,
        label: 'Sa búi trĩ',
        required: false,
      },
      {
        type: 'boolean',
        key: `${keyPrefix}Bleeding`,
        label: 'Chảy máu',
        required: false,
      },
      {
        type: 'boolean',
        key: `${keyPrefix}SkinTag`,
        label: 'Da thừa (mấu da)',
        required: false,
      },
      {
        type: 'text',
        key: `${keyPrefix}MucosaAppearance`,
        label: 'Tình trạng niêm mạc',
        required: false,
      },
      {
        type: 'textarea',
        key: `${keyPrefix}OtherFinding`,
        label: 'Ghi nhận khác',
        required: false,
      },
    ],
  };
}
