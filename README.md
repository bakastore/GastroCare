# GastroCare

Status: GREENFIELD / Documentation Baseline v1.0 — OWNER ACCEPTED (Gate 1 CLOSED). Phase FOUNDATION — COMPLETE (Gate 2 Technical Foundation OWNER ACCEPTED, CLOSED). Phase GASTROCARE CORE — IN PROGRESS: CORE-01 (Clinical Core Walking Skeleton) OWNER ACCEPTED, CLOSED. CORE-02 (Doctor Experience / Web UI v0.1) OWNER ACCEPTED, CLOSED. CORE-03 (Pilot Readiness & Operational Hardening) OWNER ACCEPTED, CLOSED. CORE-03 Real-World Clinical Form Alignment v0.1 (Clinical Forms backend + frontend + backup/restore regression + browser E2E) OWNER ACCEPTED — final independent technical audit PASSED: backend 99/99, frontend 20/20, browser 4/4 stable across two consecutive full-suite runs, backup/restore PASS (see design/REAL_WORLD_FORM_ALIGNMENT.md). This does not close the GASTROCARE CORE phase; further work packages require new Owner authorization.

No production application, database, or deployment exists yet — real patient data and production remain NOT AUTHORIZED. `backend/` contains the Gate 2 technical foundation (auth, tenant isolation, migration review process), the CORE-01 Clinical Core Walking Skeleton (Patient, Encounter, CarePlan/CarePlanVersion, CareTask, AuditEvent, minimal DOCTOR/RECEPTIONIST RBAC), CORE-03 hardening regression suites, and a CORE-03 Clinical Forms module (`ClinicalFormSubmission`, DOCTOR-only, code-configured templates — see `backend/src/clinical-forms`) implemented from real-world clinical form structural discovery (`design/REAL_WORLD_FORM_ALIGNMENT.md`; real source documents were used only as read-only local design evidence via a privacy-safe pipeline, never imported into the application). `frontend/` (CORE-02, hardened in CORE-03) is a React + TypeScript + Vite Web UI over that same API — login, role-aware navigation, Doctor "Hôm nay", Patient search/registration with duplicate warning (no auto-merge), Doctor clinical workspace (Encounter, CarePlan draft/sign/amend, Clinical Forms, Timeline), Follow-up queue, and a Receptionist boundary enforced by the backend. Built and tested against synthetic data only — no AI functionality exists. See `frontend/e2e/run-e2e.sh` for the browser E2E suite, and `OPERATIONS.md` for local operations plus an Owner Synthetic Dry Run and backup/restore verification procedure.

Current authoritative material is under `docs/`. See `CONTRIBUTING.md` for the migration review process.

See first:

1. `docs/PROJECT_STATE.md`
2. `docs/00_PROJECT_OVERVIEW.md`
3. `docs/DECISION_LOG.md`
