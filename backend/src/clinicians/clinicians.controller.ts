import { Controller, Get } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { CliniciansService } from './clinicians.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

/**
 * Read-only clinician lookup, used by the Receptionist/Doctor UI to pick a
 * responsible clinician for an Encounter Context or a handover target
 * (DEC-010 §B). No clinical content is exposed here — id/email only.
 */
@Roles(AuthRole.DOCTOR, AuthRole.RECEPTIONIST)
@Controller('clinicians')
export class CliniciansController {
  constructor(private readonly cliniciansService: CliniciansService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.cliniciansService.listClinicians(user.tenantId);
  }
}
