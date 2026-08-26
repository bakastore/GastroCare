import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { CareTasksService } from './care-tasks.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RescheduleCareTaskDto } from './dto/reschedule-care-task.dto';
import { CompleteCareTaskDto } from './dto/complete-care-task.dto';

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
}
