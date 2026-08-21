import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateEncounterDto {
  @IsUUID()
  patientId!: string;

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
