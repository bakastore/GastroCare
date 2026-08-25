import { IsObject, IsString, IsUUID, MinLength } from 'class-validator';
import type { ClinicalFormResponses } from '../templates/types';

export class CreateClinicalFormSubmissionDto {
  @IsUUID()
  encounterId!: string;

  @IsString()
  @MinLength(1)
  templateKey!: string;

  @IsObject()
  responses!: ClinicalFormResponses;
}
