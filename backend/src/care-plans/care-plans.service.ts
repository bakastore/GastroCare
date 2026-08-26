import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CarePlan,
  CarePlanStatus,
  CarePlanVersion,
  CareTask,
  CareTaskStatus,
  CareTaskType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCarePlanDto } from './dto/create-care-plan.dto';
import { UpdateDraftCarePlanDto } from './dto/update-draft-care-plan.dto';
import { AmendCarePlanDto } from './dto/amend-care-plan.dto';
import { assertHemorrhoidCarePlanPrerequisite } from '../clinical-forms/templates/hemorrhoid-sequence';

/**
 * CarePlan lifecycle: DRAFT (mutable) -> SIGNED (immutable content, snapshot
 * in CarePlanVersion) -> amend (new CarePlanVersion, lineage preserved).
 * See docs/04_CORE_DOMAIN_MODEL.md — CarePlan and
 * docs/05_ARCHITECTURE_BASELINE.md — "Signed-record immutability".
 */
@Injectable()
export class CarePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async findRootOrThrow(tenantId: string, carePlanId: string) {
    const carePlan = await this.prisma.carePlan.findFirst({
      where: { id: carePlanId, tenantId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
    if (!carePlan) {
      throw new NotFoundException('CarePlan not found');
    }
    return carePlan;
  }

  async create(tenantId: string, actorId: string, dto: CreateCarePlanDto) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: dto.encounterId, tenantId },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    const existing = await this.prisma.carePlan.findUnique({
      where: { encounterId: dto.encounterId },
    });
    if (existing) {
      throw new ConflictException(
        'A CarePlan already exists for this Encounter',
      );
    }

    await assertHemorrhoidCarePlanPrerequisite(
      this.prisma,
      tenantId,
      dto.encounterId,
    );

    const carePlan = await this.prisma.carePlan.create({
      data: {
        tenantId,
        encounterId: dto.encounterId,
        patientId: encounter.patientId,
        instructions: dto.instructions,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        status: CarePlanStatus.DRAFT,
      },
    });

    return carePlan;
  }

  async updateDraft(
    tenantId: string,
    carePlanId: string,
    dto: UpdateDraftCarePlanDto,
  ) {
    const carePlan = await this.findRootOrThrow(tenantId, carePlanId);
    if (carePlan.status !== CarePlanStatus.DRAFT) {
      throw new ConflictException(
        'CarePlan is already SIGNED — a DRAFT can only be edited before signing',
      );
    }

    return this.prisma.carePlan.update({
      where: { id: carePlanId },
      data: {
        instructions: dto.instructions ?? undefined,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
      },
    });
  }

  /**
   * DRAFT -> SIGNED. Snapshots current root content into CarePlanVersion 1
   * (append-only, never updated afterward). If followUpDate is present, a
   * CareTask is created deterministically — normal software automation, not
   * AI (CORE-01 section 9).
   *
   * F1 correction (ChatGPT T1-T4 source review): the authoritative DRAFT
   * check — and the Hemorrhoid prerequisite re-check — must happen INSIDE a
   * Serializable transaction, not before it. Two concurrent sign() calls
   * against the same DRAFT CarePlan both reading DRAFT outside a
   * transaction could otherwise both proceed to commit a versionNumber=1
   * row and an OPEN CareTask, violating the 0..1 OPEN generic follow-up
   * CareTask invariant (last-write-wins on currentVersionId). Under
   * Serializable isolation, both transactions attempt the same
   * `UPDATE care_plans ... WHERE id = carePlanId` — Postgres guarantees at
   * most one commits; the other fails with a serialization/deadlock
   * conflict, mapped to 409 by `mapConcurrencyConflict`, never
   * automatically retried.
   */
  async sign(tenantId: string, actorId: string, carePlanId: string) {
    let result: { signedPlan: CarePlan; version: CarePlanVersion; careTask: CareTask | null };
    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          const carePlan = await tx.carePlan.findFirst({
            where: { id: carePlanId, tenantId },
          });
          if (!carePlan) {
            throw new NotFoundException('CarePlan not found');
          }
          if (carePlan.status !== CarePlanStatus.DRAFT) {
            throw new ConflictException('CarePlan is already SIGNED');
          }

          // Re-check prerequisite at sign — never trust that create-time
          // state still holds; frontend is not authority (DEC-012 CD-05).
          await assertHemorrhoidCarePlanPrerequisite(
            tx,
            tenantId,
            carePlan.encounterId,
          );

          const version = await tx.carePlanVersion.create({
            data: {
              tenantId,
              carePlanId,
              versionNumber: 1,
              instructions: carePlan.instructions,
              followUpDate: carePlan.followUpDate,
              actorId,
              reason: null,
              previousVersionId: null,
            },
          });

          const signedPlan = await tx.carePlan.update({
            where: { id: carePlanId },
            data: {
              status: CarePlanStatus.SIGNED,
              currentVersionId: version.id,
            },
          });

          let careTask: CareTask | null = null;
          if (carePlan.followUpDate) {
            careTask = await tx.careTask.create({
              data: {
                tenantId,
                patientId: carePlan.patientId,
                carePlanId,
                dueDate: carePlan.followUpDate,
              },
            });
          }

          return { signedPlan, version, careTask };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CARE_PLAN_SIGNED',
      entityType: 'CarePlan',
      entityId: carePlanId,
      metadata: { versionNumber: 1 },
    });

    if (result.careTask) {
      await this.audit.record({
        tenantId,
        actorId,
        action: 'CARE_TASK_CREATED',
        entityType: 'CareTask',
        entityId: result.careTask.id,
        metadata: { source: 'CARE_PLAN_SIGN', carePlanId },
      });
    }

    return result;
  }

  /**
   * SIGNED -> new signed CarePlanVersion with lineage to the previous one,
   * with atomic follow-up CareTask reconciliation (DEC-012 §11-16;
   * docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md §11-14, CD-08
   * transition matrix). The previous CarePlanVersion row is never updated or
   * deleted — only a new row is appended and CarePlan.currentVersionId is
   * repointed.
   *
   * T4 — HIGH-RISK TRANSACTION/CONCURRENCY PATH. Every authoritative read
   * (CarePlan, currentVersionId, current signed version, linked OPEN generic
   * CareTask) happens INSIDE a Serializable interactive transaction — never
   * query-then-write against state read before the transaction opened. A
   * Postgres serialization failure (P2034) — or a stale
   * expectedCurrentVersionId, or an unexpected >1 OPEN generic CareTask —
   * maps to 409 Conflict. There is no automatic retry of a clinical
   * amendment: the caller must reload latest state and the clinician must
   * explicitly retry.
   */
  async amend(
    tenantId: string,
    actorId: string,
    carePlanId: string,
    dto: AmendCarePlanDto,
  ) {
    // F2 correction (Codex T4 audit): a whitespace-only reason is not
    // provenance — @MinLength(1) on the DTO accepts " ", so this is
    // re-validated here against the trimmed value. The trimmed value is
    // also what gets stored in the reconciliation audit event below, so a
    // request that passes this check and one that reads the audit trail
    // later see the exact same (trimmed) reason.
    const trimmedFollowUpTaskReason = dto.followUpTaskReason?.trim();
    if (
      dto.followUpTaskAction === 'KEEP_WITH_REASON' &&
      !trimmedFollowUpTaskReason
    ) {
      throw new BadRequestException(
        'followUpTaskReason is required (and must not be blank) when followUpTaskAction is KEEP_WITH_REASON',
      );
    }

    const newFollowUpDate = dto.followUpDate ? new Date(dto.followUpDate) : null;

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // 1-2. Authoritative re-read, inside the transaction.
          const carePlan = await tx.carePlan.findFirst({
            where: { id: carePlanId, tenantId },
          });
          if (!carePlan) {
            throw new NotFoundException('CarePlan not found');
          }
          if (
            carePlan.status !== CarePlanStatus.SIGNED ||
            !carePlan.currentVersionId
          ) {
            throw new ConflictException(
              'CarePlan must be SIGNED before it can be amended',
            );
          }

          // 3. Stale-write guard.
          if (carePlan.currentVersionId !== dto.expectedCurrentVersionId) {
            throw new ConflictException(
              'expectedCurrentVersionId is stale — reload the latest CarePlan and retry',
            );
          }

          // 4. Current signed version, read inside the transaction.
          const currentVersion = await tx.carePlanVersion.findFirst({
            where: { id: carePlan.currentVersionId, tenantId, carePlanId },
          });
          if (!currentVersion) {
            throw new ConflictException(
              'CarePlan has no current signed version',
            );
          }

          // 5. Linked OPEN generic CareTask(s) — carePlanId set,
          // timepointCode null (this workflow's generic follow-up task).
          const openTasks = await tx.careTask.findMany({
            where: {
              tenantId,
              carePlanId,
              status: CareTaskStatus.OPEN,
              timepointCode: null,
            },
          });
          if (openTasks.length > 1) {
            throw new ConflictException(
              'More than one OPEN generic follow-up CareTask exists for this CarePlan',
            );
          }
          const openTask = openTasks[0] ?? null;

          // 6. Validate the CD-08 transition matrix and decide the CareTask
          // mutation (if any). Never mutated here directly — only decided;
          // the actual write happens after CarePlanVersion N+1 is created,
          // per the required transaction ordering.
          const oldFollowUpDate = carePlan.followUpDate;
          const oldTime = oldFollowUpDate ? oldFollowUpDate.getTime() : null;
          const newTime = newFollowUpDate ? newFollowUpDate.getTime() : null;

          type TaskMutation =
            | { kind: 'CREATE'; dueDate: Date }
            | { kind: 'RESCHEDULE'; taskId: string; dueDate: Date }
            | { kind: 'CANCEL'; taskId: string }
            | { kind: 'KEEP_WITH_REASON'; taskId: string }
            | null;

          let mutation: TaskMutation = null;

          if (oldTime === newTime) {
            // D. Unchanged date — no reconciliation action required/taken.
            mutation = null;
          } else if (oldFollowUpDate === null && newFollowUpDate !== null) {
            // A. null -> date.
            if (openTask) {
              throw new ConflictException(
                'An OPEN generic follow-up CareTask unexpectedly already exists for this CarePlan',
              );
            }
            mutation = { kind: 'CREATE', dueDate: newFollowUpDate };
          } else if (newFollowUpDate === null) {
            // C. date -> null.
            if (openTask) {
              if (dto.followUpTaskAction === 'RESCHEDULE') {
                throw new ConflictException(
                  'RESCHEDULE is invalid when the new followUpDate is null',
                );
              }
              if (!dto.followUpTaskAction) {
                throw new BadRequestException(
                  'followUpTaskAction (CANCEL or KEEP_WITH_REASON) is required when followUpDate changes to null and an OPEN task exists',
                );
              }
              mutation =
                dto.followUpTaskAction === 'CANCEL'
                  ? { kind: 'CANCEL', taskId: openTask.id }
                  : { kind: 'KEEP_WITH_REASON', taskId: openTask.id };
            }
          } else {
            // B. date1 -> date2 with zero OPEN generic task because the historical task
            //is already CLOSED -> CREATE a new OPEN task for the new future intent.
            if (!openTask) {
              // No OPEN task to reconcile against (already closed/never
              // created) — a new future clinical intent creates a new OPEN
              // generic task, mirroring the historical-CLOSED-task rule.
              mutation = { kind: 'CREATE', dueDate: newFollowUpDate };
            } else {
              if (dto.followUpTaskAction === 'CANCEL') {
                throw new ConflictException(
                  'CANCEL is invalid while the new followUpDate is non-null',
                );
              }
              if (!dto.followUpTaskAction) {
                throw new BadRequestException(
                  'followUpTaskAction (RESCHEDULE or KEEP_WITH_REASON) is required when followUpDate changes and an OPEN task exists',
                );
              }
              mutation =
                dto.followUpTaskAction === 'RESCHEDULE'
                  ? { kind: 'RESCHEDULE', taskId: openTask.id, dueDate: newFollowUpDate }
                  : { kind: 'KEEP_WITH_REASON', taskId: openTask.id };
            }
          }

          // 7. Create CarePlanVersion N+1.
          const version = await tx.carePlanVersion.create({
            data: {
              tenantId,
              carePlanId,
              versionNumber: currentVersion.versionNumber + 1,
              instructions: dto.instructions,
              followUpDate: newFollowUpDate,
              actorId,
              reason: dto.reason,
              previousVersionId: currentVersion.id,
            },
          });

          // 8. Update CarePlan currentVersion/content/followUpDate.
          await tx.carePlan.update({
            where: { id: carePlanId },
            data: {
              currentVersionId: version.id,
              instructions: dto.instructions,
              followUpDate: newFollowUpDate,
            },
          });

          // 9. Reconcile CareTask.
          let careTask: CareTask | null = openTask;
          if (mutation) {
            switch (mutation.kind) {
              case 'CREATE':
                careTask = await tx.careTask.create({
                  data: {
                    tenantId,
                    patientId: carePlan.patientId,
                    carePlanId,
                    type: CareTaskType.FOLLOW_UP,
                    dueDate: mutation.dueDate,
                  },
                });
                break;
              case 'RESCHEDULE':
                careTask = await tx.careTask.update({
                  where: { id: mutation.taskId },
                  data: { dueDate: mutation.dueDate },
                });
                break;
              case 'CANCEL':
                careTask = await tx.careTask.update({
                  where: { id: mutation.taskId },
                  data: {
                    status: CareTaskStatus.CANCELLED,
                    cancelledAt: new Date(),
                  },
                });
                break;
              case 'KEEP_WITH_REASON':
                // Task dueDate/status intentionally unchanged.
                break;
            }
          }

          // 10. CARE_PLAN_AMENDED AuditEvent, using the transaction client.
          await this.audit.record(
            {
              tenantId,
              actorId,
              action: 'CARE_PLAN_AMENDED',
              entityType: 'CarePlan',
              entityId: carePlanId,
              metadata: {
                carePlanId,
                previousVersionId: currentVersion.id,
                newVersionId: version.id,
                reason: dto.reason,
              },
            },
            tx,
          );

          // 11. CARE_PLAN_FOLLOW_UP_RECONCILED AuditEvent, using the
          // transaction client — written ONLY when a real reconciliation
          // operation occurred (mutation is non-null: CREATE, RESCHEDULE,
          // CANCEL, or KEEP_WITH_REASON — the only Owner-locked
          // reconciliationAction vocabulary). F1 correction (Codex T4
          // audit): unchanged date (D) has no operation and never reaches
          // here; date -> null / date1 -> date2 with ZERO OPEN tasks also
          // has nothing to reconcile (mutation stays null) and must NOT
          // write this event either — there is no "NONE"/"NOOP" action.
          if (mutation) {
            await this.audit.record(
              {
                tenantId,
                actorId,
                action: 'CARE_PLAN_FOLLOW_UP_RECONCILED',
                entityType: 'CarePlan',
                entityId: carePlanId,
                metadata: {
                  carePlanId,
                  carePlanVersionId: version.id,
                  careTaskId: careTask?.id ?? null,
                  reconciliationAction: mutation.kind,
                  oldFollowUpDate: oldFollowUpDate
                    ? oldFollowUpDate.toISOString()
                    : null,
                  newFollowUpDate: newFollowUpDate
                    ? newFollowUpDate.toISOString()
                    : null,
                  oldDueDate: openTask ? openTask.dueDate.toISOString() : null,
                  newDueDate:
                    mutation.kind === 'CREATE' || mutation.kind === 'RESCHEDULE'
                      ? mutation.dueDate.toISOString()
                      : null,
                  reason: trimmedFollowUpTaskReason ?? null,
                },
              },
              tx,
            );
          }

          return { version, careTask };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return { ...result.version, careTask: result.careTask };
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
  }

  async getById(tenantId: string, carePlanId: string) {
    return this.findRootOrThrow(tenantId, carePlanId);
  }

  /**
   * Postgres SERIALIZABLE isolation surfaces a same-state concurrent write
   * conflict as either a serialization failure (SQLSTATE 40001, which
   * Prisma maps to known error code P2034) or, when two transactions' lock
   * acquisition order overlaps (e.g. both touch CarePlan then CareTask), a
   * deadlock (SQLSTATE 40P01, which Prisma does NOT map to a known error
   * code inside an interactive transaction — it surfaces as
   * PrismaClientUnknownRequestError carrying the raw Postgres error). Both
   * are the same class of "must not silently retry, caller must reload"
   * concurrency conflict (DEC-012 §15) and both map to 409. Throws for a
   * recognized conflict; returns normally otherwise, leaving the original
   * error (e.g. an application-level NotFoundException/ConflictException)
   * for the caller to rethrow unchanged.
   */
  private throwIfConcurrencyConflict(err: unknown): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2034'
    ) {
      throw new ConflictException(
        'Serialization conflict — reload the latest CarePlan state and retry',
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
        'Serialization conflict — reload the latest CarePlan state and retry',
      );
    }
  }
}
