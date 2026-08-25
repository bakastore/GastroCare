import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClinicalFormStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateClinicalFormSubmissionDto } from './dto/create-submission.dto';
import { UpdateDraftClinicalFormSubmissionDto } from './dto/update-draft-submission.dto';
import { AmendClinicalFormSubmissionDto } from './dto/amend-submission.dto';
import { getLatestTemplate, getTemplate } from './templates/registry';
import { computeScores, validateResponses } from './templates/validation';
import { assertLongoEpisodeAncestry } from './templates/longo-episode-invariant';
import { assertHemorrhoidSequencePrerequisite } from './templates/hemorrhoid-sequence';
import { ClinicalFormResponses } from './templates/types';
import { FollowUpTasksService } from '../follow-up-tasks/follow-up-tasks.service';

/**
 * ClinicalFormSubmission lifecycle: DRAFT (mutable) -> COMPLETED (immutable).
 * Correction of a COMPLETED submission never updates that row — it inserts
 * a new row (append-only amendment lineage) — see
 * docs/09_CORE04_IMPLEMENTATION_CONTRACT.md T2.
 */
@Injectable()
export class ClinicalFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly followUpTasks: FollowUpTasksService,
  ) {}

  private async findRootOrThrow(tenantId: string, id: string) {
    const submission = await this.prisma.clinicalFormSubmission.findFirst({
      where: { id, tenantId },
    });
    if (!submission) {
      throw new NotFoundException('ClinicalFormSubmission not found');
    }
    return submission;
  }

  private async loadEncounterOrThrow(tenantId: string, encounterId: string) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }
    return encounter;
  }

  async create(
    tenantId: string,
    actorId: string,
    dto: CreateClinicalFormSubmissionDto,
  ) {
    const encounter = await this.loadEncounterOrThrow(
      tenantId,
      dto.encounterId,
    );

    const template = getLatestTemplate(dto.templateKey);
    if (!template) {
      throw new NotFoundException('Unknown clinical form template');
    }

    await assertLongoEpisodeAncestry(
      this.prisma,
      tenantId,
      template.templateKey,
      encounter,
    );
    await assertHemorrhoidSequencePrerequisite(
      this.prisma,
      tenantId,
      template.templateKey,
      dto.encounterId,
    );

    // Reject if ANY submission already exists for this (Encounter,
    // templateKey) chain, at any revision/status — once a chain exists,
    // further writes go through updateDraft/complete (revision 1) or amend
    // (revision >= 2). A new root is never created on top of one.
    const existingChainMember =
      await this.prisma.clinicalFormSubmission.findFirst({
        where: { encounterId: dto.encounterId, templateKey: dto.templateKey },
        select: { id: true },
      });
    if (existingChainMember) {
      throw new ConflictException(
        'A submission for this template already exists for this Encounter',
      );
    }

    validateResponses(template, dto.responses, false);

    const submission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.clinicalFormSubmission.create({
        data: {
          tenantId,
          patientId: encounter.patientId,
          encounterId: dto.encounterId,
          templateKey: template.templateKey,
          templateVersion: template.version,
          status: ClinicalFormStatus.DRAFT,
          responses: dto.responses,
          actorId,
          logicalGroupId: '',
          revisionNumber: 1,
        },
      });
      // logicalGroupId defaults to the submission's own id — set in a
      // second step because the id is only known after insert.
      return tx.clinicalFormSubmission.update({
        where: { id: created.id },
        data: { logicalGroupId: created.id },
      });
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CLINICAL_FORM_CREATED',
      entityType: 'ClinicalFormSubmission',
      entityId: submission.id,
      metadata: {
        templateKey: template.templateKey,
        templateVersion: template.version,
      },
    });

    return submission;
  }

  async updateDraft(
    tenantId: string,
    id: string,
    dto: UpdateDraftClinicalFormSubmissionDto,
  ) {
    const submission = await this.findRootOrThrow(tenantId, id);
    if (submission.status !== ClinicalFormStatus.DRAFT) {
      throw new ConflictException(
        'Submission is already COMPLETED — a DRAFT can only be edited before completion',
      );
    }

    const template = getTemplate(
      submission.templateKey,
      submission.templateVersion,
    );
    if (!template) {
      throw new NotFoundException('Template version not found');
    }

    validateResponses(template, dto.responses, false);

    return this.prisma.clinicalFormSubmission.update({
      where: { id },
      data: { responses: dto.responses },
    });
  }

  async complete(tenantId: string, actorId: string, id: string) {
    const submission = await this.findRootOrThrow(tenantId, id);
    if (submission.status !== ClinicalFormStatus.DRAFT) {
      throw new ConflictException('Submission is already COMPLETED');
    }

    const template = getTemplate(
      submission.templateKey,
      submission.templateVersion,
    );
    if (!template) {
      throw new NotFoundException('Template version not found');
    }

    const encounter = await this.loadEncounterOrThrow(
      tenantId,
      submission.encounterId,
    );
    await assertLongoEpisodeAncestry(
      this.prisma,
      tenantId,
      submission.templateKey,
      encounter,
    );

    const responses = submission.responses as ClinicalFormResponses;
    validateResponses(template, responses, true);
    const scores = computeScores(template, responses);

    const completed = await this.prisma.clinicalFormSubmission.update({
      where: { id },
      data: {
        status: ClinicalFormStatus.COMPLETED,
        computedScores: scores,
        completedAt: new Date(),
        completedByUserId: actorId,
      },
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CLINICAL_FORM_COMPLETED',
      entityType: 'ClinicalFormSubmission',
      entityId: submission.id,
      metadata: {
        templateKey: submission.templateKey,
        templateVersion: submission.templateVersion,
      },
    });

    // T10 — explicit completed-surgery milestone triggers idempotent
    // follow-up scheduling; a completed TWO_WEEK/long-term follow-up form
    // is matched against an existing scheduled CareTask for the same
    // Episode + timepoint. Neither call is reachable for any other
    // templateKey.
    if (submission.templateKey === 'LONGO_INTRAOP_RECORD') {
      await this.followUpTasks.generateForSurgeryEncounter(
        tenantId,
        actorId,
        encounter,
      );
    } else {
      await this.followUpTasks.matchCompletion(
        tenantId,
        actorId,
        encounter,
        submission.templateKey,
        responses,
      );
    }

    return completed;
  }

  /**
   * Correction of a COMPLETED submission. Never updates the original row —
   * inserts a new row with revisionNumber + 1, previousSubmissionId pointing
   * at the current head, and a full corrected response snapshot. Rejects if
   * `id` is not currently the head of its chain (i.e. something already
   * amended it), preventing a fork before the database constraint would.
   */
  async amend(
    tenantId: string,
    actorId: string,
    id: string,
    dto: AmendClinicalFormSubmissionDto,
  ) {
    const submission = await this.findRootOrThrow(tenantId, id);
    if (submission.status !== ClinicalFormStatus.COMPLETED) {
      throw new ConflictException('Only a COMPLETED submission can be amended');
    }

    const template = getTemplate(
      submission.templateKey,
      submission.templateVersion,
    );
    if (!template) {
      throw new NotFoundException('Template version not found');
    }

    const encounter = await this.loadEncounterOrThrow(
      tenantId,
      submission.encounterId,
    );
    await assertLongoEpisodeAncestry(
      this.prisma,
      tenantId,
      submission.templateKey,
      encounter,
    );

    const existingSuccessor =
      await this.prisma.clinicalFormSubmission.findFirst({
        where: { previousSubmissionId: submission.id },
        select: { id: true },
      });
    if (existingSuccessor) {
      throw new ConflictException(
        'This submission has already been superseded by a later amendment',
      );
    }

    // R3 / Owner directive: plannedTimepoint is workflow identity for a
    // completed LONGO_LONG_TERM_FOLLOWUP revision and MUST NOT change via
    // amendment lineage. Amendment may only correct clinical content. A
    // wrong-timepoint entry must be corrected by creating a new, separate
    // clinical occurrence — never by rewriting the identity of a completed
    // revision. CareTask matching happens only at complete(), so silently
    // allowing this would let an amendment retroactively reassign a
    // completed submission to a different scheduled task without ever
    // re-running matching — this must be rejected, not normalized.
    if (submission.templateKey === 'LONGO_LONG_TERM_FOLLOWUP') {
      const existingResponses = submission.responses as ClinicalFormResponses;
      if (
        dto.responses.plannedTimepoint !== existingResponses.plannedTimepoint
      ) {
        throw new ConflictException(
          'plannedTimepoint is workflow identity and cannot be changed by amendment; create a new clinical occurrence instead',
        );
      }
    }

    validateResponses(template, dto.responses, true);
    const scores = computeScores(template, dto.responses);

    const amendment = await this.prisma.clinicalFormSubmission.create({
      data: {
        tenantId,
        patientId: submission.patientId,
        encounterId: submission.encounterId,
        templateKey: submission.templateKey,
        templateVersion: submission.templateVersion,
        status: ClinicalFormStatus.COMPLETED,
        responses: dto.responses,
        computedScores: scores,
        actorId: submission.actorId,
        logicalGroupId: submission.logicalGroupId,
        revisionNumber: submission.revisionNumber + 1,
        previousSubmissionId: submission.id,
        amendmentReason: dto.amendmentReason,
        amendedByUserId: actorId,
        completedByUserId: actorId,
        completedAt: new Date(),
      },
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CLINICAL_FORM_AMENDED',
      entityType: 'ClinicalFormSubmission',
      entityId: amendment.id,
      metadata: {
        previousSubmissionId: submission.id,
        newSubmissionId: amendment.id,
        revisionNumber: amendment.revisionNumber,
      },
    });

    return amendment;
  }

  /**
   * Read-only template schema for the frontend's generic form renderer.
   * Template definitions remain code-configuration (never a DB-backed
   * generic form builder — docs/09_CORE04_IMPLEMENTATION_CONTRACT.md T3);
   * this only exposes the already-locked field/section shape so the
   * frontend does not hand-duplicate (and risk drifting from) the same
   * clinical field definitions that live here.
   */
  getTemplateDefinition(templateKey: string) {
    const template = getLatestTemplate(templateKey);
    if (!template) {
      throw new NotFoundException('Unknown clinical form template');
    }
    return template;
  }

  async getById(tenantId: string, id: string) {
    return this.findRootOrThrow(tenantId, id);
  }

  async getHistory(tenantId: string, id: string) {
    const submission = await this.findRootOrThrow(tenantId, id);
    const revisions = await this.prisma.clinicalFormSubmission.findMany({
      where: { tenantId, logicalGroupId: submission.logicalGroupId },
      orderBy: { revisionNumber: 'asc' },
    });
    const current = revisions[revisions.length - 1] ?? submission;
    return { revisions, current };
  }

  async listByPatient(tenantId: string, patientId: string) {
    return this.prisma.clinicalFormSubmission.findMany({
      where: { tenantId, patientId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Vital-sign copy-forward for HEMORRHOID_EXAMINATION (DEC-010 §6).
   *
   * Finding 2 correction — target-aware: the caller supplies the target
   * Encounter (the Encounter the new/being-edited examination belongs to),
   * not a patientId. This method resolves tenant + patient + clinical time
   * (Encounter.occurredAt) from that target Encounter itself, then only
   * considers a prior submission eligible when
   * `sourceEncounter.occurredAt < targetEncounter.occurredAt` — this is the
   * invariant that prevents a backdated target Encounter from copying
   * forward data from the clinical future. Ordering (both the eligibility
   * cutoff and the "latest prior" selection) uses Encounter.occurredAt
   * only, never createdAt.
   *
   * Also strictly scoped to same tenantId + same patientId (never
   * cross-tenant, never cross-patient); only considers COMPLETED prior
   * submissions (DRAFT excluded).
   *
   * Deterministic tie-break when two eligible prior records share the exact
   * same occurredAt: prefer the higher revisionNumber, then the higher `id`
   * (string comparison — id is a UUID, so this has no clinical meaning, but
   * it is a stable total order over the tied set, which is all determinism
   * requires. Documented here and in the CORE04/T13-style test that proves
   * it, per DEC-010 §6 point 8).
   *
   * The caller (frontend form pre-fill) is responsible for letting the user
   * edit these values before create/complete; whatever ends up in the new
   * submission's own `responses` JSON at completion time is that
   * examination's own frozen snapshot — this method only ever reads, it
   * never mutates or links back to the source record, so a later amendment
   * to the source can never retroactively change an already-copied value.
   * The frontend must never compute/decide this clinical ordering itself —
   * it only ever passes the target Encounter id.
   */
  async getVitalsCopyForward(
    tenantId: string,
    targetEncounterId: string,
  ): Promise<{
    sourceSubmissionId: string;
    sourceEncounterId: string;
    sourceOccurredAt: Date;
    vitals: Partial<
      Record<
        | 'weight'
        | 'height'
        | 'pulse'
        | 'temperature'
        | 'systolicBloodPressure'
        | 'diastolicBloodPressure',
        number
      >
    >;
  } | null> {
    const targetEncounter = await this.prisma.encounter.findFirst({
      where: { id: targetEncounterId, tenantId },
      select: { patientId: true, occurredAt: true },
    });
    if (!targetEncounter) {
      throw new NotFoundException('Target Encounter not found');
    }

    const candidates = await this.prisma.clinicalFormSubmission.findMany({
      where: {
        tenantId,
        patientId: targetEncounter.patientId,
        templateKey: 'HEMORRHOID_EXAMINATION',
        status: ClinicalFormStatus.COMPLETED,
        encounter: { occurredAt: { lt: targetEncounter.occurredAt } },
      },
      include: { encounter: { select: { occurredAt: true } } },
    });

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => {
      const byOccurredAt =
        b.encounter.occurredAt.getTime() - a.encounter.occurredAt.getTime();
      if (byOccurredAt !== 0) return byOccurredAt;
      const byRevision = b.revisionNumber - a.revisionNumber;
      if (byRevision !== 0) return byRevision;
      // Deterministic final tie-break: higher id (string compare) wins.
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    });

    const source = candidates[0];
    const responses = source.responses as Record<string, unknown>;
    const vitalKeys = [
      'weight',
      'height',
      'pulse',
      'temperature',
      'systolicBloodPressure',
      'diastolicBloodPressure',
    ] as const;

    const vitals: Record<string, number> = {};
    for (const key of vitalKeys) {
      const value = responses[key];
      if (typeof value === 'number' && !Number.isNaN(value)) {
        vitals[key] = value;
      }
    }

    return {
      sourceSubmissionId: source.id,
      sourceEncounterId: source.encounterId,
      sourceOccurredAt: source.encounter.occurredAt,
      vitals,
    };
  }
}
