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
   * Patient Timeline — a read PROJECTION composed from Encounter/CarePlan/
   * CareTask at request time. Never a stored table, never a write target —
   * see docs/04_CORE_DOMAIN_MODEL.md — Patient Timeline.
   */
  async getTimeline(tenantId: string, patientId: string) {
    await this.getById(tenantId, patientId);

    const encounters = await this.prisma.encounter.findMany({
      where: { tenantId, patientId },
      include: {
        carePlan: {
          include: {
            versions: { orderBy: { versionNumber: 'asc' } },
            careTasks: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const completedClinicalForms =
      await this.prisma.clinicalFormSubmission.findMany({
        where: { tenantId, patientId, status: 'COMPLETED' },
      });

    type TimelineEvent = {
      type:
        | 'ENCOUNTER'
        | 'CARE_PLAN_SIGNED'
        | 'CARE_TASK'
        | 'CLINICAL_FORM_SUBMITTED';
      timestamp: Date;
      data: unknown;
    };

    const events: TimelineEvent[] = [];

    for (const encounter of encounters) {
      events.push({
        type: 'ENCOUNTER',
        timestamp: encounter.createdAt,
        data: {
          id: encounter.id,
          reasonForVisit: encounter.reasonForVisit,
          clinicalNote: encounter.clinicalNote,
          assessment: encounter.assessment,
        },
      });

      if (encounter.carePlan) {
        for (const version of encounter.carePlan.versions) {
          events.push({
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
          events.push({
            type: 'CARE_TASK',
            timestamp: task.createdAt,
            data: {
              id: task.id,
              status: task.status,
              dueDate: task.dueDate,
            },
          });
        }
      }
    }

    for (const submission of completedClinicalForms) {
      events.push({
        type: 'CLINICAL_FORM_SUBMITTED',
        timestamp: submission.submittedAt ?? submission.createdAt,
        data: {
          id: submission.id,
          templateKey: submission.templateKey,
          templateVersion: submission.templateVersion,
          computedScores: submission.computedScores,
        },
      });
    }

    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return events;
  }
}
