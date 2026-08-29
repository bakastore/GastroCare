# DEC-016 — Bản lưu yêu cầu Owner cung cấp cho Session A

Ngày tiếp nhận: 2026-08-28. Nội dung bên dưới được chép nguyên văn từ attachment Owner; chuẩn hóa xuống dòng thành LF. SHA256 attachment gốc: `f18d96aa0668ebe4dacf5ba1cb8d493c8330d4dbb9382cac4c821f53064b92a9`.

Đây là yêu cầu Owner cho phép dùng khi Contract v0.3 không có trong repository; **không phải tuyên bố đã tìm thấy bản Contract v0.3 đầy đủ bên ngoài**. Ghi chú triển khai nằm ở [13_DEC016_CASE_PATHWAY_IMPLEMENTATION.md](13_DEC016_CASE_PATHWAY_IMPLEMENTATION.md). Chỉ Owner có quyền đổi quyết định.

---

DEC-016 FULL IMPLEMENTATION — CODEX SESSION A

OWNER AUTHORITY
- DEC-016: OWNER LOCKED
- DEC-016 IMPLEMENTATION CONTRACT v0.3: OWNER LOCKED
- Owner authorizes Codex Session A to execute the full implementation package T0 → M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 continuously.
- Do NOT pause for Owner approval between checkpoints when STATUS=PASS and BLOCKERS=NONE.

REPOSITORY
/home/blockchain/projects/gastrocare

EXPECTED BASELINE
Branch:
correction/owner-acceptance-slice1-3

HEAD:
c0dfe1a4f774bef334dd2c2e0eac45f89a2e106b

Expected worktree:
CLEAN

Correction checkpoint C1–C5 + DEC-015:
CLOSED / PASS

IMPORTANT
Read AGENTS.md first.
Then follow its Startup Protocol:
1. docs/PROJECT_STATE.md
2. docs/DECISION_LOG.md
3. docs/07_ROADMAP_AND_GATES.md
4. all task-specific/domain/schema/migration/privacy SSOT required by AGENTS.md

The governing implementation artifact is:
DEC-016 IMPLEMENTATION CONTRACT v0.3.

If that artifact is not inside the repository, use the Owner-locked requirements supplied in this prompt and the existing DEC-016/domain evidence available locally.
Do NOT stop merely because an external convenience copy of the Contract is not stored in Git.

SESSION A ROLE
You are the FULL IMPLEMENTATION EXECUTOR.

Start with T0 READ-ONLY.

T0 must verify:
- branch exactly matches expected branch;
- HEAD exactly matches c0dfe1a4f774bef334dd2c2e0eac45f89a2e106b;
- worktree CLEAN;
- DEC-015 migration exists;
- Encounter.workflowKind exists as expected;
- local DB/environment is synthetic only;
- no unexpected baseline drift.

If T0 PASS:
continue automatically through:

T0
→ M0 Schema foundation + synthetic migration/reconciliation
→ M1 Case backend semantics
→ M2 TreatmentPathway + Longo integration
→ M3 Hemorrhoid Initial + Return under one Case
→ M4 Treatment Decision v2
→ M5 Investigation Core
→ M6 Case Workspace frontend
→ M7 full synthetic acceptance

AUTOMATIC CONTINUATION RULE

After each checkpoint:

STATUS = PASS
AND BLOCKERS = NONE
→ continue immediately to the next checkpoint.

Do NOT ask Owner for routine approval between checkpoints.

STOP only for:
- actual clinical semantic conflict not resolved by DEC-016;
- migration ambiguity;
- >1 authoritative Case candidate where Contract requires STOP;
- rollback/restore failure;
- real-patient data detection;
- tenant isolation/privacy violation;
- unexpected baseline drift;
- material inability to preserve historical/audit data.

IMPLEMENTATION AUTHORITY

You MAY:
- modify backend source;
- modify frontend source;
- modify Prisma schema;
- create Prisma migrations;
- add/update tests;
- update synthetic seed/fixtures;
- run PostgreSQL locally;
- create/drop disposable synthetic databases;
- perform backup/restore;
- implement reconciliation tooling;
- apply reviewed migration to the authorized LOCAL SYNTHETIC dev database after M0 proof PASS;
- run backend/frontend/browser tests;
- update technical documentation required by the implementation;
- execute the entire M0→M7 package without further Owner prompts.

YOU MUST NOT:
- use real-patient data;
- touch production;
- deploy;
- commit;
- push;
- merge;
- tag;
- reset/rewrite Git history;
- open CORE-05;
- implement AI scope;
- implement PDF/image Investigation attachments;
- expand beyond DEC-016;
- fabricate missing clinical semantics.

CRITICAL M0 REQUIREMENTS

M0 is HIGH RISK.

Before M1, prove on a disposable synthetic database:

1. PRE backup/dump + SHA256.
2. Apply DEC-016 schema migration.
3. Explicit reconciliation manifest.
4. Run2 mapping:
   - E1 Hemorrhoid Case retained/reused.
   - A HEMORRHOID_INITIAL re-parented to E1 only by explicit authority/manifest.
   - D/E Returns remain under E1.
   - E2 legacy LONGO_TREATMENT becomes LONGO TreatmentPathway under E1.
   - C Longo Encounter receives Case E1 + corresponding TreatmentPathway.
   - B generic ungrouped Encounter remains ungrouped.
5. 0/1/>1 Case-candidate STOP behavior.
6. NO text heuristic.
7. NO timestamp heuristic.
8. NO patient-name heuristic.
9. NO fabricated Encounter/Form/Diagnosis/Treatment Decision/CarePlan/CareTask.
10. Preserve AuditEvent/history and existing clinical IDs.
11. Preserve legacy timestamps exactly.
12. Destroy rehearsal DB.
13. Restore PRE state and prove signatures/hashes.
14. Reapply migration/reconciliation and prove deterministic result.

If any M0 proof fails:
STOP.
Do NOT continue to M1.

ARCHITECTURE REQUIREMENTS

CareEpisode
- remains physical Case storage in this implementation;
- do NOT introduce a second CareCase table;
- legacy LONGO_TREATMENT rows may remain compatibility/history records;
- prospective direct LONGO_TREATMENT CareEpisode creation must be retired.

TreatmentPathway
- add as child of Case;
- supports MEDICAL / PROCEDURE / SURGERY;
- surgery methodCode supports:
  LONGO
  MILLIGAN_MORGAN
  FERGUSON
  HCPT
  LASER_DIODE_LHP
  THD_HAL_RAR
- multiple pathways per Case allowed;
- multiple major procedures/surgeries per Case allowed;
- backend must NEVER implicitly default methodCode=LONGO.

Encounter
- episodeId = Case ancestry;
- add optional treatmentPathwayId;
- if pathway exists:
  same tenant,
  same Case,
  same patient ancestry.

Longo
- six existing Longo form families remain;
- Longo form ancestry becomes Case + SURGERY/LONGO TreatmentPathway;
- do not attach Longo forms to non-Longo pathways.

CareTask
- do NOT duplicate caseId/pathwayId onto CareTask unless actual source constraints make Contract impossible;
- Longo task identity should derive:
  sourceEncounterId
  → Encounter.treatmentPathwayId
- completion must match exact TreatmentPathway + exact timepointCode.
- Two LONGO pathways inside one Case MUST NOT cross-complete Month-1/3/6 tasks.

Hemorrhoid Initial
- disease-specific Initial workflow creates/uses Case immediately;
- workflowKind = HEMORRHOID_INITIAL;
- do NOT infer from reason text;
- generic Encounter remains capable of episodeId=null.

Return
- Return requires/reuses existing ACTIVE Hemorrhoid Case;
- Return does NOT create Case;
- CareTask completion + Return Encounter remain atomic;
- preserve Serializable close-vs-Return conflict safety;
- no automatic transaction retry.

Treatment Decision v2
- same template key, version 2;
- treatmentModalities: multi-select
  MEDICAL
  PROCEDURE
  SURGERY
- decisionSummary required;
- MEDICAL selected → medicalCareSetting required;
- PROCEDURE selected → procedureCareSetting required;
- SURGERY care setting is HOSPITAL invariant;
- if careSetting exists while corresponding modality is absent:
  REJECT HTTP 400;
- DRAFT may remain partial;
- COMPLETE/AMEND enforce conditions;
- implement template-specific server validation;
- do NOT create generic conditional FieldDef DSL;
- completing Treatment Decision does NOT automatically create TreatmentPathway.

NURSE
Add AuthRole.NURSE.

NURSE:
- may read minimum patient/Case/Investigation context required for assigned workflow;
- may enter raw Investigation Result;
- may NOT create Diagnosis;
- may NOT create Treatment Decision;
- may NOT gain broad DOCTOR ClinicalForm permissions.

Investigation
Implement:
- Investigation
- InvestigationOrder
- InvestigationResult

Support:
- INTERNAL_CURRENT
- ECOSYSTEM_PRIOR
- EXTERNAL_PRIOR

Parent Investigation relation must be explicit:
- same tenant;
- same patient/Case;
- no text/time inference;
- cycles rejected.

Prior evidence may have Result without fabricated local Order.

Raw Result is data, not clinical interpretation.

PDF/image attachment:
DEFERRED OUTSIDE DEC-016 v1.
Do NOT implement file/object storage.

Frontend
Case-centric workspace:

Tổng quan
Khám
CLS
Điều trị
Theo dõi
Lịch sử

Remove patient-level direct standalone Longo start capability.

Longo may be preselected in UI for BS Thái but frontend must explicitly submit LONGO.
Backend must never infer/default it.

M7 TARGETED ACCEPTANCE

Include at minimum:

1. Initial Hemorrhoid → Case + Initial Encounter.
2. Generic Encounter reason containing “trĩ” remains generic.
3. Investigation Order → Result.
4. Explicit parent-child Investigation.
5. Treatment Decision with MEDICAL + SURGERY concurrently.
6. Multiple TreatmentPathways in one Case.
7. LONGO explicit value, no backend default.
8. Longo preop/intraop/postop under Case + Pathway.
9. Follow-up task pathway identity.
10. Two LONGO pathways cannot cross-complete same timepoint.
11. Return #1/#2 reuse same Case.
12. Close/reopen + close-vs-Return concurrency.
13. Migrated Run2 shows one Hemorrhoid Case with nested legacy Longo pathway, not peer Cases.
14. Generic B stays ungrouped.
15. No fabricated Diagnosis/Treatment Decision for legacy history.

FULL REGRESSION AT M7
- prisma validate
- migrate status
- backend full E2E
- frontend full tests
- backend build
- frontend build/typecheck
- browser E2E/regression
- backup/restore
- privacy/PII scan
- git diff --check

Do not hard-code historical test counts.
Report actual counts.

AFTER M7

Do NOT commit/push.

Return ONE FINAL IMPLEMENTATION REPORT:

STATUS

BASELINE

FILES CHANGED

MIGRATIONS

TESTS
- M0 proof
- backend
- frontend
- browser
- backup/restore
- privacy/PII
- git diff --check

FINDINGS

BLOCKERS

GIT STATUS

NEXT GATE:
FRESH CODEX SESSION B — INDEPENDENT READ-ONLY AUDIT

Important:
Session A may test its work but MUST NOT call itself an independent auditor.
