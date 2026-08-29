import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ALLOW_DURING_PASSWORD_CHANGE_KEY } from './allow-during-password-change.decorator';
import { AuthenticatedUser } from './current-user.decorator';

/**
 * Global guard (registered after JwtAuthGuard / RolesGuard). When the
 * authenticated user carries `mustChangePassword = true`, only routes marked
 * @Public() or @AllowDuringPasswordChange() are permitted; every normal
 * application action is rejected with 403 until the password is changed
 * (DEC-018 T2).
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !user.mustChangePassword) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_DURING_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) {
      return true;
    }

    throw new ForbiddenException(
      'Password change required before any other action',
    );
  }
}
