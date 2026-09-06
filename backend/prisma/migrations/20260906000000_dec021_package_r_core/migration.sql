-- DEC-021 Package R — Selective Rebaseline Core Correction (Contract §12).
--
-- Additive only. No backfill, no rewrite of existing rows, no edit of any
-- prior migration file. No column is renamed or dropped.
--   * EncounterClinicalStatus enum + Encounter.clinicalStatus /
--     clinicalStartedAt / clinicalEndedAt  (all nullable — historical rows
--     stay NULL = legacy/unknown, NOT REGISTERED; Contract §5).
--   * Encounter.treatmentActivationSubmissionId (unique) +
--     treatmentActivatedAt + FK -> clinical_form_submissions (Contract §3.3).
--   * CareTaskStatus += LOST_TO_FOLLOW_UP (Contract §8).
--   * CareTask.lostToFollowUpAt / lostToFollowUpReason (nullable).
--   * care_task_contact_attempts table (append-only; Contract §8).
--   * care_episodes partial unique index: at most one ACTIVE
--     HEMORRHOID_TREATMENT CareEpisode per (tenantId, patientId) — the final
--     DB guard for the single-active invariant (Contract §4.1). Not
--     expressible in Prisma's schema DSL, enforced here only. A duplicate-
--     active precheck is run before this migration (Contract §10 / §16); if
--     any duplicate exists -> STOP. This DDL is itself fail-closed: it
--     errors rather than applying if a duplicate exists.

-- CreateEnum
CREATE TYPE "EncounterClinicalStatus" AS ENUM ('REGISTERED', 'IN_PROGRESS', 'COMPLETED');

-- AlterEnum
ALTER TYPE "CareTaskStatus" ADD VALUE 'LOST_TO_FOLLOW_UP';

-- AlterTable
ALTER TABLE "encounters"
  ADD COLUMN "clinicalStatus" "EncounterClinicalStatus",
  ADD COLUMN "clinicalStartedAt" TIMESTAMP(3),
  ADD COLUMN "clinicalEndedAt" TIMESTAMP(3),
  ADD COLUMN "treatmentActivationSubmissionId" TEXT,
  ADD COLUMN "treatmentActivatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "care_tasks"
  ADD COLUMN "lostToFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "lostToFollowUpReason" TEXT;

-- CreateTable
CREATE TABLE "care_task_contact_attempts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "careTaskId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_task_contact_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "encounters_treatmentActivationSubmissionId_key" ON "encounters"("treatmentActivationSubmissionId");

-- CreateIndex
CREATE INDEX "care_task_contact_attempts_tenantId_idx" ON "care_task_contact_attempts"("tenantId");

-- CreateIndex
CREATE INDEX "care_task_contact_attempts_tenantId_careTaskId_idx" ON "care_task_contact_attempts"("tenantId", "careTaskId");

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_treatmentActivationSubmissionId_fkey" FOREIGN KEY ("treatmentActivationSubmissionId") REFERENCES "clinical_form_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_task_contact_attempts" ADD CONSTRAINT "care_task_contact_attempts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_task_contact_attempts" ADD CONSTRAINT "care_task_contact_attempts_careTaskId_fkey" FOREIGN KEY ("careTaskId") REFERENCES "care_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual partial unique index (DEC-021 §4.1) — final DB guard for the
-- single-active-Episode invariant. Not expressible in Prisma's schema DSL;
-- deliberately absent from schema.prisma and enforced here only. The
-- application still uses SERIALIZABLE transactions + a count guard and maps
-- uniqueness/serialization conflicts to HTTP 409 with no automatic retry.
CREATE UNIQUE INDEX "care_episodes_one_active_hemorrhoid_per_patient"
ON "care_episodes" ("tenantId", "patientId")
WHERE "episodeType" = 'HEMORRHOID_TREATMENT' AND "status" = 'ACTIVE';
