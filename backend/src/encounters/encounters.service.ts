import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

    const encounter = await this.prisma.encounter.create({
      data: {
        tenantId,
        patientId: dto.patientId,
        episodeId: dto.episodeId,
        doctorId,
        reasonForVisit: dto.reasonForVisit,
        clinicalNote: dto.clinicalNote,
        assessment: dto.assessment,
        occurredAt: new Date(dto.occurredAt),
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
