import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { EncountersService } from './encounters.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { HandoverEncounterDto } from './dto/handover-encounter.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('encounters')
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  /**
   * DEC-010 §B: a Receptionist may create the Encounter Context (assigning a
   * responsible clinician + room); a DOCTOR may also create one directly.
   */
  @Roles(AuthRole.DOCTOR, AuthRole.RECEPTIONIST)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEncounterDto,
  ) {
    return this.encountersService.create(
      user.tenantId,
      user.userId,
      user.role,
      dto,
    );
  }

  // DOCTOR-only: RECEPTIONIST may create an Encounter Context (above) but
  // must not gain read access to detailed clinical Encounter content
  // (reasonForVisit/clinicalNote/assessment) — see CORE-01 section 12 role
  // boundary, preserved unchanged by DEC-010 (which authorizes Receptionist
  // *creation* of the context only, not clinical content read-back).
  @Roles(AuthRole.DOCTOR)
  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.encountersService.getById(user.tenantId, id);
  }

  /**
   * Clinician handover — DOCTOR-only (DEC-010 §B: only a clinician may hand
   * off clinical responsibility for an Encounter to another clinician).
   */
  @Roles(AuthRole.DOCTOR)
  @Post(':id/handover')
  handover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: HandoverEncounterDto,
  ) {
    return this.encountersService.handover(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  @Roles(AuthRole.DOCTOR)
  @Get(':id/clinician-history')
  getClinicianHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.encountersService.getClinicianHistory(user.tenantId, id);
  }
}
