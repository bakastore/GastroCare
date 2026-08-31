import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CareEpisode,
  CareEpisodeStatus,
  ClinicalFormStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCareEpisodeDto } from './dto/create-care-episode.dto';
import { ReopenCareEpisodeDto } from './dto/reopen-care-episode.dto';
import { HEMORRHOID_TREATMENT_EPISODE_TYPE } from '../clinical-forms/templates/hemorrhoid-continuous-care';
import { startHemorrhoidTreatmentEpisodeInTx } from './care-episode-lifecycle';

@Injectable()
export class CareEpisodesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hemorrhoid Vertical Slice 3 T4 (DEC-013 §C, §L;
   * docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §L): direct
   * creation of a HEMORRHOID_TREATMENT episode must not become an
   * uncontrolled path that can produce a second ACTIVE episode for the same
   * tenant+patient. DEC016 uses this row as physical Case storage; Initial
   * creates/reuses it, Return only reuses it. Direct LONGO_TREATMENT creation
   * is retired in favor of explicit child TreatmentPathways.
   */
  async create(
    tenantId: string,
    actorId: string,
    dto: CreateCareEpisodeDto,
  ): Promise<CareEpisode> {
    if (dto.episodeType !== HEMORRHOID_TREATMENT_EPISODE_TYPE) {
      throw new BadRequestException(
        'Direct LONGO_TREATMENT creation is retired; create a SURGERY/LONGO TreatmentPathway under a Case',
      );
    }
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    try {
      return await this.prisma.$transaction(
        // Only HEMORRHOID_TREATMENT reaches here (guarded above). The
        // single-active rule + audit shape live in the shared
        // transaction-aware helper, which is also used by the Return
        // Encounter orchestration's atomic START_NEW path (T10 P1-01).
        (tx) =>
          startHemorrhoidTreatmentEpisodeInTx(tx, {
            tenantId,
            actorId,
            patientId: dto.patientId,
            startedAt: new Date(dto.startedAt),
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
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
      where: { tenantId, patientId, legacyTreatmentPathway: { is: null } },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * DEC-020 D20-03 (Package A T4): CareEpisode close is a DOCTOR explicit
   * action only and is NEVER automatic. A completed
   * HEMORRHOID_FOLLOW_UP_ASSESSMENT is DESIRABLE but is NOT a hard
   * prerequisite — the earlier DEC-013 §Q hard requirement is superseded.
   * The frontend surfaces a non-blocking warning when none exists and the
   * Doctor confirms explicitly; the backend records, as factual audit
   * metadata only, whether one was present. Closing an episode does not
   * cancel or touch any open CareTask or TreatmentPathway.
   *
   * DEC-013 §R (close-vs-Return race), still in force: wrapped in a Serializable
   * transaction so a concurrent Return Encounter transaction that also
   * writes this same episode row (see HemorrhoidReturnEncounterService's
   * episodeGuard touch-update) cannot both commit — the loser gets 409, and
   * a Return Encounter is never committed into an episode this transaction
   * concurrently closes.
   */
  async close(
    tenantId: string,
    actorId: string,
    id: string,
  ): Promise<CareEpisode> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.careEpisode.findFirst({
            where: { id, tenantId },
          });
          if (!existing) {
            throw new NotFoundException('Care episode not found');
          }
          if (existing.status === CareEpisodeStatus.CLOSED) {
            throw new ConflictException('Care episode is already closed');
          }

          // DEC-020 D20-03: DESIRABLE, not required. Recorded as factual
          // audit metadata; never blocks the close.
          let followUpAssessmentPresent = false;
          if (existing.episodeType === HEMORRHOID_TREATMENT_EPISODE_TYPE) {
            const completedAssessment =
              await tx.clinicalFormSubmission.findFirst({
                where: {
                  tenantId,
                  templateKey: 'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
                  status: ClinicalFormStatus.COMPLETED,
                  encounter: { episodeId: id },
                },
                select: { id: true },
              });
            followUpAssessmentPresent = completedAssessment !== null;
          }

          const endedAt = new Date();
          const transition = await tx.careEpisode.updateMany({
            where: { id, tenantId, status: CareEpisodeStatus.ACTIVE },
            data: { status: CareEpisodeStatus.CLOSED, endedAt },
          });
          if (transition.count !== 1) {
            throw new ConflictException('Care episode is already closed');
          }

          const episode = await tx.careEpisode.findUniqueOrThrow({
            where: { id },
          });
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
                followUpAssessmentPresent,
              },
            },
          });

          return episode;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
  }

  /**
   * DEC-013 §M: reopening a HEMORRHOID_TREATMENT episode must never produce
   * a second ACTIVE episode of that type for the same tenant+patient.
   * Scoped to HEMORRHOID_TREATMENT only — LONGO_TREATMENT reopen behavior is
   * unchanged. Serializable for the same reason as create()/close() above.
   */
  async reopen(
    tenantId: string,
    actorId: string,
    id: string,
    dto: ReopenCareEpisodeDto,
  ): Promise<CareEpisode> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.careEpisode.findFirst({
            where: { id, tenantId },
          });
          if (!existing) {
            throw new NotFoundException('Care episode not found');
          }
          if (existing.status === CareEpisodeStatus.ACTIVE) {
            throw new ConflictException('Care episode is already active');
          }

          if (existing.episodeType === HEMORRHOID_TREATMENT_EPISODE_TYPE) {
            const activeCount = await tx.careEpisode.count({
              where: {
                tenantId,
                patientId: existing.patientId,
                episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
                status: CareEpisodeStatus.ACTIVE,
                id: { not: id },
              },
            });
            if (activeCount > 0) {
              throw new ConflictException(
                `An ACTIVE ${HEMORRHOID_TREATMENT_EPISODE_TYPE} episode already exists for this patient`,
              );
            }
          }

          const transition = await tx.careEpisode.updateMany({
            where: { id, tenantId, status: CareEpisodeStatus.CLOSED },
            data: { status: CareEpisodeStatus.ACTIVE, endedAt: null },
          });
          if (transition.count !== 1) {
            throw new ConflictException('Care episode is already active');
          }

          const episode = await tx.careEpisode.findUniqueOrThrow({
            where: { id },
          });
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
  }

  /**
   * Same mapping as CarePlansService.throwIfConcurrencyConflict /
   * HemorrhoidReturnEncounterService.throwIfConcurrencyConflict — Postgres
   * SERIALIZABLE isolation surfaces a same-state concurrent write conflict
   * as a serialization failure (P2034) or a deadlock (raw Postgres error,
   * not mapped to a known Prisma code inside an interactive transaction).
   * Both map to 409; no automatic retry (Contract §K).
   */
  private throwIfConcurrencyConflict(err: unknown): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2034'
    ) {
      throw new ConflictException(
        'Serialization conflict — reload the latest state and retry',
      );
    }
    if (
      err instanceof Error &&
      (err.message.includes('40001') ||
        err.message.includes('40P01') ||
        err.message.includes('could not serialize access') ||
        err.message.includes('deadlock detected'))
    ) {
      throw new ConflictException(
        'Serialization conflict — reload the latest state and retry',
      );
    }
  }
}
