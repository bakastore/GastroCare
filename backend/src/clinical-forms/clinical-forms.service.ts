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
import { getLatestTemplate, getTemplate } from './templates/registry';
import { computeScores, validateResponses } from './templates/validation';

/**
 * ClinicalFormSubmission lifecycle: DRAFT (mutable) -> COMPLETED (immutable).
 * No amendment lineage in this first version — see
 * design/REAL_WORLD_FORM_ALIGNMENT.md ("Submission lifecycle").
 */
@Injectable()
export class ClinicalFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  async create(
    tenantId: string,
    actorId: string,
    dto: CreateClinicalFormSubmissionDto,
  ) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: dto.encounterId, tenantId },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    const template = getLatestTemplate(dto.templateKey);
    if (!template) {
      throw new NotFoundException('Unknown clinical form template');
    }

    const existing = await this.prisma.clinicalFormSubmission.findUnique({
      where: {
        encounterId_templateKey: {
          encounterId: dto.encounterId,
          templateKey: dto.templateKey,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'A submission for this template already exists for this Encounter',
      );
    }

    validateResponses(template, dto.responses, false);

    const submission = await this.prisma.clinicalFormSubmission.create({
      data: {
        tenantId,
        patientId: encounter.patientId,
        encounterId: dto.encounterId,
        templateKey: template.templateKey,
        templateVersion: template.version,
        status: ClinicalFormStatus.DRAFT,
        responses: dto.responses,
        actorId,
      },
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

    const responses = submission.responses as Record<string, number | string>;
    validateResponses(template, responses, true);
    const scores = computeScores(template, responses);

    const completed = await this.prisma.clinicalFormSubmission.update({
      where: { id },
      data: {
        status: ClinicalFormStatus.COMPLETED,
        computedScores: scores,
        submittedAt: new Date(),
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

    return completed;
  }

  async getById(tenantId: string, id: string) {
    return this.findRootOrThrow(tenantId, id);
  }

  async listByPatient(tenantId: string, patientId: string) {
    return this.prisma.clinicalFormSubmission.findMany({
      where: { tenantId, patientId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
