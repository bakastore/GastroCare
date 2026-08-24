import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { FollowUpTasksService } from './follow-up-tasks.service';
import { GenerateFollowUpTasksDto } from './dto/generate-follow-up-tasks.dto';
import { RescheduleFollowUpTaskDto } from './dto/reschedule-follow-up-task.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Roles(AuthRole.DOCTOR)
@Controller('follow-up-tasks')
export class FollowUpTasksController {
  constructor(private readonly followUpTasksService: FollowUpTasksService) {}

  @Post('generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateFollowUpTasksDto,
  ) {
    return this.followUpTasksService.generateForSurgeryEncounterById(
      user.tenantId,
      user.userId,
      dto.sourceEncounterId,
    );
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('patientId') patientId?: string,
    @Query('sourceEncounterId') sourceEncounterId?: string,
  ) {
    if (sourceEncounterId) {
      return this.followUpTasksService.listBySourceEncounter(
        user.tenantId,
        sourceEncounterId,
      );
    }
    if (patientId) {
      return this.followUpTasksService.listByPatient(user.tenantId, patientId);
    }
    throw new BadRequestException(
      'patientId or sourceEncounterId query parameter is required',
    );
  }

  @Patch(':id/reschedule')
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RescheduleFollowUpTaskDto,
  ) {
    return this.followUpTasksService.reschedule(
      user.tenantId,
      user.userId,
      id,
      new Date(dto.dueDate),
    );
  }
}
