import { Injectable, NotFoundException } from '@nestjs/common';
import { StaffCredential, StaffCredentialStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/current-user.decorator';
import { StaffAccessService } from './staff-access.service';
import { CreateCredentialDto, UpdateCredentialDto } from './dto/credential.dto';
import { STAFF_CREDENTIAL_ENTITY } from './staff.constants';
import {
  assertOrderedDates,
  parseDateOnly,
  toCredentialView,
  trimToNull,
} from './staff-support';

@Injectable()
export class StaffCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: StaffAccessService,
  ) {}

  async list(tenantId: string, userId: string) {
    const profile = await this.access.getProfileOrThrow(tenantId, userId);
    const rows = await this.prisma.staffCredential.findMany({
      where: { tenantId, staffProfileId: profile.id },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toCredentialView);
  }

  private async findChildOrThrow(
    tenantId: string,
    staffProfileId: string,
    credentialId: string,
  ): Promise<StaffCredential> {
    const row = await this.prisma.staffCredential.findFirst({
      where: { id: credentialId, tenantId, staffProfileId },
    });
    if (!row) throw new NotFoundException('Credential not found');
    return row;
  }

  async create(
    actor: AuthenticatedUser,
    userId: string,
    dto: CreateCredentialDto,
  ) {
    const profile = await this.access.getProfileOrThrow(actor.tenantId, userId);
    const issueDate = parseDateOnly(dto.issueDate, 'issueDate') ?? null;
    const expiryDate = parseDateOnly(dto.expiryDate, 'expiryDate') ?? null;
    assertOrderedDates(
      issueDate,
      expiryDate,
      'expiryDate must be on or after issueDate',
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.staffCredential.create({
        data: {
          tenantId: actor.tenantId,
          staffProfileId: profile.id,
          credentialType: dto.credentialType,
          name: dto.name.trim(),
          credentialNumber: trimToNull(dto.credentialNumber) ?? null,
          issuingOrganization: trimToNull(dto.issuingOrganization) ?? null,
          issueDate,
          expiryDate,
          note: trimToNull(dto.note) ?? null,
        },
      });
      await this.audit.record(
        {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'CREDENTIAL_ADDED',
          entityType: STAFF_CREDENTIAL_ENTITY,
          entityId: row.id,
          metadata: {
            targetUserId: userId,
            staffProfileId: profile.id,
            credentialId: row.id,
            credentialType: row.credentialType,
            name: row.name,
          },
        },
        tx,
      );
      return row;
    });
    return toCredentialView(created);
  }

  async update(
    actor: AuthenticatedUser,
    userId: string,
    credentialId: string,
    dto: UpdateCredentialDto,
  ) {
    const profile = await this.access.getProfileOrThrow(actor.tenantId, userId);
    const current = await this.findChildOrThrow(
      actor.tenantId,
      profile.id,
      credentialId,
    );

    const nextIssue =
      dto.issueDate !== undefined
        ? parseDateOnly(dto.issueDate, 'issueDate') ?? null
        : current.issueDate;
    const nextExpiry =
      dto.expiryDate !== undefined
        ? parseDateOnly(dto.expiryDate, 'expiryDate') ?? null
        : current.expiryDate;
    assertOrderedDates(
      nextIssue,
      nextExpiry,
      'expiryDate must be on or after issueDate',
    );

    const data = {
      ...(dto.credentialType !== undefined && {
        credentialType: dto.credentialType,
      }),
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.credentialNumber !== undefined && {
        credentialNumber: trimToNull(dto.credentialNumber) ?? null,
      }),
      ...(dto.issuingOrganization !== undefined && {
        issuingOrganization: trimToNull(dto.issuingOrganization) ?? null,
      }),
      ...(dto.issueDate !== undefined && { issueDate: nextIssue }),
      ...(dto.expiryDate !== undefined && { expiryDate: nextExpiry }),
      ...(dto.status !== undefined && {
        status: dto.status as StaffCredentialStatus,
      }),
      ...(dto.note !== undefined && { note: trimToNull(dto.note) ?? null }),
    };
    if (Object.keys(data).length === 0) {
      return toCredentialView(current);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.staffCredential.update({
        where: { id: current.id },
        data,
      });
      await this.audit.record(
        {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'CREDENTIAL_UPDATED',
          entityType: STAFF_CREDENTIAL_ENTITY,
          entityId: row.id,
          metadata: {
            targetUserId: userId,
            staffProfileId: profile.id,
            credentialId: row.id,
            credentialType: row.credentialType,
            name: row.name,
            changedFields: Object.keys(data),
          },
        },
        tx,
      );
      return row;
    });
    return toCredentialView(updated);
  }

  async remove(
    actor: AuthenticatedUser,
    userId: string,
    credentialId: string,
  ) {
    const profile = await this.access.getProfileOrThrow(actor.tenantId, userId);
    const current = await this.findChildOrThrow(
      actor.tenantId,
      profile.id,
      credentialId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.staffCredential.delete({ where: { id: current.id } });
      await this.audit.record(
        {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'CREDENTIAL_REMOVED',
          entityType: STAFF_CREDENTIAL_ENTITY,
          entityId: current.id,
          metadata: {
            targetUserId: userId,
            staffProfileId: profile.id,
            credentialId: current.id,
            credentialType: current.credentialType,
            name: current.name,
          },
        },
        tx,
      );
    });
    return { deleted: true, id: current.id };
  }
}
