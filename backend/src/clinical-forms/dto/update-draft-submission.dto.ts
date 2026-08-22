import { IsObject } from 'class-validator';

export class UpdateDraftClinicalFormSubmissionDto {
  @IsObject()
  responses!: Record<string, number | string>;
}
