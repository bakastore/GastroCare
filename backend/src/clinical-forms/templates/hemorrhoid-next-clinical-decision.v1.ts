import { ClinicalFormTemplate } from './types';

// HEMORRHOID_NEXT_CLINICAL_DECISION v1 — Hemorrhoid Vertical Slice 3 T1
// (DEC-013 §4; docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §E).
//
// Single required free-text field. Deliberately a distinct template from
// HEMORRHOID_TREATMENT_DECISION (initial branch) — Contract §E: "Do NOT
// reuse HEMORRHOID_TREATMENT_DECISION on Return Encounter." No taxonomy, no
// inference. Sequence prerequisite (requires a COMPLETED
// HEMORRHOID_FOLLOW_UP_ASSESSMENT on the same Encounter) is enforced in
// hemorrhoid-sequence.ts.
export const hemorrhoidNextClinicalDecisionV1: ClinicalFormTemplate = {
  templateKey: 'HEMORRHOID_NEXT_CLINICAL_DECISION',
  version: 1,
  displayName: 'Quyết định điều trị tiếp theo',
  sections: [
    {
      key: 'nextClinicalDecision',
      label: 'Quyết định điều trị tiếp theo',
      fields: [
        {
          type: 'textarea',
          key: 'decisionSummary',
          label: 'Quyết định điều trị tiếp theo',
          required: true,
        },
      ],
    },
  ],
  scoreInstruments: [],
};
