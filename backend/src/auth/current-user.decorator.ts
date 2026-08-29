import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthRole } from '@prisma/client';

/**
 * Request-scoped authority (DEC-018). Every field here is resolved from the
 * current AuthUser row in the database by JwtStrategy.validate on each
 * request — NEVER from JWT claims. The tenant access token carries only
 * `sub`, `realm` and `sessionVersion`; it is not an authorization document.
 */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  role: AuthRole;
  isClinicAdmin: boolean;
  mustChangePassword: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
