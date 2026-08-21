import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CareTask, CareTaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type CareTaskWithDerivedOverdue = CareTask & { overdue: boolean };

function withDerivedOverdue(task: CareTask): CareTaskWithDerivedOverdue {
  return {
    ...task,
    overdue: task.status === CareTaskStatus.OPEN && task.dueDate < new Date(),
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

  async list(tenantId: string): Promise<CareTaskWithDerivedOverdue[]> {
    const tasks = await this.prisma.careTask.findMany({
      where: { tenantId },
      orderBy: { dueDate: 'asc' },
    });
    return tasks.map(withDerivedOverdue);
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
  ): Promise<CareTaskWithDerivedOverdue> {
    const task = await this.findOrThrow(tenantId, taskId);
    if (task.status !== CareTaskStatus.OPEN) {
      throw new ConflictException('Only an OPEN CareTask can be completed');
    }

    const updated = await this.prisma.careTask.update({
      where: { id: taskId },
      data: { status: CareTaskStatus.COMPLETED, completedAt: new Date() },
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CARE_TASK_COMPLETED',
      entityType: 'CareTask',
      entityId: taskId,
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
