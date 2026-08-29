import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CareTask, CareTaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RescheduleCareTaskDto } from './dto/reschedule-care-task.dto';
import { CompleteCareTaskDto } from './dto/complete-care-task.dto';

type CareTaskWithDerivedOverdue = CareTask & { overdue: boolean };

/**
 * DEC-016 F2 — additive, read-only linkage projection. A Longo timepoint
 * CareTask (timepointCode != null) is owned by a TreatmentPathway via its
 * source Encounter (CareTask -> sourceEncounter -> treatmentPathwayId /
 * episodeId). The frontend needs the authoritative pathway/case linkage to
 * route the clinician into the correct Longo clinical follow-up flow instead
 * of offering generic manual completion (which the backend guard rejects).
 * Nothing is stored on CareTask — these fields are resolved at read time.
 */
type CareTaskWithLinkage = CareTaskWithDerivedOverdue & {
  sourceEpisodeId: string | null;
  treatmentPathwayId: string | null;
};

function withDerivedOverdue(task: CareTask): CareTaskWithDerivedOverdue {
  return {
    ...task,
    overdue: task.status === CareTaskStatus.OPEN && task.dueDate < new Date(),
  };
}

function withLinkage(
  task: CareTask & {
    sourceEncounter: {
      episodeId: string | null;
      treatmentPathwayId: string | null;
    } | null;
  },
): CareTaskWithLinkage {
  const { sourceEncounter, ...rest } = task;
  return {
    ...withDerivedOverdue(rest),
    sourceEpisodeId: sourceEncounter?.episodeId ?? null,
    treatmentPathwayId: sourceEncounter?.treatmentPathwayId ?? null,
  };
}

/**
 * OVERDUE is never a stored status — only OPEN/COMPLETED/CANCELLED are
 * persisted. Overdue is computed here at read time (status == OPEN AND
 * dueDate < now) — see docs/04_CORE_DOMAIN_MODEL.md — CareTask.
 */
@Injectable()
export class CareTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string): Promise<CareTaskWithLinkage[]> {
    const tasks = await this.prisma.careTask.findMany({
      where: { tenantId },
      orderBy: { dueDate: 'asc' },
      include: {
        sourceEncounter: {
          select: { episodeId: true, treatmentPathwayId: true },
        },
      },
    });
    return tasks.map(withLinkage);
  }

  private async findOrThrow(tenantId: string, taskId: string) {
    const task = await this.prisma.careTask.findFirst({
      where: { id: taskId, tenantId },
    });
    if (!task) {
      throw new NotFoundException('CareTask not found');
    }
    return task;
  }

  async complete(
    tenantId: string,
    actorId: string,
    taskId: string,
    dto?: CompleteCareTaskDto,
  ): Promise<CareTaskWithDerivedOverdue> {
    const task = await this.findOrThrow(tenantId, taskId);
    if (task.status !== CareTaskStatus.OPEN) {
      throw new ConflictException('Only an OPEN CareTask can be completed');
    }

    if (task.timepointCode !== null)
      throw new ConflictException(
        'Longo tasks require completion of the exact pathway/timepoint clinical form',
      );

    const completedByEncounterId = dto?.completedByEncounterId;
    if (completedByEncounterId) {
      const encounter = await this.prisma.encounter.findFirst({
        where: { id: completedByEncounterId, tenantId },
      });
      if (!encounter) {
        throw new NotFoundException('Return Encounter not found');
      }
      if (encounter.patientId !== task.patientId) {
        throw new ConflictException(
          'Return Encounter must belong to the same patient as the CareTask',
        );
      }
    }

    const updated = await this.prisma.careTask.update({
      where: { id: taskId },
      data: {
        status: CareTaskStatus.COMPLETED,
        completedAt: new Date(),
        ...(completedByEncounterId ? { completedByEncounterId } : {}),
      },
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CARE_TASK_COMPLETED',
      entityType: 'CareTask',
      entityId: taskId,
      ...(completedByEncounterId
        ? { metadata: { completedByEncounterId } }
        : {}),
    });

    return withDerivedOverdue(updated);
  }

  async reschedule(
    tenantId: string,
    actorId: string,
    taskId: string,
    dto: RescheduleCareTaskDto,
  ): Promise<CareTaskWithDerivedOverdue> {
    const task = await this.findOrThrow(tenantId, taskId);
    if (task.status !== CareTaskStatus.OPEN) {
      throw new ConflictException('Only an OPEN CareTask can be rescheduled');
    }

    const oldDueDate = task.dueDate;
    const newDueDate = new Date(dto.dueDate);

    const updated = await this.prisma.careTask.update({
      where: { id: taskId },
      data: { dueDate: newDueDate },
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CARE_TASK_RESCHEDULED',
      entityType: 'CareTask',
      entityId: taskId,
      metadata: {
        oldDueDate: oldDueDate.toISOString(),
        newDueDate: newDueDate.toISOString(),
      },
    });

    return withDerivedOverdue(updated);
  }

  async cancel(
    tenantId: string,
    actorId: string,
    taskId: string,
  ): Promise<CareTaskWithDerivedOverdue> {
    const task = await this.findOrThrow(tenantId, taskId);
    if (task.status !== CareTaskStatus.OPEN) {
      throw new ConflictException('Only an OPEN CareTask can be cancelled');
    }

    const updated = await this.prisma.careTask.update({
      where: { id: taskId },
      data: { status: CareTaskStatus.CANCELLED, cancelledAt: new Date() },
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CARE_TASK_CANCELLED',
      entityType: 'CareTask',
      entityId: taskId,
    });

    return withDerivedOverdue(updated);
  }
}
