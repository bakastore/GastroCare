-- DEC-021 Package R — R9 focused correction (finding 3).
--
-- Concurrent `POST /encounters/:id/accept-handover` requests for the same
-- latest ClinicianAssignmentHistory row must not be able to append two
-- ENCOUNTER_HANDOVER_ACCEPTED AuditEvents (§6.3 idempotency). The read-then-
-- create check in the service is a fast path only; this partial unique index
-- is the final concurrency guard. Not expressible in Prisma's schema DSL, so
-- it lives only here (same pattern as care_episodes_one_active_hemorrhoid_
-- per_patient). A duplicate insert now fails with a uniqueness violation,
-- which the service maps to "already accepted" (no new event, no error to
-- the client). Additive only; no existing row is affected (there is at most
-- one such row per assignment today).

CREATE UNIQUE INDEX "audit_events_one_handover_acceptance_per_assignment"
ON "audit_events" ("tenantId", "entityType", "entityId")
WHERE "action" = 'ENCOUNTER_HANDOVER_ACCEPTED';
