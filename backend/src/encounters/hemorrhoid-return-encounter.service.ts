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
  EncounterClinicalStatus,
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
 * DEC016: atomic Return creation in the source Encounter's existing ACTIVE
 * Case. No Case creation. Guarded CareTask transition, assignment and audits
 * share one Serializable transaction; conflicts return 409 without retry.
 *
 * DEC-021 R9 correction (finding 1): a Return Encounter NEVER creates or
 * reopens a HEMORRHOID_TREATMENT CareEpisode. The legacy "first Return
 * auto-starts the episode" / "recurrence choice on the Return request"
 * behaviour is removed. A Return may only reuse an already-valid ACTIVE
 * episode; any create/reopen must go through Structured Treatment Activation
 * (`POST /encounters/:id/hemorrhoid-treatment/activate`), which enforces the
 * locked Treatment Decision v3 machine-checkable requirements (DEC-021 §3).
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

          // DEC-021 R9 finding 1 — a Return Encounter may ONLY reuse an
          // already-valid ACTIVE HEMORRHOID_TREATMENT episode. It never
          // creates or reopens one. A recurrence choice is not accepted here
          // anymore: create/reopen is exclusively Structured Treatment
          // Activation (DEC-021 §3), which enforces the Treatment Decision v3
          // machine-checkable requirements.
          if (dto.recurrenceAction) {
            throw new BadRequestException(
              'Recurrence (REOPEN_EXISTING / START_NEW) is no longer handled on the Return request. Create/reopen a HEMORRHOID_TREATMENT episode only via Structured Treatment Activation (POST /encounters/:id/hemorrhoid-treatment/activate).',
            );
          }
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
          const episode = activeEpisodes[0];
          if (!episode) {
            throw new ConflictException(
              'This patient has no ACTIVE Hemorrhoid treatment episode. A Return Encounter cannot start or reopen one — activate treatment first via Structured Treatment Activation.',
            );
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
              // DEC-021 NR-03 §5 — new Encounter Context starts REGISTERED.
              clinicalStatus: EncounterClinicalStatus.REGISTERED,
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
