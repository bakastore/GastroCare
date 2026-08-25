import { getTemplate, getLatestTemplate } from './registry';
import { validateResponses } from './validation';
import { longoTwoWeekFollowupV1 } from './longo-two-week-followup.v1';

function allFields() {
  return longoTwoWeekFollowupV1.sections.flatMap((s) => s.fields);
}

describe('LONGO_TWO_WEEK_FOLLOWUP v1 — registry resolution', () => {
  it('resolves via getTemplate and getLatestTemplate', () => {
    expect(getTemplate('LONGO_TWO_WEEK_FOLLOWUP', 1)).toBeDefined();
    expect(getLatestTemplate('LONGO_TWO_WEEK_FOLLOWUP')?.version).toBe(1);
  });
});

describe('LONGO_TWO_WEEK_FOLLOWUP v1 — Owner Decision: NO Wexner at two weeks', () => {
  it('no field key mentions Wexner, and no scoreInstrument exists', () => {
    const keysLower = allFields().map((f) => f.key.toLowerCase());
    expect(keysLower.some((k) => k.includes('wexner'))).toBe(false);
    expect(longoTwoWeekFollowupV1.scoreInstruments).toHaveLength(0);
  });
});

describe('LONGO_TWO_WEEK_FOLLOWUP v1 — pain VAS 0-10', () => {
  it('accepts 0 and 10, rejects out of range', () => {
    expect(() =>
      validateResponses(longoTwoWeekFollowupV1, { twoWeekPainVas: 0 }, false),
    ).not.toThrow();
    expect(() =>
      validateResponses(longoTwoWeekFollowupV1, { twoWeekPainVas: 10 }, false),
    ).not.toThrow();
    expect(() =>
      validateResponses(longoTwoWeekFollowupV1, { twoWeekPainVas: 11 }, false),
    ).toThrow();
  });
});

describe('LONGO_TWO_WEEK_FOLLOWUP v1 — twoWeekDilationPerformed is a summary flag only', () => {
  it('is boolean, and no structured dilation-scale keys exist', () => {
    const field = allFields().find((f) => f.key === 'twoWeekDilationPerformed');
    expect(field?.type).toBe('boolean');
    const keysLower = allFields().map((f) => f.key.toLowerCase());
    expect(
      keysLower.some((k) => k.includes('dilationresistance') || k.includes('analdiameter')),
    ).toBe(false);
  });
});
