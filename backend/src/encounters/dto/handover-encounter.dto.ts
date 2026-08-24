import { IsOptional, IsString, IsUUID } from 'class-validator';

export class HandoverEncounterDto {
  @IsUUID()
  newClinicianId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
