import { Controller, Get, Param, Post } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { CareTasksService } from './care-tasks.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Roles(AuthRole.DOCTOR)
@Controller('care-tasks')
export class CareTasksController {
  constructor(private readonly careTasksService: CareTasksService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.careTasksService.list(user.tenantId);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.careTasksService.complete(user.tenantId, user.userId, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.careTasksService.cancel(user.tenantId, user.userId, id);
  }
}
