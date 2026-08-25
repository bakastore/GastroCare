-- CORE-04 T16 remediation R1 — deterministic AuditEvent append-order.
--
-- createdAt is wall-clock and not a reliable ordering key: same-millisecond
-- collisions, timer/clock granularity, clock skew, and restore/replay can
-- all produce createdAt ties or non-monotonic values for rows that were
-- still appended in a strict order. This adds `seq`, a DB-assigned
-- monotonic sequence (Postgres SERIAL, assigned at insert time, independent
-- of wall-clock), as the sole column that may be used to assert
-- causal/append order of AuditEvents.
--
-- Purely additive: no existing column is altered/dropped, no data is
-- rewritten, no invariant outside "how do we order audit rows" changes.
-- Backward compatible — every pre-existing row is backfilled by SERIAL with
-- values in insertion order (Postgres assigns them in primary-key/physical
-- row order for an ADD COLUMN ... SERIAL, which for this table matches
-- historical createdAt insertion order since rows are only ever appended,
-- never reordered or rewritten).
ALTER TABLE "audit_events" ADD COLUMN     "seq" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_seq_key" ON "audit_events"("seq");
