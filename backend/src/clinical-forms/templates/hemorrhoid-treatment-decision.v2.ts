import { BadRequestException } from '@nestjs/common';
import { ClinicalFormResponses, ClinicalFormTemplate } from './types';
export const hemorrhoidTreatmentDecisionV2: ClinicalFormTemplate = {
  templateKey: 'HEMORRHOID_TREATMENT_DECISION',
  version: 2,
  displayName: 'Quyết định điều trị',
  sections: [
    {
      key: 'treatmentDecision',
      label: 'Quyết định điều trị',
      fields: [
        {
          type: 'multi_select',
          key: 'treatmentModalities',
          label: 'Phương thức điều trị (chọn nhiều)',
          required: true,
          options: [
            { value: 'MEDICAL', label: 'Nội khoa' },
            { value: 'PROCEDURE', label: 'Thủ thuật' },
            { value: 'SURGERY', label: 'Phẫu thuật' },
          ],
        },
        {
          type: 'textarea',
          key: 'decisionSummary',
          label: 'Quyết định điều trị',
          required: true,
        },
        // The supplied authority does not define a medical/procedure setting
        // vocabulary; capture explicit text rather than inventing a taxonomy.
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
      ],
    },
  ],
  scoreInstruments: [],
};
/** Template-specific validation, deliberately not a conditional FieldDef DSL. */
export function validateTreatmentDecisionV2(
  r: ClinicalFormResponses,
  complete: boolean,
) {
  const modalities = Array.isArray(r.treatmentModalities)
    ? r.treatmentModalities
    : [];
  if (complete && !modalities.length)
    throw new BadRequestException(
      'treatmentModalities must include at least one modality',
    );
  if (
    complete &&
    (typeof r.decisionSummary !== 'string' || !r.decisionSummary.trim())
  )
    throw new BadRequestException('decisionSummary is required');
  for (const [modality, key] of [
    ['MEDICAL', 'medicalCareSetting'],
    ['PROCEDURE', 'procedureCareSetting'],
    ['SURGERY', 'surgeryCareSetting'],
  ]) {
    const present = Object.prototype.hasOwnProperty.call(r, key);
    if (present && !modalities.includes(modality))
      throw new BadRequestException(`${key} requires ${modality}`);
    if (
      modality !== 'SURGERY' &&
      complete &&
      modalities.includes(modality) &&
      (typeof r[key] !== 'string' || !String(r[key]).trim())
    )
      throw new BadRequestException(`${key} is required`);
  }
  if (
    Object.prototype.hasOwnProperty.call(r, 'surgeryCareSetting') &&
    r.surgeryCareSetting !== 'HOSPITAL'
  )
    throw new BadRequestException('SURGERY care setting is HOSPITAL');
  // Omitted surgeryCareSetting is still HOSPITAL by this invariant; it is
  // not a choice and no pathway or performed surgery is inferred/created.
}
