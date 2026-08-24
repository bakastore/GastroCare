import {
  createWexnerSection,
  createWexnerScoreInstrument,
  wexnerItemKeys,
} from './wexner.section';
import { createAnorectalExamSection } from './anorectal-exam.section';
import { createSatisfactionSection } from './satisfaction.section';
import { computeScores } from '../validation';
import { ClinicalFormTemplate } from '../types';

function templateWithSections(
  sections: ReturnType<typeof createWexnerSection>[],
): ClinicalFormTemplate {
  return {
    templateKey: 'SYNTHETIC_T3_REUSABLE_SECTION_TEST',
    version: 1,
    displayName: 'Synthetic reusable-section test template',
    sections,
    scoreInstruments: [createWexnerScoreInstrument('wexner')],
  };
}

describe('Wexner reusable section — scoring', () => {
  it('10. five numeric items sum to a deterministic total within 0-20', () => {
    const keys = wexnerItemKeys('wexner');
    const responses = Object.fromEntries(keys.map((k) => [k, 2]));
    const scores = computeScores(
      templateWithSections([createWexnerSection('wexner')]),
      responses,
    );
    expect(scores.wexnerTotal).toBe(10);
  });

  it('11. a missing item yields a null total, matching the existing computeScores contract', () => {
    const keys = wexnerItemKeys('wexner');
    const responses = Object.fromEntries(keys.slice(0, 4).map((k) => [k, 1]));
    const scores = computeScores(
      templateWithSections([createWexnerSection('wexner')]),
      responses,
    );
    expect(scores.wexnerTotal).toBeNull();
  });
});

describe('Reusable section factories — namespace collision safety', () => {
  it('13. two Wexner sections with different prefixes produce disjoint field keys', () => {
    const month1 = createWexnerSection('month1Wexner');
    const month3 = createWexnerSection('month3Wexner');
    const month1Keys = month1.fields.map((f) => f.key);
    const month3Keys = month3.fields.map((f) => f.key);
    const overlap = month1Keys.filter((k) => month3Keys.includes(k));
    expect(overlap).toHaveLength(0);
    expect(month1Keys.every((k) => k.startsWith('month1Wexner'))).toBe(true);
    expect(month3Keys.every((k) => k.startsWith('month3Wexner'))).toBe(true);
  });

  it('14. two anorectal exam sections with different prefixes produce disjoint field keys', () => {
    const preop = createAnorectalExamSection('preop');
    const postAnesthesia = createAnorectalExamSection('postAnesthesia');
    const preopKeys = preop.fields.map((f) => f.key);
    const postKeys = postAnesthesia.fields.map((f) => f.key);
    const overlap = preopKeys.filter((k) => postKeys.includes(k));
    expect(overlap).toHaveLength(0);
    expect(preopKeys.every((k) => k.startsWith('preop'))).toBe(true);
    expect(postKeys.every((k) => k.startsWith('postAnesthesia'))).toBe(true);
  });
});

describe('Satisfaction reusable section', () => {
  it('15. exposes exactly the 5 OWNER LOCKED levels with the exact locked wording', () => {
    const section = createSatisfactionSection('followup');
    expect(section.fields).toHaveLength(1);
    const field = section.fields[0];
    if (field.type !== 'single_choice') {
      throw new Error('expected single_choice field');
    }
    const labels = field.options.map((o) => o.label);
    expect(labels).toEqual([
      'Rất hài lòng',
      'Hài lòng',
      'Trung bình',
      'Không hài lòng',
      'Rất không hài lòng',
    ]);
    expect(field.required).toBe(false);
  });
});
