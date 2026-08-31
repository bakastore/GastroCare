import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StaffProfile, StaffSpecialty } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/current-user.decorator';
import { StaffAccessService } from './staff-access.service';
import { PutStaffProfileDto } from './dto/staff-profile.dto';
import { STAFF_AUDIT_ACTIONS, STAFF_PROFILE_ENTITY } from './staff.constants';
import { toCredentialView, toProfileView, trimToNull } from './staff-support';

interface ResolvedProfileState {
  fullName: string;
  professionalTitle: string | null;
  workPhone: string | null;
  primarySpecialty: StaffSpecialty | null;
  secondarySpecialties: StaffSpecialty[];
  specialtyOtherLabel: string | null;
  biography: string | null;
}

@Injectable()
export class StaffProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: StaffAccessService,
  ) {}

  async getForAdmin(tenantId: string, userId: string) {
    const profile = await this.access.getProfileOrNull(tenantId, userId);
    return { userId, profile: profile ? toProfileView(profile) : null };
  }

  /**
   * GET /clinic-admin/users/:id/staff-audit — DEC-019 staff events for this
   * target user, ordered by AuditEvent.seq. DEC-018's user-management audit
   * (GET .../audit) is disjoint and unchanged; the frontend merges the two by
   * seq.
   */
  async getStaffAudit(tenantId: string, userId: string) {
    await this.access.findUserInTenantOrThrow(tenantId, userId);
    return this.prisma.auditEvent.findMany({
      where: {
        tenantId,
        action: { in: [...STAFF_AUDIT_ACTIONS] },
        metadata: { path: ['targetUserId'], equals: userId },
      },
      orderBy: { seq: 'asc' },
      select: {
        id: true,
        seq: true,
        action: true,
        actorId: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        metadata: true,
      },
    });
  }

  /** GET /auth/me/profile — current authenticated user only, read-only. */
  async getSelf(actor: AuthenticatedUser) {
    const user = await this.prisma.authUser.findUnique({
      where: { id: actor.userId },
    });
    if (!user) throw new NotFoundException();
    const profile = await this.prisma.staffProfile.findFirst({
      where: { authUserId: user.id, tenantId: user.tenantId },
    });
    const credentials = profile
      ? await this.prisma.staffCredential.findMany({
          where: { staffProfileId: profile.id, tenantId: user.tenantId },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    return {
      account: {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isClinicAdmin: user.isClinicAdmin,
        status: user.status,
      },
      profile: profile ? toProfileView(profile) : null,
      credentials: credentials.map(toCredentialView),
    };
  }

  async put(actor: AuthenticatedUser, userId: string, dto: PutStaffProfileDto) {
    const existing = await this.access.getProfileOrNull(actor.tenantId, userId);
    const next = this.resolveState(existing, dto);
    this.validateSpecialties(next);

    if (!existing) {
      const created = await this.prisma.$transaction(async (tx) => {
        const profile = await tx.staffProfile.create({
          data: {
            tenantId: actor.tenantId,
            authUserId: userId,
            ...next,
          },
        });
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            action: 'STAFF_PROFILE_CREATED',
            entityType: STAFF_PROFILE_ENTITY,
            entityId: profile.id,
            metadata: { targetUserId: userId, staffProfileId: profile.id },
          },
          tx,
        );
        return profile;
      });
      return toProfileView(created);
    }

    const changedFields = this.diffFields(existing, next);
    if (changedFields.length === 0) {
      return toProfileView(existing);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.staffProfile.update({
        where: { id: existing.id },
        data: next,
      });
      await this.audit.record(
        {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'STAFF_PROFILE_UPDATED',
          entityType: STAFF_PROFILE_ENTITY,
          entityId: profile.id,
          metadata: {
            targetUserId: userId,
            staffProfileId: profile.id,
            changedFields,
          },
        },
        tx,
      );
      return profile;
    });
    return toProfileView(updated);
  }

  private resolveState(
    existing: StaffProfile | null,
    dto: PutStaffProfileDto,
  ): ResolvedProfileState {
    const pick = <T>(dtoValue: T | undefined, current: T, fallback: T): T =>
      dtoValue !== undefined ? dtoValue : existing ? current : fallback;

    const fullNameRaw =
      dto.fullName !== undefined
        ? dto.fullName.trim()
        : existing?.fullName ?? '';
    if (!existing && !fullNameRaw) {
      throw new BadRequestException(
        'fullName is required when creating a staff profile',
      );
    }
    if (dto.fullName !== undefined && !fullNameRaw) {
      throw new BadRequestException('fullName cannot be blank');
    }

    return {
      fullName: fullNameRaw || (existing?.fullName ?? ''),
      professionalTitle: pick(
        trimToNull(dto.professionalTitle),
        existing?.professionalTitle ?? null,
        null,
      ),
      workPhone: pick(
        trimToNull(dto.workPhone),
        existing?.workPhone ?? null,
        null,
      ),
      primarySpecialty: pick(
        dto.primarySpecialty ?? null,
        existing?.primarySpecialty ?? null,
        null,
      ),
      secondarySpecialties: pick(
        dto.secondarySpecialties,
        existing?.secondarySpecialties ?? [],
        [],
      ),
      specialtyOtherLabel: pick(
        trimToNull(dto.specialtyOtherLabel),
        existing?.specialtyOtherLabel ?? null,
        null,
      ),
      biography: pick(
        trimToNull(dto.biography),
        existing?.biography ?? null,
        null,
      ),
    };
  }

  private validateSpecialties(state: ResolvedProfileState): void {
    const secondary = state.secondarySpecialties;
    if (new Set(secondary).size !== secondary.length) {
      throw new BadRequestException(
        'secondarySpecialties must not contain duplicates',
      );
    }
    if (
      state.primarySpecialty &&
      secondary.includes(state.primarySpecialty)
    ) {
      throw new BadRequestException(
        'primarySpecialty must not also appear in secondarySpecialties',
      );
    }
    const hasOther =
      state.primarySpecialty === StaffSpecialty.OTHER ||
      secondary.includes(StaffSpecialty.OTHER);
    if (hasOther && !state.specialtyOtherLabel) {
      throw new BadRequestException(
        'specialtyOtherLabel is required when OTHER is selected',
      );
    }
    if (!hasOther && state.specialtyOtherLabel) {
      // Silently normalize: no OTHER => no label.
      state.specialtyOtherLabel = null;
    }
  }

  private diffFields(
    existing: StaffProfile,
    next: ResolvedProfileState,
  ): string[] {
    const changed: string[] = [];
    const cmp = (k: keyof ResolvedProfileState, a: unknown, b: unknown) => {
      if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(k);
    };
    cmp('fullName', existing.fullName, next.fullName);
    cmp('professionalTitle', existing.professionalTitle, next.professionalTitle);
    cmp('workPhone', existing.workPhone, next.workPhone);
    cmp('primarySpecialty', existing.primarySpecialty, next.primarySpecialty);
    cmp(
      'secondarySpecialties',
      existing.secondarySpecialties,
      next.secondarySpecialties,
    );
    cmp(
      'specialtyOtherLabel',
      existing.specialtyOtherLabel,
      next.specialtyOtherLabel,
    );
    cmp('biography', existing.biography, next.biography);
    return changed;
  }
}
