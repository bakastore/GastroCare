import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CareEpisode, CareEpisodeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCareEpisodeDto } from './dto/create-care-episode.dto';
import { ReopenCareEpisodeDto } from './dto/reopen-care-episode.dto';

@Injectable()
export class CareEpisodesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    actorId: string,
    dto: CreateCareEpisodeDto,
  ): Promise<CareEpisode> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const episode = await tx.careEpisode.create({
        data: {
          tenantId,
          patientId: dto.patientId,
          episodeType: dto.episodeType,
          status: CareEpisodeStatus.ACTIVE,
          startedAt: new Date(dto.startedAt),
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'CARE_EPISODE_STARTED',
          entityType: 'CareEpisode',
          entityId: episode.id,
          metadata: {
            patientId: episode.patientId,
            episodeType: episode.episodeType,
            status: episode.status,
          },
        },
      });

      return episode;
    });
  }

  async getById(tenantId: string, id: string): Promise<CareEpisode> {
    const episode = await this.prisma.careEpisode.findFirst({
      where: { id, tenantId },
    });
    if (!episode) {
      throw new NotFoundException('Care episode not found');
    }
    return episode;
  }

  async listByPatient(
    tenantId: string,
    patientId: string,
  ): Promise<CareEpisode[]> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return this.prisma.careEpisode.findMany({
      where: { tenantId, patientId },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async close(
    tenantId: string,
    actorId: string,
    id: string,
  ): Promise<CareEpisode> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.careEpisode.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException('Care episode not found');
      }
      if (existing.status === CareEpisodeStatus.CLOSED) {
        throw new ConflictException('Care episode is already closed');
      }

      const endedAt = new Date();
      const transition = await tx.careEpisode.updateMany({
        where: { id, tenantId, status: CareEpisodeStatus.ACTIVE },
        data: { status: CareEpisodeStatus.CLOSED, endedAt },
      });
      if (transition.count !== 1) {
        throw new ConflictException('Care episode is already closed');
      }

      const episode = await tx.careEpisode.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'CARE_EPISODE_CLOSED',
          entityType: 'CareEpisode',
          entityId: id,
          metadata: {
            patientId: episode.patientId,
            previousStatus: CareEpisodeStatus.ACTIVE,
            status: episode.status,
            endedAt: endedAt.toISOString(),
          },
        },
      });

      return episode;
    });
  }

  async reopen(
    tenantId: string,
    actorId: string,
    id: string,
    dto: ReopenCareEpisodeDto,
  ): Promise<CareEpisode> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.careEpisode.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException('Care episode not found');
      }
      if (existing.status === CareEpisodeStatus.ACTIVE) {
        throw new ConflictException('Care episode is already active');
      }

      const transition = await tx.careEpisode.updateMany({
        where: { id, tenantId, status: CareEpisodeStatus.CLOSED },
        data: { status: CareEpisodeStatus.ACTIVE, endedAt: null },
      });
      if (transition.count !== 1) {
        throw new ConflictException('Care episode is already active');
      }

      const episode = await tx.careEpisode.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'CARE_EPISODE_REOPENED',
          entityType: 'CareEpisode',
          entityId: id,
          metadata: {
            patientId: episode.patientId,
            previousStatus: CareEpisodeStatus.CLOSED,
            status: episode.status,
            reason: dto.reason.trim(),
          },
        },
      });

      return episode;
    });
  }
}
