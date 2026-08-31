import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateFacilityAssignmentDto {
  @IsString()
  facilityId: string;

  @IsString()
  startDate: string;

  /** Ask for this assignment to become primary. The first active assignment
   *  for a profile always becomes primary regardless of this flag. */
  @IsOptional()
  @IsBoolean()
  makePrimary?: boolean;
}

/**
 * PATCH /clinic-admin/users/:id/facility-assignments/:assignmentId
 * Supported intents (Contract §10): "make target primary" and
 * "end assignment". `facilityId` / `staffProfileId` are immutable and are not
 * accepted here.
 */
export class PatchFacilityAssignmentDto {
  @IsOptional()
  @IsBoolean()
  makePrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  end?: boolean;

  @IsOptional()
  @IsString()
  endDate?: string;

  /** Required when ending the current primary while other active assignments
   *  remain (Contract T4.2). Never auto-selected. */
  @IsOptional()
  @IsString()
  replacementPrimaryAssignmentId?: string;
}
