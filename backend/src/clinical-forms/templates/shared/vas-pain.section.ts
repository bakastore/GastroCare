import { FieldDef, SectionDef } from '../types';

// Pain VAS (Visual Analogue Scale) — OWNER LOCKED (docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md
// §13.11/§13.12): 0-10, "0 = không đau" (0 = no pain). Locked as an explicit
// numeric range (unlike weight/height/pulse/etc., which have NO locked
// range and therefore declare no min/max) — so this field is the one place
// a min/max IS appropriate to enforce. Reused across LONGO_EARLY_POSTOP
// (T6), LONGO_TWO_WEEK_FOLLOWUP (T7) and LONGO_LONG_TERM_FOLLOWUP (T9) so
// the same locked semantics are never redefined per template.

export function painVasFieldKey(keyPrefix: string): string {
  return `${keyPrefix}PainVas`;
}

export function createPainVasField(keyPrefix: string): FieldDef {
  return {
    type: 'number',
    key: painVasFieldKey(keyPrefix),
    label: 'Điểm đau VAS (0 = không đau, 10 = đau nhất)',
    required: false,
    min: 0,
    max: 10,
  };
}

export function createPainVasSection(keyPrefix: string): SectionDef {
  return {
    key: `${keyPrefix}PainVasSection`,
    label: 'Đánh giá đau (VAS)',
    fields: [createPainVasField(keyPrefix)],
  };
}
