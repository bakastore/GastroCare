import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const HEMORRHOID_RECURRENCE_ACTIONS = [
  'REOPEN_EXISTING',
  'START_NEW',
] as const;
export type HemorrhoidRecurrenceAction =
  (typeof HEMORRHOID_RECURRENCE_ACTIONS)[number];

/**
 * DEC-013 §H; docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §H.
 *
 * The client MUST NOT supply patientId, episodeId, clinicalNote, or
 * assessment — patientId is derived from the CareTask, episodeId is
 * resolved by the backend, and Return Encounters have no clinical content
 * at creation time (the global ValidationPipe's `whitelist: true` already
 * strips/rejects any such extra field; there is deliberately no field here
 * that could carry them).
 *
 * DEC-020 Package A T10 P1-01 — when the patient has CLOSED Hemorrhoid
 * treatment history and no ACTIVE episode, the doctor's explicit recurrence
 * choice is carried on THIS request (flat fields, matching repo DTO
 * conventions) so the reopen/start-new lifecycle work and the Return commit
 * atomically in one Serializable transaction. Fields are flat rather than a
 * nested object because the global ValidationPipe (`whitelist: true`, no
 * `@Type`) does not deep-validate nested payloads.
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

  /** Explicit recurrence choice — only meaningful when the resolver would
   * otherwise need one (0 ACTIVE + CLOSED history). Never inferred. */
  @IsOptional()
  @IsIn(HEMORRHOID_RECURRENCE_ACTIONS)
  recurrenceAction?: HemorrhoidRecurrenceAction;

  /** Required when recurrenceAction = REOPEN_EXISTING. */
  @IsOptional()
  @IsUUID()
  recurrenceClosedEpisodeId?: string;

  /** Required when recurrenceAction = REOPEN_EXISTING (reopen reason/audit).
   * Same upper bound as the standalone ReopenCareEpisodeDto (T11 P2-01). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  recurrenceReason?: string;
}
