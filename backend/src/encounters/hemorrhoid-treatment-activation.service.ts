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
  Encounter,
  EncounterClinicalStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActivateHemorrhoidTreatmentDto } from './dto/activate-hemorrhoid-treatment.dto';
import {
  HEMORRHOID_TREATMENT_DECISION_TEMPLATE_KEY,
  readEffectiveModalities,
  readPatientDecision,
} from '../clinical-forms/templates/hemorrhoid-treatment-decision.v3';
import { HEMORRHOID_TREATMENT_EPISODE_TYPE } from '../clinical-forms/templates/hemorrhoid-continuous-care';
import {
  HEMORRHOID_RECURRENCE_CHOICE_REQUIRED,
  reopenHemorrhoidTreatmentEpisodeInTx,
  startHemorrhoidTreatmentEpisodeInTx,
} from '../care-episodes/care-episode-lifecycle';
import { ClinicalFormResponses } from '../clinical-forms/templates/types';

type RecurrenceOperation =
  | 'REUSE_ACTIVE'
  | 'CREATE_NEW'
  | 'START_NEW'
  | 'REOPEN_EXISTING';

export interface HemorrhoidTreatmentActivationResult {
  encounter: Encounter;
  episode: CareEpisode;
  alreadyActivated: boolean;
}

/**
 * DEC-021 §3 — Structured Treatment Activation. An explicit, transactional,
 * DOCTOR-only application command — NOT a generic TreatmentActivation
 * subsystem and NOT a Prescription/Pharmacy subsystem.
 *
 * Machine-checkable domain linkage (§3.3): the full chain
 *   Encounter -> treatmentActivationSubmissionId
 *             -> completed HEMORRHOID_TREATMENT_DECISION v3
 *             -> explicit effectiveModalities
 *             -> Encounter.episodeId
 *             -> CareEpisode.episodeType = HEMORRHOID_TREATMENT
 * No inference from Diagnosis free-text, same Encounter alone, temporal
 * proximity, CarePlan existence, or reminder existence.
 */
@Injectable()
export class HemorrhoidTreatmentActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async activate(
    tenantId: string,
    actorId: string,
    encounterId: string,
    dto: ActivateHemorrhoidTreatmentDto,
  ): Promise<HemorrhoidTreatmentActivationResult> {
    let out: HemorrhoidTreatmentActivationResult;
    try {
      out = await this.prisma.$transaction(
        async (tx) => {
          // 1. Load Encounter by tenantId + id.
          const encounter = await tx.encounter.findFirst({
            where: { id: encounterId, tenantId },
          });
          if (!encounter) {
            throw new NotFoundException('Encounter not found');
          }

          // 3 (idempotency, checked before the lifecycle gate so an already
          // activated Encounter can always report its resolved state):
          if (encounter.treatmentActivationSubmissionId) {
            if (
              encounter.treatmentActivationSubmissionId ===
              dto.sourceDecisionSubmissionId
            ) {
              const episode = encounter.episodeId
                ? await tx.careEpisode.findFirst({
                    where: { id: encounter.episodeId, tenantId },
                  })
                : null;
              if (!episode) {
                throw new ConflictException(
                  'Activation record is inconsistent; independent review required',
                );
              }
              return { encounter, episode, alreadyActivated: true };
            }
            throw new ConflictException(
              'This Encounter already has a Structured Treatment Activation from a different decision submission; corrections use ClinicalForm amendment + explicit re-evaluation, never activation overwrite',
            );
          }

          // 2 + §5: new-format Encounter, in IN_PROGRESS, not terminal.
          if (encounter.clinicalStatus == null) {
            throw new ConflictException(
              'Structured Treatment Activation requires a new-format Encounter with an explicit clinical lifecycle; this Encounter is legacy/unknown',
            );
          }
          if (
            encounter.clinicalStatus !== EncounterClinicalStatus.IN_PROGRESS
          ) {
            throw new ConflictException(
              `Structured Treatment Activation requires the Encounter to be IN_PROGRESS (current: ${encounter.clinicalStatus})`,
            );
          }

          // 3. Load the exact source decision submission.
          const submission = await tx.clinicalFormSubmission.findFirst({
            where: { id: dto.sourceDecisionSubmissionId, tenantId },
          });
          if (!submission) {
            throw new NotFoundException('Treatment decision submission not found');
          }

          // 4. Require same tenant/patient/encounter; template + version;
          //    latest completed head of its amendment chain; ACCEPTED;
          //    non-empty effectiveModalities.
          if (
            submission.encounterId !== encounter.id ||
            submission.patientId !== encounter.patientId
          ) {
            throw new ConflictException(
              'Treatment decision submission does not belong to this Encounter/patient',
            );
          }
          if (
            submission.templateKey !==
            HEMORRHOID_TREATMENT_DECISION_TEMPLATE_KEY
          ) {
            throw new ConflictException(
              'Source submission is not a HEMORRHOID_TREATMENT_DECISION',
            );
          }
          if (submission.templateVersion < 3) {
            throw new ConflictException(
              'Structured Treatment Activation requires HEMORRHOID_TREATMENT_DECISION version >= 3',
            );
          }
          if (submission.status !== ClinicalFormStatus.COMPLETED) {
            throw new ConflictException(
              'Source treatment decision submission is not COMPLETED',
            );
          }
          const successor = await tx.clinicalFormSubmission.findFirst({
            where: { previousSubmissionId: submission.id, tenantId },
            select: { id: true },
          });
          if (successor) {
            throw new ConflictException(
              'Source treatment decision submission is not the latest revision of its amendment chain',
            );
          }

          const responses = submission.responses as ClinicalFormResponses;
          const patientDecision = readPatientDecision(responses);
          const effectiveModalities = readEffectiveModalities(responses);
          if (patientDecision !== 'ACCEPTED') {
            throw new ConflictException(
              `Structured Treatment Activation requires patientDecision=ACCEPTED (current: ${patientDecision ?? 'none'})`,
            );
          }
          if (effectiveModalities.length === 0) {
            throw new ConflictException(
              'Structured Treatment Activation requires a non-empty effectiveModalities list',
            );
          }

          // 5. Resolve the HEMORRHOID_TREATMENT episode.
          const patientId = encounter.patientId;
          const activeEpisodes = await tx.careEpisode.findMany({
            where: {
              tenantId,
              patientId,
              episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
              status: CareEpisodeStatus.ACTIVE,
            },
          });
          if (activeEpisodes.length > 1) {
            throw new ConflictException(
              `More than one ACTIVE ${HEMORRHOID_TREATMENT_EPISODE_TYPE} episode exists for this patient`,
            );
          }

          let episode: CareEpisode;
          let recurrenceOperation: RecurrenceOperation;
          const activationMetadata = {
            activation: true,
            activationEncounterId: encounter.id,
            sourceDecisionSubmissionId: submission.id,
          };

          if (activeEpisodes.length === 1) {
            if (dto.recurrenceAction) {
              throw new ConflictException(
                'An ACTIVE Hemorrhoid treatment episode already exists for this patient; remove the recurrence choice and retry',
              );
            }
            episode = activeEpisodes[0];
            recurrenceOperation = 'REUSE_ACTIVE';
          } else {
            const closedCount = await tx.careEpisode.count({
              where: {
                tenantId,
                patientId,
                episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
                status: CareEpisodeStatus.CLOSED,
              },
            });

            if (dto.recurrenceAction === 'REOPEN_EXISTING') {
              if (!dto.recurrenceClosedEpisodeId) {
                throw new BadRequestException(
                  'recurrenceClosedEpisodeId is required for REOPEN_EXISTING',
                );
              }
              if (!dto.recurrenceReason?.trim()) {
                throw new BadRequestException(
                  'recurrenceReason is required for REOPEN_EXISTING',
                );
              }
              episode = await reopenHemorrhoidTreatmentEpisodeInTx(tx, {
                tenantId,
                actorId,
                patientId,
                episodeId: dto.recurrenceClosedEpisodeId,
                reason: dto.recurrenceReason,
              });
              recurrenceOperation = 'REOPEN_EXISTING';
            } else if (dto.recurrenceAction === 'START_NEW') {
              episode = await startHemorrhoidTreatmentEpisodeInTx(tx, {
                tenantId,
                actorId,
                patientId,
                startedAt: new Date(),
                extraAuditMetadata: activationMetadata,
              });
              recurrenceOperation = 'START_NEW';
            } else if (closedCount > 0) {
              throw new ConflictException({
                code: HEMORRHOID_RECURRENCE_CHOICE_REQUIRED,
                message:
                  'This patient has closed Hemorrhoid treatment history and no ACTIVE episode. A Doctor must explicitly choose REOPEN_EXISTING <closedEpisodeId> or START_NEW; recurrence is never inferred.',
              });
            } else {
              // First-ever activation for this patient.
              episode = await startHemorrhoidTreatmentEpisodeInTx(tx, {
                tenantId,
                actorId,
                patientId,
                startedAt: new Date(),
                extraAuditMetadata: activationMetadata,
              });
              recurrenceOperation = 'CREATE_NEW';
            }
          }

          // 6. Guarded write against the active episode row — forces a real
          // row-level conflict against a concurrent close() UPDATE on that
          // same row (mirrors HemorrhoidReturnEncounterService's episodeGuard).
          const episodeGuard = await tx.careEpisode.updateMany({
            where: {
              id: episode.id,
              tenantId,
              status: CareEpisodeStatus.ACTIVE,
            },
            data: { status: CareEpisodeStatus.ACTIVE },
          });
          if (episodeGuard.count !== 1) {
            throw new ConflictException(
              `${HEMORRHOID_TREATMENT_EPISODE_TYPE} episode was closed concurrently; reload and retry`,
            );
          }

          // 7. Atomic guarded write onto the Encounter. The WHERE re-asserts
          // treatmentActivationSubmissionId IS NULL so two concurrent
          // activations of the SAME Encounter can affect at most one row.
          if (encounter.episodeId && encounter.episodeId !== episode.id) {
            throw new ConflictException(
              'Encounter is already linked to a different CareEpisode',
            );
          }
          const activatedAt = new Date();
          const encounterGuard = await tx.encounter.updateMany({
            where: {
              id: encounter.id,
              tenantId,
              treatmentActivationSubmissionId: null,
            },
            data: {
              episodeId: episode.id,
              treatmentActivationSubmissionId: submission.id,
              treatmentActivatedAt: activatedAt,
            },
          });
          if (encounterGuard.count !== 1) {
            throw new ConflictException(
              'Encounter was activated concurrently; reload and retry',
            );
          }

          // 8. Activation AuditEvent — identifiers + modalities + recurrence
          // operation; trimmed reopenReason only for REOPEN_EXISTING. No
          // other clinical narrative. The lifecycle helper already wrote its
          // own CARE_EPISODE_STARTED / CARE_EPISODE_REOPENED event in this
          // same transaction (§3.4 step 8).
          await this.audit.record(
            {
              tenantId,
              actorId,
              action: 'HEMORRHOID_TREATMENT_ACTIVATED',
              entityType: 'Encounter',
              entityId: encounter.id,
              metadata: {
                patientId,
                episodeId: episode.id,
                sourceDecisionSubmissionId: submission.id,
                effectiveModalities,
                recurrenceOperation,
                ...(recurrenceOperation === 'REOPEN_EXISTING'
                  ? { reopenReason: dto.recurrenceReason?.trim() }
                  : {}),
              },
            },
            tx,
          );

          const freshEncounter = await tx.encounter.findUniqueOrThrow({
            where: { id: encounter.id },
          });
          const freshEpisode = await tx.careEpisode.findUniqueOrThrow({
            where: { id: episode.id },
          });
          return {
            encounter: freshEncounter,
            episode: freshEpisode,
            alreadyActivated: false,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      this.throwIfConcurrencyConflict(err);
      throw err;
    }
    return out;
  }

  private throwIfConcurrencyConflict(err: unknown): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2034' || err.code === 'P2002')
    ) {
      throw new ConflictException(
        'Serialization/uniqueness conflict — reload the latest state and retry',
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
