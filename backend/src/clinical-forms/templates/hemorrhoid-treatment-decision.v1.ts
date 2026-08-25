import { ClinicalFormTemplate } from './types';

// HEMORRHOID_TREATMENT_DECISION v1 — Hemorrhoid Vertical Slice 2 T2
// (DEC-012 CD-04; docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md §7).
//
// Single required free-text field. No taxonomy, no automatic
// Procedure/Surgery creation, no inference from decisionSummary — Treatment
// Decision != Procedure performed != Surgery performed (OWNER LOCKED
// invariant, unaffected by anything captured here).
export const hemorrhoidTreatmentDecisionV1: ClinicalFormTemplate = {
  templateKey: 'HEMORRHOID_TREATMENT_DECISION',
  version: 1,
  displayName: 'Quyết định điều trị',
  sections: [
    {
      key: 'treatmentDecision',
      label: 'Quyết định điều trị',
      fields: [
        {
          type: 'textarea',
          key: 'decisionSummary',
          label: 'Quyết định điều trị',
          required: true,
        },
      ],
    },
  ],
  scoreInstruments: [],
};
