-- DEC-019 — Staff Profile & Credential Management v1.
--
-- Additive only. Adds four independent tenant-scoped tables:
--   staff_profiles, staff_credentials, employment_history,
--   staff_facility_assignments
-- plus their enums. No backfill: existing AuthUsers have no StaffProfile until
-- one is explicitly created. No column is added to, renamed on, or dropped from
-- any existing table.
--
-- The pre-existing encounters_roomId_fkey RESTRICT-vs-model drift (present
-- since the original HEAD, reviewed and accepted by the DEC-016 independent
-- audit / Session B, and left untouched by DEC-018 for the same reason) is
-- intentionally NOT reconciled here — that is outside DEC-019 scope and would
-- be a non-additive behavior change. Prisma's create-only generator emitted a
-- DROP/ADD FOREIGN KEY pair for it; both lines were removed by hand.
--
-- The two PARTIAL UNIQUE INDEXES at the bottom of this file are the DEC-019
-- facility-assignment concurrency guard. Prisma 6.x schema DSL cannot express
-- a partial unique index, so they are absent from schema.prisma and appended
-- here manually (real PostgreSQL camelCase column identifiers):
--   * one_active_primary       — at most one active (endDate IS NULL) primary
--                                assignment per staffProfileId
--   * one_active_per_facility  — at most one active assignment per
--                                (staffProfileId, facilityId)
-- Ended rows (endDate IS NOT NULL) are excluded from both predicates, so a
-- historical ended row never blocks a later rejoin and may keep isPrimary=true.

-- CreateEnum
CREATE TYPE "StaffSpecialty" AS ENUM ('GASTROENTEROLOGY', 'COLORECTAL_SURGERY', 'GENERAL_SURGERY', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffCredentialType" AS ENUM ('LICENSE', 'CERTIFICATE', 'TRAINING');

-- CreateEnum
CREATE TYPE "StaffCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'COLLABORATOR');

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "professionalTitle" TEXT,
    "workPhone" TEXT,
    "primarySpecialty" "StaffSpecialty",
    "secondarySpecialties" "StaffSpecialty"[],
    "specialtyOtherLabel" TEXT,
    "biography" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_credentials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "credentialType" "StaffCredentialType" NOT NULL,
    "name" TEXT NOT NULL,
    "credentialNumber" TEXT,
    "issuingOrganization" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE,
    "status" "StaffCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_history" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "department" TEXT,
    "positionTitle" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "employmentType" "EmploymentType",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_facility_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_facility_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_authUserId_key" ON "staff_profiles"("authUserId");

-- CreateIndex
CREATE INDEX "staff_profiles_tenantId_idx" ON "staff_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "staff_credentials_tenantId_idx" ON "staff_credentials"("tenantId");

-- CreateIndex
CREATE INDEX "staff_credentials_tenantId_staffProfileId_idx" ON "staff_credentials"("tenantId", "staffProfileId");

-- CreateIndex
CREATE INDEX "employment_history_tenantId_idx" ON "employment_history"("tenantId");

-- CreateIndex
CREATE INDEX "employment_history_tenantId_staffProfileId_idx" ON "employment_history"("tenantId", "staffProfileId");

-- CreateIndex
CREATE INDEX "staff_facility_assignments_tenantId_idx" ON "staff_facility_assignments"("tenantId");

-- CreateIndex
CREATE INDEX "staff_facility_assignments_tenantId_staffProfileId_idx" ON "staff_facility_assignments"("tenantId", "staffProfileId");

-- CreateIndex
CREATE INDEX "staff_facility_assignments_tenantId_facilityId_idx" ON "staff_facility_assignments"("tenantId", "facilityId");

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_facility_assignments" ADD CONSTRAINT "staff_facility_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_facility_assignments" ADD CONSTRAINT "staff_facility_assignments_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_facility_assignments" ADD CONSTRAINT "staff_facility_assignments_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual partial unique indexes (DEC-019 T1.6) — NOT expressible in Prisma 6.x
-- schema DSL; deliberately absent from schema.prisma and enforced here only.
-- These are the final concurrency guard for the "one active primary" and
-- "one active assignment per facility" invariants (no SERIALIZABLE, no retry;
-- a violation / Prisma P2002 is mapped to HTTP 409 Conflict).
CREATE UNIQUE INDEX "staff_facility_assignments_one_active_primary"
ON "staff_facility_assignments" ("staffProfileId")
WHERE "isPrimary" = true AND "endDate" IS NULL;

CREATE UNIQUE INDEX "staff_facility_assignments_one_active_per_facility"
ON "staff_facility_assignments" ("staffProfileId", "facilityId")
WHERE "endDate" IS NULL;
