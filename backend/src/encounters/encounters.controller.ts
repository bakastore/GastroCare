import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { EncountersService } from './encounters.service';
import { HemorrhoidReturnEncounterService } from './hemorrhoid-return-encounter.service';
import { HemorrhoidTreatmentActivationService } from './hemorrhoid-treatment-activation.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { HandoverEncounterDto } from './dto/handover-encounter.dto';
import { CreateHemorrhoidReturnEncounterDto } from './dto/create-hemorrhoid-return-encounter.dto';
import { ActivateHemorrhoidTreatmentDto } from './dto/activate-hemorrhoid-treatment.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('encounters')
export class EncountersController {
  constructor(
    private readonly encountersService: EncountersService,
    private readonly hemorrhoidReturnEncounterService: HemorrhoidReturnEncounterService,
    private readonly hemorrhoidTreatmentActivationService: HemorrhoidTreatmentActivationService,
  ) {}

  /**
   * Dedicated atomic Return Encounter orchestration — Hemorrhoid Vertical
   * Slice 3 T2 (DEC-013 §H; docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md
   * §H). Declared before the generic `:id` routes below so this literal
   * segment is never captured as a param.
   */
  @Roles(AuthRole.DOCTOR)
  @Post('hemorrhoid-return')
  createHemorrhoidReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHemorrhoidReturnEncounterDto,
  ) {
    return this.hemorrhoidReturnEncounterService.create(
      user.tenantId,
      user.userId,
      dto,
    );
  }

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

  /** DEC-021 §3.1 — Structured Treatment Activation. DOCTOR-only. */
  @Roles(AuthRole.DOCTOR)
  @Post(':id/hemorrhoid-treatment/activate')
  activateHemorrhoidTreatment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ActivateHemorrhoidTreatmentDto,
  ) {
    return this.hemorrhoidTreatmentActivationService.activate(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  /** DEC-021 NR-03 §5 — explicit clinical start. DOCTOR-only. */
  @Roles(AuthRole.DOCTOR)
  @Post(':id/start')
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.encountersService.startEncounter(
      user.tenantId,
      user.userId,
      id,
    );
  }

  /** DEC-021 NR-03 §5 / §6.4 — explicit clinical end. DOCTOR-only. */
  @Roles(AuthRole.DOCTOR)
  @Post(':id/end')
  end(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.encountersService.endEncounter(user.tenantId, user.userId, id);
  }

  /** DEC-021 §6.3 — receiving Doctor accepts the latest handover. DOCTOR-only. */
  @Roles(AuthRole.DOCTOR)
  @Post(':id/accept-handover')
  acceptHandover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.encountersService.acceptHandover(
      user.tenantId,
      user.userId,
      id,
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
