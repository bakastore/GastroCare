-- DEC-018 — Admin Boundary / User Management v1. STRICTLY ADDITIVE migration.
--
-- Adds one new enum type (AuthUserStatus) and six new columns to auth_users.
-- No column is dropped, renamed, or retyped; no other table is touched; no FK
-- or index on any other model is changed.
--
-- Deterministic backfill for every pre-existing auth_users row:
--   displayName        = NULL   (nullable, no backfill)
--   isClinicAdmin      = false  (column DEFAULT)
--   status             = ACTIVE (column DEFAULT)
--   mustChangePassword = false  (column DEFAULT)
--   sessionVersion     = 0      (column DEFAULT)
--   updatedAt          = createdAt  (explicit backfill below, then the
--                        transient DEFAULT is dropped so the column matches
--                        the Prisma model, which carries @updatedAt and no
--                        @default — the application always supplies it)
--
-- NO heuristic admin backfill: no "first DOCTOR", no "oldest user", no
-- hard-coded UUID, no inferred email. The designated synthetic pilot admin is
-- granted isClinicAdmin explicitly by the pilot seed, not by this migration.
--
-- The pre-existing encounters_roomId_fkey RESTRICT-vs-model drift (present
-- since the original HEAD, reviewed and accepted by the DEC-016 independent
-- audit / Session B) is intentionally NOT reconciled here — that is outside
-- DEC-018 scope and would be a non-additive behavior change.

-- CreateEnum
CREATE TYPE "AuthUserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable — additive columns
ALTER TABLE "auth_users"
  ADD COLUMN "displayName"        TEXT,
  ADD COLUMN "isClinicAdmin"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sessionVersion"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status"             "AuthUserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Deterministic backfill: existing rows get updatedAt = createdAt.
UPDATE "auth_users" SET "updatedAt" = "createdAt";

-- Drop the transient DEFAULT so the column matches the Prisma model
-- (@updatedAt, no @default). New rows are written by the application layer.
ALTER TABLE "auth_users" ALTER COLUMN "updatedAt" DROP DEFAULT;
