import { ForbiddenException } from '@nestjs/common';
import { CareEpisodeStatus, Encounter } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Any Prisma client capable of running `encounter.findFirst` and
 * `careEpisode.findFirst` — either the top-level PrismaService or a
 * `$transaction` callback's `tx` argument (see hemorrhoid-sequence.ts for
 * the same pattern). */
type BranchQueryClient = Pick<PrismaService, 'encounter' | 'careEpisode'>;

// Hemorrhoid Vertical Slice 3 continuous-care loop (DEC-013 §2, §3;
// docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §C, §N).
export const HEMORRHOID_TREATMENT_EPISODE_TYPE = 'HEMORRHOID_TREATMENT';

// Only HEMORRHOID_FOLLOW_UP_ASSESSMENT is directly ancestry-guarded here.
// HEMORRHOID_NEXT_CLINICAL_DECISION's placement is instead enforced
// transitively by hemorrhoid-sequence.ts requiring a COMPLETED
// HEMORRHOID_FOLLOW_UP_ASSESSMENT on the SAME Encounter (Contract §O) — an
// Encounter that could carry a completed Follow-up Assessment has already
// passed this same ancestry guard, so re-checking here would be redundant.
export const HEMORRHOID_CONTINUOUS_CARE_ANCESTRY_TEMPLATE_KEYS: readonly string[] =
  ['HEMORRHOID_FOLLOW_UP_ASSESSMENT'];

/**
 * Enforced on create/complete/amend for HEMORRHOID_FOLLOW_UP_ASSESSMENT only
 * (Contract §N): the Encounter must belong to a HEMORRHOID_TREATMENT
 * CareEpisode of the same tenant + patient. This excludes both the
 * permanently-ungrouped initial Hemorrhoid Encounter (episodeId null —
 * Contract §B) and any Longo/unrelated episode. Does not duplicate
 * episodeId onto ClinicalFormSubmission — ancestry is re-verified through
 * the Encounter each time, mirroring the existing Longo guard
 * (assertLongoEpisodeAncestry).
 *
 * `requireActive` (default true) additionally requires the episode to
 * currently be ACTIVE — the correct requirement for create()/complete(),
 * which establish a NEW completed record and so must happen within the
 * live continuous-care window. T7 correction: amend() of an
 * already-COMPLETED historical revision must pass `requireActive: false` —
 * Contract §Q explicitly protects completed forms from being rewritten by
 * close, which only makes sense if their own legitimate correction
 * (amendment, never a rewrite of the original) remains available
 * afterward, exactly as Diagnosis/Treatment Decision amendment already
 * works regardless of anything downstream in Slice 2. Requiring ACTIVE at
 * amend time was an unintended side effect of reusing this same guard
 * across all three call sites before CareEpisode close existed (T1, before
 * T4) — tenant/patient/episodeType ancestry is still fully verified at
 * amend; only the ACTIVE-status requirement is scoped out.
 */
export async function assertHemorrhoidContinuousCareEpisodeAncestry(
  prisma: PrismaService,
  tenantId: string,
  templateKey: string,
  encounter: Pick<Encounter, 'id' | 'tenantId' | 'patientId' | 'episodeId'>,
  requireActive = true,
): Promise<void> {
  if (!HEMORRHOID_CONTINUOUS_CARE_ANCESTRY_TEMPLATE_KEYS.includes(templateKey)) {
    return;
  }

  if (!encounter.episodeId) {
    throw new ForbiddenException(
      `Encounter must belong to a ${HEMORRHOID_TREATMENT_EPISODE_TYPE} CareEpisode for template ${templateKey}`,
    );
  }

  const episode = await prisma.careEpisode.findFirst({
    where: {
      id: encounter.episodeId,
      tenantId,
      patientId: encounter.patientId,
      episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
      ...(requireActive ? { status: CareEpisodeStatus.ACTIVE } : {}),
    },
    select: { id: true },
  });
  if (!episode) {
    throw new ForbiddenException(
      requireActive
        ? `Encounter CareEpisode must be an ACTIVE ${HEMORRHOID_TREATMENT_EPISODE_TYPE} episode of the same tenant and patient`
        : `Encounter CareEpisode must be a ${HEMORRHOID_TREATMENT_EPISODE_TYPE} episode of the same tenant and patient`,
    );
  }
}

/**
 * Whether `encounterId` is a continuous-care-branch Encounter — i.e. it
 * belongs to a `HEMORRHOID_TREATMENT` CareEpisode of this tenant (any
 * status, not only ACTIVE — this identifies the *branch*, distinct from
 * `assertHemorrhoidContinuousCareEpisodeAncestry` above which additionally
 * requires the episode to currently be ACTIVE before a new clinical form
 * write is allowed on it). Used by the CarePlan two-branch prerequisite
 * (Contract §G) to distinguish a Return Encounter from the permanently
 * ungrouped initial Hemorrhoid Encounter and from unrelated Core/Longo
 * Encounters, independent of whether any HEMORRHOID_FOLLOW_UP_ASSESSMENT
 * has been submitted on it yet.
 */
export async function isHemorrhoidContinuousCareBranchEncounter(
  prisma: BranchQueryClient,
  tenantId: string,
  encounterId: string,
): Promise<boolean> {
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, tenantId },
    select: { episodeId: true },
  });
  if (!encounter?.episodeId) {
    return false;
  }

  const episode = await prisma.careEpisode.findFirst({
    where: {
      id: encounter.episodeId,
      tenantId,
      episodeType: HEMORRHOID_TREATMENT_EPISODE_TYPE,
    },
    select: { id: true },
  });
  return episode !== null;
}
