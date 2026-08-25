import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export type FollowUpTaskAction = 'RESCHEDULE' | 'CANCEL' | 'KEEP_WITH_REASON';

export const FOLLOW_UP_TASK_ACTIONS: readonly FollowUpTaskAction[] = [
  'RESCHEDULE',
  'CANCEL',
  'KEEP_WITH_REASON',
];

export class AmendCarePlanDto {
  @IsString()
  @MinLength(1)
  instructions!: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsString()
  @MinLength(1)
  reason!: string;

  /** Stale-write guard (DEC-012 §13) — the CarePlan.currentVersionId the
   * caller last observed. A mismatch inside the transaction is a 409. */
  @IsUUID()
  expectedCurrentVersionId!: string;

  /** Required only when followUpDate changes and an OPEN generic follow-up
   * CareTask exists to reconcile (CD-08 transition matrix). */
  @IsOptional()
  @IsIn(FOLLOW_UP_TASK_ACTIONS)
  followUpTaskAction?: FollowUpTaskAction;

  /** Required when followUpTaskAction is KEEP_WITH_REASON. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  followUpTaskReason?: string;
}
