import { getTemplate, getLatestTemplate } from './registry';
import { validateResponses, computeScores } from './validation';
import { hemorrhoidExaminationV1 } from './hemorrhoid-examination.v1';
import { FieldDef } from './types';

// DEC-010's exact 29 approved GENERAL_HEMORRHOID_EXAM concepts, after the
// three OWNER-LOCKED generalizations, yield 33 actual capture fields — the
// authoritative list this template must match FIELD-FOR-FIELD, no more, no
// less:
//   - mainHemorrhoidSize (1 concept) -> internal/external/mixedHemorrhoidSize
//     (3 fields, net +2)
//   - hemorrhoidProlapse (1 concept) -> prolapseSymptom/prolapseObserved
//     (2 fields, net +1)
//   - hemorrhoidBleeding (1 concept) -> bleedingSymptom/bleedingObserved
//     (2 fields, net +1)
// 29 + 2 + 1 + 1 = 33. The undifferentiated legacy concepts
// (mainHemorrhoidSize/hemorrhoidProlapse/hemorrhoidBleeding) must NOT
// remain as competing/duplicate capture fields — only their generalized
// replacements exist below.
const EXPECTED_FIELD_KEYS = [
  'historyConstipation',
  'historyPriorAnorectalSurgery',
  'historyRespiratoryDisease',
  'historyDiabetes',
  'historyCirrhosis',
  'historyOtherPregnancyDietBowelHabit',
  'weight',
  'height',
  'pulse',
  'temperature',
  'systolicBloodPressure',
  'diastolicBloodPressure',
  'anemiaStatus',
  'otherGeneralFinding',
  'hemorrhoidGoligherGrade',
  'internalHemorrhoidCount',
  'internalHemorrhoidLocation',
  'internalHemorrhoidSize',
  'externalHemorrhoidCount',
  'externalHemorrhoidLocation',
  'externalHemorrhoidSize',
  'mixedHemorrhoidCount',
  'mixedHemorrhoidLocation',
  'mixedHemorrhoidSize',
  'prolapseSymptom',
  'prolapseObserved',
  'hemorrhoidFibrosis',
  'bleedingSymptom',
  'bleedingObserved',
  'sphincterTone',
  'rectalMucosaFinding',
  'associatedAnorectalLesion',
  'skinTagFinding',
].sort();

function allFields(): FieldDef[] {
  return hemorrhoidExaminationV1.sections.flatMap((s) => s.fields);
}

function fieldByKey(key: string): FieldDef {
  const field = allFields().find((f) => f.key === key);
  if (!field) throw new Error(`field ${key} not found`);
  return field;
}

describe('HEMORRHOID_EXAMINATION v1 — registry resolution', () => {
  it('resolves via getTemplate("HEMORRHOID_EXAMINATION", 1) and getLatestTemplate', () => {
    const template = getTemplate('HEMORRHOID_EXAMINATION', 1);
    expect(template).toBeDefined();
    expect(template?.templateKey).toBe('HEMORRHOID_EXAMINATION');
    expect(template?.version).toBe(1);
    expect(getLatestTemplate('HEMORRHOID_EXAMINATION')?.version).toBe(1);
  });
});

describe('HEMORRHOID_EXAMINATION v1 — field set matches DEC-010 exactly (33 fields: 29 concepts + net +4 from the three approved generalizations)', () => {
  it('field keys exactly equal the DEC-010 approved list — no field added or omitted', () => {
    const actualKeys = allFields()
      .map((f) => f.key)
      .sort();
    expect(actualKeys).toEqual(EXPECTED_FIELD_KEYS);
  });

  it('has exactly 33 capture fields', () => {
    expect(allFields().length).toBe(33);
  });

  it('no duplicate field keys', () => {
    const keys = allFields().map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every field is required: false — no "at least one field required" rule exists anywhere', () => {
    for (const field of allFields()) {
      expect(field.required).toBe(false);
    }
  });

  it('no scoreInstruments are fabricated (HDSS/SHS-HD/dilation/Longo-difficulty/Wexner remain deferred)', () => {
    expect(hemorrhoidExaminationV1.scoreInstruments).toHaveLength(0);
    const allKeysLower = allFields().map((f) => f.key.toLowerCase());
    for (const forbidden of [
      'wexner',
      'hdss',
      'shs',
      'dilation',
      'difficulty',
      'rectoscop',
    ]) {
      expect(allKeysLower.some((k) => k.includes(forbidden))).toBe(false);
    }
  });
});

describe('HEMORRHOID_EXAMINATION v1 — fully empty examination', () => {
  it('validates as DRAFT (requireAll=false) with {}', () => {
    expect(() =>
      validateResponses(hemorrhoidExaminationV1, {}, false),
    ).not.toThrow();
  });

  it('validates as COMPLETED (requireAll=true) with {} — no required field exists', () => {
    expect(() =>
      validateResponses(hemorrhoidExaminationV1, {}, true),
    ).not.toThrow();
  });

  it('computeScores on an empty response returns an empty scores object (no instrument defined)', () => {
    expect(computeScores(hemorrhoidExaminationV1, {})).toEqual({});
  });
});

describe('HEMORRHOID_EXAMINATION v1 — Goligher: exactly one field, reusing the locked I-IV vocabulary', () => {
  it('exactly one hemorrhoidGoligherGrade field exists (not per-lesion)', () => {
    const goligherKeys = allFields()
      .map((f) => f.key)
      .filter((k) => k.toLowerCase().includes('goligher'));
    expect(goligherKeys).toEqual(['hemorrhoidGoligherGrade']);
  });

  it('accepts each locked value I-IV and rejects an out-of-set value', () => {
    for (const grade of ['I', 'II', 'III', 'IV']) {
      expect(() =>
        validateResponses(
          hemorrhoidExaminationV1,
          { hemorrhoidGoligherGrade: grade },
          false,
        ),
      ).not.toThrow();
    }
    expect(() =>
      validateResponses(
        hemorrhoidExaminationV1,
        { hemorrhoidGoligherGrade: 'V' },
        false,
      ),
    ).toThrow();
  });
});

describe('HEMORRHOID_EXAMINATION v1 — Internal/External/Mixed morphology fields', () => {
  it('each group has its own independent count (number), location (clock-face multi_select), and size (text) field', () => {
    for (const prefix of ['internal', 'external', 'mixed']) {
      const countField = fieldByKey(`${prefix}HemorrhoidCount`);
      expect(countField.type).toBe('number');
      const locationField = fieldByKey(`${prefix}HemorrhoidLocation`);
      expect(locationField.type).toBe('multi_select');
      const sizeField = fieldByKey(`${prefix}HemorrhoidSize`);
      expect(sizeField.type).toBe('text');
    }
  });

  it('exactly three size fields exist, one per group — no shared/undifferentiated size field', () => {
    const sizeKeys = allFields()
      .map((f) => f.key)
      .filter((k) => k.toLowerCase().includes('size'))
      .sort();
    expect(sizeKeys).toEqual([
      'externalHemorrhoidSize',
      'internalHemorrhoidSize',
      'mixedHemorrhoidSize',
    ]);
  });

  it('all three size values persist independently and do not overwrite one another', () => {
    const responses = {
      internalHemorrhoidSize: '1cm',
      externalHemorrhoidSize: '2cm',
      mixedHemorrhoidSize: '3cm',
    };
    expect(() =>
      validateResponses(hemorrhoidExaminationV1, responses, false),
    ).not.toThrow();
    expect(responses.internalHemorrhoidSize).toBe('1cm');
    expect(responses.externalHemorrhoidSize).toBe('2cm');
    expect(responses.mixedHemorrhoidSize).toBe('3cm');
  });

  it('clock-face location rejects an hour outside 1-12 and duplicates', () => {
    expect(() =>
      validateResponses(
        hemorrhoidExaminationV1,
        { internalHemorrhoidLocation: [0] },
        false,
      ),
    ).toThrow();
    expect(() =>
      validateResponses(
        hemorrhoidExaminationV1,
        { internalHemorrhoidLocation: [3, 3] },
        false,
      ),
    ).toThrow();
  });
});

describe('HEMORRHOID_EXAMINATION v1 — symptom vs observed split', () => {
  it('prolapseSymptom and prolapseObserved are independent boolean fields that persist independent, even opposite, values', () => {
    expect(fieldByKey('prolapseSymptom').type).toBe('boolean');
    expect(fieldByKey('prolapseObserved').type).toBe('boolean');
    const responses = { prolapseSymptom: true, prolapseObserved: false };
    expect(() =>
      validateResponses(hemorrhoidExaminationV1, responses, false),
    ).not.toThrow();
    expect(responses.prolapseSymptom).toBe(true);
    expect(responses.prolapseObserved).toBe(false);
  });

  it('bleedingSymptom and bleedingObserved are independent boolean fields that persist independent, even opposite, values', () => {
    expect(fieldByKey('bleedingSymptom').type).toBe('boolean');
    expect(fieldByKey('bleedingObserved').type).toBe('boolean');
    const responses = { bleedingSymptom: false, bleedingObserved: true };
    expect(() =>
      validateResponses(hemorrhoidExaminationV1, responses, false),
    ).not.toThrow();
    expect(responses.bleedingSymptom).toBe(false);
    expect(responses.bleedingObserved).toBe(true);
  });
});

describe('HEMORRHOID_EXAMINATION v1 — no legacy undifferentiated capture fields remain', () => {
  it('mainHemorrhoidSize/hemorrhoidProlapse/hemorrhoidBleeding do not exist as competing/duplicate fields', () => {
    const actualKeys = allFields().map((f) => f.key);
    expect(actualKeys).not.toContain('mainHemorrhoidSize');
    expect(actualKeys).not.toContain('hemorrhoidProlapse');
    expect(actualKeys).not.toContain('hemorrhoidBleeding');
  });

  it('rejects the legacy undifferentiated keys if submitted (they are unknown fields now)', () => {
    expect(() =>
      validateResponses(
        hemorrhoidExaminationV1,
        { mainHemorrhoidSize: '2cm' },
        false,
      ),
    ).toThrow();
    expect(() =>
      validateResponses(
        hemorrhoidExaminationV1,
        { hemorrhoidProlapse: true },
        false,
      ),
    ).toThrow();
    expect(() =>
      validateResponses(
        hemorrhoidExaminationV1,
        { hemorrhoidBleeding: true },
        false,
      ),
    ).toThrow();
  });
});

describe('HEMORRHOID_EXAMINATION v1 — vitals: no fabricated medical range', () => {
  it('weight/height/pulse/temperature/BP declare no min/max', () => {
    for (const key of [
      'weight',
      'height',
      'pulse',
      'temperature',
      'systolicBloodPressure',
      'diastolicBloodPressure',
    ]) {
      const field = fieldByKey(key);
      if (field.type !== 'number') {
        throw new Error(`${key} expected to be a number field`);
      }
      expect(field.min).toBeUndefined();
      expect(field.max).toBeUndefined();
    }
  });
});

describe('HEMORRHOID_EXAMINATION v1 — rejects an unknown field', () => {
  it('rejects a fabricated field key not in the DEC-010 list', () => {
    expect(() =>
      validateResponses(
        hemorrhoidExaminationV1,
        { hdssScore: 3 },
        false,
      ),
    ).toThrow();
  });
});
