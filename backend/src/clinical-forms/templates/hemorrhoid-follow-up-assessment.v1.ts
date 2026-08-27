import { ClinicalFormTemplate } from './types';

// HEMORRHOID_FOLLOW_UP_ASSESSMENT v1 — Hemorrhoid Vertical Slice 3 T1
// (DEC-013 §3; docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §D).
//
// Single required free-text field. No IMPROVED/STABLE/WORSE taxonomy, no
// scores, no inference, no AI — all explicitly OWNER LOCKED prohibitions.
// responseSummary is authored entirely by the clinician. Ancestry (which
// Encounter this may be captured on) is enforced separately — see
// hemorrhoid-continuous-care.ts.
export const hemorrhoidFollowUpAssessmentV1: ClinicalFormTemplate = {
  templateKey: 'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
  version: 1,
  displayName: 'Đánh giá tái khám',
  sections: [
    {
      key: 'followUpAssessment',
      label: 'Đánh giá tái khám',
      fields: [
        {
          type: 'textarea',
          key: 'responseSummary',
          label: 'Đánh giá tái khám',
          required: true,
        },
      ],
    },
  ],
  scoreInstruments: [],
};
