# GastroCare

Status: GREENFIELD / Documentation Baseline v1.0 — OWNER ACCEPTED (Gate 1 CLOSED). Phase FOUNDATION — COMPLETE (Gate 2 Technical Foundation OWNER ACCEPTED, CLOSED). Phase GASTROCARE CORE — IN PROGRESS: CORE-01 (Clinical Core Walking Skeleton) OWNER ACCEPTED, CLOSED. CORE-02 (Doctor Experience / Web UI v0.1) OWNER ACCEPTED, CLOSED. Awaiting Owner authorization for the next GASTROCARE CORE work package.

No production application, database, or deployment exists yet — real patient data and production remain NOT AUTHORIZED. `backend/` contains the Gate 2 technical foundation (auth, tenant isolation, migration review process) plus the CORE-01 Clinical Core Walking Skeleton (Patient, Encounter, CarePlan/CarePlanVersion, CareTask, AuditEvent, minimal DOCTOR/RECEPTIONIST RBAC). `frontend/` (new in CORE-02) is a React + TypeScript + Vite Web UI over that same API — login, role-aware navigation, Doctor "Hôm nay", Patient search/registration with duplicate warning (no auto-merge), Doctor clinical workspace (Encounter, CarePlan draft/sign/amend, Timeline), Follow-up queue, and a Receptionist boundary enforced by the backend. Built and tested against synthetic data only — no AI functionality exists. See `frontend/e2e/run-e2e.sh` for the browser E2E suite.

Current authoritative material is under `docs/`. See `CONTRIBUTING.md` for the migration review process.

See first:

1. `docs/PROJECT_STATE.md`
2. `docs/00_PROJECT_OVERVIEW.md`
3. `docs/DECISION_LOG.md`
