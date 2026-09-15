import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import type { ClinicalFormResponses } from '../templates/types';

export class CreateClinicalFormSubmissionDto {
  @IsUUID()
  encounterId!: string;

  @IsString()
  @MinLength(1)
  templateKey!: string;

  /**
   * DEC-021 §3.2 — optional explicit template version. Omitted → the "latest"
   * version for this key. Used to request HEMORRHOID_TREATMENT_DECISION v3
   * (the Structured Treatment Activation source), which is not the auto-latest.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  templateVersion?: number;

  @IsObject()
  responses!: ClinicalFormResponses;
}
