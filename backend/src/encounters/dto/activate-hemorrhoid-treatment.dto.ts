import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * DEC-021 §3.1 / §3.4 — `POST /encounters/:id/hemorrhoid-treatment/activate`.
 * DOCTOR-only (controller @Roles).
 */
export class ActivateHemorrhoidTreatmentDto {
  /** The completed HEMORRHOID_TREATMENT_DECISION v3 submission that is the
   * machine-readable source of this activation (§3.2). */
  @IsUUID()
  sourceDecisionSubmissionId!: string;

  /** Required only when the patient has CLOSED HEMORRHOID_TREATMENT history
   * and no ACTIVE episode (§3.4 step 5). Never inferred. */
  @IsOptional()
  @IsIn(['REOPEN_EXISTING', 'START_NEW'])
  recurrenceAction?: 'REOPEN_EXISTING' | 'START_NEW';

  @IsOptional()
  @IsUUID()
  recurrenceClosedEpisodeId?: string;

  /** Mandatory + non-empty for REOPEN_EXISTING (§3.4 step 5 / §3.4 step 8). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  recurrenceReason?: string;
}
