import { assertLongoEpisodeAncestry } from '../clinical-forms/templates/longo-episode-invariant';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CareTask,
  CareTaskStatus,
  CareTaskType,
  ClinicalFormStatus,
  Encounter,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Follow-up scheduling — CORE-04 T10
 * (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md T10).
 *
 * The sole postoperative timing anchor is the Surgery Encounter's
 * occurredAt (never createdAt, admission/discharge date, or a manual
 * elapsed-month figure). Generation is triggered after the explicit
 * completed-surgery milestone (LONGO_INTRAOP_RECORD reaching COMPLETED on
 * that Encounter) and is idempotent: the unique (sourceEncounterId,
 * timepointCode) index on CareTask is the actual duplicate-prevention
 * mechanism; this service also short-circuits on already-existing rows so
 * repeated calls are cheap no-ops, not just constraint-safe.
 *
 * episodeId is never stored on CareTask — the Episode is always inferred
 * later via sourceEncounter -> Encounter.episodeId.
 */

export const FOLLOW_UP_TIMEPOINTS = [
  'TWO_WEEK',
  'MONTH_1',
  'MONTH_3',
  'MONTH_6',
] as const;
export type FollowUpTimepoint = (typeof FOLLOW_UP_TIMEPOINTS)[number];

const TIMEPOINT_OFFSET_DAYS: Record<FollowUpTimepoint, number> = {
  TWO_WEEK: 14,
  MONTH_1: 30,
  MONTH_3: 90,
  MONTH_6: 180,
};

/**
 * Deterministic mapping from a completed Longo follow-up submission to the
 * timepoint it satisfies — contract-locked, never inferred from field name
 * similarity.
 */
export function resolveCompletionTimepoint(
  templateKey: string,
  responses: Record<string, unknown>,
): FollowUpTimepoint | null {
  if (templateKey === 'LONGO_TWO_WEEK_FOLLOWUP') {
    return 'TWO_WEEK';
  }
  if (templateKey === 'LONGO_LONG_TERM_FOLLOWUP') {
    const planned = responses.plannedTimepoint;
    if (
      planned === 'MONTH_1' ||
      planned === 'MONTH_3' ||
      planned === 'MONTH_6'
    ) {
      return planned;
    }
  }
  return null;
}

type CareTaskWithDerivedOverdue = CareTask & { overdue: boolean };

function withDerivedOverdue(task: CareTask): CareTaskWithDerivedOverdue {
  return {
    ...task,
    overdue: task.status === CareTaskStatus.OPEN && task.dueDate < new Date(),
  };
}

@Injectable()
export class FollowUpTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Idempotent generation of the four follow-up CareTasks for a completed
   * Surgery Encounter. Safe to call more than once — existing timepoints
   * for this sourceEncounterId are never duplicated or overwritten.
   */
  /**
   * R2 — the sole gate that proves an Encounter is a valid Longo surgery
   * milestone before follow-up generation may proceed. Enforced on BOTH the
   * automatic path (triggered right after LONGO_INTRAOP_RECORD completion)
   * and the manual `/follow-up-tasks/generate` endpoint — neither may bypass
   * this. Requires, in order: same-tenant Encounter; a same-tenant/patient
   * CareEpisode of type LONGO_TREATMENT; a COMPLETED LONGO_INTRAOP_RECORD
   * ClinicalFormSubmission recorded on THIS Encounter (the actual surgery
   * clinical milestone, not merely "some encounter in the episode").
   */
  private async assertValidSurgeryAnchor(
    tenantId: string,
    sourceEncounter: Pick<
      Encounter,
      'id' | 'tenantId' | 'patientId' | 'episodeId' | 'treatmentPathwayId'
    >,
  ): Promise<void> {
    if (sourceEncounter.tenantId !== tenantId) {
      throw new NotFoundException('Encounter not found');
    }
    await assertLongoEpisodeAncestry(
      this.prisma,
      tenantId,
      'LONGO_INTRAOP_RECORD',
      sourceEncounter,
    );

    const completedIntraop = await this.prisma.clinicalFormSubmission.findFirst(
      {
        where: {
          tenantId,
          encounterId: sourceEncounter.id,
          templateKey: 'LONGO_INTRAOP_RECORD',
          status: ClinicalFormStatus.COMPLETED,
        },
        select: { id: true },
      },
    );
    if (!completedIntraop) {
      throw new ForbiddenException(
        'Encounter does not carry a completed LONGO_INTRAOP_RECORD — not a valid surgery milestone',
      );
    }
  }

  async generateForSurgeryEncounter(
    tenantId: string,
    actorId: string,
    sourceEncounter: Pick<
      Encounter,
      | 'id'
      | 'tenantId'
      | 'patientId'
      | 'occurredAt'
      | 'episodeId'
      | 'treatmentPathwayId'
    >,
  ): Promise<CareTaskWithDerivedOverdue[]> {
    await this.assertValidSurgeryAnchor(tenantId, sourceEncounter);

    const existing = await this.prisma.careTask.findMany({
      where: { tenantId, sourceEncounterId: sourceEncounter.id },
    });
    const existingTimepoints = new Set(existing.map((t) => t.timepointCode));
    const missing = FOLLOW_UP_TIMEPOINTS.filter(
      (tp) => !existingTimepoints.has(tp),
    );

    if (missing.length === 0) {
      return existing.map(withDerivedOverdue);
    }

    const surgeryOccurredAt = sourceEncounter.occurredAt;
    await this.prisma.careTask.createMany({
      data: missing.map((timepointCode) => {
        const dueDate = new Date(surgeryOccurredAt);
        dueDate.setDate(
          dueDate.getDate() + TIMEPOINT_OFFSET_DAYS[timepointCode],
        );
        return {
          tenantId,
          patientId: sourceEncounter.patientId,
          type: CareTaskType.FOLLOW_UP,
          status: CareTaskStatus.OPEN,
          dueDate,
          sourceEncounterId: sourceEncounter.id,
          timepointCode,
        };
      }),
      skipDuplicates: true,
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'FOLLOW_UP_TASKS_GENERATED',
      entityType: 'Encounter',
      entityId: sourceEncounter.id,
      metadata: { timepointsCreated: missing },
    });

    const all = await this.prisma.careTask.findMany({
      where: { tenantId, sourceEncounterId: sourceEncounter.id },
    });
    return all.map(withDerivedOverdue);
  }

  /**
   * Deterministic completion matching: an OPEN CareTask is matched only if
   * its sourceEncounter belongs to the SAME Episode as the completing
   * Encounter and the timepointCode matches exactly. An unrelated
   * Encounter's completion never completes a task — if no match exists,
   * this is a safe no-op (e.g. the surgery/generation step was skipped, or
   * this is a non-scheduled ad-hoc form).
   */
  async matchCompletion(
    tenantId: string,
    actorId: string,
    completingEncounter: Pick<
      Encounter,
      'id' | 'tenantId' | 'episodeId' | 'patientId' | 'treatmentPathwayId'
    >,
    templateKey: string,
    responses: Record<string, unknown>,
  ): Promise<void> {
    if (
      !completingEncounter.episodeId ||
      !completingEncounter.treatmentPathwayId
    ) {
      return;
    }
    const timepoint = resolveCompletionTimepoint(templateKey, responses);
    if (!timepoint) {
      return;
    }

    const task = await this.prisma.careTask.findFirst({
      where: {
        tenantId,
        status: CareTaskStatus.OPEN,
        timepointCode: timepoint,
        sourceEncounter: {
          tenantId,
          episodeId: completingEncounter.episodeId,
          patientId: completingEncounter.patientId,
          treatmentPathwayId: completingEncounter.treatmentPathwayId,
        },
      },
    });
    if (!task) {
      return;
    }

    await this.prisma.careTask.update({
      where: { id: task.id },
      data: {
        status: CareTaskStatus.COMPLETED,
        completedAt: new Date(),
        completedByEncounterId: completingEncounter.id,
      },
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'FOLLOW_UP_TASK_MATCHED_COMPLETED',
      entityType: 'CareTask',
      entityId: task.id,
      metadata: {
        timepointCode: timepoint,
        completedByEncounterId: completingEncounter.id,
      },
    });
  }

  async generateForSurgeryEncounterById(
    tenantId: string,
    actorId: string,
    sourceEncounterId: string,
  ): Promise<CareTaskWithDerivedOverdue[]> {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: sourceEncounterId, tenantId },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }
    return this.generateForSurgeryEncounter(tenantId, actorId, encounter);
  }

  async listBySourceEncounter(
    tenantId: string,
    sourceEncounterId: string,
  ): Promise<CareTaskWithDerivedOverdue[]> {
    const tasks = await this.prisma.careTask.findMany({
      where: { tenantId, sourceEncounterId },
      orderBy: { dueDate: 'asc' },
    });
    return tasks.map(withDerivedOverdue);
  }

  async listByPatient(
    tenantId: string,
    patientId: string,
  ): Promise<CareTaskWithDerivedOverdue[]> {
    const tasks = await this.prisma.careTask.findMany({
      where: { tenantId, patientId, timepointCode: { not: null } },
      orderBy: { dueDate: 'asc' },
    });
    return tasks.map(withDerivedOverdue);
  }

  /**
   * Editable due date — the only supported edit for a follow-up CareTask.
   * This is NOT the "surgery occurredAt changed" review-flag path (there is
   * no Encounter update endpoint anywhere in this codebase, so that anchor
   * cannot silently change today); this is an explicit, audited, doctor-
   * initiated reschedule of one task.
   */
  async reschedule(
    tenantId: string,
    actorId: string,
    taskId: string,
    dueDate: Date,
  ): Promise<CareTaskWithDerivedOverdue> {
    const task = await this.prisma.careTask.findFirst({
      where: { id: taskId, tenantId },
    });
    if (!task) {
      throw new NotFoundException('CareTask not found');
    }

    const updated = await this.prisma.careTask.update({
      where: { id: taskId },
      data: { dueDate },
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CARE_TASK_RESCHEDULED',
      entityType: 'CareTask',
      entityId: taskId,
      metadata: { newDueDate: dueDate.toISOString() },
    });

    return withDerivedOverdue(updated);
  }
}
