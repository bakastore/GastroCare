import { IsObject, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateClinicalFormSubmissionDto {
  @IsUUID()
  encounterId!: string;

  @IsString()
  @MinLength(1)
  templateKey!: string;

  @IsObject()
  responses!: Record<string, number | string>;
}
