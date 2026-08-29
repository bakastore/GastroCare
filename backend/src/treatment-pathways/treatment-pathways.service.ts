import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTreatmentPathwayDto } from './treatment-pathways.controller';
export const SURGERY_METHOD_CODES = [
  'LONGO',
  'MILLIGAN_MORGAN',
  'FERGUSON',
  'HCPT',
  'LASER_DIODE_LHP',
  'THD_HAL_RAR',
] as const;
@Injectable()
export class TreatmentPathwaysService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    tenantId: string,
    actorId: string,
    dto: CreateTreatmentPathwayDto,
  ) {
    if (
      dto.modality === 'SURGERY'
        ? !SURGERY_METHOD_CODES.some((code) => code === dto.methodCode)
        : dto.methodCode != null
    )
      throw new BadRequestException(
        'SURGERY requires an explicit supported methodCode; other modalities must omit it',
      );
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const careCase = await tx.careEpisode.findFirst({
            where: {
              id: dto.caseId,
              tenantId,
              episodeType: 'HEMORRHOID_TREATMENT',
            },
          });
          if (!careCase) throw new NotFoundException('Case not found');
          if (careCase.status !== 'ACTIVE')
            throw new ConflictException('Case must be ACTIVE');
          await tx.careEpisode.update({
            where: { id: careCase.id },
            data: { status: 'ACTIVE' },
          });
          const pathway = await tx.treatmentPathway.create({
            data: {
              tenantId,
              caseId: careCase.id,
              patientId: careCase.patientId,
              modality: dto.modality,
              methodCode: dto.methodCode ?? null,
              startedAt: new Date(dto.startedAt),
              createdByUserId: actorId,
            },
          });
          await tx.auditEvent.create({
            data: {
              tenantId,
              actorId,
              action: 'TREATMENT_PATHWAY_CREATED',
              entityType: 'TreatmentPathway',
              entityId: pathway.id,
              metadata: {
                caseId: careCase.id,
                modality: pathway.modality,
                methodCode: pathway.methodCode,
              },
            },
          });
          return pathway;
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
  async list(tenantId: string, caseId: string) {
    if (
      !(await this.prisma.careEpisode.findFirst({
        where: { id: caseId, tenantId },
      }))
    )
      throw new NotFoundException('Case not found');
    return this.prisma.treatmentPathway.findMany({
      where: { tenantId, caseId },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    });
  }
}
