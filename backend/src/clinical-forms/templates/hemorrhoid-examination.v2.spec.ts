import { getTemplate, getLatestTemplate } from './registry';
import { validateResponses, computeScores } from './validation';
import { hemorrhoidExaminationV1 } from './hemorrhoid-examination.v1';
import { hemorrhoidExaminationV2 } from './hemorrhoid-examination.v2';
import { FieldDef } from './types';

// DEC-020 Package B — T12 backend/template tests for HEMORRHOID_EXAMINATION
// v2 (field map T1, optionality T2, aggregate morphology, single Goligher,
// patient-vs-doctor split, cross-version readability). Vital copy-forward
// determinism / RR-SpO2 propagation and Doctor-only authorization are
// covered by the e2e suites.

function v2Fields(): FieldDef[] {
  return hemorrhoidExaminationV2.sections.flatMap((s) => s.fields);
}
function v1FieldKeys(): string[] {
  return hemorrhoidExaminationV1.sections.flatMap((s) => s.fields.map((f) => f.key));
}
function fieldByKey(key: string): FieldDef {
  const f = v2Fields().find((x) => x.key === key);
  if (!f) throw new Error(`field ${key} not found in v2`);
  return f;
}

describe('HEMORRHOID_EXAMINATION v2 — registry / versioning (T12 #2)', () => {
  it('v2 resolves and is the latest version; v1 still resolves at version 1', () => {
    expect(getTemplate('HEMORRHOID_EXAMINATION', 2)?.version).toBe(2);
    expect(getTemplate('HEMORRHOID_EXAMINATION', 1)?.version).toBe(1);
    expect(getLatestTemplate('HEMORRHOID_EXAMINATION')?.version).toBe(2);
  });

  it('displayName and templateKey are stable across versions', () => {
    expect(hemorrhoidExaminationV2.templateKey).toBe('HEMORRHOID_EXAMINATION');
    expect(hemorrhoidExaminationV2.displayName).toBe('Khám trĩ');
  });
});

describe('HEMORRHOID_EXAMINATION v2 — structure & Contract §9 grouping (T4)', () => {
  it('sections are the eight source-form clinical groups, in order', () => {
    expect(hemorrhoidExaminationV2.sections.map((s) => s.key)).toEqual([
      'reasonAndSymptoms',
      'historyAndAllergy',
      'generalExamAndVitals',
      'digitalRectalExam',
      'hemorrhoidMorphology',
      'prolapseAndBleeding',
      'otherAnorectalFindings',
      'relatedInvestigations',
    ]);
  });

  it('no duplicate field keys', () => {
    const keys = v2Fields().map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is a strict superset of the shared v1 clinical keys (cross-version continuity)', () => {
    const v2Keys = new Set(v2Fields().map((f) => f.key));
    for (const key of v1FieldKeys()) {
      expect(v2Keys.has(key)).toBe(true);
    }
  });

  it('does not fabricate ICD / VAS / score instruments / BMI derivation', () => {
    expect(hemorrhoidExaminationV2.scoreInstruments).toHaveLength(0);
    const lower = v2Fields().map((f) => f.key.toLowerCase());
    for (const forbidden of ['icd', 'vas', 'wexner', 'hdss', 'shs', 'bmi', 'pilenumber', 'pile#']) {
      expect(lower.some((k) => k.includes(forbidden))).toBe(false);
    }
  });
});

describe('HEMORRHOID_EXAMINATION v2 — optionality (T12 #3 / Contract §7)', () => {
  it('every field is required: false', () => {
    for (const f of v2Fields()) expect(f.required).toBe(false);
  });

  it('a fully empty examination validates as DRAFT and as COMPLETED', () => {
    expect(() => validateResponses(hemorrhoidExaminationV2, {}, false)).not.toThrow();
    expect(() => validateResponses(hemorrhoidExaminationV2, {}, true)).not.toThrow();
  });

  it('a partially-filled examination validates as COMPLETED — blanks never block completion', () => {
    expect(() =>
      validateResponses(
        hemorrhoidExaminationV2,
        { symptomAnalPain: true, hemorrhoidGoligherGrade: 'II' },
        true,
      ),
    ).not.toThrow();
  });

  it('computeScores returns {} — no derived score', () => {
    expect(computeScores(hemorrhoidExaminationV2, {})).toEqual({});
  });
});

describe('HEMORRHOID_EXAMINATION v2 — field types & choices validate (T12 #4)', () => {
  it('single_choice fields reject out-of-set values', () => {
    expect(() =>
      validateResponses(hemorrhoidExaminationV2, { hemorrhoidGoligherGrade: 'V' }, false),
    ).toThrow();
    expect(() =>
      validateResponses(hemorrhoidExaminationV2, { stoolStatus: 'MAYBE' }, false),
    ).toThrow();
    expect(() =>
      validateResponses(hemorrhoidExaminationV2, { analSphincterExam: 'NORMAL' }, false),
    ).not.toThrow();
  });

  it('number fields reject non-numbers; boolean fields reject non-booleans; text rejects non-strings', () => {
    expect(() =>
      validateResponses(hemorrhoidExaminationV2, { respiratoryRate: 'fast' }, false),
    ).toThrow();
    expect(() =>
      validateResponses(hemorrhoidExaminationV2, { palpableTumor: 'yes' }, false),
    ).toThrow();
    expect(() =>
      validateResponses(hemorrhoidExaminationV2, { stoolCharacteristics: 3 }, false),
    ).toThrow();
    expect(() =>
      validateResponses(
        hemorrhoidExaminationV2,
        { respiratoryRate: 18, spo2: 98, palpableTumor: true, palpableTumorDistanceCm: 4 },
        false,
      ),
    ).not.toThrow();
  });

  it('rejects an unknown / fabricated field', () => {
    expect(() =>
      validateResponses(hemorrhoidExaminationV2, { pileNumber1Size: '2cm' }, false),
    ).toThrow();
  });

  it('declares no fabricated numeric medical range on vitals', () => {
    for (const key of ['pulse', 'temperature', 'respiratoryRate', 'spo2', 'systolicBloodPressure']) {
      const f = fieldByKey(key);
      if (f.type !== 'number') throw new Error(`${key} should be a number field`);
      expect(f.min).toBeUndefined();
      expect(f.max).toBeUndefined();
    }
  });
});

describe('HEMORRHOID_EXAMINATION v2 — aggregate INTERNAL/EXTERNAL/MIXED morphology (T12 #5 / #6)', () => {
  it('exactly one whole-examination Goligher grade field — never per-lesion', () => {
    const goligher = v2Fields()
      .map((f) => f.key)
      .filter((k) => k.toLowerCase().includes('goligher'));
    expect(goligher).toEqual(['hemorrhoidGoligherGrade']);
  });

  it('each type has its own count (number) / location (clock-face multi_select) / size (text)', () => {
    for (const prefix of ['internal', 'external', 'mixed']) {
      expect(fieldByKey(`${prefix}HemorrhoidCount`).type).toBe('number');
      expect(fieldByKey(`${prefix}HemorrhoidLocation`).type).toBe('multi_select');
      expect(fieldByKey(`${prefix}HemorrhoidSize`).type).toBe('text');
    }
  });

  it('no repeatable individual Pile #1/#2/#3 entity — three size fields total, one per type', () => {
    const sizeKeys = v2Fields()
      .map((f) => f.key)
      .filter((k) => k.toLowerCase().includes('size'))
      .sort();
    expect(sizeKeys).toEqual([
      'externalHemorrhoidSize',
      'internalHemorrhoidSize',
      'mixedHemorrhoidSize',
    ]);
  });

  it('all three type groups round-trip independently and do not overwrite one another', () => {
    const r = {
      internalHemorrhoidCount: 2,
      internalHemorrhoidLocation: [3, 7],
      internalHemorrhoidSize: '1cm',
      externalHemorrhoidCount: 1,
      externalHemorrhoidLocation: [11],
      externalHemorrhoidSize: '0.5cm',
      mixedHemorrhoidCount: 3,
      mixedHemorrhoidLocation: [1, 5, 9],
      mixedHemorrhoidSize: '2mm',
    };
    expect(() => validateResponses(hemorrhoidExaminationV2, r, true)).not.toThrow();
    expect(r.internalHemorrhoidSize).toBe('1cm');
    expect(r.externalHemorrhoidSize).toBe('0.5cm');
    expect(r.mixedHemorrhoidSize).toBe('2mm');
  });

  it('clock-face location rejects an hour outside 1-12 and duplicates', () => {
    expect(() =>
      validateResponses(hemorrhoidExaminationV2, { mixedHemorrhoidLocation: [0] }, false),
    ).toThrow();
    expect(() =>
      validateResponses(hemorrhoidExaminationV2, { mixedHemorrhoidLocation: [5, 5] }, false),
    ).toThrow();
  });
});

describe('HEMORRHOID_EXAMINATION v2 — patient-reported vs doctor-observed stay distinct (T12 #7)', () => {
  it('prolapse and bleeding each keep an independent patient / doctor boolean', () => {
    for (const key of ['prolapseSymptom', 'prolapseObserved', 'bleedingSymptom', 'bleedingObserved']) {
      expect(fieldByKey(key).type).toBe('boolean');
    }
    const r = {
      prolapseSymptom: true,
      prolapseObserved: false,
      bleedingSymptom: false,
      bleedingObserved: true,
    };
    expect(() => validateResponses(hemorrhoidExaminationV2, r, true)).not.toThrow();
    expect(r.prolapseSymptom).toBe(true);
    expect(r.prolapseObserved).toBe(false);
    expect(r.bleedingSymptom).toBe(false);
    expect(r.bleedingObserved).toBe(true);
  });
});

describe('HEMORRHOID_EXAMINATION v1 stays intact under its own version (T12 #1)', () => {
  it('a stored v1 response set still validates against the v1 template', () => {
    expect(() =>
      validateResponses(
        hemorrhoidExaminationV1,
        { hemorrhoidGoligherGrade: 'III', prolapseSymptom: true },
        true,
      ),
    ).not.toThrow();
  });

  it('v2-only keys are rejected by the v1 template (v1 submissions are not silently widened)', () => {
    expect(() =>
      validateResponses(hemorrhoidExaminationV1, { respiratoryRate: 18 }, false),
    ).toThrow();
  });
});
