import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordAuditEventInput {
  tenantId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Append-only Core audit writer. No update/delete methods exist here or
 * anywhere in the application boundary — see docs/05_ARCHITECTURE_BASELINE.md
 * ("Append-only audit"). Metadata must never carry clinical note/assessment
 * content, only identifiers and operation metadata — see
 * docs/06_SAFETY_PRIVACY_AND_GOVERNANCE.md ("Patient Data Sensitivity").
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  }
}
