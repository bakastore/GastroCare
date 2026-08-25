import { ClinicalFormTemplate } from './types';
import { createPainVasField } from './shared/vas-pain.section';

// LONGO_TWO_WEEK_FOLLOWUP v1 — CORE-04 T7
// (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md v0.3.1, T7 field contract).
//
// OWNER DECISION (docs/DECISION_LOG.md DEC-007 #1, contract §T7): Wexner is
// NOT implemented at the two-week milestone in v1. This template contains
// no Wexner fields, no Wexner total, and does not import
// backend/src/clinical-forms/templates/shared/wexner.section.ts at all —
// enforced structurally, not just by omission.
//
// `twoWeekDilationPerformed` is a summary/intervention flag only (contract
// wording verbatim) — it never captures or overwrites the detail of an
// actual dilation session; a real dilation is its own Encounter +
// ANAL_DILATION_ASSESSMENT submission (T8).
export const longoTwoWeekFollowupV1: ClinicalFormTemplate = {
  templateKey: 'LONGO_TWO_WEEK_FOLLOWUP',
  version: 1,
  displayName: 'Tái khám 2 tuần sau phẫu thuật Longo',
  sections: [
    {
      key: 'followup',
      label: 'Đánh giá tái khám 2 tuần',
      fields: [
        createPainVasField('twoWeek'),
        {
          type: 'boolean',
          key: 'bleeding',
          label: 'Chảy máu',
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
          key: 'skinTags',
          label: 'Da thừa (mấu da)',
          required: false,
        },
        {
          type: 'textarea',
          key: 'defecationStatusNote',
          label: 'Tình trạng đại tiện',
          required: false,
        },
        {
          type: 'boolean',
          key: 'earlyAnalStenosis',
          label: 'Hẹp hậu môn sớm',
          required: false,
        },
        {
          type: 'boolean',
          key: 'twoWeekDilationPerformed',
          label: 'Đã nong hậu môn',
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
