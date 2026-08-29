import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/current-user.decorator';

/**
 * Focused Clinic Admin capability guard (DEC-018 T3). NOT a generic
 * permission engine. Grants access only to a request whose current AuthUser
 * (already resolved from DB by JwtStrategy) is authenticated, ACTIVE,
 * `isClinicAdmin === true` and not mid forced-password-change.
 *
 * ACTIVE status is already enforced upstream by JwtStrategy (a non-ACTIVE
 * user never reaches here); this guard re-checks the capability and the
 * password-change gate that specifically bound administrative actions.
 */
@Injectable()
export class ClinicAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException();
    }
    if (!user.isClinicAdmin || user.mustChangePassword) {
      throw new ForbiddenException('Clinic Admin capability required');
    }
    return true;
  }
}
