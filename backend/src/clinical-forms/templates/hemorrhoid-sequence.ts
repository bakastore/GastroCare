import { ConflictException } from '@nestjs/common';
import { ClinicalFormStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Any Prisma client capable of running `clinicalFormSubmission.findFirst`
 * — either the top-level PrismaService or a `$transaction` callback's `tx`
 * argument, so these guards can be re-run authoritatively inside a
 * Serializable transaction (e.g. CarePlan sign/amend) as well as from
 * plain request-scoped calls (e.g. ClinicalFormSubmission create). */
type SequenceQueryClient = Pick<PrismaService, 'clinicalFormSubmission'>;

// Hemorrhoid Vertical Slice 2 backend-authoritative sequence (DEC-012 CD-05;
// docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md §6-§8):
//   HEMORRHOID_EXAMINATION COMPLETED
//     -> HEMORRHOID_DIAGNOSIS COMPLETED
//     -> HEMORRHOID_TREATMENT_DECISION COMPLETED
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
 * CarePlan create/sign prerequisite for Hemorrhoid encounters (DEC-012
 * CD-05; docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md §8): a
 * COMPLETED HEMORRHOID_TREATMENT_DECISION must exist on the same Encounter.
 * No-op for non-Hemorrhoid encounters — must never affect unrelated
 * Core/Longo CarePlan flows.
 */
export async function assertHemorrhoidCarePlanPrerequisite(
  prisma: SequenceQueryClient,
  tenantId: string,
  encounterId: string,
): Promise<void> {
  const isHemorrhoid = await isHemorrhoidWorkflowEncounter(
    prisma,
    tenantId,
    encounterId,
  );
  if (!isHemorrhoid) {
    return;
  }

  const satisfied = await hasCompletedSubmissionForEncounter(
    prisma,
    tenantId,
    encounterId,
    'HEMORRHOID_TREATMENT_DECISION',
  );
  if (!satisfied) {
    throw new ConflictException(
      'A COMPLETED HEMORRHOID_TREATMENT_DECISION is required on this Encounter before a CarePlan may be created or signed',
    );
  }
}
