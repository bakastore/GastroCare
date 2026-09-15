import { BadRequestException } from '@nestjs/common';
import { ClinicalFormResponses, ClinicalFormTemplate } from './types';

// HEMORRHOID_TREATMENT_DECISION v3 — DEC-021 Package R §3.2 / §9.
//
// v3 is the machine-readable source for Structured Treatment Activation
// (DEC-021 §3). It separates, at minimum:
//   * proposedModalities[]  — the Doctor's proposal (never activates anything)
//   * patientDecision       — ACCEPTED | UNDECIDED | DECLINED_ALL
//   * effectiveModalities[] — modalities actually activated for the current
//                             treatment course (the ONLY activation input)
//   * decisionSummary       — free-text narrative, preserved as-is
//   * care-setting fields   — only meaningful when the matching effective
//                             modality needs them
//   * outcome / disposition — structured NR-07 representation for DECLINED_ALL
//
// This template creates NO Procedure/Surgery, NO CareEpisode, NO
// TreatmentPathway and infers nothing from decisionSummary. "Actual
// treatment performed" stays a separate downstream factual event.
// Historical v1/v2 submissions are untouched.

export const HEMORRHOID_TREATMENT_DECISION_TEMPLATE_KEY =
  'HEMORRHOID_TREATMENT_DECISION';

export type HemorrhoidTreatmentModality = 'MEDICAL' | 'PROCEDURE' | 'SURGERY';
export type HemorrhoidPatientDecision =
  | 'ACCEPTED'
  | 'UNDECIDED'
  | 'DECLINED_ALL';

const MODALITY_OPTIONS = [
  { value: 'MEDICAL', label: 'Nội khoa' },
  { value: 'PROCEDURE', label: 'Thủ thuật' },
  { value: 'SURGERY', label: 'Phẫu thuật' },
];

export const hemorrhoidTreatmentDecisionV3: ClinicalFormTemplate = {
  templateKey: HEMORRHOID_TREATMENT_DECISION_TEMPLATE_KEY,
  version: 3,
  displayName: 'Quyết định điều trị',
  sections: [
    {
      key: 'treatmentDecision',
      label: 'Quyết định điều trị',
      fields: [
        {
          type: 'multi_select',
          key: 'proposedModalities',
          label: 'Phương thức bác sĩ đề xuất (chọn nhiều)',
          required: true,
          options: MODALITY_OPTIONS,
        },
        {
          type: 'single_choice',
          key: 'patientDecision',
          label: 'Quyết định của bệnh nhân',
          required: true,
          options: [
            { value: 'ACCEPTED', label: 'Đồng ý điều trị' },
            { value: 'UNDECIDED', label: 'Chưa quyết định' },
            { value: 'DECLINED_ALL', label: 'Từ chối toàn bộ điều trị' },
          ],
        },
        {
          type: 'multi_select',
          key: 'effectiveModalities',
          label: 'Phương thức được kích hoạt trong đợt điều trị này (chọn nhiều)',
          required: false,
          options: MODALITY_OPTIONS,
        },
        {
          type: 'textarea',
          key: 'decisionSummary',
          label: 'Diễn giải quyết định điều trị',
          required: true,
        },
        {
          type: 'text',
          key: 'medicalCareSetting',
          label: 'Nơi điều trị nội khoa',
          required: false,
        },
        {
          type: 'text',
          key: 'procedureCareSetting',
          label: 'Nơi thực hiện thủ thuật',
          required: false,
        },
        {
          type: 'single_choice',
          key: 'surgeryCareSetting',
          label: 'Phẫu thuật tại bệnh viện',
          required: false,
          options: [{ value: 'HOSPITAL', label: 'Bệnh viện' }],
        },
        {
          type: 'single_choice',
          key: 'outcome',
          label: 'Kết quả (khi từ chối điều trị)',
          required: false,
          options: [
            {
              value: 'PATIENT_DECLINED_TREATMENT',
              label: 'Bệnh nhân từ chối điều trị',
            },
          ],
        },
        {
          type: 'single_choice',
          key: 'disposition',
          label: 'Hướng xử trí (khi từ chối điều trị)',
          required: false,
          options: [{ value: 'SELF_MONITORING', label: 'Tự theo dõi' }],
        },
      ],
    },
  ],
  scoreInstruments: [],
};

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as string[]) : [];
}

/**
 * Template-specific validation, deliberately not a conditional FieldDef DSL
 * (same convention as validateTreatmentDecisionV2). Field-level type/option
 * checks already ran in validateResponses(); this enforces the cross-field
 * DEC-021 §3.2 / §9 rules.
 */
export function validateTreatmentDecisionV3(
  r: ClinicalFormResponses,
  complete: boolean,
): void {
  const proposed = asStringArray(r.proposedModalities);
  const effective = asStringArray(r.effectiveModalities);
  const patientDecision = r.patientDecision as string | undefined;

  if (complete && proposed.length === 0) {
    throw new BadRequestException(
      'proposedModalities must include at least one modality',
    );
  }
  if (
    complete &&
    (typeof r.decisionSummary !== 'string' || !r.decisionSummary.trim())
  ) {
    throw new BadRequestException('decisionSummary is required');
  }

  // effectiveModalities must be a subset of proposedModalities — a modality
  // can only be activated for this course if the Doctor proposed it.
  for (const m of effective) {
    if (!proposed.includes(m)) {
      throw new BadRequestException(
        'effectiveModalities must be a subset of proposedModalities',
      );
    }
  }

  if (complete && !patientDecision) {
    throw new BadRequestException('patientDecision is required');
  }

  if (patientDecision === 'UNDECIDED' && effective.length > 0) {
    throw new BadRequestException(
      'patientDecision=UNDECIDED requires effectiveModalities to be empty',
    );
  }

  if (patientDecision === 'DECLINED_ALL') {
    if (effective.length > 0) {
      throw new BadRequestException(
        'patientDecision=DECLINED_ALL requires effectiveModalities to be empty',
      );
    }
    if (complete) {
      if (r.outcome !== 'PATIENT_DECLINED_TREATMENT') {
        throw new BadRequestException(
          'DECLINED_ALL requires outcome=PATIENT_DECLINED_TREATMENT',
        );
      }
      if (r.disposition !== 'SELF_MONITORING') {
        throw new BadRequestException(
          'DECLINED_ALL requires disposition=SELF_MONITORING',
        );
      }
    }
  } else {
    // outcome/disposition are the NR-07 declined-treatment representation
    // only — they must not appear for any other decision.
    if (r.outcome !== undefined && r.outcome !== null && r.outcome !== '') {
      throw new BadRequestException(
        'outcome is only valid when patientDecision=DECLINED_ALL',
      );
    }
    if (
      r.disposition !== undefined &&
      r.disposition !== null &&
      r.disposition !== ''
    ) {
      throw new BadRequestException(
        'disposition is only valid when patientDecision=DECLINED_ALL',
      );
    }
  }

  if (
    patientDecision === 'ACCEPTED' &&
    complete &&
    effective.length === 0 &&
    proposed.length > 0
  ) {
    // Not an error per se (a Doctor may record ACCEPTED before choosing what
    // to activate), but activation (§3.4) will reject an empty
    // effectiveModalities — no invention here, just do not block completion.
  }

  // Care-setting fields require the matching EFFECTIVE modality.
  for (const [modality, key] of [
    ['MEDICAL', 'medicalCareSetting'],
    ['PROCEDURE', 'procedureCareSetting'],
    ['SURGERY', 'surgeryCareSetting'],
  ] as const) {
    const present = Object.prototype.hasOwnProperty.call(r, key);
    const raw = r[key];
    const hasValue =
      present && raw !== undefined && raw !== null && raw !== '';
    if (hasValue && !effective.includes(modality)) {
      throw new BadRequestException(`${key} requires effective ${modality}`);
    }
    if (
      modality !== 'SURGERY' &&
      complete &&
      effective.includes(modality) &&
      (typeof raw !== 'string' || !String(raw).trim())
    ) {
      throw new BadRequestException(`${key} is required`);
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(r, 'surgeryCareSetting') &&
    r.surgeryCareSetting !== '' &&
    r.surgeryCareSetting !== undefined &&
    r.surgeryCareSetting !== null &&
    r.surgeryCareSetting !== 'HOSPITAL'
  ) {
    throw new BadRequestException('SURGERY care setting is HOSPITAL');
  }
}

/** The activation-eligible effective modalities on a completed v3 submission. */
export function readEffectiveModalities(
  responses: ClinicalFormResponses,
): HemorrhoidTreatmentModality[] {
  return asStringArray(responses.effectiveModalities).filter(
    (m): m is HemorrhoidTreatmentModality =>
      m === 'MEDICAL' || m === 'PROCEDURE' || m === 'SURGERY',
  );
}

export function readPatientDecision(
  responses: ClinicalFormResponses,
): HemorrhoidPatientDecision | undefined {
  const v = responses.patientDecision;
  return v === 'ACCEPTED' || v === 'UNDECIDED' || v === 'DECLINED_ALL'
    ? v
    : undefined;
}
