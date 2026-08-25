import { ClinicalFormTemplate } from './types';

// LONGO_INTRAOP_RECORD v1 — CORE-04 T5
// (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md v0.3.1, T5 field contract).
//
// This form is attached to the Surgery Encounter. Encounter.occurredAt on
// that Encounter is the sole postoperative timing anchor used later by T10
// follow-up scheduling — nothing on this template stores or duplicates that
// anchor; createdAt/admission/discharge/manual elapsed-month are never used
// anywhere in this codebase for that purpose.
//
// Field groups, mapped 1:1 to the locked contract bullets:
//   - anesthesia -> free text only (no anesthesia taxonomy/semantics is
//     OWNER LOCKED — "không activate anesthesia semantics chưa khóa")
//   - operativeDuration -> minute, bloodLoss -> mL: plain number fields,
//     no min/max (no medical range is locked for either)
//   - additional procedures, stapler/specimen findings -> free text (no
//     structured vocabulary is locked)
//   - intraoperative complications -> a structured boolean presence flag
//     (mirrors the anemia pattern in T4: presence, never a taxonomy) plus
//     free-text detail — NOT the deferred structured complication
//     taxonomy
//   - a final free-text field for anything not safely standardized
//     elsewhere
//
// Deliberately NOT activated (still DEFERRED_WITH_REASON): Longo difficulty
// score / unresolved difficulty items, structured complication taxonomy,
// anesthesia semantics beyond free text.
//
// No scoreInstruments: the contract defines no derived score for this
// template.
export const longoIntraopRecordV1: ClinicalFormTemplate = {
  templateKey: 'LONGO_INTRAOP_RECORD',
  version: 1,
  displayName: 'Biên bản phẫu thuật Longo',
  sections: [
    {
      key: 'surgery',
      label: 'Thông số trong mổ',
      fields: [
        {
          type: 'textarea',
          key: 'anesthesiaNote',
          label: 'Vô cảm',
          required: false,
        },
        {
          type: 'number',
          key: 'operativeDurationMinutes',
          label: 'Thời gian phẫu thuật',
          required: false,
          unit: 'minute',
        },
        {
          type: 'number',
          key: 'bloodLossMl',
          label: 'Lượng máu mất',
          required: false,
          unit: 'mL',
        },
        {
          type: 'textarea',
          key: 'additionalProceduresNote',
          label: 'Thủ thuật kèm theo',
          required: false,
        },
        {
          type: 'textarea',
          key: 'staplerSpecimenFindings',
          label: 'Ghi nhận stapler/bệnh phẩm',
          required: false,
        },
      ],
    },
    {
      key: 'complications',
      label: 'Biến chứng trong mổ',
      fields: [
        {
          type: 'boolean',
          key: 'intraopComplicationsPresent',
          label: 'Có biến chứng trong mổ',
          required: false,
        },
        {
          type: 'textarea',
          key: 'intraopComplicationsNote',
          label: 'Ghi nhận biến chứng',
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
          key: 'otherFindingsNote',
          label: 'Ghi nhận khác',
          required: false,
        },
      ],
    },
  ],
  scoreInstruments: [],
};
