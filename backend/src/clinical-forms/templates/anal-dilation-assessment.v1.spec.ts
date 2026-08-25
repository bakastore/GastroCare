import { getTemplate, getLatestTemplate } from './registry';
import { validateResponses } from './validation';
import { analDilationAssessmentV1 } from './anal-dilation-assessment.v1';

function allFields() {
  return analDilationAssessmentV1.sections.flatMap((s) => s.fields);
}

describe('ANAL_DILATION_ASSESSMENT v1 — registry resolution', () => {
  it('resolves via getTemplate and getLatestTemplate', () => {
    expect(getTemplate('ANAL_DILATION_ASSESSMENT', 1)).toBeDefined();
    expect(getLatestTemplate('ANAL_DILATION_ASSESSMENT')?.version).toBe(1);
  });
});

describe('ANAL_DILATION_ASSESSMENT v1 — all five locked concepts are free text only', () => {
  const expectedKeys = [
    'analDiameterNote',
    'dilationResistanceNote',
    'dilationPainNote',
    'dilationBleedingNote',
    'defecationAbilityNote',
  ];

  it('all five concept fields exist and are text/textarea', () => {
    for (const key of expectedKeys) {
      const field = allFields().find((f) => f.key === key);
      expect(field).toBeDefined();
      expect(field?.type === 'text' || field?.type === 'textarea').toBe(true);
    }
  });

  it('no numeric/single_choice/multi_select field exists for any of the five concepts', () => {
    for (const field of allFields()) {
      expect(field.type === 'number').toBe(false);
      expect(field.type === 'single_choice').toBe(false);
      expect(field.type === 'multi_select').toBe(false);
    }
  });
});

describe('ANAL_DILATION_ASSESSMENT v1 — no 0-3 scale, no score, no placeholder', () => {
  it('no scoreInstruments and no forbidden vocabulary in labels/keys', () => {
    expect(analDilationAssessmentV1.scoreInstruments).toHaveLength(0);
    const haystack = allFields()
      .flatMap((f) => [f.key.toLowerCase(), f.label.toLowerCase()])
      .join(' | ');
    for (const forbidden of ['mức 0', 'grade', 'score', 'total']) {
      expect(haystack.includes(forbidden)).toBe(false);
    }
  });

  it('free-text values validate without any numeric coercion', () => {
    expect(() =>
      validateResponses(
        analDilationAssessmentV1,
        {
          analDiameterNote: 'Dữ liệu giả lập',
          dilationResistanceNote: 'Dữ liệu giả lập',
          dilationPainNote: 'Dữ liệu giả lập',
          dilationBleedingNote: 'Dữ liệu giả lập',
          defecationAbilityNote: 'Dữ liệu giả lập',
        },
        true,
      ),
    ).not.toThrow();
  });
});
