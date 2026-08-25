import { getTemplate, getLatestTemplate } from './registry';
import { validateResponses } from './validation';
import { longoEarlyPostopV1 } from './longo-early-postop.v1';

function allFields() {
  return longoEarlyPostopV1.sections.flatMap((s) => s.fields);
}

describe('LONGO_EARLY_POSTOP v1 — registry resolution', () => {
  it('resolves via getTemplate and getLatestTemplate', () => {
    expect(getTemplate('LONGO_EARLY_POSTOP', 1)).toBeDefined();
    expect(getLatestTemplate('LONGO_EARLY_POSTOP')?.version).toBe(1);
  });
});

describe('LONGO_EARLY_POSTOP v1 — field key integrity', () => {
  it('no duplicate field keys', () => {
    const keys = allFields().map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('LONGO_EARLY_POSTOP v1 — pain VAS 0-10 (locked range)', () => {
  it('accepts boundary values 0 and 10', () => {
    expect(() =>
      validateResponses(
        longoEarlyPostopV1,
        { earlyPostopPainVas: 0 },
        false,
      ),
    ).not.toThrow();
    expect(() =>
      validateResponses(
        longoEarlyPostopV1,
        { earlyPostopPainVas: 10 },
        false,
      ),
    ).not.toThrow();
  });

  it('rejects values outside 0-10', () => {
    expect(() =>
      validateResponses(
        longoEarlyPostopV1,
        { earlyPostopPainVas: -1 },
        false,
      ),
    ).toThrow();
    expect(() =>
      validateResponses(
        longoEarlyPostopV1,
        { earlyPostopPainVas: 11 },
        false,
      ),
    ).toThrow();
  });
});

describe('LONGO_EARLY_POSTOP v1 — no fabricated analgesic duration', () => {
  it('no field key mentions duration', () => {
    const keysLower = allFields().map((f) => f.key.toLowerCase());
    expect(keysLower.some((k) => k.includes('duration'))).toBe(false);
  });
});

describe('LONGO_EARLY_POSTOP v1 — no deferred instrument sneaks in', () => {
  it('no Wexner/HDSS/SHS/dilation-scale keys, no scoreInstruments', () => {
    const keysLower = allFields().map((f) => f.key.toLowerCase());
    for (const forbidden of ['wexner', 'hdss', 'shs']) {
      expect(keysLower.some((k) => k.includes(forbidden))).toBe(false);
    }
    expect(longoEarlyPostopV1.scoreInstruments).toHaveLength(0);
  });
});
