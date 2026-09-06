import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { CareTasksService } from './care-tasks.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RescheduleCareTaskDto } from './dto/reschedule-care-task.dto';
import { CompleteCareTaskDto } from './dto/complete-care-task.dto';
import { ContactAttemptDto } from './dto/contact-attempt.dto';
import { LostToFollowUpDto } from './dto/lost-to-follow-up.dto';

// DEC-021 §8.1 — the class-level @Roles(AuthRole.DOCTOR) stays UNCHANGED. It
// applies to list/complete/reschedule/cancel (DOCTOR-only). Only the two new
// NR-01 mutation endpoints below carry a method-level @Roles override adding
// AuthRole.NURSE. No read/discovery/worklist endpoint or projection for NURSE
// is created here, and `GET /care-tasks` is NOT widened for NURSE.
@Roles(AuthRole.DOCTOR)
@Controller('care-tasks')
export class CareTasksController {
  constructor(private readonly careTasksService: CareTasksService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.careTasksService.list(user.tenantId);
  }

  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompleteCareTaskDto,
  ) {
    return this.careTasksService.complete(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/reschedule')
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RescheduleCareTaskDto,
  ) {
    return this.careTasksService.reschedule(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.careTasksService.cancel(user.tenantId, user.userId, id);
  }

  /** DEC-021 NR-01 §8 — DOCTOR + NURSE (method-level override only). */
  @Roles(AuthRole.DOCTOR, AuthRole.NURSE)
  @Post(':id/contact-attempt')
  contactAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ContactAttemptDto,
  ) {
    return this.careTasksService.contactAttempt(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  /** DEC-021 NR-01 §8 — DOCTOR + NURSE (method-level override only). */
  @Roles(AuthRole.DOCTOR, AuthRole.NURSE)
  @Post(':id/lost-to-follow-up')
  markLostToFollowUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LostToFollowUpDto,
  ) {
    return this.careTasksService.markLostToFollowUp(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }
}
