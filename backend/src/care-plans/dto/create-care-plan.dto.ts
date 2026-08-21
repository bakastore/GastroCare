import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateCarePlanDto {
  @IsUUID()
  encounterId!: string;

  @IsString()
  @MinLength(1)
  instructions!: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
