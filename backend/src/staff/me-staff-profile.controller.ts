import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { StaffProfileService } from './staff-profile.service';

/**
 * DEC-019 T2 self view. Read-only; resolves ONLY the current authenticated
 * user (never an arbitrary id). No self-edit endpoint exists in v1.
 */
@Controller('auth/me')
export class MeStaffProfileController {
  constructor(private readonly profiles: StaffProfileService) {}

  @Get('profile')
  getSelfProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getSelf(user);
  }
}
