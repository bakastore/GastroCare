import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FoundationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tenant scope always comes from the authenticated identity's tenantId
   * (resolved server-side from the verified JWT), never from any
   * client-supplied value. Any tenantId present in query/body input is
   * ignored for authorization purposes.
   */
  async listProbeRecords(authenticatedTenantId: string) {
    return this.prisma.foundationProbeRecord.findMany({
      where: { tenantId: authenticatedTenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getProbeRecord(authenticatedTenantId: string, recordId: string) {
    const record = await this.prisma.foundationProbeRecord.findFirst({
      where: { id: recordId, tenantId: authenticatedTenantId },
    });

    if (!record) {
      // Non-disclosing: identical 404 whether the record does not exist at
      // all or exists but belongs to a different tenant.
      throw new NotFoundException('Foundation probe record not found');
    }

    return record;
  }
}
