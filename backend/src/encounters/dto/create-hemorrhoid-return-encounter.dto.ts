import { IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * DEC-013 §H; docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §H.
 *
 * The client MUST NOT supply patientId, episodeId, clinicalNote, or
 * assessment — patientId is derived from the CareTask, episodeId is
 * resolved by the backend, and Return Encounters have no clinical content
 * at creation time (the global ValidationPipe's `whitelist: true` already
 * strips/rejects any such extra field; there is deliberately no field here
 * that could carry them).
 */
export class CreateHemorrhoidReturnEncounterDto {
  @IsUUID()
  careTaskId!: string;

  @IsISO8601({ strict: true })
  occurredAt!: string;

  @IsString()
  @MinLength(1)
  reasonForVisit!: string;

  @IsOptional()
  @IsUUID()
  responsibleClinicianId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;
}
