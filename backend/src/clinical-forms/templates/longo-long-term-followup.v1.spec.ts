import { getTemplate, getLatestTemplate } from './registry';
import { validateResponses, computeScores } from './validation';
import { longoLongTermFollowupV1 } from './longo-long-term-followup.v1';
import { wexnerItemKeys } from './shared/wexner.section';

function allFields() {
  return longoLongTermFollowupV1.sections.flatMap((s) => s.fields);
}

describe('LONGO_LONG_TERM_FOLLOWUP v1 — registry resolution', () => {
  it('resolves via getTemplate and getLatestTemplate', () => {
    expect(getTemplate('LONGO_LONG_TERM_FOLLOWUP', 1)).toBeDefined();
    expect(getLatestTemplate('LONGO_LONG_TERM_FOLLOWUP')?.version).toBe(1);
  });
});

describe('LONGO_LONG_TERM_FOLLOWUP v1 — field key integrity', () => {
  it('no duplicate field keys', () => {
    const keys = allFields().map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('LONGO_LONG_TERM_FOLLOWUP v1 — plannedTimepoint is required workflow identity', () => {
  it('field is required, single_choice, exactly MONTH_1/MONTH_3/MONTH_6', () => {
    const field = allFields().find((f) => f.key === 'plannedTimepoint');
    if (!field || field.type !== 'single_choice') {
      throw new Error('plannedTimepoint missing or wrong type');
    }
    expect(field.required).toBe(true);
    expect(field.options.map((o) => o.value).sort()).toEqual(
      ['MONTH_1', 'MONTH_3', 'MONTH_6'].sort(),
    );
  });

  it('completion (requireAll=true) rejects a submission missing plannedTimepoint', () => {
    expect(() =>
      validateResponses(longoLongTermFollowupV1, {}, true),
    ).toThrow(/plannedTimepoint/);
  });

  it('requiredness is scoped to plannedTimepoint plus the Wexner instrument completion rule only — no other clinical field is required', () => {
    const wexnerKeys = new Set(wexnerItemKeys('longTerm'));
    const otherRequired = allFields().filter(
      (f) => f.key !== 'plannedTimepoint' && !wexnerKeys.has(f.key) && f.required,
    );
    expect(otherRequired).toHaveLength(0);
  });
});

describe('LONGO_LONG_TERM_FOLLOWUP v1 — Wexner applies at every use of this template', () => {
  const itemKeys = wexnerItemKeys('longTerm');

  it('all 5 Wexner item fields exist, single_choice, 0-4', () => {
    expect(itemKeys).toHaveLength(5);
    for (const key of itemKeys) {
      const field = allFields().find((f) => f.key === key);
      if (!field || field.type !== 'single_choice') {
        throw new Error(`${key} missing or wrong type`);
      }
      expect(field.options.map((o) => o.value).sort()).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it('computes a deterministic total 0-20 when all items are answered', () => {
    const responses = {
      plannedTimepoint: 'MONTH_1',
      ...Object.fromEntries(itemKeys.map((k) => [k, 2])),
    };
    const scores = computeScores(longoLongTermFollowupV1, responses);
    expect(scores.longTermTotal).toBe(10);
  });

  it('never trusts a client-submitted total — computeScores always recomputes from items', () => {
    const responses = {
      plannedTimepoint: 'MONTH_1',
      ...Object.fromEntries(itemKeys.map((k) => [k, 0])),
    };
    const scores = computeScores(longoLongTermFollowupV1, responses);
    expect(scores.longTermTotal).toBe(0);
  });
});

describe('LONGO_LONG_TERM_FOLLOWUP v1 — Satisfaction reused, no extra scoring', () => {
  it('exactly one scoreInstrument exists (Wexner) — satisfaction is not scored', () => {
    expect(longoLongTermFollowupV1.scoreInstruments).toHaveLength(1);
    expect(longoLongTermFollowupV1.scoreInstruments[0].key).toBe('longTermTotal');
  });
});
