# GASTROCARE — HEMORRHOID VERTICAL SLICE 2 IMPLEMENTATION CONTRACT v0.1

**Loại tài liệu:** Implementation Contract (hợp đồng triển khai)

**Phiên bản:** 0.1

**Trạng thái:** OWNER LOCKED

**Ngày:** 2026-08-25

**Work package:** `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2`

**Current branch:** `discovery/hemorrhoid-real-world-workflow`

**Discovery baseline:** `eeadfc31ed9819e06fb80c545573a4bba76d952a`

**Clinical SSOT:** `docs/10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md`

**Owner Decision:** `DEC-012 — OWNER LOCKED`

**Implementation status:** `AUTHORIZED FOR IMPLEMENTATION`

**Real-patient runtime:** `NOT AUTHORIZED`

**Implementation/test data:** `SYNTHETIC DATA ONLY`

---

## 1. Purpose and authority

Contract chuyển DEC-012 thành implementation boundary, task sequence và acceptance gates. Implementation được phép tuần tự T0→T7; không cần Owner checkpoint giữa từng task nếu không gặp Stop Condition. Không commit/push nếu Owner chưa cho phép riêng.

Thứ bậc: Newest Owner Decision > Hemorrhoid SSOT > this Contract > Project State > existing implementation > assumptions/recommendations.

## 2. Objective

`Hemorrhoid Examination → Diagnosis → Treatment Decision → CarePlan → Follow-up → Return Encounter`.

Không mở Procedure/Surgery/Investigation/AI/CORE-05.

## 3. Locked semantics

Diagnosis: `1 Encounter → 1 HEMORRHOID_DIAGNOSIS logical chain`; `diagnosisSummary` REQUIRED free text; không coding/taxonomy/inference.

Treatment Decision: `1 Encounter → 1 HEMORRHOID_TREATMENT_DECISION logical chain`; `decisionSummary` REQUIRED free text; không taxonomy; `Treatment Decision ≠ Procedure performed ≠ Surgery performed`.

Sequence backend-authoritative: `HEMORRHOID_EXAMINATION COMPLETED → HEMORRHOID_DIAGNOSIS COMPLETED → HEMORRHOID_TREATMENT_DECISION COMPLETED → CarePlan → CarePlan SIGNED`.

General Hemorrhoid CarePlan có `0..1` next clinical follow-up target. Return Encounter matching explicit only.

## 4. Reuse/schema boundary

Reuse `Encounter`, `ClinicalFormSubmission`, `CarePlan`, `CarePlanVersion`, `CareTask`, `AuditEvent`, Patient Timeline.

Diagnosis/Treatment Decision dùng `ClinicalFormSubmission`.

Không tạo Diagnosis, TreatmentDecision, HemorrhoidFollowUp hoặc TimelineEvent table.

Expected: `schema.prisma NO CHANGE`; `prisma/migrations/ NO NEW MIGRATION`.
Nếu migration cần: STOP + Owner Decision.

## 5. Preserve Core invariants

ClinicalFormSubmission: DRAFT→COMPLETED; completed immutable; amendment append-only; one logical root/Encounter+templateKey; full corrected snapshot.
CarePlan: 1:1 Encounter; DRAFT→SIGNED; signed versions append-only.
CareTask: OPEN/COMPLETED/CANCELLED; OVERDUE derived.
AuditEvent append-only; không dump clinical text vào metadata.
Timeline read projection. Tenant/RBAC/same-patient ancestry giữ nguyên.

## 6. HEMORRHOID_DIAGNOSIS v1

Template: `HEMORRHOID_DIAGNOSIS`, version 1, displayName `Chẩn đoán`.
Field: `diagnosisSummary`, textarea, required=true. Không maxLength y khoa chưa khóa; không score/coding.
Create root chỉ khi cùng Encounter có completed HEMORRHOID_EXAMINATION.
Tests: valid create/complete; missing summary; prerequisite reject; one chain; amendment; original immutable; tenant isolation.

## 7. HEMORRHOID_TREATMENT_DECISION v1

Template: `HEMORRHOID_TREATMENT_DECISION`, version 1, displayName `Quyết định điều trị`.
Field: `decisionSummary`, textarea, required=true. Không taxonomy.
Create root chỉ khi cùng Encounter có completed HEMORRHOID_DIAGNOSIS.
Không automatic action từ decisionSummary.
Tests tương đương T1.

## 8. CarePlan sequence

Hemorrhoid CarePlan create chỉ khi completed HEMORRHOID_TREATMENT_DECISION cùng Encounter. Sign phải re-check prerequisite. Không làm hỏng unrelated Core flow.
Không dùng Encounter.assessment làm Diagnosis source; không dùng CarePlan.instructions làm Diagnosis/Treatment Decision source.

## 9. Follow-up cardinality

General Hemorrhoid v1: `0..1 OPEN generic follow-up CareTask per CarePlan`.
Generic task: `carePlanId != null`, `timepointCode = null`; không Longo timepoints.
Historical CLOSED tasks giữ nguyên.
Nếu authoritative transaction thấy >1 OPEN generic task → 409; không tự chọn/normalize.

## 10. CarePlan sign

followUpDate null → không task. Non-null → tạo một OPEN CareTask với carePlanId/patientId/dueDate/type FOLLOW_UP. Không multi-timepoint schedule.

## 11. Signed CarePlan amendment request

Bắt buộc `expectedCurrentVersionId`; optional `followUpTaskAction`, `followUpTaskReason`.
Stale expected version → 409.
Allowed actions: `RESCHEDULE`, `CANCEL`, `KEEP_WITH_REASON`. Không skipTaskUpdate boolean. KEEP_WITH_REASON bắt buộc reason.

## 12. CD-08 transition matrix

Unchanged date: no action required.
null→date: nếu không OPEN task thì CREATE trong transaction; nếu OPEN task bất ngờ tồn tại → 409.
date1→date2: OPEN task → action required; RESCHEDULE sets dueDate; KEEP_WITH_REASON keeps task; CANCEL invalid khi new followUpDate non-null.
date→null: OPEN task → CANCEL hoặc KEEP_WITH_REASON; RESCHEDULE invalid.
Closed historical task không rewrite/reopen; new future intent → create new OPEN generic task.

## 13. T4 transaction/concurrency — BLOCKING INVARIANT

Dùng Prisma interactive transaction với `isolationLevel = Serializable`.
Không authoritative query-then-write ngoài transaction.
Trong transaction re-read CarePlan, currentVersionId, current signed CarePlanVersion, linked OPEN generic CareTask(s).

Flow: BEGIN SERIALIZABLE → verify expectedCurrentVersionId → load OPEN task state → validate matrix → create CarePlanVersion N+1 → update CarePlan currentVersion/content/followUpDate → reconcile CareTask → write CARE_PLAN_AMENDED using tx → write CARE_PLAN_FOLLOW_UP_RECONCILED using tx → COMMIT.

Any failure → ROLLBACK ALL.
Serialization/write conflict (bao gồm Prisma P2034 nếu runtime trả mã này) → 409 Conflict. Không automatic retry clinical amendment. Caller reload; clinician chủ động retry.

Invariant: concurrent amendments against same observed state: at most one commit. No last-write-wins, no CarePlanVersion fork, no duplicate OPEN task, no duplicate user intent.

## 14. Audit

T4 audit nằm trong same transaction; dùng `AuditService.record(..., tx)`.
Actions tối thiểu: CARE_PLAN_AMENDED, CARE_PLAN_FOLLOW_UP_RECONCILED.
Metadata chỉ operation metadata/IDs/dates/action/reason; không diagnosisSummary/decisionSummary/instructions.

## 15. Generic CareTask reschedule

Bổ sung generic reschedule vào CareTasksService; DOCTOR-only; same tenant; OPEN only; update dueDate + CARE_TASK_RESCHEDULED audit.
Operational reschedule không amend CarePlan. CarePlan.followUpDate = signed clinical intent; CareTask.dueDate = current operational schedule.
Không refactor Longo nếu không cần.

## 16. Return Encounter explicit linkage

Extend generic CareTask completion bằng optional `completedByEncounterId`.
Validate task/Encounter same tenant, same patient, task OPEN. Then status COMPLETED + completedAt + completedByEncounterId.
Audit metadata chứa completedByEncounterId. Không auto-select/infer Encounter. Existing manual completion giữ nguyên.

## 17. Timeline

Không tạo Timeline entity. Reuse PatientsService.getTimeline(). Map rõ HEMORRHOID_DIAGNOSIS→Chẩn đoán và HEMORRHOID_TREATMENT_DECISION→Quyết định điều trị. Giữ revision lineage. Có thể project summary từ responses nhưng không duplicate storage.

## 18. RBAC

DOCTOR-only cho Diagnosis, Treatment Decision, CarePlan clinical actions, generic CareTask clinical/return-link actions, Timeline. Không mở clinical write cho Receptionist; giữ Slice 1 administrative permissions.

## 19. Frontend

Ưu tiên generic Clinical Form renderer. Golden path: Examination complete → Diagnosis complete → Treatment Decision complete → CarePlan create/sign → Follow-up → Return Encounter → explicit CareTask completion. UI phản ánh prerequisite nhưng backend authority. Hỗ trợ amendment và CD-08 reconciliation. Không Procedure/Surgery UI.

## 20. Error behavior

Reject rõ: prerequisite violations; stale expectedCurrentVersionId; changed followUpDate thiếu action; KEEP_WITH_REASON thiếu reason; invalid action/date; >1 OPEN generic task; cross-tenant/patient return link; serialization/write conflict→409. Không silent normalize.

## 21. T4 concurrency tests — MANDATORY

Dùng PostgreSQL thật trên disposable synthetic test DB, không mock away concurrency.

C1 concurrent null→date: exactly one commit, loser 409, one new committed CarePlanVersion, exactly one OPEN generic task, no duplicate audit lineage.
C2 concurrent date1→date2: at most one commit, loser 409, one authoritative dueDate, no lost update/duplicate OPEN task.
C3 concurrent amendment lineage: two requests same expectedCurrentVersionId; only one committed successor; no fork; loser 409.
C4 rollback proof: forced failure after version insert but before reconciliation/audit; after rollback no new version/currentVersion change/task change/audit.

## 22. Task sequence

T0 Preflight read-only → READY FOR T1.
T1 Diagnosis template/prerequisite/tests → T1 PASS.
T2 Treatment Decision template/prerequisite/tests → T2 PASS.
T3 CarePlan sequence enforcement → T3 PASS.
T4 reconciliation/concurrency §§11–14 + C1–C4 → targeted tests PASS → ChatGPT source review PASS → fresh Independent Codex READ-ONLY T4 audit → `READY FOR T4 ACCEPTANCE: YES`. Audit only T4. FAIL → targeted correction/verification/focused re-check. If T4 production code changes after PASS, gate reopens for affected delta.
T5 generic CareTask reschedule + explicit Return Encounter linkage → T5 PASS.
T6 Timeline + frontend → T6 PASS.
T7 targeted synthetic acceptance → SLICE 2 TARGETED ACCEPTANCE PASS.

## 23. T7 golden path

1 synthetic Patient; 2 Hemorrhoid Encounter Context; 3 complete Examination; 4 create/complete Diagnosis; 5 create/complete Treatment Decision; 6 create CarePlan with followUpDate; 7 sign; 8 verify one OPEN task; 9 amend with RESCHEDULE + expectedCurrentVersionId; 10 verify version lineage; 11 verify dueDate; 12 create Return Encounter; 13 explicit task completion; 14 verify completedByEncounterId; 15 verify Timeline; 16 amend Diagnosis and preserve original; 17 verify Procedure/Surgery/AI/CORE-05 absent.

Negative: Diagnosis before Examination; Treatment before Diagnosis; CarePlan before Treatment; stale expectedCurrentVersionId; silent drift; cross-patient completion — all reject.

## 24. Validation strategy

Minimum: backend build; targeted Slice 2 E2E; relevant ClinicalForm/CarePlan/CareTask regressions; T4 real-Postgres concurrency tests; frontend unit/build if changed; browser golden path if UI changed; git diff --check.
Không rerun backup/restore nếu schema/migration/backup/restore assumptions unchanged. Schema/migration change → STOP.

## 25. Review strategy

Default reviewer ChatGPT. T1/T2/T3/T5/T6: ChatGPT source review + relevant tests. T4: MANDATORY fresh Independent Codex READ-ONLY audit after implementation/tests/ChatGPT review. Không review chain. Không full-Slice independent audit nếu không risk mới/Owner request.

## 26. Acceptance criteria

1 Diagnosis lifecycle; 2 Treatment lifecycle; 3 backend sequence; 4 no new Diagnosis/Treatment entities; 5 no migration; 6 CarePlan reuse; 7 0..1 OPEN task; 8 expectedCurrentVersionId; 9 T4 Serializable atomicity; 10 conflict→409/no retry; 11 no lost update/fork/>1 OPEN; 12 T4 Codex gate PASS; 13 Return Encounter linkage; 14 Timeline projection; 15 audit provenance; 16 RBAC; 17 related Longo behavior; 18 deferred scope intact; 19 synthetic targeted acceptance PASS; 20 real-patient runtime NOT AUTHORIZED.

## 27. Stop conditions

STOP nếu cần migration/Diagnosis entity/TreatmentDecision entity/clinical semantics/ICD-taxonomy/inferred diagnosis/heuristic return match/Procedure-Surgery/Longo semantic change; nếu không map được serialization conflict→409; nếu correctness cần automatic retry; nếu phát hiện real-patient data; hoặc có Owner question mới.

## 28. Deliverable report

STATUS; BASELINE; FILES CHANGED; SCHEMA/MIGRATION NO CHANGE expected; T1–T7; T4 INDEPENDENT GATE STATUS; TESTS ACTUALLY RUN; FAILURES/WARNINGS; SCOPE EXCLUSIONS; WORKTREE STATUS; NO SELF-CERTIFICATION AS INDEPENDENT AUDIT.

Không commit/push nếu Owner chưa cho phép riêng.
