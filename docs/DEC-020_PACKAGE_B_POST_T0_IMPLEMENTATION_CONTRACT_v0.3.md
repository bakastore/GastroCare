# GASTROCARE — PACKAGE B v0.3 POST-T0 IMPLEMENTATION CONTRACT

Clinical Form Fidelity + Sequential Longo Follow-up + LTFU Completion

Loại tài liệu: Implementation Contract
Ngày: 2026-09-18
Phiên bản: v0.3 Post-T0
Trạng thái: OWNER LOCKED — 2026-09-18
T0 baseline: main @ 47a690c3a8eaf7f67f76f6d3adf0c5ed9676e013

Authority:

* DEC-020 Package B v0.2 OWNER LOCKED
* DEC-021 / DEC-022 applicable OWNER LOCKED governance
* DEC-023 OWNER LOCKED (historical, unchanged)
* Post-T0 Owner Decisions OD-B01–OD-B05: APPROVED 2026-09-17
* Post-T0 Owner Decision OD-B06: FINALIZED 2026-09-18

## Relationship to prior v0.3

Prior v0.3 Contract:
`docs/DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_IMPLEMENTATION_CONTRACT_v0.3.md`

Post-T0 Contract supersedes prior v0.3 CHỈ đối với OD-B01→OD-B06 và bounded
implementation package được định nghĩa trong chính Post-T0 Contract này.

Package B preserved scope khác trong prior v0.3 KHÔNG bị xóa và tiếp tục tồn
tại làm historical/preserved authority.

Preserved scope ngoài 4 delta (Vitals / Diagnosis v2 / Longo sequential / LTFU)
KHÔNG thuộc bounded implementation package hiện tại. Triển khai preserved
scope đó đòi hỏi contract/authorization riêng, tách biệt khỏi Post-T0
Contract này.

Hoàn thành bounded Post-T0 package KHÔNG được dùng để claim Package B CLOSED.

Data boundary: SYNTHETIC DATA ONLY
Production: NOT AUTHORIZED
Real-patient runtime: NOT AUTHORIZED
Implementation: NOT AUTHORIZED by this document

Owner Lock của tài liệu này KHÔNG tự động là implementation authorization.
Implementation chỉ bắt đầu sau explicit Owner statement:
`OWNER LOCKED + PACKAGE B v0.3 IMPLEMENTATION AUTHORIZED`

## 1. PURPOSE

Triển khai bốn delta đã Owner quyết định sau T0:

1. Vitals — loại bỏ auto-prefill/copy-forward.
2. Diagnosis v2 — ordered repeatable free-text diagnosis.
3. Longo — thay fixed future schedule bằng sequential doctor-driven follow-up.
4. LTFU — machine-checkable failed attempts + human confirmation + atomic Episode closure consequence.

Không mở rộng sang generic workflow engine, generic form builder, hay nghiệp vụ ngoài phạm vi Contract.

## 2. OWNER-LOCKED SEMANTICS

### OD-B01 — Vitals

Encounter mới phải nhập vital mới.
Không auto-prefill.
Không auto-copy.
Không Apply/Copy action.
Historical data giữ nguyên.
Historical read-only UI không bắt buộc trong Package này.

### OD-B02 — Diagnosis v2

`HEMORRHOID_DIAGNOSIS v1` giữ nguyên lịch sử.

`HEMORRHOID_DIAGNOSIS v2`:

* ordered free-text diagnosis lines;
* line 1 = chẩn đoán chính, bắt buộc;
* line 2+ = chẩn đoán kèm, tùy chọn;
* UI action = `Thêm dòng`;
* implementation dùng reusable repeatable-text primitive, không diagnosis-specific hack.

### OD-B03 — Longo sequential follow-up

Doctor đánh giá tại từng Encounter.

Nếu cần tái khám tiếp:

* Doctor chọn ngày;
* UI gợi ý khoảng +1 tuần;
* chỉ tạo tối đa 01 next CareTask;
* không pre-create future chain;
* không dùng `CarePlan.followUpDate` làm cơ chế Longo chính;
* không fixed maximum number of weeks cho việc tái khám bình thường.

Ngoại lệ LTFU theo OD-B06.

### OD-B04 — Legacy cutover

Longo context đã có fixed-timepoint CareTask tiếp tục legacy mode.

Legacy và Sequential không được chạy song song trong cùng:
`Episode + Longo TreatmentPathway`

Không:

* rewrite legacy tasks;
* delete legacy tasks;
* convert legacy tasks.

### OD-B05 — Qualifying failed attempt

Extend existing `CareTaskContactAttempt`.

Thêm:
`qualifyingFailed Boolean?`

Historical rows:
`NULL = legacy/unknown/không tính threshold`

New attempts:
`qualifyingFailed` bắt buộc true hoặc false ngay khi record.

Actor ghi attempt:

* DOCTOR
* NURSE

Attempt append-only.
Không sửa outcome sau khi tạo.

### OD-B06 — LTFU timing semantics

FINALIZED 2026-09-18

Anchor:
`CareEpisode.startedAt`

Hard gate:

Trước khi đủ:
`CareEpisode.startedAt + 2 calendar months`
hệ thống KHÔNG được xử lý bất kỳ bước nào của quy trình LTFU:

* không đếm threshold;
* không cảnh báo LTFU;
* không cho phép final confirm.

Contact attempts ghi nhận trước gate vẫn tồn tại trong history nhưng KHÔNG được tính threshold, kể cả:
`qualifyingFailed = true`

Sau gate, hệ thống đánh giá theo từng calendar month tiếp theo:

* tháng thứ 3;
* tháng thứ 4;
* ...
* tiếp tục nếu Episode vẫn ACTIVE.

Không giới hạn số tháng đánh giá.

Threshold:

```text
>= 3 attempts
qualifyingFailed = true
trên chính target CareTask
attemptedAt thuộc CÙNG một calendar month
attemptedAt >= CareEpisode.startedAt + 2 calendar months
```

`calendar month` = ranh giới tháng dương lịch.

KHÔNG dùng:

* rolling 30×24h;
* rolling N days;
* `referenceTime - N seconds`.

Quan hệ OD-B03:
Gate LTFU không giới hạn số lần follow-up thực tế nếu bệnh nhân vẫn tương tác bình thường.
Nó chỉ áp dụng cho nhánh bệnh nhân mất liên lạc.

Backend phải tự recount threshold trong final-confirmation transaction theo calendar month tại thời điểm confirm.

#### D3 — Timezone semantics (OWNER APPROVED 2026-09-26)

Calendar-day / calendar-month boundary cho toàn bộ OD-B06 dùng:
`Asia/Ho_Chi_Minh` = `UTC+07:00`, không DST.

Timestamp persistence (`attemptedAt`, `CareEpisode.startedAt`, mọi cột lưu trữ
hiện hữu) KHÔNG thay đổi. Không thêm timezone dependency mới; có thể dùng
built-in `Intl` hoặc fixed offset `UTC+07:00`.

Hard gate calculation:

1. convert `CareEpisode.startedAt` sang civil time `Asia/Ho_Chi_Minh`;
2. cộng 2 calendar months theo D4;
3. giữ nguyên time-of-day;
4. convert kết quả lại thành instant;
5. so sánh authoritative `attemptedAt` với instant đó.

Calendar-month grouping của `attemptedAt` (threshold counting) cũng tính theo
`Asia/Ho_Chi_Minh`.

#### D4 — Calendar-month arithmetic (OWNER APPROVED 2026-09-26)

`+N calendar months` dùng end-of-month clamp:
`targetDay = min(sourceDay, daysInTargetMonth)`

Giữ nguyên time-of-day.

Mandatory examples:

* `2026-01-31 + 1 month → 2026-02-28`
* `2028-01-31 + 1 month → 2028-02-29`
* `2026-12-31 + 2 months → 2027-02-28`
* `2026-08-30 + 2 months → 2026-10-30`

### Existing DEC-023 authority — LTFU confirmation RBAC

Không phải Owner Decision mới.

Final confirm LTFU:

* DOCTOR
* NURSE
* RECEPTIONIST

kế thừa DEC-023 OWNER LOCKED.

RECEPTIONIST không được mở rộng sang contact-attempt hoặc mutation khác.

## 3. T1 — VITALS

Current Encounter response không được populate từ previous Encounter.
User nhập mới.
Historical submissions không đổi.

Trước khi retire copy-forward phải repo-wide search:

* `getVitalsCopyForward`
* `vitals-copy-forward`
* mọi caller liên quan.

Nếu chỉ còn known caller trong scope → retire.
Nếu phát hiện consumer mới ngoài scope:
`STOP`

Retire:

* backend `getVitalsCopyForward()` active path;
* controller endpoint nếu không còn consumer;
* frontend auto-fetch;
* frontend response merge/prefill.

Không xây historical-vitals UI mới trong Package này.

## 4. T2 — DIAGNOSIS v2

`HEMORRHOID_DIAGNOSIS v1` giữ nguyên.
`diagnosisSummary` giữ nguyên lịch sử.
Historical submissions resolve theo stored `templateVersion`.
Không migrate/rewrite v1 data.

New primitive:
`repeatable_text`

Value:
`string[]`

Rules khi COMPLETED:

* array tồn tại;
* ít nhất 1 item;
* mọi item là string;
* `trim(item)` non-empty;
* item đầu = primary diagnosis;
* item sau = associated diagnosis;
* order preserved.

DRAFT tiếp tục partial theo lifecycle hiện hành.

Không tự đặt:

* max rows;
* max length;
* vocabulary;
* ICD requirement

nếu chưa có authority.

Required backend layers:

* template types;
* FieldDef;
* response validation;
* Diagnosis v2 template;
* registry/version resolution;
* tests.

Required frontend layers:

* domain field types;
* generic form renderer;
* Add/Remove line UX;
* tests.

Persistence dùng existing JSON response.
Không authorize Prisma migration cho Diagnosis.

Nếu implementation yêu cầu migration:
`STOP`

## 5. T3 — LONGO SEQUENTIAL FOLLOW-UP

Fixed future generation:

* TWO_WEEK
* MONTH_1
* MONTH_3
* MONTH_6

không được tạo cho new sequential context.

Retire:

* automatic bulk generation sau `LONGO_INTRAOP_RECORD`;
* manual fixed generator path hiện tại.

Historical vẫn giữ:

* timepoint codes;
* templates;
* submissions;
* CareTasks;
* matching logic.

`POST /follow-up-tasks/generate`
không được tiếp tục tạo fixed schedule sau cutover.

Repo-wide search caller trước khi change/remove.
Nếu caller ngoài scope phụ thuộc semantics cũ:
`STOP`

Sequential task dùng existing CareTask:

```text
type = FOLLOW_UP
status = OPEN
timepointCode IS NULL
carePlanId IS NULL
sourceEncounterId IS NOT NULL
```

Với sequential task:
`sourceEncounterId = Encounter nơi Doctor quyết định hẹn tiếp`

Legacy fixed task giữ:
`sourceEncounterId = surgery anchor Encounter`

Không rewrite historical rows.

Search tất cả consumer của `sourceEncounterId`.
Consumer không phân biệt được semantics:
`STOP`

### Sequential selector

OPEN sequential next-task selector:

```text
CareTask:
 tenantId = current
 type = FOLLOW_UP
 status = OPEN
 timepointCode IS NULL
 carePlanId IS NULL
 sourceEncounterId IS NOT NULL

AND sourceEncounter:
 episodeId = target Episode
 treatmentPathwayId = target Longo TreatmentPathway
```

Frontend không phải authority cho selector.

### At-most-one invariant

Trước create-next:

* backend query selector;
* count = 0 → được insert;
* count >= 1 → 409 CONFLICT.

Không dựa vào:
`UNIQUE(sourceEncounterId, timepointCode)`
vì sequential task có:
`timepointCode = NULL`

Concurrent create-next trong cùng Episode + TreatmentPathway:

* exactly one commit;
* loser → 409;
* never two OPEN sequential tasks.

Nếu cần Longo schema/index mới:
`STOP`

### Legacy classification

LEGACY nếu tồn tại BẤT KỲ CareTask, bất kể status, có:

```text
timepointCode IN {
 TWO_WEEK,
 MONTH_1,
 MONTH_3,
 MONTH_6
}
```

và authoritative `sourceEncounter` linkage đúng:
`Episode + TreatmentPathway`

Nếu LEGACY:

* tiếp tục legacy mode;
* không create sequential.

Không phụ thuộc:

* deploy timestamp;
* createdAt;
* surgery date;
* app version;
* UI state.

Invariant:
`LEGACY XOR SEQUENTIAL`

## 6. T4 — LTFU CONTACT ATTEMPT DATA MODEL

Authorized schema delta DUY NHẤT:

```text
CareTaskContactAttempt.qualifyingFailed Boolean?
```

và index:

```text
(tenantId, careTaskId, attemptedAt)
```

Không backfill historical rows.
Historical NULL không tính threshold.

New attempt:
`qualifyingFailed` REQUIRED boolean.
`note` giữ theo contract hiện tại.

Actor:

* DOCTOR
* NURSE

Không:

* update/edit route;
* contact-channel taxonomy;
* outcome enum;
* second ContactAttempt entity.

Audit contact-attempt phải bổ sung:

* contactAttemptId
* qualifyingFailed

## 7. T5 — LTFU THRESHOLD

Áp dụng chính xác OD-B06.

Backend phải recount trong final-confirmation transaction.
Không tin:

* frontend count;
* client calculated threshold;
* client `eligible=true`;
* previously cached threshold.

## 8. T6 — FINAL LTFU CONFIRMATION

Record contact attempt:

* DOCTOR
* NURSE

Final confirm:

* DOCTOR
* NURSE
* RECEPTIONIST

Không mở rộng RECEPTIONIST sang mutation khác.

Existing `lost-to-follow-up` action hiện là CareTask-only mutation phải chuyển thành final-confirm command có consequence:

1. target CareTask → `LOST_TO_FOLLOW_UP`;
2. Episode → `CLOSED`;
3. remaining authoritative-linked OPEN CareTasks → `CANCELLED`.

Repo-wide search tất cả caller trước thay đổi:

* frontend;
* backend;
* tests;
* API helpers.

Known caller trong scope → update.
External/out-of-scope consumer phụ thuộc semantics cũ:
`STOP`

Không giữ second legacy endpoint có thể bypass atomic consequence.

Frontend trước confirm phải hiển thị:

* target task sẽ `LOST_TO_FOLLOW_UP`;
* Episode hiện tại sẽ đóng;
* remaining linked OPEN tasks sẽ bị hủy.

Không bắt buộc hiển thị exact N.
Nếu hiển thị count thì chỉ informational.
Backend transaction là authority.

Sau success frontend reload:

* CareTask;
* Episode;
* follow-up state.

## 9. T7 — AUTHORITATIVE EPISODE RESOLUTION

Resolve Episode duy nhất qua:

```text
CareTask
→ sourceEncounter
→ episodeId
```

HOẶC:

```text
CareTask
→ carePlan
→ encounter
→ episodeId
```

Không dùng:

* patientId matching;
* latest Episode;
* date proximity;
* free text;
* frontend context.

Required:

* exactly one Episode;
* same tenant;
* status ACTIVE.

Valid = exactly one ACTIVE same-tenant Episode.

Nếu:

* 0 Episode;
* >1 Episode / ambiguous linkage;
* CLOSED Episode;
* inconsistent linkage;

→ `409 CONFLICT`

Không auto-repair.

## 10. T8 — ATOMIC LTFU TRANSACTION

Final confirmation chạy trong ONE SERIALIZABLE transaction.

Logical order:

1. establish server `referenceTime`;
2. verify actor authorization;
3. verify target CareTask OPEN;
4. resolve exact ACTIVE Episode;
5. enforce OD-B06 hard gate;
6. count qualifying attempts theo OD-B06;
7. require count >= 3 trong valid calendar month;
8. target CareTask → `LOST_TO_FOLLOW_UP`;
9. Episode → `CLOSED`;
10. remaining authoritative-linked OPEN CareTasks → `CANCELLED`;
11. write AuditEvents;
12. COMMIT.

Fail bất kỳ bước nào:
`ROLLBACK ALL`

Không partial state.

## 11. SHARED EPISODE-CLOSE CORE

CẤM implementation kiểu:

```text
markLostToFollowUp()
COMMIT

closeEpisode()
COMMIT
```

Normal Episode Close và LTFU consequence phải reuse một transaction-aware core closure implementation nhận current Prisma transaction client.

Helper chịu trách nhiệm:

* ACTIVE → CLOSED guarded transition;
* authoritative linked OPEN task resolution;
* task cancellation;
* Episode audit;
* disposition audits.

Authorization/RBAC vẫn nằm ở controller/application command boundary.
Không duplicate Episode-close semantics.

## 12. AUDIT CONTRACT

Episode closure audit:

Normal manual close:
`closureCause = MANUAL`

LTFU:
`closureCause = LTFU_CONFIRMED`
kèm:

* triggerCareTaskId;
* referenceTime;
* windowStart;
* qualifyingAttemptCount.

Task disposition audit:

* episodeId;
* previous status;
* final status;
* cancellation timestamp;
* disposition reason.

`closureCause` chỉ là audit metadata string.

Không tạo:

* Prisma enum mới;
* CareEpisode field mới;
* domain state mới.

## 13. CONCURRENCY CONTRACT

Isolation:
`SERIALIZABLE`

No auto-retry cho clinical state transition.

Serialization/deadlock conflict:
`409 CONFLICT`
Client/frontend phải reload authoritative state.

Phải có consistent resource-acquisition strategy giữa:

* normal Episode close;
* LTFU confirm;
* CareTask complete;
* CareTask cancel;
* CareTask reschedule;
* sequential create-next;
* contact-attempt interaction.

Nếu cần raw lock hoặc architecture ngoài Contract:
`STOP`

Required concurrency tests:

C1
LTFU confirm vs LTFU confirm:

* exactly one success;
* loser 409.

C2
Contact attempt vs LTFU confirm:
threshold dựa trên authoritative committed state.

C3
Normal Episode close vs LTFU confirm:
không hai conflicting closure path cùng commit.

C4
CareTask complete/cancel/reschedule vs LTFU confirm:
exactly one conflicting transition commits.

C5
Sequential create-next vs create-next:

* exactly one next task;
* never two OPEN sequential tasks.

## 14. FUNCTIONAL ACCEPTANCE TESTS

### Vitals

Chứng minh:

* previous completed Encounter tồn tại;
* new Encounter form starts blank;
* no copy-forward API call;
* no copied payload;
* historical data unchanged.

### Diagnosis v2

Chứng minh:

* v1 remains renderable;
* v1 remains valid;
* v2 DRAFT supports partial;
* COMPLETED requires line 1;
* blank lines rejected;
* order preserved;
* Add/Remove UI works;
* non-string array rejected;
* amendment pinned to v2;
* no v1 rewrite;
* no Prisma migration.

### Longo

Chứng minh:

* new surgery completion không tạo bốn fixed tasks;
* manual fixed generator không tạo new fixed schedule;
* existing legacy remains unchanged;
* legacy context rejected từ sequential create;
* sequential context tạo tối đa 1 OPEN next task;
* duplicate create → 409;
* concurrent duplicate → exactly one success;
* Doctor chọn next date;
* no-follow-up path tạo zero tasks;
* historical fixed matching vẫn hoạt động.

### LTFU

Chứng minh:

* new attempt requires boolean;
* historical NULL không tính;
* false không tính;
* true có thể tính khi nằm trong eligible window;
* attempt trước 2-calendar-month gate không tính dù true;
* 3 qualifying attempts trong cùng calendar month sau gate → eligible;
* 2 attempts → reject;
* attempts phân tán sang nhiều calendar month mà không tháng nào đạt 3 → reject;
* attempt của CareTask khác không tính.

RBAC:

* RECEPTIONIST không record attempt;
* RECEPTIONIST được final-confirm;
* DOCTOR/NURSE record và confirm được.

Episode linkage:

* no Episode → 409;
* ambiguous → 409;
* CLOSED → 409.

Successful confirmation:

* target → LOST_TO_FOLLOW_UP;
* Episode → CLOSED;
* remaining linked OPEN → CANCELLED;
* non-OPEN unchanged;
* audits atomic;
* `closureCause=LTFU_CONFIRMED`.

Normal close:
`closureCause=MANUAL`

Frontend:

* cascade warning trước confirm;
* reload authoritative state sau success.

## 15. IMPLEMENTATION IMPACT MAP

Vitals

* clinical-forms service/controller;
* HemorrhoidExaminationPage;
* tests.

Diagnosis

* template types;
* validation;
* registry;
* Diagnosis v2 template;
* frontend domain types;
* generic renderer;
* tests.

Longo

* follow-up-tasks service/controller/DTO;
* clinical-forms completion trigger;
* frontend follow-up workflow;
* tests.

LTFU

* schema.prisma;
* đúng 1 migration cho `qualifyingFailed + index`;
* contact-attempt DTO/controller/service;
* lost-to-follow-up controller/service;
* frontend FollowUp flow;
* tests.

Episode close

* care-episodes service/lifecycle helper;
* tests.

Sửa module ngoài impact map mà không chỉ là import/test wiring hiển nhiên:
`STOP`

## 16. AUTHORIZED SCHEMA CHANGE

Authorize duy nhất:

```text
CareTaskContactAttempt.qualifyingFailed Boolean?
```

và:

```text
INDEX (tenantId, careTaskId, attemptedAt)
```

Không authorize schema change cho:

* Diagnosis;
* Vitals;
* Longo sequential;
* CareEpisode;
* CareTask;
* CareTaskStatus;
* workflow enum;
* contact channel;
* outcome taxonomy.

## 17. NON-GOALS

Không triển khai:

* generic low-code form builder;
* generic workflow engine;
* historical vitals redesign;
* arbitrary Diagnosis row limits;
* arbitrary Diagnosis length limits;
* contact channel taxonomy;
* new Longo timepoint enum/state;
* migration legacy Longo sang sequential;
* automatic LTFU;
* automatic Episode Close chỉ vì threshold;
* Package C;
* R10 acceptance;
* production runtime;
* real-patient runtime.

## 18. STOP CONDITIONS

STOP nếu:

* baseline sai;
* working tree dirty;
* Vitals consumer mới ngoài scope;
* LTFU endpoint caller ngoài scope;
* `sourceEncounterId` consumer incompatible;
* Diagnosis cần migration;
* Longo cần schema/index/state/enum mới;
* legacy/sequential classification không machine-checkable;
* at-most-one invariant không chứng minh được trong authorized shape;
* historical data cần rewrite/delete;
* exact Episode không resolve được;
* atomicity không đảm bảo;
* concurrency fix cần raw SQL/architecture ngoài Contract;
* RBAC cần mở rộng ngoài authority;
* xuất hiện clinical semantics mới chưa có authority;
* production data xuất hiện;
* real-patient data xuất hiện.

STOP nghĩa là:

* report evidence;
* không workaround;
* không tự mở scope;
* không tiếp tục phần bị block.

## 19. IMPLEMENTATION ORDER

Chỉ sau explicit statement:
`OWNER LOCKED + PACKAGE B v0.3 IMPLEMENTATION AUTHORIZED`
thì implementation sequence mới là:

1. T1 Vitals
2. T2 Diagnosis v2
3. T3 Longo sequential + legacy cutover
4. T4 LTFU schema/contact attempt
5. T5 Atomic LTFU confirmation
6. T6 Frontend integration
7. T7 focused regression/concurrency tests
8. source review
9. independent audit
10. Owner review

Không auto-chain Package tiếp theo.

## 20. ACCEPTANCE BOUNDARY

Candidate implementation chỉ được gọi:
`READY FOR INDEPENDENT REVIEW`
khi:

* build pass;
* lint pass;
* tests pass;
* focused Package B tests pass;
* historical compatibility tests pass;
* concurrency tests pass;
* diff đúng scope;
* chỉ authorized migration tồn tại;
* synthetic data only;
* không governance drift.

Claude Code KHÔNG được tự tuyên bố:

* PASS cuối;
* OWNER ACCEPTED;
* Package B CLOSED;
* production ready;
* R10 passed.

Final acceptance authority thuộc Owner.

## 21. CURRENT GATE

T0 source verification:
`COMPLETE — OWNER REVIEWED`

Post-T0 Owner Decisions:

* OD-B01–B05 APPROVED — 2026-09-17
* OD-B06 FINALIZED — 2026-09-18

Post-T0 Contract:
`OWNER LOCKED — 2026-09-18`

Implementation:
`NOT AUTHORIZED`

Production / real patient:
`NOT AUTHORIZED`

Next gate:

```text
Owner review
→ docs commit/push/PR/merge
→ establish new main merge SHA as PACKAGE_B_IMPLEMENTATION_BASE_SHA
→ separate explicit Package B v0.3 implementation authorization
→ implementation branch
→ Claude Code executes one bounded Package B implementation package
```

END CONTRACT
