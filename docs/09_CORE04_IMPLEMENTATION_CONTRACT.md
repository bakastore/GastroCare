# GASTROCARE — CORE-04 IMPLEMENTATION CONTRACT v0.3.1

**Loại tài liệu:** Implementation Contract (hợp đồng triển khai)

**Phiên bản:** 0.3.1

**Trạng thái:** OWNER LOCKED

**Ngày:** 23/08/2026

**Work package:** `CORE-04 — REAL-WORLD CLINICAL WORKFLOW`

**Branch:** `core/core-04-real-world-clinical-workflow`

**Branch baseline:** `161b46b9a4c4d77cf6f66bb487b9dc38b1bdfbc5`

**Technical Core baseline:** `1a95f57f0b19bddbfcd817101d5c0c1135d90686` (`technical-core-v0.1`)

**Clinical SSOT:** [`08_LONGO_CLINICAL_WORKFLOW_v1.0.md`](08_LONGO_CLINICAL_WORKFLOW_v1.0.md)

**Implementation status:** NOT STARTED

**Real-patient runtime:** NOT AUTHORIZED

**Dữ liệu triển khai/kiểm thử/nghiệm thu:** SYNTHETIC DATA ONLY

---

## 1. Mục đích và thẩm quyền

Tài liệu này chuyển Longo Clinical Workflow v1.0 đã `OWNER LOCKED` thành thứ tự triển khai và tiêu chí kiểm chứng cho CORE-04. Tài liệu này không mở lại quyết định lâm sàng, không thay thế SSOT 08 và không cho phép triển khai ngoài phạm vi đã khóa.

Khi có xung đột, áp dụng thứ bậc:

```text
Newest explicit Owner Decision
> Previous Owner Decision
> Verified Project State
> Approved Baseline
> Working Assumption
> AI Recommendation
```

Các chi tiết triển khai được phép thay đổi nếu không phá invariant (bất biến) đã khóa. Mọi thay đổi clinical semantics (ngữ nghĩa lâm sàng) cần authority phù hợp và cập nhật governance.

## 2. Phạm vi và ranh giới

CORE-04 triển khai:

- `CareEpisode` tối thiểu và vòng đời explicit start/close/reopen;
- `Encounter.episodeId?` và `Encounter.occurredAt`;
- amendment lineage (chuỗi sửa đổi) cho `ClinicalFormSubmission`;
- reusable section/instrument framework (khung section/thang đo dùng lại);
- sáu Longo form families;
- follow-up scheduling (lập lịch theo dõi) idempotent;
- Episode-aware Timeline dạng read projection;
- functional frontend workflow;
- regression, browser E2E, backup/restore và independent audit.

Không thuộc CORE-04:

- real-patient runtime hoặc pilot thực tế;
- historical patient-data import;
- AI feature;
- full UI/UX redesign;
- HIS, full EMR hoặc generic research database;
- generic database form builder;
- billing, claims, pharmacy, inventory hoặc commercial logic.

## 3. Invariant bắt buộc xuyên suốt

Phải giữ nguyên:

- patient identity bất biến và không auto-merge;
- tenant isolation, RBAC và same-patient ancestry;
- `ClinicalFormSubmission` chỉ liên kết trực tiếp với `Encounter`;
- không nhân bản `episodeId` xuống `ClinicalFormSubmission`, `CarePlan` hoặc `CareTask`;
- Clinical Form `COMPLETED` bất biến;
- amendment là full corrected snapshot (ảnh chụp đầy đủ đã sửa), append-only;
- Timeline là read projection, không phải write target;
- `CareTask` chỉ có stored status đã định nghĩa; `OVERDUE` là derived state;
- không tự động đóng `CareEpisode`;
- follow-up scheduling idempotent;
- không fabricate historical score items;
- chỉ dùng synthetic data (dữ liệu giả lập).

Với cả sáu Longo template:

```text
LONGO_PREOP_ASSESSMENT
LONGO_INTRAOP_RECORD
LONGO_EARLY_POSTOP
LONGO_TWO_WEEK_FOLLOWUP
ANAL_DILATION_ASSESSMENT
LONGO_LONG_TERM_FOLLOWUP
```

Encounter bắt buộc có `episodeId != null`, và `CareEpisode` phải cùng tenant, cùng patient với Encounter. Create hoặc complete Longo submission vi phạm invariant này phải bị reject. Không suy rộng yêu cầu `episodeId` bắt buộc sang Encounter chung ngoài workflow Longo.

## 4. Quy tắc thực thi

1. Thực hiện tuần tự T0 → T16; không bỏ qua gate của task trước.
2. Mỗi task chỉ bắt đầu sau khi task/gate trước PASS và Owner cho phép khi execution context yêu cầu.
3. Trước mọi write: chạy `git status` và `git diff`.
4. Không commit, push, merge, tag, reset hoặc tạo branch nếu Owner chưa cho phép rõ ràng.
5. Không áp migration vào shared/real-data environment.
6. Không sửa code để che baseline failure ở T0.
7. Không bịa field/scoring đang `DEFERRED_WITH_REASON`.

---

## T0 — Baseline Verification

T0 read-only đối với source/runtime. Phải kiểm tra:

1. branch, HEAD, `git status`, `git diff` và `CURRENT EXECUTION CONTEXT`;
2. code drift so với Technical Core baseline khi cần;
3. backend unit tests;
4. backend E2E;
5. frontend tests;
6. toàn bộ browser E2E hai lần liên tiếp;
7. `prisma validate` và `prisma migrate status` trên disposable synthetic DB;
8. backup/restore verification theo `OPERATIONS.md`;
9. privacy, secret và real-patient-data scan;
10. migration baseline và unexpected code drift.

Baseline lịch sử tối thiểu để so sánh:

```text
Backend:       99/99 PASS
Frontend:      20/20 PASS
Browser E2E:   4/4 PASS, hai lần liên tiếp
Backup/restore: PASS
Privacy/Git:    PASS
```

Nếu actual count cao hơn và tất cả PASS thì ghi actual count, không coi là lỗi. Nếu bất kỳ baseline test FAIL, không sửa code; STOP và báo failing test, nguyên nhân nếu xác định được, phân loại baseline drift/environment issue và hành động đề xuất. Nếu phát hiện dữ liệu bệnh nhân thật, STOP ngay.

**Gate T0:** Chỉ khi toàn bộ T0 PASS mới báo `READY FOR T1`; không triển khai T1 trong checkpoint T0.

## T1 — CareEpisode + Encounter Clinical Time

### T1.1 CareEpisode tối thiểu

Triển khai tối thiểu:

```text
id
tenantId
patientId
episodeType
status
startedAt
endedAt?
createdAt
```

`episodeType = LONGO_TREATMENT`; `status = ACTIVE | CLOSED`.

- Start: explicit authorized action, không tự động suy ra.
- Close: `status = CLOSED`, `endedAt = now()`.
- Reopen: `status = ACTIVE`, `endedAt = NULL`, `reason = REQUIRED`, `AuditEvent = REQUIRED`.
- Không cho phép trạng thái `ACTIVE + endedAt != NULL`.
- Start/close/reopen phải enforce tenant, patient ancestry, RBAC và audit phù hợp.

### T1.2 Encounter clinical time

Thêm:

```text
episodeId?
occurredAt
```

`Encounter.occurredAt` là thời gian lâm sàng thực tế; `createdAt` là thời gian persistence. Application phải reject create Encounter nếu thiếu `occurredAt` sau khi T1 được triển khai.

Không backfill:

```text
occurredAt = createdAt
```

Không suy diễn clinical time. Với disposable synthetic DB, dùng reset/reseed/recreate; mọi seed phải truyền `occurredAt` tường minh. Không áp migration này vào shared/real-data environment.

### T1.3 E2E bắt buộc

- start/close/reopen lifecycle đúng;
- reopen thiếu reason bị reject;
- reopen tạo `AuditEvent`;
- không tồn tại `ACTIVE + endedAt != NULL`;
- cross-tenant/cross-patient Episode link bị reject;
- Encounter chung có thể `episodeId = null`;
- create Encounter thiếu `occurredAt` bị reject.

## T2 — ClinicalForm Amendment Lineage

### T2.1 Schema contract

Clinical Form `COMPLETED` không được update. Amendment tạo row mới là full corrected snapshot, giữ tối thiểu:

```text
previousSubmissionId
logicalGroupId
revisionNumber
amendmentReason
amendedByUserId
completedAt
```

Giữ hai constraint Prisma độc lập:

```prisma
previousSubmissionId String? @unique

@@unique([logicalGroupId, revisionNumber])
```

Không được có unconditional Prisma constraint:

```prisma
@@unique([encounterId, templateKey])
```

vì constraint đó chặn amendment revision >= 2.

### T2.2 Migration contract

Migration phải drop unique index cũ:

```sql
DROP INDEX "clinical_form_submissions_encounterId_templateKey_key";
```

Sau đó tạo partial unique root index bằng đúng database column naming convention (quy ước tên cột cơ sở dữ liệu) hiện tại:

```sql
CREATE UNIQUE INDEX
  "clinical_form_submissions_one_chain_root_key"
ON "clinical_form_submissions" ("encounterId", "templateKey")
WHERE "revisionNumber" = 1;
```

Verified baseline evidence (bằng chứng baseline đã xác minh): migration `20260822141912_clinical_forms` hiện dùng quoted camelCase columns `"encounterId"`, `"templateKey"` và index `"clinical_form_submissions_encounterId_templateKey_key"`.

Hai invariant độc lập:

1. `previousSubmissionId @unique` chống fork lineage (một parent có hai child).
2. Partial unique root index chống duplicate root cho cùng Encounter + template.

### T2.3 Test contract

Phải chứng minh:

- revision 2 tạo được;
- duplicate root bị database reject;
- hai amendment cùng parent bị database reject;
- original completed row không đổi;
- revision number/logical group/provenance đúng;
- amendment thiếu reason bị reject;
- cross-tenant/cross-patient amendment bị reject.

## T3 — Reusable Section / Instrument Framework

Template definitions tiếp tục cấu hình bằng code, có version; không tạo generic DB form builder. Framework phải hỗ trợ:

- reusable field/section definitions;
- stage context và independent observation;
- required/optional validation theo từng template/version;
- structured, free-text và system-derived fields;
- deterministic score computation;
- completion validation;
- snapshot resolution theo `templateKey` + `templateVersion`.

Reusable building blocks v1:

```text
ANORECTAL_EXAM
WEXNER
SATISFACTION
```

HDSS/SHS-HD chưa được routine-finalized và không được bật scoring/capture thường quy.

## T4 — LONGO_PREOP_ASSESSMENT

Triển khai các nhóm đã khóa:

- tiền sử và bệnh đồng mắc liên quan;
- cân nặng kg, chiều cao cm, mạch bpm, nhiệt độ °C;
- huyết áp tách systolic/diastolic mmHg;
- anemia assessment có cấu trúc nhưng không tự suy ra từ Hb/Hct;
- cận lâm sàng và rectoscopy subsection tối thiểu + free-text impression;
- pre-op anorectal exam;
- Goligher I–IV;
- vị trí búi trĩ clock-face 1h–12h, multi-select;
- free text cho nội dung chưa chuẩn hóa an toàn.

Post-anesthesia observation không overwrite pre-op observation; exact field equivalence còn deferred khi chưa có semantics rõ.

## T5 — LONGO_INTRAOP_RECORD

Triển khai record trong mổ gắn với Surgery Encounter:

- anesthesia;
- `operativeDuration` theo minute;
- `bloodLoss` theo mL;
- additional procedures;
- stapler/specimen findings;
- intraoperative complications;
- free text phù hợp cho other finding/complication.

Surgery `Encounter.occurredAt` là postoperative timing anchor duy nhất. Không dùng `createdAt`, admission/discharge date hoặc manual elapsed month làm anchor.

Không fabricate Longo difficulty item definitions; giữ `DEFERRED_WITH_REASON`.

## T6 — LONGO_EARLY_POSTOP

Triển khai nhóm hậu phẫu sớm đã khóa:

- pain VAS 0–10;
- analgesics và duration nếu định nghĩa đã rõ;
- bleeding, urinary retention, fever, prolapse;
- constipation, diarrhea, tenesmus;
- first bowel movement timing;
- stool characteristics, blood và patient sensation;
- free text cho nội dung không chuẩn hóa an toàn.

Form có thể gắn cùng Surgery/Admission Encounter khi đó vẫn là cùng clinical occurrence; không tạo Encounter chỉ vì có thêm form.

## T7 — LONGO_TWO_WEEK_FOLLOWUP

Triển khai:

- pain VAS 0–10 (`0 = không đau`);
- bleeding;
- prolapse;
- skin tags;
- defecation status;
- early anal stenosis;
- `twoWeekDilationPerformed` là summary/intervention flag.

**Owner Decision:** Không triển khai Wexner tại mốc hai tuần trong v1. `LONGO_TWO_WEEK_FOLLOWUP` không chứa Wexner fields, Wexner total hoặc placeholder liên quan.

Nếu có nong hậu môn thực tế, tạo clinical occurrence riêng theo T8; không dùng summary flag để overwrite một lần nong.

## T8 — ANAL_DILATION_ASSESSMENT

Mỗi lần nong hậu môn là một Encounter/clinical occurrence riêng và một submission riêng.

Năm concept tiếp tục được accounted for:

- anal diameter;
- dilation resistance;
- pain;
- bleeding;
- defecation ability.

V1 capture bằng free text. Không activate:

- single-choice 0–3;
- numeric scale;
- total score;
- placeholder `Mức 0..3`.

Toàn bộ định nghĩa scale 0–3 giữ `DEFERRED_WITH_REASON` cho đến khi clinician authority xác nhận đầy đủ definitions. Không suy ra từ corpus/template reference.

## T9 — LONGO_LONG_TERM_FOLLOWUP

Một template dùng lại cho ba mốc:

```text
MONTH_1
MONTH_3
MONTH_6
```

Field workflow identity:

```text
plannedTimepoint
required: true
```

`plannedTimepoint` bắt buộc để deterministic matching (đối sánh xác định) MONTH_1/MONTH_3/MONTH_6. Không suy rộng quy tắc required này sang clinical fields khác.

Mỗi mốc là Encounter riêng, có actual `occurredAt` và elapsed time system-derived. Nội dung gồm các field dài hạn đã khóa: recurrence/location, stenosis, dilation/post-dilation outcome, VAS 0–10, skin tags, management, defecation status, tenesmus, anal discharge, satisfaction và comments theo disposition được phê duyệt.

Wexner prospective routine bắt đầu tại:

```text
MONTH_1
MONTH_3
MONTH_6
```

Wexner gồm 5 items, mỗi item 0–4, completion đủ items, deterministic total 0–20 và instrument version. Không reconstruct historical items. HDSS/SHS-HD tiếp tục deferred pending clinical validation.

## T10 — Follow-up Scheduling

Sau explicit completed surgery milestone, sinh `CareTask` cho:

```text
~14 ngày
~1 tháng
~3 tháng
~6 tháng
```

Yêu cầu:

- anchor duy nhất: Surgery `Encounter.occurredAt`;
- stable schedule key và idempotent generation;
- task editable/cancellable/audited;
- task không phải visit hoặc attendance proof;
- task không tự complete bởi Encounter không liên quan;
- completion phải match đúng Episode + timepoint + CareTask;
- không auto-close Episode;
- sửa surgery `occurredAt` không âm thầm đổi lịch; task liên quan chuyển sang cần review và thay đổi phải audit.

Phải có negative/concurrency E2E chứng minh gọi scheduling lặp không tạo duplicate task.

## T11 — Episode-aware Timeline

Timeline tiếp tục là read projection:

```text
Patient
├── Episode
│   ├── Encounter
│   ├── Form completion/amendment
│   ├── CarePlan
│   └── Follow-up
└── Ungrouped Encounter
```

Phải:

- group theo Episode;
- hỗ trợ Encounter không thuộc Episode;
- dùng clinical time phù hợp để sắp xếp;
- hiển thị amendment lineage mà không làm mất original;
- không tạo writable Timeline table.

## T12 — Migration / Seed / Backup-Restore

Mọi schema change tuân thủ `CONTRIBUTING.md` và Migration Review Before Application.

Yêu cầu:

- review schema diff, destructive operations, tenant/clinical integrity;
- migration Clinical Form phải thực hiện T2.2 chính xác;
- không backfill `occurredAt = createdAt`;
- disposable synthetic DB dùng reset/reseed/recreate;
- mọi Encounter trong seed truyền `occurredAt` tường minh;
- seed chỉ chứa synthetic data;
- backup/restore bao phủ `CareEpisode`, Encounter clinical time, form lineage và follow-up state mới;
- không áp migration vào shared/real-data environment.

## T13 — Backend Regression + New Tests

Toàn bộ backend baseline phải tiếp tục PASS và thêm coverage cho:

- T1 lifecycle/time/ancestry/RBAC;
- T2 amendment/database constraints;
- create và complete của cả sáu Longo template reject khi Encounter thiếu Episode hoặc Episode sai tenant/patient;
- template version/validation và deferred-field boundaries;
- Wexner chỉ ở MONTH_1/MONTH_3/MONTH_6;
- không Wexner ở hai tuần;
- T8 không có scale/score giả;
- follow-up idempotency và correct task matching;
- Timeline read projection;
- privacy/error response không lộ clinical data.

## T14 — Frontend Functional Workflow

Chỉ triển khai functional UX đủ để:

- thấy Episode `ACTIVE`/`CLOSED`;
- start/close/reopen với reason khi cần;
- tạo Encounter với `occurredAt`;
- dùng sáu Longo forms;
- xem/tạo amendment và history;
- xem follow-up queue, planned vs actual;
- ghi repeated dilation sessions;
- xem Episode-aware Timeline.

Không thực hiện full UI/UX redesign.

## T15 — Browser E2E

Browser E2E dùng synthetic data, bao phủ ít nhất:

```text
Patient
→ Start Longo Episode
→ Pre-op
→ Surgery
→ Early Post-op
→ Follow-up schedule
→ 2-week visit (không Wexner)
→ Anal dilation nếu cần (free text, có thể lặp)
→ Month 1/3/6 (plannedTimepoint bắt buộc + Wexner)
→ Amendment scenario
→ Explicit Episode closure/reopen
```

Toàn bộ suite phải PASS hai lần liên tiếp. Không dùng real-patient data, screenshot hoặc example có định danh thật.

## T16 — Independent Post-implementation Audit

Audit độc lập xác minh:

- T1–T15 và Gate A–G;
- schema/migration đúng contract;
- không invariant regression;
- test counts và hai browser runs;
- backup/restore;
- privacy/secret/real-patient-data scan;
- documentation/implementation alignment;
- working tree/Git provenance;
- không có scope creep sang AI, historical import hoặc UI redesign.

T16 không tự cấp phép real-patient runtime và không tự đóng toàn bộ GastroCare Core.

---

## 5. Acceptance Gates

| Gate | Điều kiện PASS |
|---|---|
| A — Domain / Schema | `CareEpisode`, `Encounter.episodeId?`, `Encounter.occurredAt`, tenant/patient invariants; không duplicate ancestry |
| B — Clinical Record Lifecycle | `COMPLETED` immutable; amendment append-only; provenance rõ; original không đổi; database constraints T2 PASS |
| C — Longo Forms | Sáu form family; field đã khóa được triển khai; deferred có lý do; không bịa scoring |
| D — Follow-up | Surgery anchor đúng; schedule idempotent; planned/actual tách; task completion đúng visit; không auto-close |
| E — Timeline | Group theo Episode, hỗ trợ ungrouped Encounter, read-only |
| F — Regression | Backend/frontend/browser PASS; backup/restore PASS; invariant cũ không regression |
| G — Owner Synthetic Clinical Acceptance | Owner chạy được full synthetic workflow; chỉ xác nhận Clinical Core readiness, không phải real-world validation |

## 6. Migration Safety Checklist riêng cho CORE-04

Trước khi Owner review migration:

1. xác nhận exact current schema và quoted camelCase column names;
2. review việc drop old unique index và tạo partial root index;
3. chứng minh revision 2, duplicate root reject, same-parent fork reject;
4. xác nhận không có `occurredAt = createdAt` backfill;
5. xác nhận disposable DB reset/reseed strategy;
6. chạy `prisma validate`, migrate status và full backend regression;
7. chạy backup/restore verification;
8. không deploy vào shared/real-data environment.

## 7. Deferred With Reason

Tiếp tục deferred, không tự giải quyết trong implementation:

- exact post-anesthesia field equivalence;
- anal-dilation full 0–3 definitions;
- HDSS scoring;
- SHS-HD scoring;
- Longo difficulty item definitions;
- full rectoscopy vocabulary;
- combined historical labels chưa rõ cách split;
- historical import.

Các mục này không block toàn bộ CORE-04; chỉ block field/instrument tương ứng.

## 8. Owner Decisions áp dụng trong v0.3.1

1. Contract v0.3.1 là `OWNER LOCKED`.
2. Không dùng unconditional `@@unique([encounterId, templateKey])`; dùng `previousSubmissionId @unique`, `@@unique([logicalGroupId, revisionNumber])` và partial unique root index đã chỉ định.
3. `plannedTimepoint` là required workflow identity trong `LONGO_LONG_TERM_FOLLOWUP`.
4. Cả sáu Longo templates bắt buộc Encounter thuộc Episode cùng tenant/cùng patient ở application validation.
5. Reopen đưa `endedAt` về `NULL`; không cho phép `ACTIVE + endedAt != NULL`.
6. Không triển khai Wexner ở mốc hai tuần trong v1.
7. Wexner prospective routine bắt đầu từ MONTH_1 và áp dụng MONTH_1/MONTH_3/MONTH_6 trong `LONGO_LONG_TERM_FOLLOWUP`.
8. T8 giữ năm concept nhưng chỉ capture free text; scale 0–3 tiếp tục `DEFERRED_WITH_REASON`.

## 9. Unresolved Owner Questions

```text
0
```

Contract không còn marker yêu cầu Owner xác nhận.

## 10. Execution Gate hiện tại

```text
CORE-04 Implementation Contract v0.3.1
OWNER LOCKED
→ T0 Baseline Verification
→ PASS
→ chờ Owner authorization để bắt đầu T1
```

Tài liệu này không tự cho phép triển khai T1, commit, push, migration application vào shared/real-data environment hoặc real-patient runtime.
