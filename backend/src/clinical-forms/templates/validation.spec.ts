import { computeScores, validateResponses } from './validation';
import { ClinicalFormTemplate } from './types';

// CORE-04 T3 — reusable field-type/validation/scoring engine tests.
// Synthetic template only — no real clinical form is defined or activated
// here, per contract scope control (T3 = framework only).
const SYNTHETIC_TEMPLATE: ClinicalFormTemplate = {
  templateKey: 'SYNTHETIC_T3_TEST_TEMPLATE',
  version: 1,
  displayName: 'Synthetic T3 test template',
  sections: [
    {
      key: 'numbers',
      label: 'Numbers',
      fields: [
        {
          type: 'number',
          key: 'freeNumber',
          label: 'Free number',
          required: false,
        },
        {
          type: 'number',
          key: 'boundedNumber',
          label: 'Bounded number',
          required: false,
          min: 0,
          max: 10,
        },
      ],
    },
    {
      key: 'texts',
      label: 'Texts',
      fields: [
        { type: 'text', key: 'freeText', label: 'Free text', required: false },
        {
          type: 'text',
          key: 'boundedText',
          label: 'Bounded text',
          required: false,
          maxLength: 5,
        },
      ],
    },
    {
      key: 'other',
      label: 'Other',
      fields: [
        { type: 'boolean', key: 'flag', label: 'Flag', required: false },
        {
          type: 'single_choice',
          key: 'numericChoice',
          label: 'Numeric choice',
          required: false,
          options: [
            { value: 1, label: 'One' },
            { value: 2, label: 'Two' },
          ],
        },
        {
          type: 'single_choice',
          key: 'stringChoice',
          label: 'String choice',
          required: false,
          options: [
            { value: 'A', label: 'A' },
            { value: 'B', label: 'B' },
          ],
        },
        {
          type: 'multi_select',
          key: 'multi',
          label: 'Multi select',
          required: false,
          options: [
            { value: 1, label: 'One' },
            { value: 2, label: 'Two' },
            { value: 3, label: 'Three' },
          ],
        },
      ],
    },
  ],
  scoreInstruments: [
    {
      key: 'sumOfTwoNumbers',
      label: 'Sum of two numbers',
      itemFieldKeys: ['freeNumber', 'boundedNumber'],
      minTotal: 0,
      maxTotal: 100,
    },
    {
      key: 'misconfiguredAgainstStringChoice',
      label: 'Misconfigured instrument (points at a non-numeric field)',
      itemFieldKeys: ['stringChoice'],
      minTotal: 0,
      maxTotal: 100,
    },
  ],
};

function expectRejected(
  responses: Record<string, unknown>,
  requireAll = false,
) {
  expect(() =>
    validateResponses(SYNTHETIC_TEMPLATE, responses as never, requireAll),
  ).toThrow();
}

function expectAccepted(
  responses: Record<string, unknown>,
  requireAll = false,
) {
  expect(() =>
    validateResponses(SYNTHETIC_TEMPLATE, responses as never, requireAll),
  ).not.toThrow();
}

describe('validateResponses — number field', () => {
  it('1. without min/max accepts a valid number even if negative or very large', () => {
    expectAccepted({ freeNumber: -999999 });
    expectAccepted({ freeNumber: 999999999 });
  });

  it('2. with min/max enforces the declared boundary exactly', () => {
    expectAccepted({ boundedNumber: 0 });
    expectAccepted({ boundedNumber: 10 });
    expectRejected({ boundedNumber: -1 });
    expectRejected({ boundedNumber: 11 });
  });
});

describe('validateResponses — text/textarea field', () => {
  it('3. without maxLength does not reject for arbitrary length', () => {
    expectAccepted({ freeText: 'x'.repeat(10000) });
  });

  it('4. with maxLength enforces the declared boundary', () => {
    expectAccepted({ boundedText: 'abcde' });
    expectRejected({ boundedText: 'abcdef' });
  });
});

describe('validateResponses — boolean field', () => {
  it('5. accepts true/false, rejects string/number', () => {
    expectAccepted({ flag: true });
    expectAccepted({ flag: false });
    expectRejected({ flag: 'true' });
    expectRejected({ flag: 1 });
  });
});

describe('validateResponses — single_choice field', () => {
  it('6. numeric options: valid value passes, invalid value rejected', () => {
    expectAccepted({ numericChoice: 1 });
    expectRejected({ numericChoice: 3 });
  });

  it('7. string options: valid value passes, invalid value rejected', () => {
    expectAccepted({ stringChoice: 'A' });
    expectRejected({ stringChoice: 'Z' });
  });
});

describe('validateResponses — multi_select field', () => {
  it('8. valid array passes; invalid option value rejected; non-array rejected', () => {
    expectAccepted({ multi: [1, 3] });
    expectRejected({ multi: [1, 99] });
    expectRejected({ multi: 'not-an-array' });
  });

  it('duplicate values within the same multi_select response are rejected', () => {
    expectRejected({ multi: [1, 1] });
  });
});

describe('validateResponses — unknown fields', () => {
  it('9. an unknown response key is always rejected', () => {
    expectRejected({ notARealField: 1 });
  });
});

describe('computeScores — deterministic totals and fail-safe null', () => {
  it('10. sums numeric item values into a deterministic total', () => {
    const scores = computeScores(SYNTHETIC_TEMPLATE, {
      freeNumber: 3,
      boundedNumber: 4,
    });
    expect(scores.sumOfTwoNumbers).toBe(7);
  });

  it('11. a missing item field yields a null score, not a partial/crashed total', () => {
    const scores = computeScores(SYNTHETIC_TEMPLATE, { freeNumber: 3 });
    expect(scores.sumOfTwoNumbers).toBeNull();
  });

  it('12. an instrument pointed at a non-numeric field response yields null, never throws or coerces', () => {
    expect(() =>
      computeScores(SYNTHETIC_TEMPLATE, { stringChoice: 'A' }),
    ).not.toThrow();
    const scores = computeScores(SYNTHETIC_TEMPLATE, { stringChoice: 'A' });
    expect(scores.misconfiguredAgainstStringChoice).toBeNull();
  });
});
