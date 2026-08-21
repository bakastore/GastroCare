# GastroCare

Status: GREENFIELD / Documentation Baseline v1.0 — OWNER ACCEPTED (Gate 1 CLOSED). Phase FOUNDATION — COMPLETE (Gate 2 Technical Foundation OWNER ACCEPTED, CLOSED). Phase GASTROCARE CORE — IN PROGRESS: CORE-01 (Clinical Core Walking Skeleton) OWNER ACCEPTED, CLOSED. Awaiting Owner authorization for the next GASTROCARE CORE work package (e.g. CORE-02).

No production application, database, or deployment exists yet — real patient data and production remain NOT AUTHORIZED. `backend/` now contains the Gate 2 technical foundation (auth, tenant isolation, migration review process) plus the CORE-01 Clinical Core Walking Skeleton (Patient, Encounter, CarePlan/CarePlanVersion, CareTask, AuditEvent, minimal DOCTOR/RECEPTIONIST RBAC), built against synthetic data only. No frontend and no AI functionality exist.

Current authoritative material is under `docs/`. See `CONTRIBUTING.md` for the migration review process.

See first:

1. `docs/PROJECT_STATE.md`
2. `docs/00_PROJECT_OVERVIEW.md`
3. `docs/DECISION_LOG.md`
