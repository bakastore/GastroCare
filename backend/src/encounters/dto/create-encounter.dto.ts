import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateEncounterDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  episodeId?: string;

  @IsISO8601({ strict: true })
  occurredAt!: string;

  @IsString()
  @MinLength(1)
  reasonForVisit!: string;

  @IsString()
  @MinLength(1)
  clinicalNote!: string;

  @IsString()
  @MinLength(1)
  assessment!: string;
}
