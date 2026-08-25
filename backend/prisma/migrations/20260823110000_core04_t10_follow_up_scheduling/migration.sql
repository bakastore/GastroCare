-- CORE-04 T10 — Follow-up Scheduling.
--
-- CareTask.carePlanId becomes optional: a Longo follow-up CareTask is
-- generated directly from a completed Surgery Encounter, not from a
-- CarePlan. sourceEncounterId is the Surgery Encounter that generated the
-- schedule (the sole postoperative timing anchor is that Encounter's
-- occurredAt — never stored redundantly here). timepointCode identifies
-- TWO_WEEK/MONTH_1/MONTH_3/MONTH_6. completedByEncounterId is set only when
-- a matching real visit Encounter's form completion is matched to this
-- task. scheduleReviewRequired defaults to false and is never silently
-- cleared by a reschedule.
--
-- episodeId is deliberately NOT added to care_tasks — the Episode is always
-- inferred via sourceEncounterId -> Encounter.episodeId, per the
-- "no episodeId duplication onto CareTask" invariant
-- (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md §3).
--
-- The unique index on (sourceEncounterId, timepointCode) is what makes
-- follow-up generation idempotent: Postgres unique indexes treat NULL as
-- distinct, so pre-existing non-Longo CareTasks (both columns NULL) are
-- unaffected.

-- DropForeignKey
ALTER TABLE "care_tasks" DROP CONSTRAINT "care_tasks_carePlanId_fkey";

-- AlterTable
ALTER TABLE "care_tasks"
  ADD COLUMN "completedByEncounterId" TEXT,
  ADD COLUMN "scheduleReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceEncounterId" TEXT,
  ADD COLUMN "timepointCode" TEXT,
  ALTER COLUMN "carePlanId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "care_tasks_tenantId_sourceEncounterId_idx" ON "care_tasks"("tenantId", "sourceEncounterId");

-- CreateIndex
CREATE UNIQUE INDEX "care_tasks_sourceEncounterId_timepointCode_key" ON "care_tasks"("sourceEncounterId", "timepointCode");

-- AddForeignKey
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_carePlanId_fkey" FOREIGN KEY ("carePlanId") REFERENCES "care_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_sourceEncounterId_fkey" FOREIGN KEY ("sourceEncounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_completedByEncounterId_fkey" FOREIGN KEY ("completedByEncounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
