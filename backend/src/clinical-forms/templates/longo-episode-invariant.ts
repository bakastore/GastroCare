import { ForbiddenException } from '@nestjs/common';
import { Encounter } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// The six Longo template families (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md
// §3, §13) each require their Encounter to belong to a CareEpisode of the
// same tenant/patient. None of these six templates are implemented yet
// (T4-T9 — out of scope for T2); this guard is structural readiness so that
// create/complete/amend already enforce the invariant the moment those
// templates are registered, without any T2-time behavior change for
// existing (non-Longo) templates such as HEMORRHOID_LONGO_FOLLOWUP.
export const LONGO_EPISODE_REQUIRED_TEMPLATE_KEYS: readonly string[] = [
  'LONGO_PREOP_ASSESSMENT',
  'LONGO_INTRAOP_RECORD',
  'LONGO_EARLY_POSTOP',
  'LONGO_TWO_WEEK_FOLLOWUP',
  'ANAL_DILATION_ASSESSMENT',
  'LONGO_LONG_TERM_FOLLOWUP',
];

/**
 * Enforced on create/complete/amend for the six Longo template keys only.
 * Does not duplicate episodeId onto ClinicalFormSubmission — it re-verifies
 * ancestry through the Encounter each time, per contract invariant.
 */
export async function assertLongoEpisodeAncestry(
  prisma: PrismaService,
  tenantId: string,
  templateKey: string,
  encounter: Pick<Encounter, 'id' | 'tenantId' | 'patientId' | 'episodeId'>,
): Promise<void> {
  if (!LONGO_EPISODE_REQUIRED_TEMPLATE_KEYS.includes(templateKey)) {
    return;
  }

  if (!encounter.episodeId) {
    throw new ForbiddenException(
      `Encounter must belong to a CareEpisode for template ${templateKey}`,
    );
  }

  const episode = await prisma.careEpisode.findFirst({
    where: {
      id: encounter.episodeId,
      tenantId,
      patientId: encounter.patientId,
    },
    select: { id: true },
  });
  if (!episode) {
    throw new ForbiddenException(
      'Encounter CareEpisode must belong to the same tenant and patient',
    );
  }
}
