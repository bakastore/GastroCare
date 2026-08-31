import { Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentHistory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/current-user.decorator';
import { StaffAccessService } from './staff-access.service';
import { CreateEmploymentDto, UpdateEmploymentDto } from './dto/employment.dto';
import { EMPLOYMENT_HISTORY_ENTITY } from './staff.constants';
import {
  assertOrderedDates,
  parseDateOnly,
  toEmploymentView,
  trimToNull,
} from './staff-support';

/**
 * DEC-019 T3.2 Employment history. Overlapping records are explicitly allowed
 * (no exclusion constraint). Hard delete allowed; mutation + audit atomic.
 */
@Injectable()
export class StaffEmploymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: StaffAccessService,
  ) {}

  async list(tenantId: string, userId: string) {
    const profile = await this.access.getProfileOrThrow(tenantId, userId);
    const rows = await this.prisma.employmentHistory.findMany({
      where: { tenantId, staffProfileId: profile.id },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toEmploymentView);
  }

  private async findChildOrThrow(
    tenantId: string,
    staffProfileId: string,
    recordId: string,
  ): Promise<EmploymentHistory> {
    const row = await this.prisma.employmentHistory.findFirst({
      where: { id: recordId, tenantId, staffProfileId },
    });
    if (!row) throw new NotFoundException('Employment record not found');
    return row;
  }

  async create(
    actor: AuthenticatedUser,
    userId: string,
    dto: CreateEmploymentDto,
  ) {
    const profile = await this.access.getProfileOrThrow(actor.tenantId, userId);
    const startDate = parseDateOnly(dto.startDate, 'startDate');
    if (!startDate) throw new NotFoundException('startDate is required');
    const endDate = parseDateOnly(dto.endDate, 'endDate') ?? null;
    assertOrderedDates(
      startDate,
      endDate,
      'endDate must be on or after startDate',
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.employmentHistory.create({
        data: {
          tenantId: actor.tenantId,
          staffProfileId: profile.id,
          organizationName: dto.organizationName.trim(),
          department: trimToNull(dto.department) ?? null,
          positionTitle: trimToNull(dto.positionTitle) ?? null,
          startDate,
          endDate,
          employmentType: dto.employmentType ?? null,
          note: trimToNull(dto.note) ?? null,
        },
      });
      await this.audit.record(
        {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'EMPLOYMENT_RECORD_ADDED',
          entityType: EMPLOYMENT_HISTORY_ENTITY,
          entityId: row.id,
          metadata: {
            targetUserId: userId,
            staffProfileId: profile.id,
            recordId: row.id,
            organizationName: row.organizationName,
          },
        },
        tx,
      );
      return row;
    });
    return toEmploymentView(created);
  }

  async update(
    actor: AuthenticatedUser,
    userId: string,
    recordId: string,
    dto: UpdateEmploymentDto,
  ) {
    const profile = await this.access.getProfileOrThrow(actor.tenantId, userId);
    const current = await this.findChildOrThrow(
      actor.tenantId,
      profile.id,
      recordId,
    );

    const nextStart =
      dto.startDate !== undefined
        ? parseDateOnly(dto.startDate, 'startDate') ?? current.startDate
        : current.startDate;
    const nextEnd =
      dto.endDate !== undefined
        ? parseDateOnly(dto.endDate, 'endDate') ?? null
        : current.endDate;
    assertOrderedDates(
      nextStart,
      nextEnd,
      'endDate must be on or after startDate',
    );

    const data = {
      ...(dto.organizationName !== undefined && {
        organizationName: dto.organizationName.trim(),
      }),
      ...(dto.department !== undefined && {
        department: trimToNull(dto.department) ?? null,
      }),
      ...(dto.positionTitle !== undefined && {
        positionTitle: trimToNull(dto.positionTitle) ?? null,
      }),
      ...(dto.startDate !== undefined && { startDate: nextStart }),
      ...(dto.endDate !== undefined && { endDate: nextEnd }),
      ...(dto.employmentType !== undefined && {
        employmentType: dto.employmentType ?? null,
      }),
      ...(dto.note !== undefined && { note: trimToNull(dto.note) ?? null }),
    };
    if (Object.keys(data).length === 0) {
      return toEmploymentView(current);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.employmentHistory.update({
        where: { id: current.id },
        data,
      });
      await this.audit.record(
        {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'EMPLOYMENT_RECORD_UPDATED',
          entityType: EMPLOYMENT_HISTORY_ENTITY,
          entityId: row.id,
          metadata: {
            targetUserId: userId,
            staffProfileId: profile.id,
            recordId: row.id,
            changedFields: Object.keys(data),
          },
        },
        tx,
      );
      return row;
    });
    return toEmploymentView(updated);
  }

  async remove(actor: AuthenticatedUser, userId: string, recordId: string) {
    const profile = await this.access.getProfileOrThrow(actor.tenantId, userId);
    const current = await this.findChildOrThrow(
      actor.tenantId,
      profile.id,
      recordId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.employmentHistory.delete({ where: { id: current.id } });
      await this.audit.record(
        {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'EMPLOYMENT_RECORD_REMOVED',
          entityType: EMPLOYMENT_HISTORY_ENTITY,
          entityId: current.id,
          metadata: {
            targetUserId: userId,
            staffProfileId: profile.id,
            recordId: current.id,
            organizationName: current.organizationName,
            ...(current.positionTitle
              ? { positionTitle: current.positionTitle }
              : {}),
          },
        },
        tx,
      );
    });
    return { deleted: true, id: current.id };
  }
}
