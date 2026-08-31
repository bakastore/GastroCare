import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CareEpisode, CareEpisodeStatus, Prisma } from '@prisma/client';
import { HEMORRHOID_TREATMENT_EPISODE_TYPE } from '../clinical-forms/templates/hemorrhoid-continuous-care';

/**
 * Stable machine-readable error code for the recurrence-choice-required
 * state on `POST /encounters/hemorrhoid-return` — 0 ACTIVE
 * HEMORRHOID_TREATMENT episode, CLOSED history exists, and the request
 * carried no explicit recurrence choice. The frontend branches on HTTP 409
 * + this code, never on message wording (DEC-020 Package A T10 P2-01).
 */
export const HEMORRHOID_RECURRENCE_CHOICE_REQUIRED =
  'HEMORRHOID_RECURRENCE_CHOICE_REQUIRED';

/**
 * Transaction-aware HEMORRHOID_TREATMENT CareEpisode lifecycle helpers.
 *
 * These are the single source of truth for the reopen / start-new business
 * rules + audit shape when the lifecycle action must commit **atomically as
 * part of** the Return Encounter orchestration transaction (DEC-020
 * Package A T10 P1-01: an explicit recurrence choice and its Return must
 * never be observable independently). `CareEpisodesService.reopen()` /
 * `.create()` keep the same rules for their own standalone workflows and
 * own the outer `$transaction` + serialization-conflict mapping; these
 * helpers deliberately do NOT open their own transaction.
 */

type LifecycleTxClient = Prisma.TransactionClient;

export async function reopenHemorrhoidTreatmentEpisodeInTx(
  tx: LifecycleTxClient,
  params: {
    tenantId: string;
    actorId: string;
    patientId: string;
    episodeId: string;
    reason: string;
  },
): Promise<CareEpisode> {
  const reason = params.reason?.trim();
  if (!reason) {
    throw new BadRequestException(
      'A non-empty reason is required to reopen a closed episode',
    );
  }
  // Parity with ReopenCareEpisodeDto / CreateHemorrhoidReturnEncounterDto
  // (T11 P2-01) — defensive, so no caller can bypass the reason bound.
  if (reason.length > 500) {
    throw new BadRequestException(
      'reopen reason must be at most 500 characters',
    );
  }

  const existing = await tx.careEpisode.findFirst({
    where: { id: params.episodeId, tenantId: params.tenantId },
  });
  // A cross-tenant / cross-patient / unknown id is reported as "not found"
  // — no existence or ownership information is leaked (T10 test H).
  if (!existing || existing.patientId !== params.patientId) {
    throw new NotFoundException('Care episode not found');
  }
  if (existing.episodeType !== HEMORRHOID_TREATMENT_EPISODE_TYPE) {
    throw new BadRequestException(
      `Selected episode is not a ${HEMORRHOID_TREATMENT_EPISODE_TYPE} episode`,
    );
  }
  if (existing.status !== CareEpisodeStatus.CLOSED) {
    throw new ConflictException('Selected episode is not CLOSED');
  }

  const otherActive = await tx.careEpisode.count({
    where: {
      tenantId: params.tenantId,
      patientId: existing.patientId,
      episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
      status: CareEpisodeStatus.ACTIVE,
      id: { not: params.episodeId },
    },
  });
  if (otherActive > 0) {
    throw new ConflictException(
      `An ACTIVE ${HEMORRHOID_TREATMENT_EPISODE_TYPE} episode already exists for this patient`,
    );
  }

  const transition = await tx.careEpisode.updateMany({
    where: {
      id: params.episodeId,
      tenantId: params.tenantId,
      status: CareEpisodeStatus.CLOSED,
    },
    data: { status: CareEpisodeStatus.ACTIVE, endedAt: null },
  });
  if (transition.count !== 1) {
    throw new ConflictException('Care episode is already active');
  }

  const episode = await tx.careEpisode.findUniqueOrThrow({
    where: { id: params.episodeId },
  });
  await tx.auditEvent.create({
    data: {
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: 'CARE_EPISODE_REOPENED',
      entityType: 'CareEpisode',
      entityId: params.episodeId,
      metadata: {
        patientId: episode.patientId,
        previousStatus: CareEpisodeStatus.CLOSED,
        status: episode.status,
        reason,
      },
    },
  });
  return episode;
}

export async function startHemorrhoidTreatmentEpisodeInTx(
  tx: LifecycleTxClient,
  params: {
    tenantId: string;
    actorId: string;
    patientId: string;
    startedAt: Date;
    /** Optional extra audit metadata merged into CARE_EPISODE_STARTED. */
    extraAuditMetadata?: Record<string, unknown>;
  },
): Promise<CareEpisode> {
  const activeCount = await tx.careEpisode.count({
    where: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
      status: CareEpisodeStatus.ACTIVE,
    },
  });
  if (activeCount > 0) {
    throw new ConflictException(
      `An ACTIVE ${HEMORRHOID_TREATMENT_EPISODE_TYPE} episode already exists for this patient`,
    );
  }

  const episode = await tx.careEpisode.create({
    data: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
      status: CareEpisodeStatus.ACTIVE,
      startedAt: params.startedAt,
    },
  });
  await tx.auditEvent.create({
    data: {
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: 'CARE_EPISODE_STARTED',
      entityType: 'CareEpisode',
      entityId: episode.id,
      metadata: {
        patientId: episode.patientId,
        episodeType: episode.episodeType,
        status: episode.status,
        ...(params.extraAuditMetadata ?? {}),
      },
    },
  });
  return episode;
}
