import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './current-user.decorator';
import { TENANT_REALM, TenantJwtPayload } from './tenant-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Runs only after passport-jwt has verified the signature and expiry.
   * DEC-018: request authority is resolved from the current AuthUser row,
   * never from the token. A stale token whose bearer has since been
   * role-changed / capability-revoked / disabled / password-reset is either
   * rejected here (disable, password reset) or handed downstream with the
   * *current* role and capability (role change, capability revoke).
   */
  async validate(payload: TenantJwtPayload): Promise<AuthenticatedUser> {
    if (payload?.realm !== TENANT_REALM) {
      throw new UnauthorizedException();
    }
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.authUser.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.status !== AuthUserStatus.ACTIVE) {
      throw new UnauthorizedException();
    }
    if (payload.sessionVersion !== user.sessionVersion) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      isClinicAdmin: user.isClinicAdmin,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
