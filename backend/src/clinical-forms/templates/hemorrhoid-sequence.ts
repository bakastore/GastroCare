import { ConflictException } from '@nestjs/common';
import { ClinicalFormStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isHemorrhoidContinuousCareBranchEncounter } from './hemorrhoid-continuous-care';

/** Any Prisma client capable of running `clinicalFormSubmission.findFirst`
 * (and, for the CarePlan two-branch prerequisite, `encounter.findFirst` /
 * `careEpisode.findFirst`) — either the top-level PrismaService or a
 * `$transaction` callback's `tx` argument, so these guards can be re-run
 * authoritatively inside a Serializable transaction (e.g. CarePlan
 * sign/amend) as well as from plain request-scoped calls (e.g.
 * ClinicalFormSubmission create). */
type SequenceQueryClient = Pick<
  PrismaService,
  'clinicalFormSubmission' | 'encounter' | 'careEpisode'
>;

// Hemorrhoid Vertical Slice 2 backend-authoritative sequence (DEC-012 CD-05;
// docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md §6-§8):
//   HEMORRHOID_EXAMINATION COMPLETED
//     -> HEMORRHOID_DIAGNOSIS COMPLETED
//     -> HEMORRHOID_TREATMENT_DECISION COMPLETED
//     -> CarePlan -> CarePlan SIGNED
//
// Hemorrhoid Vertical Slice 3 continuous-care branch (DEC-013 §4;
// docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §G, §O):
//   HEMORRHOID_FOLLOW_UP_ASSESSMENT COMPLETED
//     -> HEMORRHOID_NEXT_CLINICAL_DECISION COMPLETED
//     -> CarePlan -> CarePlan SIGNED
//
// Each entry maps a templateKey to the templateKey that must already have a
// COMPLETED submission on the SAME Encounter before a root submission of
// this templateKey may be created. Frontend state is never authority — this
// is re-verified server-side on every root create, and direct API bypass is
// rejected the same way.
const REQUIRED_PREDECESSOR_TEMPLATE_KEY: Readonly<Record<string, string>> = {
  HEMORRHOID_DIAGNOSIS: 'HEMORRHOID_EXAMINATION',
  HEMORRHOID_TREATMENT_DECISION: 'HEMORRHOID_DIAGNOSIS',
  HEMORRHOID_NEXT_CLINICAL_DECISION: 'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
};

/**
 * Whether at least one COMPLETED submission of `templateKey` exists for this
 * Encounter — a logical chain's revisions all keep status COMPLETED once
 * completed (amendment inserts a new COMPLETED row, never reopens the
 * original), so existence of any such row is sufficient to prove the
 * predecessor step is done, regardless of amendment history.
 */
export async function hasCompletedSubmissionForEncounter(
  prisma: SequenceQueryClient,
  tenantId: string,
  encounterId: string,
  templateKey: string,
): Promise<boolean> {
  const found = await prisma.clinicalFormSubmission.findFirst({
    where: {
      tenantId,
      encounterId,
      templateKey,
      status: ClinicalFormStatus.COMPLETED,
    },
    select: { id: true },
  });
  return found !== null;
}

/**
 * Enforced only at root creation, per contract ("A Diagnosis root may only
 * be created for an Encounter that has a COMPLETED HEMORRHOID_EXAMINATION on
 * the same tenant/patient/Encounter"). Encounter/tenant scoping already
 * comes from the caller (create() loads the Encounter by tenantId first).
 */
export async function assertHemorrhoidSequencePrerequisite(
  prisma: SequenceQueryClient,
  tenantId: string,
  templateKey: string,
  encounterId: string,
): Promise<void> {
  const predecessor = REQUIRED_PREDECESSOR_TEMPLATE_KEY[templateKey];
  if (!predecessor) {
    return;
  }

  const satisfied = await hasCompletedSubmissionForEncounter(
    prisma,
    tenantId,
    encounterId,
    predecessor,
  );
  if (!satisfied) {
    throw new ConflictException(
      `A COMPLETED ${predecessor} is required on this Encounter before ${templateKey} may be created`,
    );
  }
}

/**
 * An Encounter is part of the Hemorrhoid workflow iff a HEMORRHOID_EXAMINATION
 * chain (any status) has been started on it. Used to scope the CarePlan
 * sequence prerequisite (DEC-012 CD-05) to Hemorrhoid encounters only, so
 * unrelated Core/Longo CarePlan flows — which never have this submission —
 * are never affected.
 */
export async function isHemorrhoidWorkflowEncounter(
  prisma: SequenceQueryClient,
  tenantId: string,
  encounterId: string,
): Promise<boolean> {
  const found = await prisma.clinicalFormSubmission.findFirst({
    where: { tenantId, encounterId, templateKey: 'HEMORRHOID_EXAMINATION' },
    select: { id: true },
  });
  return found !== null;
}

/**
 * CarePlan create/sign prerequisite for Hemorrhoid encounters — two
 * backend-authoritative branches (DEC-012 CD-05; DEC-013 §4;
 * docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md §8;
 * docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §G):
 *
 *   initial branch:        COMPLETED HEMORRHOID_TREATMENT_DECISION required
 *   continuous-care branch: COMPLETED HEMORRHOID_NEXT_CLINICAL_DECISION required
 *
 * No-op for encounters in neither branch — must never affect unrelated
 * Core/Longo CarePlan flows. Slice 3 correction: this must NOT silently
 * no-op for a Return Encounter merely because it has no
 * HEMORRHOID_EXAMINATION submission (which only the initial branch ever
 * has) — branch membership for the continuous-care branch is instead
 * determined by CareEpisode ancestry (`HEMORRHOID_TREATMENT` episode type),
 * independent of which forms have been submitted on it yet.
 */
export async function assertHemorrhoidCarePlanPrerequisite(
  prisma: SequenceQueryClient,
  tenantId: string,
  encounterId: string,
): Promise<void> {
  const isInitialBranch = await isHemorrhoidWorkflowEncounter(
    prisma,
    tenantId,
    encounterId,
  );
  const isContinuousCareBranch =
    !isInitialBranch &&
    (await isHemorrhoidContinuousCareBranchEncounter(
      prisma,
      tenantId,
      encounterId,
    ));

  if (!isInitialBranch && !isContinuousCareBranch) {
    return;
  }

  const requiredPredecessor = isInitialBranch
    ? 'HEMORRHOID_TREATMENT_DECISION'
    : 'HEMORRHOID_NEXT_CLINICAL_DECISION';

  const satisfied = await hasCompletedSubmissionForEncounter(
    prisma,
    tenantId,
    encounterId,
    requiredPredecessor,
  );
  if (!satisfied) {
    throw new ConflictException(
      `A COMPLETED ${requiredPredecessor} is required on this Encounter before a CarePlan may be created or signed`,
    );
  }
}
