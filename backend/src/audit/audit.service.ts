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

/** Any Prisma client capable of running `auditEvent.create` — either the
 * top-level PrismaService or a `$transaction` callback's `tx` argument. */
type AuditCapableClient = Pick<PrismaService, 'auditEvent'>;

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

  /**
   * @param client Optional — pass a `$transaction` callback's `tx` client to
   * make this AuditEvent write commit atomically as part of that same
   * transaction (e.g. Finding 4: the handover transaction must never commit
   * without its AuditEvent, and must never leave one without the other).
   * Defaults to the top-level PrismaService for non-transactional callers.
   */
  async record(
    input: RecordAuditEventInput,
    client: AuditCapableClient = this.prisma,
  ): Promise<void> {
    await client.auditEvent.create({
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
