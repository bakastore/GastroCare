-- CORE-04 T1 contract migration.
-- Do not infer clinical event time. This migration deliberately fails if any
-- Encounter was not recreated/reseeded with an explicit occurredAt value.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "encounters" WHERE "occurredAt" IS NULL) THEN
    RAISE EXCEPTION 'CORE-04 T1 contract blocked: encounters.occurredAt contains NULL values';
  END IF;
END $$;

ALTER TABLE "encounters" ALTER COLUMN "occurredAt" SET NOT NULL;
