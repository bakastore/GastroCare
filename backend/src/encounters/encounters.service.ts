import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthRole,
  Encounter,
  EncounterClinicalStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CliniciansService } from '../clinicians/clinicians.service';
import { RoomsService } from '../rooms/rooms.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { HandoverEncounterDto } from './dto/handover-encounter.dto';

/**
 * No update/PATCH exists for Encounter anywhere in this module — the
 * simplest safe lifecycle satisfying "no free unrestricted overwrite of
 * finalized clinical content" (CORE-01 section 7) is the absence of a write
 * path after creation, EXCEPT the narrow, audited, provenance-preserving
 * `handover()` transition for responsibleClinicianId (DEC-010 §B) — this is
 * not a general-purpose Encounter edit path.
 */
@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clinicians: CliniciansService,
    private readonly rooms: RoomsService,
  ) {}

  /**
   * @param actorId the authenticated actor creating this Encounter
   * (createdByUserId — pure provenance, DEC-010 §A). This is NEVER the same
   * concept as responsibleClinicianId even when the values happen to
   * coincide (e.g. a DOCTOR creating their own Encounter).
   * @param actorRole the authenticated actor's role. Finding 1 correction —
   * a RECEPTIONIST may only ever create an administrative Encounter
   * Context (Patient, Facility, Room, responsible clinician,
   * occurredAt/reasonForVisit) and must never be able to attach an
   * episodeId or clinical content (clinicalNote/assessment), deny-by-
   * default, enforced here in the service layer (not merely by relying on
   * the frontend never sending those fields). A DOCTOR retains full,
   * unrestricted generic-create capability.
   */
  async create(
    tenantId: string,
    actorId: string,
    actorRole: AuthRole,
    dto: CreateEncounterDto,
  ): Promise<Encounter> {
    if (actorRole !== AuthRole.DOCTOR && actorRole !== AuthRole.RECEPTIONIST)
      throw new ForbiddenException();
    if (actorRole === AuthRole.RECEPTIONIST) {
      if (dto.treatmentPathwayId !== undefined)
        throw new ForbiddenException(
          'RECEPTIONIST may not attach a TreatmentPathway',
        );
      if (dto.episodeId !== undefined) {
        throw new ForbiddenException(
          'RECEPTIONIST may not attach an Encounter to a CareEpisode; ' +
            'only an Encounter Context (Patient/Facility/Room/clinician) ' +
            'may be created',
        );
      }
      if (dto.clinicalNote !== undefined) {
        throw new ForbiddenException(
          'RECEPTIONIST may not supply clinicalNote — this is clinical ' +
            'content and must be recorded by a DOCTOR via a clinical form',
        );
      }
      if (dto.assessment !== undefined) {
        throw new ForbiddenException(
          'RECEPTIONIST may not supply assessment — this is clinical ' +
            'content and must be recorded by a DOCTOR via a clinical form',
        );
      }
    }

    if (dto.workflowKind && dto.treatmentPathwayId)
      throw new BadRequestException(
        'Initial workflow cannot attach a TreatmentPathway',
      );
    if (dto.treatmentPathwayId && !dto.episodeId)
      throw new BadRequestException(
        'TreatmentPathway requires explicit Case ancestry',
      );
    // DEC-020 D20-02 (Package A): the Initial Hemorrhoid Encounter stays
    // ungrouped — episodeId must be null. The HEMORRHOID_TREATMENT
    // CareEpisode begins at the first Return Encounter, never here. This
    // supersedes the DEC-016-era rule where the Initial Encounter
    // created/reused the Case. An explicit episodeId with
    // workflowKind=HEMORRHOID_INITIAL is a contradictory request.
    if (dto.workflowKind === 'HEMORRHOID_INITIAL' && dto.episodeId)
      throw new BadRequestException(
        'Initial Hemorrhoid Encounter cannot attach a CareEpisode; the ' +
          'treatment episode begins at the first Return Encounter (DEC-020)',
      );

    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const responsibleClinician = dto.responsibleClinicianId
      ? await this.clinicians.assertClinicianInTenant(
          tenantId,
          dto.responsibleClinicianId,
        )
      : actorRole === AuthRole.DOCTOR
        ? await this.clinicians.assertClinicianInTenant(tenantId, actorId)
        : await this.clinicians.resolveDefaultClinician(tenantId);

    if (dto.roomId) {
      await this.rooms.assertRoomInTenant(tenantId, dto.roomId);
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // DEC-020 D20-02: no CareEpisode is ever created or resolved here.
          // A HEMORRHOID_INITIAL Encounter is ungrouped (episodeId null,
          // guarded above). An explicitly supplied episodeId (Longo pathway
          // Encounters, generic episode-bound Encounters) is still validated
          // below exactly as before.
          const episodeId = dto.episodeId;
          if (episodeId) {
            const careCase = await tx.careEpisode.findFirst({
              where: { id: episodeId, tenantId },
            });
            if (!careCase) throw new NotFoundException('Case not found');
            if (
              careCase.patientId !== dto.patientId ||
              careCase.episodeType !== 'HEMORRHOID_TREATMENT'
            )
              throw new BadRequestException(
                'Encounter requires same-patient Hemorrhoid Case',
              );
            if (careCase.status !== 'ACTIVE')
              throw new ConflictException('Case must be ACTIVE');
            await tx.careEpisode.update({
              where: { id: episodeId },
              data: { status: 'ACTIVE' },
            });
          }
          if (dto.treatmentPathwayId) {
            const pathway = await tx.treatmentPathway.findFirst({
              where: {
                id: dto.treatmentPathwayId,
                tenantId,
                caseId: episodeId,
                patientId: dto.patientId,
              },
            });
            if (!pathway)
              throw new BadRequestException(
                'TreatmentPathway ancestry mismatch',
              );
          }

          const created = await tx.encounter.create({
            data: {
              tenantId,
              patientId: dto.patientId,
              episodeId,
              treatmentPathwayId: dto.treatmentPathwayId,
              responsibleClinicianId: responsibleClinician.id,
              createdByUserId: actorId,
              roomId: dto.roomId,
              reasonForVisit: dto.reasonForVisit,
              clinicalNote: dto.clinicalNote ?? '',
              assessment: dto.assessment ?? '',
              occurredAt: new Date(dto.occurredAt),
              // DEC-015 — explicit persisted discriminator; never inferred,
              // never normalised. Omitted -> NULL (generic Encounter).
              workflowKind: dto.workflowKind ?? null,
              // DEC-021 NR-03 §5 — a new Encounter Context starts REGISTERED
              // (receptionist record creation != clinical start). Historical
              // rows stay NULL and are never backfilled.
              clinicalStatus: EncounterClinicalStatus.REGISTERED,
            },
          });

          await tx.clinicianAssignmentHistory.create({
            data: {
              tenantId,
              encounterId: created.id,
              clinicianId: responsibleClinician.id,
              previousClinicianId: null,
              assignedByUserId: actorId,
              reason: 'initial assignment at Encounter Context creation',
            },
          });

          await this.audit.record(
            {
              tenantId,
              actorId,
              action: 'ENCOUNTER_CREATED',
              entityType: 'Encounter',
              entityId: created.id,
              metadata: {
                responsibleClinicianId: responsibleClinician.id,
                roomId: dto.roomId ?? null,
                episodeId: created.episodeId,
                treatmentPathwayId: created.treatmentPathwayId,
              },
            },
            tx,
          );
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2034'
      )
        throw new ConflictException(
          'Concurrent Case change; reload before retrying',
        );
      throw err;
    }
  }

  async getById(tenantId: string, encounterId: string): Promise<Encounter> {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }
    return encounter;
  }

  /**
   * Clinician handover (DEC-010 §B). Reassigns responsibleClinicianId,
   * preserving full previous-assignment provenance via a new
   * ClinicianAssignmentHistory row (never overwriting the previous one) and
   * emitting an AuditEvent attributed to the actor performing the handover.
   * Historical AuditEvents are never rewritten — this only ever appends.
   *
   * Restricted to DOCTOR role at the controller (only a clinician may hand
   * off clinical responsibility to another clinician) — a RECEPTIONIST
   * attempting this is rejected by RolesGuard before this method runs
   * (satisfies "unauthorized actor -> REJECT", distinct from the
   * cross-tenant rejection below).
   *
   * Finding 4 correction — the entire handover is ONE Prisma transaction:
   * resolve the Encounter, read the current responsibleClinicianId, and
   * apply the reassignment guarded by an optimistic-concurrency
   * `updateMany` (its `where` clause requires responsibleClinicianId to
   * still equal the value just read — if a concurrent handover already
   * moved it, the affected row count is 0 and this throws ConflictException
   * instead of partially applying). The ClinicianAssignmentHistory row and
   * the AuditEvent are written inside that same transaction, so it is never
   * possible to observe a committed handover without its audit trail, and a
   * failed audit write rolls the whole handover back.
   */
  async handover(
    tenantId: string,
    actorId: string,
    encounterId: string,
    dto: HandoverEncounterDto,
  ): Promise<Encounter> {
    // Cross-tenant / nonexistent / non-DOCTOR target clinician -> REJECT.
    // Validated before the transaction — this does not depend on, and
    // cannot race with, the current responsibleClinicianId.
    const newClinician = await this.clinicians.assertClinicianInTenant(
      tenantId,
      dto.newClinicianId,
    );

    const reason = dto.reason?.trim() || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.encounter.findFirst({
        where: { id: encounterId, tenantId },
      });
      if (!existing) {
        throw new NotFoundException('Encounter not found');
      }

      const previousClinicianId = existing.responsibleClinicianId;
      if (newClinician.id === previousClinicianId) {
        throw new ConflictException(
          'Encounter is already assigned to this responsible clinician',
        );
      }

      // Optimistic concurrency guard: only succeeds if
      // responsibleClinicianId still equals the value just read inside
      // this same transaction. Two concurrent handovers starting from the
      // same previous clinician can both attempt this, but only one
      // `updateMany` can match a still-current row — the other observes
      // count !== 1 and is rejected with 409, never partially applied.
      const transition = await tx.encounter.updateMany({
        where: {
          id: encounterId,
          tenantId,
          responsibleClinicianId: previousClinicianId,
        },
        data: { responsibleClinicianId: newClinician.id },
      });
      if (transition.count !== 1) {
        throw new ConflictException(
          'Encounter responsible clinician changed concurrently; reload and retry',
        );
      }

      // DEC-021 §6.1 — retain the new assignment row id so the handover
      // AuditEvent carries a machine-checkable bridge (assignmentHistoryId)
      // to the exact ClinicianAssignmentHistory row this handover created.
      const assignment = await tx.clinicianAssignmentHistory.create({
        data: {
          tenantId,
          encounterId,
          clinicianId: newClinician.id,
          previousClinicianId,
          assignedByUserId: actorId,
          reason,
        },
      });

      // Written inside the same transaction as the Encounter update and
      // history row (Finding 4, point 7) — a failed audit write rolls back
      // the whole handover; a committed handover is never observable
      // without its AuditEvent. DEC-021 §6.1 — metadata now also carries
      // `assignmentHistoryId` (additive).
      await this.audit.record(
        {
          tenantId,
          actorId,
          action: 'ENCOUNTER_CLINICIAN_HANDOVER',
          entityType: 'Encounter',
          entityId: encounterId,
          metadata: {
            previousClinicianId,
            newClinicianId: newClinician.id,
            assignmentHistoryId: assignment.id,
            reason,
          },
        },
        tx,
      );

      return tx.encounter.findUniqueOrThrow({ where: { id: encounterId } });
    });

    return updated;
  }

  /**
   * DEC-021 NR-03 §5 — `POST /encounters/:id/start`. DOCTOR-only (controller).
   * REGISTERED -> IN_PROGRESS, sets clinicalStartedAt, audited. A legacy
   * (clinicalStatus NULL) Encounter cannot be started — it has no new-format
   * lifecycle and is never backfilled.
   */
  async startEncounter(
    tenantId: string,
    actorId: string,
    encounterId: string,
  ): Promise<Encounter> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.encounter.findFirst({
        where: { id: encounterId, tenantId },
      });
      if (!existing) throw new NotFoundException('Encounter not found');
      if (existing.clinicalStatus == null) {
        throw new ConflictException(
          'Encounter has no new-format clinical lifecycle (legacy row); cannot start',
        );
      }
      if (existing.clinicalStatus !== EncounterClinicalStatus.REGISTERED) {
        throw new ConflictException(
          `Encounter is not REGISTERED (current: ${existing.clinicalStatus})`,
        );
      }
      const startedAt = new Date();
      const transition = await tx.encounter.updateMany({
        where: {
          id: encounterId,
          tenantId,
          clinicalStatus: EncounterClinicalStatus.REGISTERED,
        },
        data: {
          clinicalStatus: EncounterClinicalStatus.IN_PROGRESS,
          clinicalStartedAt: startedAt,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException(
          'Encounter clinical status changed concurrently; reload and retry',
        );
      }
      await this.audit.record(
        {
          tenantId,
          actorId,
          action: 'ENCOUNTER_CLINICAL_STARTED',
          entityType: 'Encounter',
          entityId: encounterId,
          metadata: { clinicalStartedAt: startedAt.toISOString() },
        },
        tx,
      );
      return tx.encounter.findUniqueOrThrow({ where: { id: encounterId } });
    });
  }

  /**
   * DEC-021 NR-03 §5 + §6.4 — `POST /encounters/:id/end`. DOCTOR-only.
   * IN_PROGRESS -> COMPLETED, sets clinicalEndedAt, audited. If a handover
   * exists after the initial assignment, the exact latest handover
   * (resolved by AuditEvent.seq, §6.2) MUST have a matching
   * ENCOUNTER_HANDOVER_ACCEPTED by the current responsible Doctor, else the
   * Encounter is not ended (§6.4).
   */
  async endEncounter(
    tenantId: string,
    actorId: string,
    encounterId: string,
  ): Promise<Encounter> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.encounter.findFirst({
        where: { id: encounterId, tenantId },
      });
      if (!existing) throw new NotFoundException('Encounter not found');
      if (existing.clinicalStatus == null) {
        throw new ConflictException(
          'Encounter has no new-format clinical lifecycle (legacy row); cannot end',
        );
      }
      if (existing.clinicalStatus !== EncounterClinicalStatus.IN_PROGRESS) {
        throw new ConflictException(
          `Encounter is not IN_PROGRESS (current: ${existing.clinicalStatus})`,
        );
      }

      // §6.4 — end-Encounter guard after handover.
      const latestHandover = await this.resolveLatestHandover(
        tx,
        tenantId,
        existing,
      );
      if (latestHandover) {
        const accepted = await tx.auditEvent.findFirst({
          where: {
            tenantId,
            action: 'ENCOUNTER_HANDOVER_ACCEPTED',
            entityType: 'ClinicianAssignmentHistory',
            entityId: latestHandover.assignmentHistoryId,
            actorId: existing.responsibleClinicianId,
          },
          select: { id: true },
        });
        if (!accepted) {
          throw new ConflictException(
            'The latest Doctor handover has not been accepted by the current responsible Doctor; the Encounter cannot be ended',
          );
        }
      }

      const endedAt = new Date();
      const transition = await tx.encounter.updateMany({
        where: {
          id: encounterId,
          tenantId,
          clinicalStatus: EncounterClinicalStatus.IN_PROGRESS,
        },
        data: {
          clinicalStatus: EncounterClinicalStatus.COMPLETED,
          clinicalEndedAt: endedAt,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException(
          'Encounter clinical status changed concurrently; reload and retry',
        );
      }
      await this.audit.record(
        {
          tenantId,
          actorId,
          action: 'ENCOUNTER_CLINICAL_ENDED',
          entityType: 'Encounter',
          entityId: encounterId,
          metadata: { clinicalEndedAt: endedAt.toISOString() },
        },
        tx,
      );
      return tx.encounter.findUniqueOrThrow({ where: { id: encounterId } });
    });
  }

  /**
   * DEC-021 §6.2 — deterministic latest-handover resolution. Returns null if
   * the Encounter has had no handover (only its initial assignment). Never
   * resolves "latest" by assignedAt / timestamp proximity / free text /
   * arbitrary ordering — only by AuditEvent.seq (DESC, take 1).
   */
  private async resolveLatestHandover(
    tx: Prisma.TransactionClient,
    tenantId: string,
    encounter: Encounter,
  ): Promise<{ assignmentHistoryId: string } | null> {
    const latest = await tx.auditEvent.findFirst({
      where: {
        tenantId,
        action: 'ENCOUNTER_CLINICIAN_HANDOVER',
        entityType: 'Encounter',
        entityId: encounter.id,
      },
      orderBy: { seq: 'desc' },
    });
    if (!latest) return null;

    const meta = (latest.metadata ?? {}) as Record<string, unknown>;
    const assignmentHistoryId = meta.assignmentHistoryId;
    const newClinicianId = meta.newClinicianId;
    if (typeof assignmentHistoryId !== 'string') {
      throw new ConflictException(
        'Latest handover AuditEvent has no machine-checkable assignmentHistoryId; independent review required',
      );
    }

    const assignment = await tx.clinicianAssignmentHistory.findFirst({
      where: { id: assignmentHistoryId, tenantId },
    });
    if (
      !assignment ||
      assignment.encounterId !== encounter.id ||
      assignment.clinicianId !== encounter.responsibleClinicianId ||
      assignment.previousClinicianId == null ||
      newClinicianId !== encounter.responsibleClinicianId
    ) {
      throw new ConflictException(
        'Latest handover assignment does not reconcile with the Encounter state; not repaired automatically',
      );
    }
    return { assignmentHistoryId };
  }

  /**
   * DEC-021 §6.3 — `POST /encounters/:id/accept-handover`. DOCTOR-only. Only
   * the current responsibleClinicianId Doctor, only while IN_PROGRESS, only
   * for the exact latest handover (§6.2). Idempotent: repeated acceptance of
   * the exact same latest assignment returns already-accepted and appends no
   * duplicate event. Never mutates a historical ClinicianAssignmentHistory
   * row.
   */
  async acceptHandover(
    tenantId: string,
    actorId: string,
    encounterId: string,
  ): Promise<{ assignmentHistoryId: string; alreadyAccepted: boolean }> {
    // Read-only validation snapshot (§6.3): right Doctor, IN_PROGRESS, exact
    // latest handover (§6.2). The only write is the single acceptance
    // AuditEvent, appended below.
    const { assignmentHistoryId, alreadyAccepted } = await this.prisma.$transaction(
      async (tx) => {
        const encounter = await tx.encounter.findFirst({
          where: { id: encounterId, tenantId },
        });
        if (!encounter) throw new NotFoundException('Encounter not found');
        if (encounter.clinicalStatus !== EncounterClinicalStatus.IN_PROGRESS) {
          throw new ConflictException(
            'Encounter must be IN_PROGRESS to accept a handover',
          );
        }
        if (encounter.responsibleClinicianId !== actorId) {
          throw new ForbiddenException(
            'Only the current responsible Doctor may accept the handover',
          );
        }
        const latestHandover = await this.resolveLatestHandover(
          tx,
          tenantId,
          encounter,
        );
        if (!latestHandover) {
          throw new ConflictException('This Encounter has had no handover');
        }
        const existing = await tx.auditEvent.findFirst({
          where: {
            tenantId,
            action: 'ENCOUNTER_HANDOVER_ACCEPTED',
            entityType: 'ClinicianAssignmentHistory',
            entityId: latestHandover.assignmentHistoryId,
          },
          select: { id: true },
        });
        return {
          assignmentHistoryId: latestHandover.assignmentHistoryId,
          alreadyAccepted: existing !== null,
        };
      },
    );

    if (alreadyAccepted) {
      return { assignmentHistoryId, alreadyAccepted: true };
    }

    // DEC-021 R9 finding 3 — the read above is a fast path only. Two
    // concurrent requests can both observe no existing acceptance; the
    // partial unique index `audit_events_one_handover_acceptance_per_assignment`
    // (migration 20260906000100) is the real guard — it rejects the second
    // insert with P2002, which we treat as "already accepted" (§6.3: no
    // duplicate event, no error to the client). The insert is done outside
    // the read transaction so a uniqueness violation does not abort a
    // transaction that also holds other writes (it holds none).
    try {
      await this.audit.record({
        tenantId,
        actorId,
        action: 'ENCOUNTER_HANDOVER_ACCEPTED',
        entityType: 'ClinicianAssignmentHistory',
        entityId: assignmentHistoryId,
        metadata: { encounterId, clinicianId: actorId },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return { assignmentHistoryId, alreadyAccepted: true };
      }
      throw err;
    }
    return { assignmentHistoryId, alreadyAccepted: false };
  }

  /** Full clinician-assignment provenance for an Encounter, oldest first. */
  async getClinicianHistory(tenantId: string, encounterId: string) {
    await this.getById(tenantId, encounterId);
    return this.prisma.clinicianAssignmentHistory.findMany({
      where: { tenantId, encounterId },
      orderBy: { assignedAt: 'asc' },
    });
  }
}
