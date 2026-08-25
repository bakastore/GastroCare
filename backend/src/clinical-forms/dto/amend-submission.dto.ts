import { IsObject, IsString, MinLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import type { ClinicalFormResponses } from '../templates/types';

export class AmendClinicalFormSubmissionDto {
  @IsObject()
  responses!: ClinicalFormResponses;

  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  amendmentReason!: string;
}
