import { SectionDef } from '../types';

// Satisfaction — OWNER LOCKED (docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md §18):
// a single structured item with exactly 5 levels, explicitly "not a
// multi-item instrument" — so unlike Wexner, this has no companion score
// instrument. The 5 display labels below are the exact locked wording;
// the `value` codes are stable, neutral engineering identifiers (matching
// this codebase's existing enum-code convention, e.g. CareEpisodeStatus)
// and do not assert an ordinal numeric scale the SSOT never locked.

const SATISFACTION_OPTIONS = [
  { value: 'VERY_SATISFIED', label: 'Rất hài lòng' },
  { value: 'SATISFIED', label: 'Hài lòng' },
  { value: 'NEUTRAL', label: 'Trung bình' },
  { value: 'DISSATISFIED', label: 'Không hài lòng' },
  { value: 'VERY_DISSATISFIED', label: 'Rất không hài lòng' },
];

export function satisfactionFieldKey(keyPrefix: string): string {
  return `${keyPrefix}Satisfaction`;
}

export function createSatisfactionSection(keyPrefix: string): SectionDef {
  return {
    key: `${keyPrefix}SatisfactionSection`,
    label: 'Đánh giá mức độ hài lòng',
    fields: [
      {
        type: 'single_choice',
        key: satisfactionFieldKey(keyPrefix),
        label: 'Mức độ hài lòng của bệnh nhân',
        required: false,
        options: SATISFACTION_OPTIONS,
      },
    ],
  };
}
