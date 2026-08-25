import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { CareEpisodesService } from './care-episodes.service';
import { CreateCareEpisodeDto } from './dto/create-care-episode.dto';
import { ReopenCareEpisodeDto } from './dto/reopen-care-episode.dto';

@Roles(AuthRole.DOCTOR)
@Controller()
export class CareEpisodesController {
  constructor(private readonly careEpisodesService: CareEpisodesService) {}

  @Post('care-episodes')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCareEpisodeDto,
  ) {
    return this.careEpisodesService.create(user.tenantId, user.userId, dto);
  }

  @Get('care-episodes/:id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.careEpisodesService.getById(user.tenantId, id);
  }

  @Get('patients/:patientId/care-episodes')
  listByPatient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId') patientId: string,
  ) {
    return this.careEpisodesService.listByPatient(user.tenantId, patientId);
  }

  @Post('care-episodes/:id/close')
  close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.careEpisodesService.close(user.tenantId, user.userId, id);
  }

  @Post('care-episodes/:id/reopen')
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReopenCareEpisodeDto,
  ) {
    return this.careEpisodesService.reopen(user.tenantId, user.userId, id, dto);
  }
}
