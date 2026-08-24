import { IsObject } from 'class-validator';
import type { ClinicalFormResponses } from '../templates/types';

export class UpdateDraftClinicalFormSubmissionDto {
  @IsObject()
  responses!: ClinicalFormResponses;
}
