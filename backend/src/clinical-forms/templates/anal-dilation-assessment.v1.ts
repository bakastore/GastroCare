import { ClinicalFormTemplate } from './types';

// ANAL_DILATION_ASSESSMENT v1 — CORE-04 T8
// (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md v0.3.1, T8 field contract).
//
// Each dilation session is its own Encounter + own submission of this
// template (docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md §11.9, §13.13) — never
// overwrites a prior session.
//
// The five locked concepts (anal diameter, dilation resistance, pain,
// bleeding, defecation ability) are ALL captured as free text in v1 — the
// contract is explicit ("V1 phải capture bằng free text") and explicitly
// forbids activating a single-choice 0-3 scale, a numeric grading, a total
// dilation score, or any "Mức 0..3" placeholder for ANY of them, including
// pain (this template deliberately does NOT reuse the numeric VAS field
// used elsewhere, to avoid silently introducing a structured pain scale
// this contract has not authorized for this specific instrument). The full
// 0-3 definitions remain DEFERRED_WITH_REASON pending clinician
// confirmation.
//
// No scoreInstruments — no total dilation score is fabricated.
export const analDilationAssessmentV1: ClinicalFormTemplate = {
  templateKey: 'ANAL_DILATION_ASSESSMENT',
  version: 1,
  displayName: 'Đánh giá nong hậu môn',
  sections: [
    {
      key: 'dilation',
      label: 'Đánh giá lần nong hậu môn',
      fields: [
        {
          type: 'textarea',
          key: 'analDiameterNote',
          label: 'Đường kính hậu môn',
          required: false,
        },
        {
          type: 'textarea',
          key: 'dilationResistanceNote',
          label: 'Mức độ kháng lực khi nong',
          required: false,
        },
        {
          type: 'textarea',
          key: 'dilationPainNote',
          label: 'Đau khi nong',
          required: false,
        },
        {
          type: 'textarea',
          key: 'dilationBleedingNote',
          label: 'Chảy máu khi nong',
          required: false,
        },
        {
          type: 'textarea',
          key: 'defecationAbilityNote',
          label: 'Khả năng đại tiện',
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
