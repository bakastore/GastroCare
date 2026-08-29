/** DEC-016 LOCAL SYNTHETIC reconciliation. No heuristic candidate selection.
 * Not an API or historical-import feature. Entire manifest applies atomically.
 * Legacy records stay intact; only explicitly authorized ancestry is changed.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

export interface ReconciliationManifest {
  authority: 'DEC-016';
  syntheticOnly: true;
  id: string;
  appliedAt: string;
  entries: {
    tenantId: string;
    patientId: string;
    actorId: string;
    caseId: string;
    // Required ONLY for an explicitly authorized zero-candidate Case creation.
    newCase?: { startedAt: string; createdAt: string };
    initialEncounterIds: string[];
    legacyPathways: {
      legacyEpisodeId: string;
      pathwayId: string;
      encounterIds: string[];
    }[];
  }[];
}

export function assertLocalSyntheticTarget() {
  const u = new URL(process.env.DATABASE_URL ?? '');
  if (
    !['localhost', '127.0.0.1'].includes(u.hostname) ||
    u.port !== '55432' ||
    !['/gastrocare_dec016_rehearsal', '/gastrocare_foundation_test'].includes(
      u.pathname,
    )
  ) {
    throw new Error(
      'STOP: only the authorized local synthetic databases are allowed',
    );
  }
}

export async function reconcile(
  prisma: PrismaClient,
  manifest: ReconciliationManifest,
) {
  assertLocalSyntheticTarget();
  if (
    manifest.authority !== 'DEC-016' ||
    manifest.syntheticOnly !== true ||
    !manifest.id ||
    !Number.isFinite(Date.parse(manifest.appliedAt))
  ) {
    throw new Error('STOP: invalid explicit reconciliation authority');
  }
  return prisma.$transaction(
    async (tx) => {
      const seen = new Set<string>();
      for (const entry of manifest.entries) {
        const { tenantId, patientId, actorId, caseId } = entry;
        if (seen.has(patientId))
          throw new Error('STOP: duplicate patient manifest entry');
        seen.add(patientId);
        const patient = await tx.patient.findFirst({
          where: { id: patientId, tenantId },
        });
        const actor = await tx.authUser.findFirst({
          where: { id: actorId, tenantId, role: 'DOCTOR' },
        });
        if (!patient || !actor)
          throw new Error('STOP: manifest ancestry/actor mismatch');
        const candidates = await tx.careEpisode.findMany({
          where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT' },
        });
        if (candidates.length > 1)
          throw new Error('STOP: >1 authoritative Case candidate');
        if (candidates.length === 1 && candidates[0].id !== caseId)
          throw new Error(
            'STOP: explicit Case differs from authoritative candidate',
          );
        let createdCase = false;
        if (!candidates.length) {
          if (!entry.newCase)
            throw new Error(
              'STOP: zero candidates requires explicit newCase manifest',
            );
          await tx.careEpisode.create({
            data: {
              id: caseId,
              tenantId,
              patientId,
              episodeType: 'HEMORRHOID_TREATMENT',
              startedAt: new Date(entry.newCase.startedAt),
              createdAt: new Date(entry.newCase.createdAt),
            },
          });
          createdCase = true;
        }
        const auditId = `${manifest.id}:${patientId}`;
        const previousAudit = await tx.auditEvent.findFirst({
          where: { id: auditId, tenantId },
        });
        const manifestMetadata = JSON.parse(
          JSON.stringify(entry),
        ) as Prisma.InputJsonValue;
        if (
          previousAudit &&
          JSON.stringify(previousAudit.metadata) !==
            JSON.stringify(manifestMetadata)
        ) {
          // JSONB key ordering differs; use structural equality below instead.
          const canonical = (value: unknown): string =>
            JSON.stringify(value, (_k, v) =>
              v && !Array.isArray(v) && typeof v === 'object'
                ? Object.fromEntries(
                    Object.keys(v)
                      .sort()
                      .map((k) => [k, v[k]]),
                  )
                : v,
            );
          if (canonical(previousAudit.metadata) !== canonical(manifestMetadata))
            throw new Error(
              'STOP: manifest identity reused with different mapping',
            );
        }
        let changed = createdCase;
        for (const id of entry.initialEncounterIds) {
          const encounter = await tx.encounter.findFirst({
            where: { id, tenantId, patientId },
          });
          if (
            !encounter ||
            encounter.workflowKind !== 'HEMORRHOID_INITIAL' ||
            encounter.treatmentPathwayId ||
            (encounter.episodeId && encounter.episodeId !== caseId)
          )
            throw new Error('STOP: Initial mapping is not explicitly eligible');
          if (encounter.episodeId === null) {
            await tx.encounter.update({
              where: { id },
              data: { episodeId: caseId },
            });
            changed = true;
          }
        }
        for (const mapping of entry.legacyPathways) {
          const legacy = await tx.careEpisode.findFirst({
            where: {
              id: mapping.legacyEpisodeId,
              tenantId,
              patientId,
              episodeType: 'LONGO_TREATMENT',
            },
          });
          if (!legacy) throw new Error('STOP: missing legacy Longo ancestry');
          const existing = await tx.treatmentPathway.findUnique({
            where: { legacyEpisodeId: legacy.id },
          });
          if (
            existing &&
            (existing.id !== mapping.pathwayId ||
              existing.caseId !== caseId ||
              existing.patientId !== patientId ||
              existing.tenantId !== tenantId ||
              existing.modality !== 'SURGERY' ||
              existing.methodCode !== 'LONGO')
          )
            throw new Error('STOP: existing legacy pathway mapping differs');
          if (!existing) {
            await tx.treatmentPathway.create({
              data: {
                id: mapping.pathwayId,
                tenantId,
                patientId,
                caseId,
                modality: 'SURGERY',
                methodCode: 'LONGO',
                legacyEpisodeId: legacy.id,
                // Exact preserved legacy timestamps, NEVER a matching heuristic.
                startedAt: legacy.startedAt,
                endedAt: legacy.endedAt,
                createdAt: legacy.createdAt,
                createdByUserId: actorId,
              },
            });
            changed = true;
          }
          const unmapped = await tx.encounter.count({
            where: {
              episodeId: legacy.id,
              id: { notIn: mapping.encounterIds },
            },
          });
          if (unmapped)
            throw new Error(
              'STOP: legacy Encounter missing from explicit manifest',
            );
          for (const id of mapping.encounterIds) {
            const encounter = await tx.encounter.findFirst({
              where: { id, tenantId, patientId },
            });
            if (
              !encounter ||
              ![legacy.id, caseId].includes(encounter.episodeId ?? '') ||
              encounter.workflowKind !== null ||
              (encounter.treatmentPathwayId !== null &&
                encounter.treatmentPathwayId !== mapping.pathwayId)
            )
              throw new Error('STOP: legacy Encounter mapping mismatch');
            if (
              encounter.episodeId === caseId &&
              encounter.treatmentPathwayId !== mapping.pathwayId
            )
              throw new Error(
                'STOP: Case Encounter lacks matching prior reconciliation',
              );
            if (encounter.episodeId === legacy.id) {
              await tx.encounter.update({
                where: { id },
                data: {
                  episodeId: caseId,
                  treatmentPathwayId: mapping.pathwayId,
                },
              });
              changed = true;
            }
          }
        }
        if (previousAudit && changed)
          throw new Error('STOP: already-applied manifest state drift');
        if (!previousAudit)
          await tx.auditEvent.create({
            data: {
              id: auditId,
              tenantId,
              actorId,
              action: 'DEC016_ANCESTRY_RECONCILED',
              entityType: 'CareEpisode',
              entityId: caseId,
              createdAt: new Date(manifest.appliedAt),
              metadata: manifestMetadata,
            },
          });
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30000,
    },
  );
}

if (require.main === module) {
  assertLocalSyntheticTarget();
  const prisma = new PrismaClient();
  const manifest = JSON.parse(
    readFileSync(process.argv[2], 'utf8'),
  ) as ReconciliationManifest;
  reconcile(prisma, manifest)
    .then(() => console.log('Reconciliation PASS'))
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
