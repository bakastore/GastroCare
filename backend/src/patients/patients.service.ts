import { Injectable, NotFoundException } from '@nestjs/common';
import { Patient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { DuplicateCheckDto } from './dto/duplicate-check.dto';
import { normalizeFullName, normalizePhone } from './patient-matching';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Candidate duplicates by matching SIGNALS (normalized name + dateOfBirth,
   * or normalized phone) — never identity, never auto-merged. See
   * docs/04_CORE_DOMAIN_MODEL.md — Patient.
   */
  private async findCandidateDuplicates(
    tenantId: string,
    fullName: string,
    dateOfBirth: string,
    phone: string,
  ): Promise<Patient[]> {
    const normalizedFullName = normalizeFullName(fullName);
    const normalizedPhone = normalizePhone(phone);

    return this.prisma.patient.findMany({
      where: {
        tenantId,
        OR: [
          {
            normalizedFullName,
            dateOfBirth: new Date(dateOfBirth),
          },
          {
            normalizedPhone,
          },
        ],
      },
    });
  }

  async checkDuplicates(
    tenantId: string,
    dto: DuplicateCheckDto,
  ): Promise<Patient[]> {
    return this.findCandidateDuplicates(
      tenantId,
      dto.fullName,
      dto.dateOfBirth,
      dto.phone,
    );
  }

  /**
   * Always creates a new Patient (explicit create-new decision) — GastroCare
   * never auto-merges on matching signals. possibleDuplicates is returned
   * alongside the created record purely as a non-blocking warning.
   */
  async create(
    tenantId: string,
    actorId: string,
    dto: CreatePatientDto,
  ): Promise<{ patient: Patient; possibleDuplicates: Patient[] }> {
    const possibleDuplicates = await this.findCandidateDuplicates(
      tenantId,
      dto.fullName,
      dto.dateOfBirth,
      dto.phone,
    );

    const patient = await this.prisma.patient.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        normalizedFullName: normalizeFullName(dto.fullName),
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        phone: dto.phone,
        normalizedPhone: normalizePhone(dto.phone),
      },
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'PATIENT_CREATED',
      entityType: 'Patient',
      entityId: patient.id,
    });

    return { patient, possibleDuplicates };
  }

  async list(tenantId: string): Promise<Patient[]> {
    return this.prisma.patient.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(tenantId: string, patientId: string): Promise<Patient> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  /**
   * Patient Timeline — a read PROJECTION composed from CareEpisode/
   * Encounter/CarePlan/CareTask/ClinicalFormSubmission at request time.
   * Never a stored table, never a write target — see
   * docs/04_CORE_DOMAIN_MODEL.md — Patient Timeline.
   *
   * CORE-04 T11 (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md T11) groups
   * events by CareEpisode and sorts using clinical time
   * (Encounter.occurredAt), not createdAt. Encounters with episodeId =
   * null (and everything hung off them) are returned under
   * `ungroupedEncounters` rather than silently dropped. Amendment lineage
   * is preserved in full: every COMPLETED revision of a
   * ClinicalFormSubmission (root and every amendment) appears as its own
   * CLINICAL_FORM_SUBMITTED event — the original is never hidden by a
   * later amendment.
   */
  async getTimeline(tenantId: string, patientId: string) {
    await this.getById(tenantId, patientId);

    type TimelineEvent = {
      type:
        | 'ENCOUNTER'
        | 'CARE_PLAN_SIGNED'
        | 'CARE_TASK'
        | 'CLINICAL_FORM_SUBMITTED'
        | 'FOLLOW_UP_TASK';
      timestamp: Date;
      data: unknown;
    };

    const [episodes, encounters, completedClinicalForms, followUpTasks] =
      await Promise.all([
        this.prisma.careEpisode.findMany({
          where: { tenantId, patientId },
          orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }],
        }),
        this.prisma.encounter.findMany({
          where: { tenantId, patientId },
          include: {
            carePlan: {
              include: {
                versions: { orderBy: { versionNumber: 'asc' } },
                careTasks: true,
              },
            },
          },
          orderBy: { occurredAt: 'asc' },
        }),
        this.prisma.clinicalFormSubmission.findMany({
          where: { tenantId, patientId, status: 'COMPLETED' },
          orderBy: { revisionNumber: 'asc' },
        }),
        this.prisma.careTask.findMany({
          where: { tenantId, patientId, timepointCode: { not: null } },
          include: { sourceEncounter: { select: { episodeId: true } } },
        }),
      ]);

    const encounterById = new Map(encounters.map((e) => [e.id, e]));
    const eventsByEpisodeId = new Map<string, TimelineEvent[]>();
    const ungroupedEncounters: TimelineEvent[] = [];

    function bucketFor(episodeId: string | null): TimelineEvent[] {
      if (!episodeId) return ungroupedEncounters;
      let bucket = eventsByEpisodeId.get(episodeId);
      if (!bucket) {
        bucket = [];
        eventsByEpisodeId.set(episodeId, bucket);
      }
      return bucket;
    }

    for (const encounter of encounters) {
      const bucket = bucketFor(encounter.episodeId);
      bucket.push({
        type: 'ENCOUNTER',
        timestamp: encounter.occurredAt,
        data: {
          id: encounter.id,
          reasonForVisit: encounter.reasonForVisit,
          clinicalNote: encounter.clinicalNote,
          assessment: encounter.assessment,
          occurredAt: encounter.occurredAt,
          // F2 — lets the UI offer "Xem kế hoạch chăm sóc" instead of
          // re-offering CarePlan creation once one already exists for this
          // Encounter (DRAFT or SIGNED); no new storage, CarePlan is already
          // fetched 1:1 with Encounter above.
          carePlanId: encounter.carePlan?.id ?? null,
          carePlanStatus: encounter.carePlan?.status ?? null,
        },
      });

      if (encounter.carePlan) {
        for (const version of encounter.carePlan.versions) {
          bucket.push({
            type: 'CARE_PLAN_SIGNED',
            timestamp: version.signedAt,
            data: {
              carePlanId: encounter.carePlan.id,
              versionNumber: version.versionNumber,
              instructions: version.instructions,
              followUpDate: version.followUpDate,
              reason: version.reason,
            },
          });
        }

        for (const task of encounter.carePlan.careTasks) {
          bucket.push({
            type: 'CARE_TASK',
            timestamp: task.createdAt,
            data: {
              id: task.id,
              status: task.status,
              dueDate: task.dueDate,
              // F1 — expose existing fields (no new storage) so explicit
              // Return Encounter completion is visible in the Timeline:
              // generic follow-up tasks (carePlanId set, timepointCode
              // null) vs Longo timepoint tasks, and who/what closed it.
              carePlanId: task.carePlanId,
              timepointCode: task.timepointCode,
              completedAt: task.completedAt,
              completedByEncounterId: task.completedByEncounterId,
            },
          });
        }
      }
    }

    // F3 — data minimization: the Timeline is a read PROJECTION, not a
    // mirror of ClinicalFormSubmission.responses. Only the two Hemorrhoid
    // Slice 2 templates get a minimal, named summary field; every other
    // template keeps its existing (no full-responses) Timeline shape.
    const summaryFieldByTemplateKey: Record<string, string> = {
      HEMORRHOID_DIAGNOSIS: 'diagnosisSummary',
      HEMORRHOID_TREATMENT_DECISION: 'decisionSummary',
      // Hemorrhoid Slice 3 continuous-care loop (DEC-013;
      // docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §U).
      HEMORRHOID_FOLLOW_UP_ASSESSMENT: 'responseSummary',
      HEMORRHOID_NEXT_CLINICAL_DECISION: 'decisionSummary',
    };

    for (const submission of completedClinicalForms) {
      const encounter = encounterById.get(submission.encounterId);
      const bucket = bucketFor(encounter?.episodeId ?? null);
      const summaryField = summaryFieldByTemplateKey[submission.templateKey];
      const responses = submission.responses as Record<string, unknown> | null;
      bucket.push({
        type: 'CLINICAL_FORM_SUBMITTED',
        timestamp: submission.completedAt ?? submission.createdAt,
        data: {
          id: submission.id,
          encounterId: submission.encounterId,
          templateKey: submission.templateKey,
          templateVersion: submission.templateVersion,
          summary: summaryField ? (responses?.[summaryField] ?? null) : null,
          computedScores: submission.computedScores,
          logicalGroupId: submission.logicalGroupId,
          revisionNumber: submission.revisionNumber,
          previousSubmissionId: submission.previousSubmissionId,
          amendmentReason: submission.amendmentReason,
        },
      });
    }

    for (const task of followUpTasks) {
      const bucket = bucketFor(task.sourceEncounter?.episodeId ?? null);
      bucket.push({
        type: 'FOLLOW_UP_TASK',
        timestamp: task.dueDate,
        data: {
          id: task.id,
          status: task.status,
          dueDate: task.dueDate,
          timepointCode: task.timepointCode,
          sourceEncounterId: task.sourceEncounterId,
          completedByEncounterId: task.completedByEncounterId,
        },
      });
    }

    function byTimestamp(a: TimelineEvent, b: TimelineEvent): number {
      return a.timestamp.getTime() - b.timestamp.getTime();
    }

    ungroupedEncounters.sort(byTimestamp);

    return {
      episodes: episodes.map((episode) => {
        const events = eventsByEpisodeId.get(episode.id) ?? [];
        events.sort(byTimestamp);
        return { episode, events };
      }),
      ungroupedEncounters,
    };
  }
}
