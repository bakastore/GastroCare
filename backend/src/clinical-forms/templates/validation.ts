import { BadRequestException } from '@nestjs/common';
import { ClinicalFormResponses, ClinicalFormTemplate } from './types';

/**
 * Server-side response validation against a template's code-defined field
 * schema. `requireAll` is true at COMPLETED time (every required field must
 * be present and valid); false at DRAFT save time (present fields must be
 * valid, but the draft may be partial).
 *
 * CORE-04 T3 adds boolean/multi_select and makes number min/max and text
 * maxLength optional constraints — only enforced when a template actually
 * declares them, never inferred.
 */
export function validateResponses(
  template: ClinicalFormTemplate,
  responses: ClinicalFormResponses,
  requireAll: boolean,
): void {
  for (const section of template.sections) {
    for (const field of section.fields) {
      const value = responses[field.key];
      const isPresent = value !== undefined && value !== null && value !== '';

      if (!isPresent) {
        if (field.required && requireAll) {
          throw new BadRequestException(`Missing required field: ${field.key}`);
        }
        continue;
      }

      switch (field.type) {
        case 'number': {
          if (typeof value !== 'number' || Number.isNaN(value)) {
            throw new BadRequestException(
              `Field ${field.key} must be a number`,
            );
          }
          if (field.min !== undefined && value < field.min) {
            throw new BadRequestException(
              `Field ${field.key} must be at least ${field.min}`,
            );
          }
          if (field.max !== undefined && value > field.max) {
            throw new BadRequestException(
              `Field ${field.key} must be at most ${field.max}`,
            );
          }
          break;
        }
        case 'text':
        case 'textarea': {
          if (typeof value !== 'string') {
            throw new BadRequestException(`Field ${field.key} must be text`);
          }
          if (field.maxLength !== undefined && value.length > field.maxLength) {
            throw new BadRequestException(
              `Field ${field.key} exceeds max length ${field.maxLength}`,
            );
          }
          break;
        }
        case 'boolean': {
          if (typeof value !== 'boolean') {
            throw new BadRequestException(
              `Field ${field.key} must be true or false`,
            );
          }
          break;
        }
        case 'single_choice': {
          if (typeof value !== 'number' && typeof value !== 'string') {
            throw new BadRequestException(
              `Field ${field.key} must be one of the defined option values`,
            );
          }
          const validValues = field.options.map((o) => o.value);
          if (!validValues.includes(value)) {
            throw new BadRequestException(
              `Field ${field.key} has an invalid option value`,
            );
          }
          break;
        }
        case 'multi_select': {
          if (!Array.isArray(value)) {
            throw new BadRequestException(
              `Field ${field.key} must be a list of option values`,
            );
          }
          const validValues = field.options.map((o) => o.value);
          const seen = new Set<number | string>();
          for (const item of value) {
            if (typeof item !== 'number' && typeof item !== 'string') {
              throw new BadRequestException(
                `Field ${field.key} contains an invalid option value`,
              );
            }
            if (!validValues.includes(item)) {
              throw new BadRequestException(
                `Field ${field.key} contains an invalid option value`,
              );
            }
            if (seen.has(item)) {
              throw new BadRequestException(
                `Field ${field.key} contains a duplicate option value`,
              );
            }
            seen.add(item);
          }
          break;
        }
      }
    }
  }

  const knownKeys = new Set(
    template.sections.flatMap((s) => s.fields.map((f) => f.key)),
  );
  for (const key of Object.keys(responses)) {
    if (!knownKeys.has(key)) {
      throw new BadRequestException(`Unknown field: ${key}`);
    }
  }
}

/**
 * Deterministic score computation from raw item responses — never trusts a
 * client-submitted total. Returns null for an instrument if any of its item
 * fields are absent OR not a number (fail-safe: never coerces a string to a
 * number, never throws) — e.g. still a partial DRAFT, or a scoreInstrument
 * misconfigured to point at a non-numeric field.
 */
export function computeScores(
  template: ClinicalFormTemplate,
  responses: ClinicalFormResponses,
): Record<string, number | null> {
  const scores: Record<string, number | null> = {};
  for (const instrument of template.scoreInstruments) {
    const values = instrument.itemFieldKeys.map((key) => responses[key]);
    const allPresent = values.every(
      (v) => typeof v === 'number' && !Number.isNaN(v),
    );
    if (!allPresent) {
      scores[instrument.key] = null;
      continue;
    }
    const total = (values as number[]).reduce((sum, v) => sum + v, 0);
    scores[instrument.key] = total;
  }
  return scores;
}
