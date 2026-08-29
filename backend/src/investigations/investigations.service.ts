import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import type {
  CreateInvestigationDto,
  InvestigationOrderDto,
  InvestigationResultDto,
} from './investigations.controller';
type Tx = Prisma.TransactionClient;
// NURSE sees only assigned orders/results and the minimum identity/Case
// context, never the patient's timeline, diagnoses, plans or other orders.
const contextSelect = {
  id: true,
  label: true,
  origin: true,
  caseId: true,
  patientId: true,
  parentInvestigationId: true,
  createdAt: true,
  patient: { select: { id: true, fullName: true, dateOfBirth: true } },
  careCase: { select: { id: true, status: true, episodeType: true } },
} as const;
@Injectable()
export class InvestigationsService {
  constructor(private readonly prisma: PrismaService) {}
  private async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2034'
      )
        throw new ConflictException(
          'Concurrent Investigation change; reload before retrying',
        );
      throw err;
    }
  }
  private async find(tx: Tx, u: AuthenticatedUser, id: string) {
    const inv = await tx.investigation.findFirst({
      where: { id, tenantId: u.tenantId },
    });
    if (!inv) throw new NotFoundException('Investigation not found');
    return inv;
  }
  private async audit(
    tx: Tx,
    u: AuthenticatedUser,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    await tx.auditEvent.create({
      data: {
        tenantId: u.tenantId,
        actorId: u.userId,
        action,
        entityType,
        entityId,
        metadata,
      },
    });
  }
  private async guardCase(tx: Tx, u: AuthenticatedUser, caseId: string) {
    const c = await tx.careEpisode.findFirst({
      where: {
        id: caseId,
        tenantId: u.tenantId,
        episodeType: 'HEMORRHOID_TREATMENT',
      },
    });
    if (!c) throw new NotFoundException('Case not found');
    if (c.status !== 'ACTIVE')
      throw new ConflictException('Case must be ACTIVE');
    await tx.careEpisode.update({
      where: { id: c.id },
      data: { status: 'ACTIVE' },
    });
    return c;
  }
  async create(u: AuthenticatedUser, dto: CreateInvestigationDto) {
    return this.transaction(async (tx) => {
      const c = await this.guardCase(tx, u, dto.caseId);
      if (dto.parentInvestigationId) {
        const p = await this.find(tx, u, dto.parentInvestigationId);
        if (p.caseId !== c.id || p.patientId !== c.patientId)
          throw new BadRequestException(
            'Parent must belong to the same patient/Case',
          );
      }
      const inv = await tx.investigation.create({
        data: {
          tenantId: u.tenantId,
          caseId: c.id,
          patientId: c.patientId,
          origin: dto.origin,
          label: dto.label,
          parentInvestigationId: dto.parentInvestigationId,
          createdByUserId: u.userId,
        },
      });
      await this.audit(
        tx,
        u,
        'INVESTIGATION_CREATED',
        'Investigation',
        inv.id,
        {
          caseId: c.id,
          parentInvestigationId: inv.parentInvestigationId,
          origin: inv.origin,
        },
      );
      return inv;
    });
  }
  async parent(u: AuthenticatedUser, id: string, parentId: string) {
    return this.transaction(async (tx) => {
      const inv = await this.find(tx, u, id);
      await this.guardCase(tx, u, inv.caseId);
      const seen = new Set([id]);
      let cursor: string | null = parentId;
      while (cursor) {
        if (seen.has(cursor))
          throw new BadRequestException('Investigation parent cycle');
        seen.add(cursor);
        const p = await this.find(tx, u, cursor);
        if (p.caseId !== inv.caseId || p.patientId !== inv.patientId)
          throw new BadRequestException(
            'Parent must belong to the same patient/Case',
          );
        cursor = p.parentInvestigationId;
      }
      const updated = await tx.investigation.update({
        where: { id },
        data: { parentInvestigationId: parentId },
      });
      await this.audit(
        tx,
        u,
        'INVESTIGATION_PARENT_LINKED',
        'Investigation',
        id,
        {
          previousParentId: inv.parentInvestigationId,
          parentInvestigationId: parentId,
        },
      );
      return updated;
    });
  }
  async order(u: AuthenticatedUser, id: string, dto: InvestigationOrderDto) {
    return this.transaction(async (tx) => {
      const inv = await this.find(tx, u, id);
      await this.guardCase(tx, u, inv.caseId);
      if (inv.origin !== 'INTERNAL_CURRENT')
        throw new BadRequestException(
          'Prior evidence must not fabricate a local Order',
        );
      if (
        dto.assignedToUserId &&
        !(await tx.authUser.findFirst({
          where: {
            id: dto.assignedToUserId,
            tenantId: u.tenantId,
            role: { in: ['DOCTOR', 'NURSE'] },
          },
        }))
      )
        throw new BadRequestException(
          'Assignee must be a same-tenant DOCTOR or NURSE',
        );
      const order = await tx.investigationOrder.create({
        data: {
          tenantId: u.tenantId,
          investigationId: id,
          orderedByUserId: u.userId,
          assignedToUserId: dto.assignedToUserId,
          requestedAt: new Date(dto.requestedAt),
          requestText: dto.requestText,
        },
      });
      await this.audit(
        tx,
        u,
        'INVESTIGATION_ORDER_CREATED',
        'InvestigationOrder',
        order.id,
        { investigationId: id, assignedToUserId: order.assignedToUserId },
      );
      return order;
    });
  }
  async result(u: AuthenticatedUser, id: string, dto: InvestigationResultDto) {
    return this.transaction(async (tx) => {
      const inv = await this.find(tx, u, id);
      const order = dto.orderId
        ? await tx.investigationOrder.findFirst({
            where: {
              id: dto.orderId,
              investigationId: id,
              tenantId: u.tenantId,
            },
          })
        : null;
      if (dto.orderId && !order)
        throw new BadRequestException(
          'Order does not belong to this Investigation',
        );
      if (u.role === 'NURSE' && (!order || order.assignedToUserId !== u.userId))
        throw new ForbiddenException(
          'NURSE may enter raw Result only for an explicitly assigned Order',
        );
      if (!['DOCTOR', 'NURSE'].includes(u.role)) throw new ForbiddenException();
      if (inv.origin === 'INTERNAL_CURRENT' && !order)
        throw new BadRequestException(
          'Current Result requires its explicit Order',
        );
      await this.guardCase(tx, u, inv.caseId);
      const result = await tx.investigationResult.create({
        data: {
          tenantId: u.tenantId,
          investigationId: id,
          orderId: dto.orderId,
          observedAt: new Date(dto.observedAt),
          rawText: dto.rawText,
          recordedByUserId: u.userId,
        },
      });
      await this.audit(
        tx,
        u,
        'INVESTIGATION_RESULT_RECORDED',
        'InvestigationResult',
        result.id,
        { investigationId: id, orderId: result.orderId },
      );
      return result;
    });
  }
  async get(u: AuthenticatedUser, id: string) {
    const inv = await this.prisma.investigation.findFirst({
      where: {
        id,
        tenantId: u.tenantId,
        ...(u.role === 'NURSE'
          ? {
              orders: {
                some: { assignedToUserId: u.userId, tenantId: u.tenantId },
              },
            }
          : {}),
      },
      select: {
        ...contextSelect,
        orders: {
          where: {
            tenantId: u.tenantId,
            ...(u.role === 'NURSE' ? { assignedToUserId: u.userId } : {}),
          },
        },
        results: {
          where: {
            tenantId: u.tenantId,
            ...(u.role === 'NURSE'
              ? { order: { assignedToUserId: u.userId } }
              : {}),
          },
        },
      },
    });
    if (!inv)
      throw new NotFoundException('Investigation not found or not assigned');
    return inv;
  }
  async list(u: AuthenticatedUser, caseId: string) {
    if (
      !(await this.prisma.careEpisode.findFirst({
        where: { id: caseId, tenantId: u.tenantId },
      }))
    )
      throw new NotFoundException('Case not found');
    const rows = await this.prisma.investigation.findMany({
      where: { tenantId: u.tenantId, caseId },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(rows.map((r) => this.get(u, r.id)));
  }
  async assignees(u: AuthenticatedUser) {
    return this.prisma.authUser.findMany({
      where: { tenantId: u.tenantId, role: { in: ['DOCTOR', 'NURSE'] } },
      select: { id: true, email: true, role: true },
      orderBy: { email: 'asc' },
    });
  }
  async assigned(u: AuthenticatedUser) {
    const rows = await this.prisma.investigation.findMany({
      where: {
        tenantId: u.tenantId,
        orders: { some: { tenantId: u.tenantId, assignedToUserId: u.userId } },
      },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(rows.map((r) => this.get(u, r.id)));
  }
}
