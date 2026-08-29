import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthRole, AuthUser, AuthUserStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/current-user.decorator';
import { generateTemporaryPassword } from './temp-password';
import { USER_MANAGEMENT_AUDIT_ACTIONS } from './audit-actions';
import {
  CreateClinicAdminUserDto,
  UpdateClinicAdminUserDto,
} from './dto/clinic-admin-user.dto';

const BCRYPT_ROUNDS = 10;
const AUTH_USER_ENTITY = 'AuthUser';

export interface ClinicAdminUserView {
  id: string;
  email: string;
  displayName: string | null;
  role: AuthRole;
  status: AuthUserStatus;
  isClinicAdmin: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toView(u: AuthUser): ClinicAdminUserView {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    isClinicAdmin: u.isClinicAdmin,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/**
 * DEC-018 T3/T4 Clinic Admin user-management. Every target lookup is scoped
 * by `id + currentUser.tenantId`; the client can never address a user in
 * another tenant, and a wrong-tenant id is reported as a plain 404 (no
 * existence leak). No DELETE. Role / displayName / isClinicAdmin are the only
 * mutable profile fields; tenant is never switchable.
 */
@Injectable()
export class ClinicAdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async findInTenantOrThrow(
    tenantId: string,
    id: string,
  ): Promise<AuthUser> {
    const user = await this.prisma.authUser.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async list(
    tenantId: string,
    search?: string,
  ): Promise<ClinicAdminUserView[]> {
    const where: Prisma.AuthUserWhereInput = { tenantId };
    const trimmed = search?.trim();
    if (trimmed) {
      where.OR = [
        { email: { contains: trimmed, mode: 'insensitive' } },
        { displayName: { contains: trimmed, mode: 'insensitive' } },
      ];
    }
    const users = await this.prisma.authUser.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }],
    });
    return users.map(toView);
  }

  async getById(tenantId: string, id: string): Promise<ClinicAdminUserView> {
    return toView(await this.findInTenantOrThrow(tenantId, id));
  }

  async create(
    actor: AuthenticatedUser,
    dto: CreateClinicAdminUserDto,
  ): Promise<{ user: ClinicAdminUserView; temporaryPassword: string }> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.authUser.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const grantAdmin = dto.isClinicAdmin === true;

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.authUser.create({
        data: {
          email,
          passwordHash,
          role: dto.role,
          tenantId: actor.tenantId,
          displayName: dto.displayName?.trim() || null,
          isClinicAdmin: grantAdmin,
          status: AuthUserStatus.ACTIVE,
          mustChangePassword: true,
          sessionVersion: 0,
        },
      });

      await this.audit.record(
        {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'USER_CREATED',
          entityType: AUTH_USER_ENTITY,
          entityId: user.id,
          metadata: {
            targetUserId: user.id,
            email: user.email,
            role: user.role,
            isClinicAdmin: user.isClinicAdmin,
          },
        },
        tx,
      );
      if (grantAdmin) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            action: 'USER_CLINIC_ADMIN_GRANTED',
            entityType: AUTH_USER_ENTITY,
            entityId: user.id,
            metadata: { targetUserId: user.id, grantedAtCreation: true },
          },
          tx,
        );
      }
      return user;
    });

    return { user: toView(created), temporaryPassword };
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateClinicAdminUserDto,
  ): Promise<ClinicAdminUserView> {
    const current = await this.findInTenantOrThrow(actor.tenantId, id);

    const nextDisplayName =
      dto.displayName === undefined
        ? current.displayName
        : dto.displayName.trim() || null;
    const displayNameChanged = nextDisplayName !== current.displayName;
    const roleChanged =
      dto.role !== undefined && dto.role !== current.role;
    const adminChanged =
      dto.isClinicAdmin !== undefined &&
      dto.isClinicAdmin !== current.isClinicAdmin;
    const revokingAdmin = adminChanged && dto.isClinicAdmin === false;

    if (!displayNameChanged && !roleChanged && !adminChanged) {
      return toView(current);
    }

    const data: Prisma.AuthUserUpdateInput = {};
    if (displayNameChanged) data.displayName = nextDisplayName;
    if (roleChanged) data.role = dto.role;
    if (adminChanged) data.isClinicAdmin = dto.isClinicAdmin;

    const writeAndAudit = async (tx: Prisma.TransactionClient) => {
      if (revokingAdmin && current.status === AuthUserStatus.ACTIVE) {
        await this.assertNotLastActiveClinicAdmin(tx, actor.tenantId);
      }

      const updated = await tx.authUser.update({
        where: { id: current.id },
        data,
      });

      if (displayNameChanged) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            action: 'USER_PROFILE_UPDATED',
            entityType: AUTH_USER_ENTITY,
            entityId: current.id,
            metadata: { targetUserId: current.id, field: 'displayName' },
          },
          tx,
        );
      }
      if (roleChanged) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            action: 'USER_ROLE_CHANGED',
            entityType: AUTH_USER_ENTITY,
            entityId: current.id,
            metadata: {
              targetUserId: current.id,
              fromRole: current.role,
              toRole: updated.role,
            },
          },
          tx,
        );
      }
      if (adminChanged) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            action: updated.isClinicAdmin
              ? 'USER_CLINIC_ADMIN_GRANTED'
              : 'USER_CLINIC_ADMIN_REVOKED',
            entityType: AUTH_USER_ENTITY,
            entityId: current.id,
            metadata: { targetUserId: current.id },
          },
          tx,
        );
      }
      return updated;
    };

    try {
      const updated = revokingAdmin
        ? await this.prisma.$transaction(writeAndAudit, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          })
        : await this.prisma.$transaction(writeAndAudit);
      return toView(updated);
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
  }

  async disable(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<ClinicAdminUserView> {
    const current = await this.findInTenantOrThrow(actor.tenantId, id);
    if (current.status === AuthUserStatus.DISABLED) {
      throw new ConflictException('User is already disabled');
    }

    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          if (current.isClinicAdmin) {
            await this.assertNotLastActiveClinicAdmin(tx, actor.tenantId);
          }
          const u = await tx.authUser.update({
            where: { id: current.id },
            data: {
              status: AuthUserStatus.DISABLED,
              sessionVersion: { increment: 1 },
            },
          });
          await this.audit.record(
            {
              tenantId: actor.tenantId,
              actorId: actor.userId,
              action: 'USER_DISABLED',
              entityType: AUTH_USER_ENTITY,
              entityId: current.id,
              metadata: { targetUserId: current.id },
            },
            tx,
          );
          return u;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return toView(updated);
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
  }

  async reactivate(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<ClinicAdminUserView> {
    const current = await this.findInTenantOrThrow(actor.tenantId, id);
    if (current.status === AuthUserStatus.ACTIVE) {
      throw new ConflictException('User is already active');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Reactivate ONLY flips status. Clinic Admin capability is NOT restored
      // automatically; password is NOT reset automatically (DEC-018 T4).
      const u = await tx.authUser.update({
        where: { id: current.id },
        data: { status: AuthUserStatus.ACTIVE },
      });
      await this.audit.record(
        {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'USER_REACTIVATED',
          entityType: AUTH_USER_ENTITY,
          entityId: current.id,
          metadata: { targetUserId: current.id },
        },
        tx,
      );
      return u;
    });
    return toView(updated);
  }

  async resetPassword(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<{ user: ClinicAdminUserView; temporaryPassword: string }> {
    const current = await this.findInTenantOrThrow(actor.tenantId, id);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.authUser.update({
        where: { id: current.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          sessionVersion: { increment: 1 },
        },
      });
      await this.audit.record(
        {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'USER_PASSWORD_RESET',
          entityType: AUTH_USER_ENTITY,
          entityId: current.id,
          metadata: { targetUserId: current.id },
        },
        tx,
      );
      return u;
    });

    return { user: toView(updated), temporaryPassword };
  }

  async getAudit(tenantId: string, id: string) {
    await this.findInTenantOrThrow(tenantId, id);
    const events = await this.prisma.auditEvent.findMany({
      where: {
        tenantId,
        entityType: AUTH_USER_ENTITY,
        entityId: id,
        action: { in: [...USER_MANAGEMENT_AUDIT_ACTIONS] },
      },
      orderBy: { seq: 'asc' },
      select: {
        id: true,
        seq: true,
        action: true,
        actorId: true,
        createdAt: true,
        metadata: true,
      },
    });
    return events;
  }

  /**
   * Must run inside a SERIALIZABLE transaction. Takes a row lock on the
   * tenant so that every last-Clinic-Admin-guarded mutation for a tenant is
   * serialized: concurrent disable/revoke calls queue behind this lock, and
   * each re-reads the ACTIVE Clinic Admin count only after the previous one
   * has committed. Rejects (409) when the tenant has one (or zero) ACTIVE
   * Clinic Admin left, so the count can never drop below 1. A genuine
   * Postgres serialization failure is still mapped to 409 by
   * throwIfConcurrencyConflict; there is no automatic retry.
   */
  private async assertNotLastActiveClinicAdmin(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`;

    const activeAdmins = await tx.authUser.count({
      where: {
        tenantId,
        status: AuthUserStatus.ACTIVE,
        isClinicAdmin: true,
      },
    });
    if (activeAdmins <= 1) {
      throw new ConflictException(
        'A tenant must always retain at least one active Clinic Admin',
      );
    }
  }

  private throwIfConcurrencyConflict(err: unknown): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2034'
    ) {
      throw new ConflictException(
        'Serialization conflict — reload the latest user state and retry',
      );
    }
    if (
      err instanceof Error &&
      (err.message.includes('40001') ||
        err.message.includes('40P01') ||
        err.message.includes('could not serialize access') ||
        err.message.includes('deadlock detected'))
    ) {
      throw new ConflictException(
        'Serialization conflict — reload the latest user state and retry',
      );
    }
  }
}
