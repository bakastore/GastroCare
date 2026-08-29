import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TENANT_REALM } from './tenant-jwt';

const BCRYPT_ROUNDS = 10;

/** Safe current-user projection for the frontend — never a secret. */
export interface AuthMeView {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string | null;
  role: string;
  isClinicAdmin: boolean;
  status: AuthUserStatus;
  mustChangePassword: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private signTenantToken(userId: string, sessionVersion: number) {
    // Tenant JWT v1 — only sub / realm / sessionVersion (DEC-018).
    return this.jwtService.signAsync({
      sub: userId,
      realm: TENANT_REALM,
      sessionVersion,
    });
  }

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.authUser.findUnique({ where: { email } });
    if (!user || user.status !== AuthUserStatus.ACTIVE) {
      // Generic response — do not disclose whether the account exists or is
      // disabled.
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { accessToken: await this.signTenantToken(user.id, user.sessionVersion) };
  }

  async me(userId: string): Promise<AuthMeView> {
    const user = await this.prisma.authUser.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isClinicAdmin: user.isClinicAdmin,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
    };
  }

  /**
   * Self-service password change. On success the session version is bumped,
   * so the token that made this call — and every other previously issued
   * token for this user — is invalid on the next request. A fresh token is
   * returned so the caller's session can continue uninterrupted.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ accessToken: string }> {
    const user = await this.prisma.authUser.findUnique({ where: { id: userId } });
    if (!user || user.status !== AuthUserStatus.ACTIVE) {
      throw new UnauthorizedException();
    }

    const currentMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!currentMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const updated = await this.prisma.authUser.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
    });

    return {
      accessToken: await this.signTenantToken(
        updated.id,
        updated.sessionVersion,
      ),
    };
  }
}
