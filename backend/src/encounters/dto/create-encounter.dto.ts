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

  /**
   * Optional target CareEpisode. A RECEPTIONIST creating the Encounter
   * Context must never supply this (Finding 1 correction) — enforced in
   * EncountersService.create, not just by DTO shape.
   */
  @IsOptional()
  @IsUUID()
  episodeId?: string;

  /**
   * The clinician clinically responsible for this Encounter (DEC-010 §A/§B).
   * Optional: a Receptionist creating an Encounter Context may omit it, in
   * which case the pilot default clinician is resolved server-side via a
   * legitimate seed/config lookup (see ClinicianLookupService) — never a
   * hard-coded raw user id in DTO/UI code.
   */
  @IsOptional()
  @IsUUID()
  responsibleClinicianId?: string;

  /**
   * Physical room this Encounter takes place in (DEC-010 §C). Optional —
   * not every Encounter (e.g. legacy/non-physical flows) has one recorded.
   */
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsISO8601({ strict: true })
  occurredAt!: string;

  @IsString()
  @MinLength(1)
  reasonForVisit!: string;

  /**
   * Optional: a Receptionist creating the initial Encounter Context has no
   * clinical content to record yet (DEC-010 §B) — this is captured later by
   * the Hemorrhoid Examination clinical form. Defaults to empty string.
   */
  @IsOptional()
  @IsString()
  clinicalNote?: string;

  @IsOptional()
  @IsString()
  assessment?: string;
}
