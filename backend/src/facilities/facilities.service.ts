import { Injectable, NotFoundException } from '@nestjs/common';
import { Facility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Facility — physical care location, tenant-scoped (DEC-010 §C). Tenant
 * remains the security/customer workspace boundary; Facility is a distinct
 * physical-location concept, not conflated with it.
 */
@Injectable()
export class FacilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * DEC-018 — creation is a Clinic Admin action (gated in the controller).
   * The Facility row and its FACILITY_CREATED AuditEvent are written in the
   * same transaction.
   */
  async create(
    tenantId: string,
    name: string,
    actorId: string,
  ): Promise<Facility> {
    return this.prisma.$transaction(async (tx) => {
      const facility = await tx.facility.create({ data: { tenantId, name } });
      await this.audit.record(
        {
          tenantId,
          actorId,
          action: 'FACILITY_CREATED',
          entityType: 'Facility',
          entityId: facility.id,
          metadata: { facilityId: facility.id, name: facility.name },
        },
        tx,
      );
      return facility;
    });
  }

  async listByTenant(tenantId: string): Promise<Facility[]> {
    return this.prisma.facility.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getById(tenantId: string, id: string): Promise<Facility> {
    const facility = await this.prisma.facility.findFirst({
      where: { id, tenantId },
    });
    if (!facility) {
      throw new NotFoundException('Facility not found');
    }
    return facility;
  }
}
