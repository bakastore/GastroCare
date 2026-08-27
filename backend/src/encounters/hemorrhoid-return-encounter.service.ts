import {
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

/**
 * Dedicated atomic Return Encounter orchestration — Hemorrhoid Vertical
 * Slice 3 T2 (DEC-013; docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md
 * §H-§K). Deliberately separate from the generic
 * `CareTasksService.complete()` (Contract §J: "Do NOT use the current
 * generic CareTasksService.complete() as the atomic implementation for this
 * dedicated path") — that method is a plain read-then-update with no
 * episode resolution and no Serializable isolation, insufficient for the
 * CareEpisode start/reuse race this endpoint must guard against.
 *
 * The full C1-C4 real-Postgres concurrency proof and the mandatory
 * Independent Codex audit for this transaction are T4 (deferred — this is
 * T2 implementation only, already using the Contract-mandated Serializable
 * isolation and guarded conditional update so T4 has the correct shape to
 * test against).
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
      episodeId: string;
      episodeCreated: boolean;
      careTaskId: string;
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
            select: { encounterId: true },
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

          // 4-6. Resolve ACTIVE HEMORRHOID_TREATMENT episode: 0 -> create;
          // 1 -> reuse; >1 -> 409 (Contract §C, §J).
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
          let episode = activeEpisodes[0] ?? null;
          let episodeCreated = false;
          const occurredAt = new Date(dto.occurredAt);
          if (!episode) {
            // First Return Encounter for this patient — start the episode.
            // startedAt = Return Encounter.occurredAt (Contract §J); reusing
            // an existing episode must never change its startedAt.
            episode = await tx.careEpisode.create({
              data: {
                tenantId,
                patientId,
                episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
                status: CareEpisodeStatus.ACTIVE,
                startedAt: occurredAt,
              },
            });
            episodeCreated = true;
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
          // observable without its audit trail.
          if (episodeCreated) {
            await this.audit.record(
              {
                tenantId,
                actorId,
                action: 'CARE_EPISODE_STARTED',
                entityType: 'CareEpisode',
                entityId: episode.id,
                metadata: {
                  episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
                  patientId,
                },
              },
              tx,
            );
          }
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
            episodeId: episode.id,
            episodeCreated,
            careTaskId: task.id,
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
