-- CORE-04 T2 — ClinicalForm Amendment Lineage.
--
-- Adds append-only amendment lineage to ClinicalFormSubmission. This is
-- structural initialization for existing rows, not clinical data:
-- logicalGroupId = own id, revisionNumber = 1. completedByUserId is left
-- NULL deliberately -- the prior actorId recorded who created the DRAFT,
-- not a proven completer, and provenance must never be fabricated.
--
-- Drops the old unconditional unique index on (encounterId, templateKey)
-- (it would block revision >= 2) and replaces it with a partial unique
-- index that enforces exactly one chain root per (Encounter, templateKey)
-- without blocking amendments. Fork protection is a separate, independent
-- unique constraint on previousSubmissionId.

-- 1. Rename submittedAt -> completedAt, preserving existing values.
ALTER TABLE "clinical_form_submissions" RENAME COLUMN "submittedAt" TO "completedAt";

-- 2. Add new lineage/provenance columns (nullable first, for backfill).
ALTER TABLE "clinical_form_submissions"
  ADD COLUMN "logicalGroupId" TEXT,
  ADD COLUMN "revisionNumber" INTEGER,
  ADD COLUMN "previousSubmissionId" TEXT,
  ADD COLUMN "amendmentReason" TEXT,
  ADD COLUMN "amendedByUserId" TEXT,
  ADD COLUMN "completedByUserId" TEXT;

-- 3. Structural backfill for existing rows only.
UPDATE "clinical_form_submissions"
SET "logicalGroupId" = "id", "revisionNumber" = 1
WHERE "logicalGroupId" IS NULL;

-- 4. Enforce NOT NULL now that every row has a value.
ALTER TABLE "clinical_form_submissions" ALTER COLUMN "logicalGroupId" SET NOT NULL;
ALTER TABLE "clinical_form_submissions" ALTER COLUMN "revisionNumber" SET NOT NULL;

-- 5. Drop the old unconditional unique index.
DROP INDEX "clinical_form_submissions_encounterId_templateKey_key";

-- 6. Independent lineage invariants.
CREATE UNIQUE INDEX "clinical_form_submissions_previousSubmissionId_key"
  ON "clinical_form_submissions"("previousSubmissionId");

CREATE UNIQUE INDEX "clinical_form_submissions_logicalGroupId_revisionNumber_key"
  ON "clinical_form_submissions"("logicalGroupId", "revisionNumber");

CREATE INDEX "clinical_form_submissions_logicalGroupId_idx"
  ON "clinical_form_submissions"("logicalGroupId");

-- 7. Partial unique root index: exactly one revisionNumber = 1 root per
-- (Encounter, templateKey). Not expressible via Prisma's schema DSL --
-- deliberately absent from schema.prisma; enforced here only.
CREATE UNIQUE INDEX "clinical_form_submissions_one_chain_root_key"
  ON "clinical_form_submissions" ("encounterId", "templateKey")
  WHERE "revisionNumber" = 1;

-- 8. Fork-protection self-referential foreign key.
ALTER TABLE "clinical_form_submissions"
  ADD CONSTRAINT "clinical_form_submissions_previousSubmissionId_fkey"
  FOREIGN KEY ("previousSubmissionId") REFERENCES "clinical_form_submissions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
