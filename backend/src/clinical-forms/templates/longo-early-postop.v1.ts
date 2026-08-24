import { ClinicalFormTemplate } from './types';
import { createPainVasField } from './shared/vas-pain.section';

// LONGO_EARLY_POSTOP v1 — CORE-04 T6
// (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md v0.3.1, T6 field contract).
//
// May be attached to the same Surgery/Admission Encounter it follows, when
// that is still the same clinical occurrence (docs/08 §11.6) — this
// template does not require or create a new Encounter by itself; that is a
// caller/workflow decision, not something this template enforces.
//
// Field groups, mapped 1:1 to the locked contract bullets:
//   - pain VAS 0-10 -> reuses the shared, OWNER LOCKED VAS field
//   - analgesics -> a structured boolean ("were analgesics used") plus
//     free text; duration is NOT included because the contract requires a
//     resolved duration definition ("nếu định nghĩa đã rõ") which does not
//     exist anywhere in the locked SSOT — fabricating one is forbidden
//   - bleeding / urinary retention / fever / prolapse / constipation /
//     diarrhea / tenesmus -> structured booleans (clear, unambiguous
//     presence/absence concepts, consistent with §14.1 STRUCTURED policy)
//   - first bowel movement timing -> free text (no locked unit/format
//     exists for "timing" — a number field would silently fabricate a
//     unit)
//   - stool characteristics, blood, patient sensation -> free text (no
//     locked structured vocabulary for any of the three)
//   - a final free-text field for anything not safely standardized
//     elsewhere
//
// No scoreInstruments: the contract defines no derived score for this
// template.
export const longoEarlyPostopV1: ClinicalFormTemplate = {
  templateKey: 'LONGO_EARLY_POSTOP',
  version: 1,
  displayName: 'Hậu phẫu sớm Longo',
  sections: [
    {
      key: 'painAndAnalgesia',
      label: 'Đau và giảm đau',
      fields: [
        createPainVasField('earlyPostop'),
        {
          type: 'boolean',
          key: 'analgesicsUsed',
          label: 'Có dùng thuốc giảm đau',
          required: false,
        },
        {
          type: 'textarea',
          key: 'analgesicsNote',
          label: 'Ghi chú giảm đau',
          required: false,
        },
      ],
    },
    {
      key: 'earlyPostopFindings',
      label: 'Ghi nhận hậu phẫu sớm',
      fields: [
        {
          type: 'boolean',
          key: 'bleeding',
          label: 'Chảy máu',
          required: false,
        },
        {
          type: 'boolean',
          key: 'urinaryRetention',
          label: 'Bí tiểu',
          required: false,
        },
        {
          type: 'boolean',
          key: 'fever',
          label: 'Sốt',
          required: false,
        },
        {
          type: 'boolean',
          key: 'prolapse',
          label: 'Sa búi trĩ',
          required: false,
        },
        {
          type: 'boolean',
          key: 'constipation',
          label: 'Táo bón',
          required: false,
        },
        {
          type: 'boolean',
          key: 'diarrhea',
          label: 'Tiêu chảy',
          required: false,
        },
        {
          type: 'boolean',
          key: 'tenesmus',
          label: 'Mót rặn',
          required: false,
        },
      ],
    },
    {
      key: 'bowelFunction',
      label: 'Chức năng đại tiện',
      fields: [
        {
          type: 'textarea',
          key: 'firstBowelMovementNote',
          label: 'Thời điểm đại tiện đầu tiên',
          required: false,
        },
        {
          type: 'textarea',
          key: 'stoolCharacteristicsNote',
          label: 'Đặc điểm phân',
          required: false,
        },
        {
          type: 'boolean',
          key: 'stoolBloodPresent',
          label: 'Phân có máu',
          required: false,
        },
        {
          type: 'textarea',
          key: 'patientSensationNote',
          label: 'Cảm giác của bệnh nhân',
          required: false,
        },
      ],
    },
    {
      key: 'other',
      label: 'Ghi nhận khác',
      fields: [
        {
          type: 'textarea',
          key: 'otherNotes',
          label: 'Ghi nhận khác',
          required: false,
        },
      ],
    },
  ],
  scoreInstruments: [],
};
