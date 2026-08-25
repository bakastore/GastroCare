import { getTemplate, getLatestTemplate } from './registry';
import { validateResponses } from './validation';
import { longoPreopAssessmentV1 } from './longo-preop-assessment.v1';
import { FieldDef } from './types';

function allFields(): FieldDef[] {
  return longoPreopAssessmentV1.sections.flatMap((s) => s.fields);
}

function fieldByKey(key: string): FieldDef {
  const field = allFields().find((f) => f.key === key);
  if (!field) throw new Error(`field ${key} not found`);
  return field;
}

describe('LONGO_PREOP_ASSESSMENT v1 — registry resolution', () => {
  it('1. resolves via getTemplate("LONGO_PREOP_ASSESSMENT", 1)', () => {
    const template = getTemplate('LONGO_PREOP_ASSESSMENT', 1);
    expect(template).toBeDefined();
    expect(template?.templateKey).toBe('LONGO_PREOP_ASSESSMENT');
    expect(template?.version).toBe(1);
  });

  it('2. getLatestTemplate resolves the same v1 (only version registered)', () => {
    const template = getLatestTemplate('LONGO_PREOP_ASSESSMENT');
    expect(template?.version).toBe(1);
  });
});

describe('LONGO_PREOP_ASSESSMENT v1 — field key integrity', () => {
  it('3. no duplicate field keys across the whole template', () => {
    const keys = allFields().map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('4. the reused anorectal-exam section keys are namespaced with "preop" and do not collide with any other section', () => {
    const anorectalKeys = allFields()
      .map((f) => f.key)
      .filter((k) => k.startsWith('preop'));
    expect(anorectalKeys.length).toBeGreaterThan(0);
    const nonAnorectalKeys = allFields()
      .map((f) => f.key)
      .filter((k) => !k.startsWith('preop'));
    const overlap = anorectalKeys.filter((k) => nonAnorectalKeys.includes(k));
    expect(overlap).toHaveLength(0);
  });
});

describe('LONGO_PREOP_ASSESSMENT v1 — Goligher (reused from anorectal section)', () => {
  it('5. accepts each locked value I-IV', () => {
    for (const grade of ['I', 'II', 'III', 'IV']) {
      expect(() =>
        validateResponses(
          longoPreopAssessmentV1,
          { preopGoligherGrade: grade },
          false,
        ),
      ).not.toThrow();
    }
  });

  it('6. rejects a value outside the locked set', () => {
    expect(() =>
      validateResponses(
        longoPreopAssessmentV1,
        { preopGoligherGrade: 'V' },
        false,
      ),
    ).toThrow();
  });
});

describe('LONGO_PREOP_ASSESSMENT v1 — clock-face hemorrhoid location (reused from anorectal section)', () => {
  it('7. accepts a valid multi-select array of clock-face hours', () => {
    expect(() =>
      validateResponses(
        longoPreopAssessmentV1,
        { preopHemorrhoidLocation: [3, 7, 11] },
        false,
      ),
    ).not.toThrow();
  });

  it('8. rejects an hour outside 1-12', () => {
    expect(() =>
      validateResponses(
        longoPreopAssessmentV1,
        { preopHemorrhoidLocation: [0] },
        false,
      ),
    ).toThrow();
    expect(() =>
      validateResponses(
        longoPreopAssessmentV1,
        { preopHemorrhoidLocation: [13] },
        false,
      ),
    ).toThrow();
  });

  it('9. rejects a duplicate hour within the same response (T3 multi_select rule)', () => {
    expect(() =>
      validateResponses(
        longoPreopAssessmentV1,
        { preopHemorrhoidLocation: [5, 5] },
        false,
      ),
    ).toThrow();
  });
});

describe('LONGO_PREOP_ASSESSMENT v1 — measurements: no fabricated ranges', () => {
  it('10. weight/height/pulse/temperature/BP fields declare no min/max, and extreme values are accepted', () => {
    for (const key of [
      'weightKg',
      'heightCm',
      'pulseBpm',
      'temperatureC',
      'systolicBloodPressure',
      'diastolicBloodPressure',
    ]) {
      const field = fieldByKey(key);
      if (field.type !== 'number')
        throw new Error(`${key} expected to be a number field`);
      expect(field.min).toBeUndefined();
      expect(field.max).toBeUndefined();
    }

    expect(() =>
      validateResponses(
        longoPreopAssessmentV1,
        {
          weightKg: -5,
          heightCm: 999,
          pulseBpm: 0,
          temperatureC: 1000,
          systolicBloodPressure: -1,
          diastolicBloodPressure: 99999,
        },
        false,
      ),
    ).not.toThrow();
  });
});

describe('LONGO_PREOP_ASSESSMENT v1 — anemia: no derived rule', () => {
  it('11. anemiaPresent is an independent boolean; no Hb/Hct field exists anywhere in the template, and nothing computes anemiaPresent from another field', () => {
    const keys = allFields().map((f) => f.key.toLowerCase());
    expect(keys.some((k) => k.includes('hb') || k.includes('hct'))).toBe(false);

    const anemiaField = fieldByKey('anemiaPresent');
    expect(anemiaField.type).toBe('boolean');

    // Setting anemiaPresent has no side effect on any other field, and no
    // scoreInstrument (there are none in this template) derives from it.
    expect(longoPreopAssessmentV1.scoreInstruments).toHaveLength(0);
  });
});

describe('LONGO_PREOP_ASSESSMENT v1 — rectoscopy: minimal structured element only', () => {
  it('12. only a presence boolean and a free-text impression exist; no deferred finding vocabulary is activated', () => {
    const rectoscopyKeys = allFields()
      .map((f) => f.key)
      .filter((k) => k.toLowerCase().includes('rectoscop'));
    expect(rectoscopyKeys.sort()).toEqual(
      ['rectoscopyImpression', 'rectoscopyPerformed'].sort(),
    );
    expect(fieldByKey('rectoscopyPerformed').type).toBe('boolean');
    expect(fieldByKey('rectoscopyImpression').type).toBe('textarea');

    // No deferred instrument/vocabulary sneaks in as a field on this
    // template: Wexner, HDSS, SHS-HD, dilation 0-3, Longo difficulty.
    const allKeysLower = allFields().map((f) => f.key.toLowerCase());
    for (const forbidden of [
      'wexner',
      'hdss',
      'shs',
      'dilation',
      'difficulty',
    ]) {
      expect(allKeysLower.some((k) => k.includes(forbidden))).toBe(false);
    }
  });
});
