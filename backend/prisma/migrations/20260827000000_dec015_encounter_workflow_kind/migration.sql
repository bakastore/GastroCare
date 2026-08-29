-- DEC-015 M0 — additive-only migration. Adds a generic, nullable Encounter
-- workflow-identity extension point (Encounter.workflowKind). v1 defines
-- exactly one enum value, HEMORRHOID_INITIAL.
--
-- Strictly additive: a new PostgreSQL enum type + a new NULLABLE column with
-- NO DEFAULT. There is NO UPDATE/backfill — every pre-existing Encounter row
-- keeps workflowKind = NULL. No FK, no index, no change to any other column
-- (episodeId, source, etc.). Longo / Hemorrhoid Return workflow identity keeps
-- deriving from CareEpisode.episodeType and is NOT duplicated here.

-- CreateEnum
CREATE TYPE "EncounterWorkflowKind" AS ENUM ('HEMORRHOID_INITIAL');

-- AlterTable
ALTER TABLE "encounters" ADD COLUMN     "workflowKind" "EncounterWorkflowKind";
