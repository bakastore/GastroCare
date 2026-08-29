import { ForbiddenException } from '@nestjs/common';
import { Encounter } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// DEC016: the six verified Longo families require explicit Case +
// SURGERY/LONGO TreatmentPathway ancestry on create, complete and amend.
// The legacy generic HEMORRHOID_LONGO_FOLLOWUP template remains separate.
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
  encounter: Pick<
    Encounter,
    'id' | 'tenantId' | 'patientId' | 'episodeId' | 'treatmentPathwayId'
  >,
): Promise<void> {
  if (!LONGO_EPISODE_REQUIRED_TEMPLATE_KEYS.includes(templateKey)) {
    return;
  }

  if (!encounter.episodeId || !encounter.treatmentPathwayId) {
    throw new ForbiddenException(
      `Longo requires Case + SURGERY/LONGO TreatmentPathway for ${templateKey}`,
    );
  }
  const pathway = await prisma.treatmentPathway.findFirst({
    where: {
      id: encounter.treatmentPathwayId,
      tenantId,
      patientId: encounter.patientId,
      caseId: encounter.episodeId,
      modality: 'SURGERY',
      methodCode: 'LONGO',
      careCase: {
        tenantId,
        patientId: encounter.patientId,
        episodeType: 'HEMORRHOID_TREATMENT',
      },
    },
    select: { id: true },
  });
  if (!pathway)
    throw new ForbiddenException('Longo TreatmentPathway ancestry mismatch');
}
