import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CareTask, CareTaskStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RescheduleCareTaskDto } from './dto/reschedule-care-task.dto';
import { CompleteCareTaskDto } from './dto/complete-care-task.dto';
import { ContactAttemptDto } from './dto/contact-attempt.dto';
import { LostToFollowUpDto } from './dto/lost-to-follow-up.dto';

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
 * OVERDUE is never a stored status — only OPEN/COMPLETED/CANCELLED/
 * LOST_TO_FOLLOW_UP are persisted. Overdue is computed here at read time
 * (status == OPEN AND dueDate < now) — see docs/04_CORE_DOMAIN_MODEL.md.
 *
 * DEC-021 §7.4 — complete/reschedule/cancel are guarded transactional state
 * transitions: an authoritative read + `updateMany where id + tenantId +
 * status = OPEN` (affected-row count must be exactly 1) + the AuditEvent, all
 * in one transaction. A concurrent Episode close vs complete/reschedule/
 * cancel → one commits, the loser gets 409, no automatic retry.
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

  private throwIfConcurrencyConflict(err: unknown): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2034' || err.code === 'P2002')
    ) {
      throw new ConflictException(
        'Serialization/uniqueness conflict — reload the latest state and retry',
      );
    }
    if (
      err instanceof Error &&
      (err.message.includes('40001') ||
        err.message.includes('40P01') ||
        err.message.includes('could not serialize access') ||
        err.message.includes('deadlock detected'))
    ) {
      throw new ConflictException(
        'Serialization conflict — reload the latest state and retry',
      );
    }
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

    try {
      return await this.prisma.$transaction(async (tx) => {
        const transition = await tx.careTask.updateMany({
          where: { id: taskId, tenantId, status: CareTaskStatus.OPEN },
          data: {
            status: CareTaskStatus.COMPLETED,
            completedAt: new Date(),
            ...(completedByEncounterId ? { completedByEncounterId } : {}),
          },
        });
        if (transition.count !== 1) {
          throw new ConflictException(
            'CareTask changed concurrently (completed, cancelled, or disposed by Episode close); reload and retry',
          );
        }
        const updated = await tx.careTask.findUniqueOrThrow({
          where: { id: taskId },
        });
        await this.audit.record(
          {
            tenantId,
            actorId,
            action: 'CARE_TASK_COMPLETED',
            entityType: 'CareTask',
            entityId: taskId,
            ...(completedByEncounterId
              ? { metadata: { completedByEncounterId } }
              : {}),
          },
          tx,
        );
        return withDerivedOverdue(updated);
      });
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
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
    const newDueDate = new Date(dto.dueDate);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.careTask.findFirst({
          where: { id: taskId, tenantId },
        });
        if (!current) throw new NotFoundException('CareTask not found');
        const transition = await tx.careTask.updateMany({
          where: { id: taskId, tenantId, status: CareTaskStatus.OPEN },
          data: { dueDate: newDueDate },
        });
        if (transition.count !== 1) {
          throw new ConflictException(
            'CareTask changed concurrently (completed, cancelled, or disposed by Episode close); reload and retry',
          );
        }
        const updated = await tx.careTask.findUniqueOrThrow({
          where: { id: taskId },
        });
        await this.audit.record(
          {
            tenantId,
            actorId,
            action: 'CARE_TASK_RESCHEDULED',
            entityType: 'CareTask',
            entityId: taskId,
            metadata: {
              oldDueDate: current.dueDate.toISOString(),
              newDueDate: newDueDate.toISOString(),
            },
          },
          tx,
        );
        return withDerivedOverdue(updated);
      });
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
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

    try {
      return await this.prisma.$transaction(async (tx) => {
        const transition = await tx.careTask.updateMany({
          where: { id: taskId, tenantId, status: CareTaskStatus.OPEN },
          data: {
            status: CareTaskStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });
        if (transition.count !== 1) {
          throw new ConflictException(
            'CareTask changed concurrently (completed, cancelled, or disposed by Episode close); reload and retry',
          );
        }
        const updated = await tx.careTask.findUniqueOrThrow({
          where: { id: taskId },
        });
        await this.audit.record(
          {
            tenantId,
            actorId,
            action: 'CARE_TASK_CANCELLED',
            entityType: 'CareTask',
            entityId: taskId,
          },
          tx,
        );
        return withDerivedOverdue(updated);
      });
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
  }

  /**
   * DEC-021 NR-01 §8 — append-only contact attempt for a follow-up CareTask.
   * DOCTOR or NURSE (method-level @Roles on the controller). Attempts are
   * never updated/deleted. Allowed while the task is OPEN (recording an
   * attempt to reach the patient before deciding lost-to-follow-up).
   */
  async contactAttempt(
    tenantId: string,
    actorId: string,
    taskId: string,
    dto: ContactAttemptDto,
  ) {
    const task = await this.findOrThrow(tenantId, taskId);
    if (task.status !== CareTaskStatus.OPEN) {
      throw new ConflictException(
        'Contact attempts can only be recorded on an OPEN CareTask',
      );
    }
    const note = dto.note?.trim() ? dto.note.trim() : null;

    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.careTaskContactAttempt.create({
        data: { tenantId, careTaskId: taskId, actorId, note },
      });
      await this.audit.record(
        {
          tenantId,
          actorId,
          action: 'CARE_TASK_CONTACT_ATTEMPT_RECORDED',
          entityType: 'CareTask',
          entityId: taskId,
          metadata: { contactAttemptId: attempt.id },
        },
        tx,
      );
      return attempt;
    });
  }

  /**
   * DEC-021 NR-01 §8 — mark an OPEN follow-up CareTask LOST_TO_FOLLOW_UP.
   * DOCTOR or NURSE. Reason mandatory + trimmed. Overdue alone never triggers
   * this. Terminal for Package R: a later Episode close does NOT auto-cancel
   * a LOST_TO_FOLLOW_UP task.
   */
  async markLostToFollowUp(
    tenantId: string,
    actorId: string,
    taskId: string,
    dto: LostToFollowUpDto,
  ): Promise<CareTaskWithDerivedOverdue> {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException(
        'A non-empty reason is required to mark a CareTask LOST_TO_FOLLOW_UP',
      );
    }
    const task = await this.findOrThrow(tenantId, taskId);
    if (task.status !== CareTaskStatus.OPEN) {
      throw new ConflictException(
        'Only an OPEN CareTask can be marked LOST_TO_FOLLOW_UP',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const lostAt = new Date();
        const transition = await tx.careTask.updateMany({
          where: { id: taskId, tenantId, status: CareTaskStatus.OPEN },
          data: {
            status: CareTaskStatus.LOST_TO_FOLLOW_UP,
            lostToFollowUpAt: lostAt,
            lostToFollowUpReason: reason,
          },
        });
        if (transition.count !== 1) {
          throw new ConflictException(
            'CareTask changed concurrently; reload and retry',
          );
        }
        const updated = await tx.careTask.findUniqueOrThrow({
          where: { id: taskId },
        });
        await this.audit.record(
          {
            tenantId,
            actorId,
            action: 'CARE_TASK_LOST_TO_FOLLOW_UP',
            entityType: 'CareTask',
            entityId: taskId,
            metadata: { reason, lostToFollowUpAt: lostAt.toISOString() },
          },
          tx,
        );
        return withDerivedOverdue(updated);
      });
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
  }
}
