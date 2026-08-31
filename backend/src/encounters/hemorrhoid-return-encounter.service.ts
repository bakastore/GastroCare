import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CareEpisodeStatus,
  CareTaskStatus,
  CareTaskType,
  Encounter,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CliniciansService } from '../clinicians/clinicians.service';
import { RoomsService } from '../rooms/rooms.service';
import { CreateHemorrhoidReturnEncounterDto } from './dto/create-hemorrhoid-return-encounter.dto';
import { isHemorrhoidWorkflowEncounter } from '../clinical-forms/templates/hemorrhoid-sequence';
import {
  HEMORRHOID_TREATMENT_EPISODE_TYPE,
  isHemorrhoidContinuousCareBranchEncounter,
} from '../clinical-forms/templates/hemorrhoid-continuous-care';
import {
  HEMORRHOID_RECURRENCE_CHOICE_REQUIRED,
  reopenHemorrhoidTreatmentEpisodeInTx,
  startHemorrhoidTreatmentEpisodeInTx,
} from '../care-episodes/care-episode-lifecycle';

/**
 * DEC016: atomic Return creation in the source Encounter's existing ACTIVE
 * Case. No Case creation. Guarded CareTask transition, assignment and audits
 * share one Serializable transaction; conflicts return 409 without retry.
 * Existing C1-C4 tests continue to verify close/Return and rollback safety.
 */
@Injectable()
export class HemorrhoidReturnEncounterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clinicians: CliniciansService,
    private readonly rooms: RoomsService,
  ) {}

  async create(
    tenantId: string,
    actorId: string,
    dto: CreateHemorrhoidReturnEncounterDto,
  ): Promise<Encounter> {
    // Tenant-scoped identity lookups, independent of the CareTask race
    // guarded inside the transaction below — same convention as
    // EncountersService.create. This route is DOCTOR-only (controller
    // @Roles), so an omitted responsibleClinicianId defaults to the acting
    // DOCTOR, mirroring EncountersService.create's DOCTOR default.
    const responsibleClinician = dto.responsibleClinicianId
      ? await this.clinicians.assertClinicianInTenant(
          tenantId,
          dto.responsibleClinicianId,
        )
      : await this.clinicians.assertClinicianInTenant(tenantId, actorId);
    if (dto.roomId) {
      await this.rooms.assertRoomInTenant(tenantId, dto.roomId);
    }

    let result: {
      encounterId: string;
    };
    try {
      result = await this.prisma.$transaction(
        async (tx) => {
          // 1. Authoritative load CareTask, inside the transaction.
          const task = await tx.careTask.findFirst({
            where: { id: dto.careTaskId, tenantId },
          });
          if (!task) {
            throw new NotFoundException('CareTask not found');
          }

          // 2. CareTask eligibility (Contract §I).
          if (
            task.status !== CareTaskStatus.OPEN ||
            task.type !== CareTaskType.FOLLOW_UP ||
            !task.carePlanId ||
            task.timepointCode !== null
          ) {
            throw new ConflictException(
              'CareTask is not an eligible generic Hemorrhoid follow-up task',
            );
          }
          const carePlan = await tx.carePlan.findFirst({
            where: { id: task.carePlanId, tenantId },
            select: {
              encounterId: true,
              patientId: true,
              encounter: {
                select: {
                  episodeId: true,
                  patientId: true,
                  treatmentPathwayId: true,
                },
              },
            },
          });
          if (!carePlan) {
            throw new ConflictException('CareTask has no linked CarePlan');
          }
          const isInitialBranch = await isHemorrhoidWorkflowEncounter(
            tx,
            tenantId,
            carePlan.encounterId,
          );
          const isContinuousCareBranch =
            !isInitialBranch &&
            (await isHemorrhoidContinuousCareBranchEncounter(
              tx,
              tenantId,
              carePlan.encounterId,
            ));
          if (!isInitialBranch && !isContinuousCareBranch) {
            throw new ConflictException(
              'CareTask does not belong to the Hemorrhoid workflow (Longo/unrelated Core tasks are rejected)',
            );
          }

          // 3. Derive patientId from the CareTask — never from the client.
          const patientId = task.patientId;
          const occurredAt = new Date(dto.occurredAt);

          // CarePlan / source-Encounter ancestry. DEC-020 D20-02: the source
          // (Initial) Encounter is ungrouped (episodeId null) until the first
          // Return, so its membership in the Hemorrhoid workflow is proven by
          // same-patient + no TreatmentPathway — NOT by the source Encounter
          // already being inside the episode (which it never is at this
          // point). A pathway-owned source Encounter is still rejected.
          if (
            carePlan.patientId !== patientId ||
            carePlan.encounter.patientId !== patientId ||
            carePlan.encounter.treatmentPathwayId !== null
          ) {
            throw new ConflictException(
              'Return requires a generic Hemorrhoid follow-up task whose source Encounter is an ungrouped Encounter of the same patient',
            );
          }

          // DEC-020 D20-02 / D20-03 authoritative episode resolution — the
          // reopen / start-new lifecycle work happens INSIDE this same
          // Serializable transaction (T10 P1-01), so a recurrence choice and
          // its Return can never be observed independently:
          //   0 ACTIVE + no CLOSED history + no choice -> create one ACTIVE episode
          //   0 ACTIVE + CLOSED history    + no choice -> 409 + stable code
          //   0 ACTIVE + choice REOPEN_EXISTING        -> reopen that episode
          //   0 ACTIVE + choice START_NEW              -> create one ACTIVE episode
          //   1 ACTIVE (+ any choice)                  -> reuse / reject stale choice
          //   >1 ACTIVE                                -> deterministic conflict
          const activeEpisodes = await tx.careEpisode.findMany({
            where: {
              tenantId,
              patientId,
              episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
              status: CareEpisodeStatus.ACTIVE,
            },
          });
          if (activeEpisodes.length > 1) {
            throw new ConflictException(
              `More than one ACTIVE ${HEMORRHOID_TREATMENT_EPISODE_TYPE} episode exists for this patient`,
            );
          }
          let episode = activeEpisodes[0];
          if (episode) {
            // Reuse the ACTIVE episode. A recurrence choice here is
            // contradictory / stale — never silently ignored.
            if (dto.recurrenceAction) {
              throw new ConflictException(
                'An ACTIVE Hemorrhoid treatment episode already exists for this patient; remove the recurrence choice and retry',
              );
            }
          } else if (dto.recurrenceAction === 'REOPEN_EXISTING') {
            if (!dto.recurrenceClosedEpisodeId) {
              throw new BadRequestException(
                'recurrenceClosedEpisodeId is required for REOPEN_EXISTING',
              );
            }
            if (!dto.recurrenceReason?.trim()) {
              throw new BadRequestException(
                'recurrenceReason is required for REOPEN_EXISTING',
              );
            }
            episode = await reopenHemorrhoidTreatmentEpisodeInTx(tx, {
              tenantId,
              actorId,
              patientId,
              episodeId: dto.recurrenceClosedEpisodeId,
              reason: dto.recurrenceReason,
            });
          } else if (dto.recurrenceAction === 'START_NEW') {
            episode = await startHemorrhoidTreatmentEpisodeInTx(tx, {
              tenantId,
              actorId,
              patientId,
              startedAt: occurredAt,
            });
          } else {
            // No explicit choice. If any CLOSED Hemorrhoid history exists the
            // doctor MUST choose (recurrence is never inferred); otherwise
            // this is a first-ever Return and the episode begins here.
            const closedCount = await tx.careEpisode.count({
              where: {
                tenantId,
                patientId,
                episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
                status: CareEpisodeStatus.CLOSED,
              },
            });
            if (closedCount > 0) {
              throw new ConflictException({
                code: HEMORRHOID_RECURRENCE_CHOICE_REQUIRED,
                message:
                  'This patient has closed Hemorrhoid treatment history and no ACTIVE episode. A Doctor must explicitly choose REOPEN_EXISTING <closedEpisodeId> or START_NEW on this request; recurrence is never inferred.',
              });
            }
            // First-ever Return. Two concurrent first Returns both reach the
            // shared helper; Postgres SERIALIZABLE predicate locking on the
            // ACTIVE-episode read makes at most one commit — the loser is
            // mapped to 409 by throwIfConcurrencyConflict, never a second
            // ACTIVE episode.
            episode = await startHemorrhoidTreatmentEpisodeInTx(tx, {
              tenantId,
              actorId,
              patientId,
              startedAt: occurredAt,
            });
          }

          // T4 — close-vs-Return concurrency guard (Contract §R): a plain
          // re-read of `episode` inside this same transaction would not
          // observe a concurrent close() committed after this transaction's
          // snapshot was taken (Postgres SERIALIZABLE uses one consistent
          // snapshot for reads throughout the transaction). Converting this
          // into a genuine WRITE against the same episode row — even a
          // no-op status write when reusing an existing episode — forces a
          // real row-level conflict against a concurrent close() UPDATE on
          // that same row, so at most one of {this Return Encounter, that
          // close} can commit; the loser gets 409, never silently
          // proceeding into a concurrently-closed Case.
          const episodeGuard = await tx.careEpisode.updateMany({
            where: {
              id: episode.id,
              tenantId,
              status: CareEpisodeStatus.ACTIVE,
            },
            data: { status: CareEpisodeStatus.ACTIVE },
          });
          if (episodeGuard.count !== 1) {
            throw new ConflictException(
              `${HEMORRHOID_TREATMENT_EPISODE_TYPE} episode was closed concurrently; reload and retry`,
            );
          }

          // 7. Create Return Encounter with episodeId AT CREATION.
          const encounter = await tx.encounter.create({
            data: {
              tenantId,
              patientId,
              episodeId: episode.id,
              responsibleClinicianId: responsibleClinician.id,
              createdByUserId: actorId,
              roomId: dto.roomId,
              reasonForVisit: dto.reasonForVisit,
              occurredAt,
            },
          });

          // 8. ClinicianAssignmentHistory.
          await tx.clinicianAssignmentHistory.create({
            data: {
              tenantId,
              encounterId: encounter.id,
              clinicianId: responsibleClinician.id,
              previousClinicianId: null,
              assignedByUserId: actorId,
              reason:
                'initial assignment at Hemorrhoid Return Encounter creation',
            },
          });

          // 9-11. Guarded CareTask OPEN -> COMPLETED transition. The WHERE
          // clause re-asserts id + status=OPEN so a concurrent completion of
          // the SAME CareTask can affect at most one transaction's update —
          // the loser observes count !== 1 and is rejected with 409, never
          // partially applied (mirrors EncountersService.handover's
          // optimistic-concurrency `updateMany` pattern).
          const transition = await tx.careTask.updateMany({
            where: { id: task.id, tenantId, status: CareTaskStatus.OPEN },
            data: {
              status: CareTaskStatus.COMPLETED,
              completedAt: new Date(),
              completedByEncounterId: encounter.id,
            },
          });
          if (transition.count !== 1) {
            throw new ConflictException(
              'CareTask was already completed or cancelled concurrently; reload and retry',
            );
          }

          // 12. Required AuditEvents, written inside the same transaction
          // (Contract §T) so a committed Return Encounter is never
          // observable without its audit trail. Any CARE_EPISODE_STARTED /
          // CARE_EPISODE_REOPENED event was already written by the lifecycle
          // helper above, in this same transaction.
          await this.audit.record(
            {
              tenantId,
              actorId,
              action: 'ENCOUNTER_CREATED',
              entityType: 'Encounter',
              entityId: encounter.id,
              metadata: {
                responsibleClinicianId: responsibleClinician.id,
                roomId: dto.roomId ?? null,
                episodeId: episode.id,
              },
            },
            tx,
          );
          await this.audit.record(
            {
              tenantId,
              actorId,
              action: 'CARE_TASK_COMPLETED',
              entityType: 'CareTask',
              entityId: task.id,
              metadata: { completedByEncounterId: encounter.id },
            },
            tx,
          );

          return {
            encounterId: encounter.id,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }

    return this.prisma.encounter.findUniqueOrThrow({
      where: { id: result.encounterId },
    });
  }

  /**
   * Same mapping as CarePlansService.throwIfConcurrencyConflict — Postgres
   * SERIALIZABLE isolation surfaces a same-state concurrent write conflict
   * as a serialization failure (P2034) or a deadlock (raw Postgres error,
   * not mapped to a known Prisma code inside an interactive transaction).
   * Both map to 409; no automatic retry (Contract §K).
   */
  private throwIfConcurrencyConflict(err: unknown): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2034'
    ) {
      throw new ConflictException(
        'Serialization conflict — reload the latest state and retry',
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
}
