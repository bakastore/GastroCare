import { getTemplate, getLatestTemplate } from './registry';
import { validateResponses } from './validation';
import { longoIntraopRecordV1 } from './longo-intraop-record.v1';

function allFields() {
  return longoIntraopRecordV1.sections.flatMap((s) => s.fields);
}

describe('LONGO_INTRAOP_RECORD v1 — registry resolution', () => {
  it('resolves via getTemplate and getLatestTemplate', () => {
    expect(getTemplate('LONGO_INTRAOP_RECORD', 1)).toBeDefined();
    expect(getLatestTemplate('LONGO_INTRAOP_RECORD')?.version).toBe(1);
  });
});

describe('LONGO_INTRAOP_RECORD v1 — field key integrity', () => {
  it('no duplicate field keys', () => {
    const keys = allFields().map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('LONGO_INTRAOP_RECORD v1 — operativeDuration/bloodLoss: no fabricated ranges', () => {
  it('neither field declares min/max, and extreme values are accepted', () => {
    for (const key of ['operativeDurationMinutes', 'bloodLossMl']) {
      const field = allFields().find((f) => f.key === key);
      if (!field || field.type !== 'number') throw new Error(`${key} missing`);
      expect(field.min).toBeUndefined();
      expect(field.max).toBeUndefined();
    }
    expect(() =>
      validateResponses(
        longoIntraopRecordV1,
        { operativeDurationMinutes: 0, bloodLossMl: 99999 },
        false,
      ),
    ).not.toThrow();
  });
});

describe('LONGO_INTRAOP_RECORD v1 — no deferred/fabricated semantics', () => {
  it('no difficulty score, complication taxonomy, or scoreInstrument exists', () => {
    const keysLower = allFields().map((f) => f.key.toLowerCase());
    for (const forbidden of ['difficulty', 'taxonomy']) {
      expect(keysLower.some((k) => k.includes(forbidden))).toBe(false);
    }
    expect(longoIntraopRecordV1.scoreInstruments).toHaveLength(0);
  });

  it('complications is a boolean presence flag plus free text, not a structured taxonomy', () => {
    const present = allFields().find(
      (f) => f.key === 'intraopComplicationsPresent',
    );
    const note = allFields().find(
      (f) => f.key === 'intraopComplicationsNote',
    );
    expect(present?.type).toBe('boolean');
    expect(note?.type).toBe('textarea');
  });
});
