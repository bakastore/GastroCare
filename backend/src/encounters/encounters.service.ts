import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthRole, Encounter } from '@prisma/client';
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
    if (actorRole === AuthRole.RECEPTIONIST) {
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

    // DEC-015 §B — workflowKind and episodeId are mutually exclusive on
    // create. An episode-bound Encounter (Longo, Hemorrhoid Return) derives
    // its workflow identity from CareEpisode.episodeType; also stamping a
    // workflowKind would create a duplicate/competing workflow identity.
    // Reject 400 BEFORE any write — no Encounter is created.
    if (dto.workflowKind != null && dto.episodeId != null) {
      throw new BadRequestException(
        'workflowKind may not be combined with episodeId — an episode-bound ' +
          'Encounter derives its workflow identity from CareEpisode.episodeType',
      );
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    if (dto.episodeId) {
      const episode = await this.prisma.careEpisode.findFirst({
        where: { id: dto.episodeId, tenantId },
        select: { patientId: true },
      });
      if (!episode) {
        throw new NotFoundException('Care episode not found');
      }
      if (episode.patientId !== dto.patientId) {
        throw new BadRequestException(
          'Care episode does not belong to the Encounter patient',
        );
      }
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

    const encounter = await this.prisma.$transaction(async (tx) => {
      const created = await tx.encounter.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          episodeId: dto.episodeId,
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

      return created;
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'ENCOUNTER_CREATED',
      entityType: 'Encounter',
      entityId: encounter.id,
      metadata: {
        responsibleClinicianId: responsibleClinician.id,
        roomId: dto.roomId ?? null,
      },
    });

    return encounter;
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

      await tx.clinicianAssignmentHistory.create({
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
      // without its AuditEvent.
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
            reason,
          },
        },
        tx,
      );

      return tx.encounter.findUniqueOrThrow({ where: { id: encounterId } });
    });

    return updated;
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
