import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { DuplicateCheckDto } from './dto/duplicate-check.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

/**
 * Patient registration/lookup is available to both DOCTOR and RECEPTIONIST
 * (CORE-01 section 12) — Patient itself carries no clinical content. Timeline
 * is DOCTOR-only: it surfaces Encounter/CarePlan clinical content.
 */
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Roles(AuthRole.DOCTOR, AuthRole.RECEPTIONIST)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.create(user.tenantId, user.userId, dto);
  }

  @Roles(AuthRole.DOCTOR, AuthRole.RECEPTIONIST)
  @Post('duplicate-check')
  checkDuplicates(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DuplicateCheckDto,
  ) {
    return this.patientsService.checkDuplicates(user.tenantId, dto);
  }

  @Roles(AuthRole.DOCTOR, AuthRole.RECEPTIONIST)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.list(user.tenantId);
  }

  @Roles(AuthRole.DOCTOR, AuthRole.RECEPTIONIST)
  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.patientsService.getById(user.tenantId, id);
  }

  @Roles(AuthRole.DOCTOR)
  @Get(':id/timeline')
  getTimeline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.patientsService.getTimeline(user.tenantId, id);
  }
}
