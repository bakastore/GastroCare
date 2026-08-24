import { Injectable, NotFoundException } from '@nestjs/common';
import { Facility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Facility — physical care location, tenant-scoped (DEC-010 §C). Tenant
 * remains the security/customer workspace boundary; Facility is a distinct
 * physical-location concept, not conflated with it.
 */
@Injectable()
export class FacilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, name: string): Promise<Facility> {
    return this.prisma.facility.create({ data: { tenantId, name } });
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
