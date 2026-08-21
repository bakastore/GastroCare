import { Controller, Get, Param } from '@nestjs/common';
import { FoundationService } from './foundation.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

/**
 * Neutral Foundation routes used only to prove Gate 2 technical capabilities
 * (authentication + tenant isolation). Not GastroCare Core.
 */
@Controller('foundation')
export class FoundationController {
  constructor(private readonly foundationService: FoundationService) {}

  // Neutral protected route used as auth evidence: 200 for any valid
  // authenticated identity, 401 otherwise (enforced by the global guard).
  @Get('whoami')
  whoami(@CurrentUser() user: AuthenticatedUser) {
    return { userId: user.userId, tenantId: user.tenantId, email: user.email };
  }

  @Get('probe')
  listProbeRecords(@CurrentUser() user: AuthenticatedUser) {
    return this.foundationService.listProbeRecords(user.tenantId);
  }

  @Get('probe/:id')
  getProbeRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.foundationService.getProbeRecord(user.tenantId, id);
  }
}
