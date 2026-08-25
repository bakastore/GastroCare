-- Hemorrhoid Vertical Slice 1 (DEC-010) — additive-safe migration.
--
-- §A: Encounter.doctorId is generalized/renamed to responsibleClinicianId
-- (the clinician clinically responsible for the Encounter, mutable via
-- handover) and a NEW separate createdByUserId column captures pure
-- provenance (the actor who created the row). Historically doctorId WAS
-- both the responsible clinician AND the creating actor (see
-- EncountersService.create pre-migration: doctorId == user.userId of the
-- creating request) — so backfilling createdByUserId from the renamed
-- responsibleClinicianId value is data-preserving and accurate for every
-- existing row, not a guess. Going forward the two fields are never
-- inferred from one another.
--
-- §C: Facility/Room are new physical-location entities, tenant-scoped,
-- distinct from Tenant (the security/customer workspace boundary).
--
-- §B: ClinicianAssignmentHistory is a new append-only provenance table for
-- clinician handover. One row is backfilled per existing Encounter so the
-- assignment history is complete from t=0, not just from this migration
-- forward.

-- Rename doctorId -> responsibleClinicianId (preserves existing data).
ALTER TABLE "encounters" RENAME COLUMN "doctorId" TO "responsibleClinicianId";

-- New pure-provenance column. Backfilled from the (renamed)
-- responsibleClinicianId because pre-migration that value already was the
-- creating actor's id — see comment above. Never inferred this way again
-- after this one-time backfill.
ALTER TABLE "encounters" ADD COLUMN "createdByUserId" TEXT;
UPDATE "encounters" SET "createdByUserId" = "responsibleClinicianId" WHERE "createdByUserId" IS NULL;
ALTER TABLE "encounters" ALTER COLUMN "createdByUserId" SET NOT NULL;

-- Encounter Context (DEC-010 §B): a Receptionist creating the initial
-- context has no clinical content to record yet — clinicalNote/assessment
-- become optional at the application layer, backed by a DB default so
-- existing NOT NULL rows are unaffected and new rows may omit them.
ALTER TABLE "encounters" ALTER COLUMN "clinicalNote" SET DEFAULT '';
ALTER TABLE "encounters" ALTER COLUMN "assessment" SET DEFAULT '';

-- Physical location (DEC-010 §C).
ALTER TABLE "encounters" ADD COLUMN "roomId" TEXT;

-- CreateTable: Facility
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Room
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ClinicianAssignmentHistory
CREATE TABLE "clinician_assignment_history" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "previousClinicianId" TEXT,
    "assignedByUserId" TEXT NOT NULL,
    "reason" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinician_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facilities_tenantId_idx" ON "facilities"("tenantId");
CREATE INDEX "rooms_tenantId_idx" ON "rooms"("tenantId");
CREATE INDEX "rooms_tenantId_facilityId_idx" ON "rooms"("tenantId", "facilityId");
CREATE INDEX "clinician_assignment_history_tenantId_idx" ON "clinician_assignment_history"("tenantId");
CREATE INDEX "clinician_assignment_history_tenantId_encounterId_idx" ON "clinician_assignment_history"("tenantId", "encounterId");
CREATE INDEX "encounters_tenantId_roomId_idx" ON "encounters"("tenantId", "roomId");
CREATE INDEX "encounters_tenantId_responsibleClinicianId_idx" ON "encounters"("tenantId", "responsibleClinicianId");

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinician_assignment_history" ADD CONSTRAINT "clinician_assignment_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinician_assignment_history" ADD CONSTRAINT "clinician_assignment_history_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinician_assignment_history" ADD CONSTRAINT "clinician_assignment_history_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_responsibleClinicianId_fkey" FOREIGN KEY ("responsibleClinicianId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one ClinicianAssignmentHistory row per pre-existing Encounter,
-- recording the initial (pre-migration) responsible-clinician assignment.
-- previousClinicianId is NULL — this is the first recorded assignment for
-- each row, there is no earlier one to reference.
INSERT INTO "clinician_assignment_history"
  ("id", "tenantId", "encounterId", "clinicianId", "previousClinicianId", "assignedByUserId", "reason", "assignedAt")
SELECT
  gen_random_uuid()::text,
  e."tenantId",
  e."id",
  e."responsibleClinicianId",
  NULL,
  e."createdByUserId",
  'backfilled at Hemorrhoid Vertical Slice 1 migration (pre-existing Encounter)',
  e."createdAt"
FROM "encounters" e;
