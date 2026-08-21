import { Injectable, NotFoundException } from '@nestjs/common';
import { Encounter } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';

/**
 * No update/PATCH exists for Encounter anywhere in this module — the
 * simplest safe lifecycle satisfying "no free unrestricted overwrite of
 * finalized clinical content" (CORE-01 section 7) is the absence of a write
 * path after creation.
 */
@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    tenantId: string,
    doctorId: string,
    dto: CreateEncounterDto,
  ): Promise<Encounter> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const encounter = await this.prisma.encounter.create({
      data: {
        tenantId,
        patientId: dto.patientId,
        doctorId,
        reasonForVisit: dto.reasonForVisit,
        clinicalNote: dto.clinicalNote,
        assessment: dto.assessment,
      },
    });

    await this.audit.record({
      tenantId,
      actorId: doctorId,
      action: 'ENCOUNTER_CREATED',
      entityType: 'Encounter',
      entityId: encounter.id,
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
}
