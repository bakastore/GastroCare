import { ClinicalFormTemplate } from './types';

// HEMORRHOID_DIAGNOSIS v1 — Hemorrhoid Vertical Slice 2 T1 (DEC-012 CD-02,
// CD-03; docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md §6).
//
// Single required free-text field. No ICD, no custom taxonomy, no automatic
// classification, no inference from Examination/Goligher/symptoms/rules/AI —
// all explicitly OWNER LOCKED prohibitions. diagnosisSummary is authored
// entirely by the clinician.
export const hemorrhoidDiagnosisV1: ClinicalFormTemplate = {
  templateKey: 'HEMORRHOID_DIAGNOSIS',
  version: 1,
  displayName: 'Chẩn đoán',
  sections: [
    {
      key: 'diagnosis',
      label: 'Chẩn đoán',
      fields: [
        {
          type: 'textarea',
          key: 'diagnosisSummary',
          label: 'Chẩn đoán',
          required: true,
        },
      ],
    },
  ],
  scoreInstruments: [],
};
