import { SectionDef, ScoreInstrumentDef } from '../types';

// Wexner (Jorge-Wexner) Continence Grading Scale — OWNER LOCKED prospective
// model (docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md §16): 5 items, each 0-4,
// deterministic total 0-20. Item wording is the standard published
// instrument (public clinical instrument, independent of the source
// dataset) — see design/REAL_WORLD_FORM_ALIGNMENT.md §8 for why the
// source's own item-level wording was not extractable at sufficient
// corpus-wide confidence. CORE-04 T3 factors this out of
// hemorrhoid-longo-followup.v1.ts into a reusable, namespaced definition so
// future Longo templates (T9 — LONGO_LONG_TERM_FOLLOWUP) can embed it
// without key collisions. This factory does not attach the instrument to
// any template — T3 scope is framework only.

export const WEXNER_INSTRUMENT_VERSION = 1;

const WEXNER_FREQUENCY_OPTIONS = [
  { value: 0, label: 'Không bao giờ' },
  { value: 1, label: 'Hiếm khi (<1 lần/tháng)' },
  { value: 2, label: 'Thỉnh thoảng (<1 lần/tuần, ≥1 lần/tháng)' },
  { value: 3, label: 'Hàng tuần (<1 lần/ngày, ≥1 lần/tuần)' },
  { value: 4, label: 'Hàng ngày (≥1 lần/ngày)' },
];

const WEXNER_ITEM_SUFFIXES = [
  'SolidStool',
  'LiquidStool',
  'Gas',
  'PadWearing',
  'LifestyleAlteration',
];

const WEXNER_ITEM_LABELS = [
  'Đại tiện không tự chủ với phân rắn',
  'Đại tiện không tự chủ với phân lỏng',
  'Không tự chủ với hơi',
  'Phải mang băng vệ sinh/tã',
  'Thay đổi lối sống do rối loạn tự chủ',
];

export function wexnerItemKeys(keyPrefix: string): string[] {
  return WEXNER_ITEM_SUFFIXES.map((suffix) => `${keyPrefix}${suffix}`);
}

/**
 * Field keys are namespaced with `keyPrefix` (e.g. "month1Wexner",
 * "month3Wexner") so the same reusable section can appear more than once
 * across a template's sections/timepoints without key collisions.
 */
export function createWexnerSection(keyPrefix: string): SectionDef {
  const itemKeys = wexnerItemKeys(keyPrefix);
  return {
    key: `${keyPrefix}Section`,
    label: 'Đánh giá khả năng tự chủ hậu môn (thang điểm Wexner)',
    fields: itemKeys.map((key, index) => ({
      type: 'single_choice',
      key,
      label: WEXNER_ITEM_LABELS[index],
      required: true,
      options: WEXNER_FREQUENCY_OPTIONS,
    })),
  };
}

export function createWexnerScoreInstrument(
  keyPrefix: string,
): ScoreInstrumentDef {
  return {
    key: `${keyPrefix}Total`,
    label: 'Tổng điểm Wexner',
    itemFieldKeys: wexnerItemKeys(keyPrefix),
    minTotal: 0,
    maxTotal: 20,
  };
}
