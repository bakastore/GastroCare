# GastroCare — Decision Log

Cập nhật: 2026-08-27

Đây là Decision Log hiện hành và là nguồn chuẩn cho Owner Decisions
và Working Assumptions của GastroCare.

---

## OWNER DECISIONS

| ID | Quyết định | Ngày | Rationale |
|---|---|---|---|
| DEC-001 | Pilot đầu tiên với BS Thái sử dụng manual entry only; không phụ thuộc AI. | 2026-08-21 | Tách kiểm chứng workflow khỏi rủi ro chất lượng AI. |
| DEC-002 | AI là Future Value-Added Layer; AI không định nghĩa hoặc quyết định Core architecture. | 2026-08-21 | Core phải tạo giá trị độc lập với AI. |
| DEC-003 | Owner chấp nhận runway khoảng 1 năm nếu cần để ưu tiên kiến trúc và chất lượng; đây không phải deadline hoặc time-box cố định. | 2026-08-21 | Tránh tối ưu tốc độ ngắn hạn dẫn đến chi phí kiến trúc lớn về sau. |
| DEC-004 | BS Thái là first pilot user. | 2026-08-21 | Pilot thực tế đầu tiên của GastroCare. |
| DEC-005 | Documentation Baseline v1.0 phải hoàn tất và được Owner review trước khi technical implementation bắt đầu. | 2026-08-21 | Có SSOT rõ ràng trước khi AI-assisted implementation bắt đầu. |

### DEC-006 — Longo Clinical Workflow v1.0

**Ngày:** 2026-08-23

**Trạng thái:** OWNER LOCKED

**Nguồn chuẩn:** [`08_LONGO_CLINICAL_WORKFLOW_v1.0.md`](08_LONGO_CLINICAL_WORKFLOW_v1.0.md)

Owner khóa các quyết định sau cho phạm vi v1:

1. `CareEpisode` là thực thể tối thiểu được phê duyệt để nhóm một đợt điều trị; vòng đời gồm `ACTIVE` và `CLOSED`, với thao tác bắt đầu, đóng và mở lại rõ ràng. Mở lại bắt buộc có lý do và `AuditEvent`. Không tự động đóng Episode.
2. `Encounter.episodeId` nullable (cho phép rỗng) ở Core schema, nhưng application validation (xác thực ở tầng ứng dụng) của quy trình Longo bắt buộc phải có giá trị.
3. `Encounter.occurredAt` là thời điểm sự kiện lâm sàng thực sự xảy ra. Với Encounter phẫu thuật Longo, đây là mốc tính thời gian hậu phẫu.
4. `ClinicalFormSubmission` chỉ liên kết với `Encounter`. Không nhân bản `episodeId` vào `ClinicalFormSubmission`, `CarePlan` hoặc `CareTask` trong v1.
5. Clinical Form đã `COMPLETED` phải bất biến; mọi sửa đổi dùng append-only amendment lineage (chuỗi sửa đổi chỉ ghi nối tiếp), không ghi đè âm thầm.
6. Sáu họ biểu mẫu Longo được phê duyệt: `LONGO_PREOP_ASSESSMENT`, `LONGO_INTRAOP_RECORD`, `LONGO_EARLY_POSTOP`, `LONGO_TWO_WEEK_FOLLOWUP`, `ANAL_DILATION_ASSESSMENT` và `LONGO_LONG_TERM_FOLLOWUP`.
7. Các mốc tháng 1, 3 và 6 dùng chung một template `LONGO_LONG_TERM_FOLLOWUP`.
8. Nong hậu môn là sự kiện có thể lặp lại; mỗi lần là một clinical occurrence (lần xảy ra lâm sàng) riêng biệt.
9. Mô hình Wexner cho dữ liệu thu thập mới gồm 5 mục và tổng điểm xác định 0–20. Dữ liệu lịch sử thực tế của Wexner, HDSS và SHS-HD đều là `UNDETERMINED`.
10. Triển khai thường quy cuối cùng cho HDSS và SHS-HD được hoãn đến khi có xác nhận lâm sàng. Các trường research extension (mở rộng nghiên cứu) vẫn được tính đến nhưng nằm ngoài quy trình lâm sàng thường ngày mặc định.
11. Sinh `CareTask` theo dõi sau phẫu thuật phải idempotent (chạy lặp không tạo bản ghi trùng).
12. Timeline tiếp tục là read projection (hình chiếu chỉ đọc), không phải nguồn dữ liệu độc lập.
13. Historical import (nhập dữ liệu lịch sử) nằm ngoài phạm vi triển khai hiện tại.
14. Real-patient runtime (môi trường chạy với bệnh nhân thật) chưa được phép. Triển khai, kiểm thử và nghiệm thu hiện tại chỉ dùng synthetic data (dữ liệu giả lập); bằng chứng từ corpus thực tế chỉ được sử dụng dưới dạng bằng chứng/kết quả tổng hợp đã được khử thông tin nhận dạng.

**Căn cứ:** quyết định Owner/clinician; kiểm toán toàn bộ 270/270 DOCX; Atomic Field Dictionary 118/118 khái niệm đã được tính đến, 0 unmapped; kiểm tra hẹp việc thu thập Wexner/HDSS/SHS-HD.

Các định nghĩa vẫn hoãn, không được suy diễn thành dữ kiện: chấm điểm nong hậu môn đầy đủ; cách chấm HDSS; cách chấm SHS-HD; tương đương trường sau vô cảm chưa giải quyết; định nghĩa các mục độ khó Longo; triển khai nhập dữ liệu lịch sử.

### DEC-007 — CORE-04 Implementation Contract v0.3.1 và mốc Wexner v1

**Ngày:** 2026-08-23

**Trạng thái:** OWNER LOCKED

**Nguồn chuẩn:** [`09_CORE04_IMPLEMENTATION_CONTRACT.md`](09_CORE04_IMPLEMENTATION_CONTRACT.md)

Owner chấp thuận và khóa CORE-04 Implementation Contract v0.3.1 sau final micro-patch, gồm các quyết định:

1. `LONGO_TWO_WEEK_FOLLOWUP` không triển khai Wexner trong v1.
2. Wexner prospective routine bắt đầu từ `MONTH_1` và áp dụng tại `MONTH_1`, `MONTH_3`, `MONTH_6` trong `LONGO_LONG_TERM_FOLLOWUP`.
3. Contract v0.3.1 có 0 unresolved Owner questions và là execution contract (hợp đồng thực thi) có thẩm quyền cho CORE-04, dưới clinical SSOT 08.

Quyết định này không resolve A-001 và không cấp phép real-patient runtime, T1 implementation, commit hoặc push.

### DEC-008 — plannedTimepoint là workflow identity, bất biến qua amendment (T16 remediation R3)

**Ngày:** 2026-08-24

**Trạng thái:** OWNER LOCKED

**Nguồn chuẩn:** Owner directive trong T16 remediation batch instructions; triển khai tại `backend/src/clinical-forms/clinical-forms.service.ts` (`amend()`).

Owner khóa quyết định sau cho phạm vi CORE-04 v1:

1. `plannedTimepoint` của một revision `LONGO_LONG_TERM_FOLLOWUP` đã `COMPLETED` là workflow identity và KHÔNG được thay đổi qua amendment lineage. Amendment chỉ được sửa nội dung lâm sàng.
2. Nếu payload amendment chỉ định `plannedTimepoint` khác giá trị của revision đã hoàn tất (MONTH_1/MONTH_3/MONTH_6), validation phải REJECT (409 Conflict) — không âm thầm chuẩn hóa (normalize) giá trị.
3. Không bao giờ reconcile/remap một `CareTask` bằng cách chuyển một submission đã hoàn tất sang timepoint khác.
4. Nếu một timepoint bị nhập sai, quy trình đúng là tạo một clinical occurrence/submission mới phù hợp — không bao giờ viết lại identity của một occurrence đã hoàn tất thông qua amendment.
5. Bất biến này có automated test bắt buộc (xem `backend/test/core04-t5-t9-longo-forms.e2e-spec.ts`, mục G).

**Căn cứ:** Independent T16 Audit finding R3 (5 findings, T16 FAIL); tránh rủi ro một amendment âm thầm gán lại một submission đã khớp CareTask sang timepoint khác mà không chạy lại matching.

### DEC-009 — Retire Longo-only Gate G và giữ CORE-04 làm verified baseline trước workflow pivot

**Ngày:** 2026-08-24

**Trạng thái:** OWNER DECISION

Owner quyết định:

1. Ghi nhận chuỗi kiểm chứng CORE-04: Initial Independent T16 `FAIL` → T16 remediation `COMPLETED` → Fresh Independent T16 re-audit `PASS`.
2. Gate G Longo-only được `RETIRED BY OWNER` và không tiếp tục, vì workflow sản phẩm đã đổi.
3. Không ghi nhận hoặc suy ra `CORE-04 OWNER ACCEPTED`; CORE-04 Owner product acceptance là `NOT CLAIMED`.
4. Vai trò của CORE-04 là independently verified technical/clinical implementation baseline cho Longo sub-branch, dùng làm checkpoint trước khi chuyển hướng sản phẩm.
5. Real-patient runtime tiếp tục `NOT AUTHORIZED`; quyết định này không mở pilot thật, production hoặc quyền dùng dữ liệu bệnh nhân thật.
6. Current direction là `HEMORRHOID REAL-WORLD CLINICAL WORKFLOW RECONCILIATION`. Đây là direction, không phải work package mới được mở bởi quyết định này.
7. `CORE-05` giữ nguyên là `CASE INTELLIGENCE`; không đổi tên, không thay scope và chưa được mở trong checkpoint CORE-04.

**Căn cứ:** Owner directive đóng checkpoint kỹ thuật CORE-04 trước khi chuyển sang workflow thực tế mới của BS Thái; fresh Independent T16 re-audit đã PASS sau remediation.

### DEC-010 — Hemorrhoid Real-World Workflow Vertical Slice 1

**Ngày:** 2026-08-24

**Trạng thái:** OWNER LOCKED

**Thẩm quyền:** Explicit Owner decision dated 2026-08-24. Quyết định này supersede DEC-009 §6 CHỈ ở phần DEC-009 nói Hemorrhoid direction "không phải work package mới được mở bởi quyết định này". Toàn bộ nội dung khác của DEC-009 (điểm 1–5, 7) không thay đổi và vẫn có hiệu lực nguyên vẹn.

Owner chính thức mở work package:

**HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 1**

**Evidence basis:**

External sanitized evidence artifact: `LONGO_ATOMIC_FIELD_DICTIONARY_v1.md`
SHA-256: `e95a240a9d51c73dbabeba0e4c373aa871ca4acf900ed19c95ca38bdff9f3726`

Artifact này chỉ là evidence, không được copy vào repository.

Classification audit:

| Nhóm | Số lượng |
|---|---|
| GENERAL_HEMORRHOID_EXAM | 29 |
| LONGO_SPECIFIC | 4 |
| SURGERY_SPECIFIC | 51 |
| RESEARCH_ONLY | 5 |
| DEFERRED_SEMANTICS | 21 |
| NOT_RELEVANT_TO_GENERAL_EXAM | 8 |
| TOTAL | 118 |
| MISSING | 0 |
| DUPLICATE | 0 |

**A. Encounter clinician**

`Encounter.doctorId` semantics hiện tại được thay thế/tổng quát hóa bởi `responsibleClinicianId` — nghĩa là clinician hiện đang chịu trách nhiệm lâm sàng cho Encounter, tách biệt với các provenance actor: `createdBy`, `completedBy`, `amendedBy`, `AuditEvent.actor`. Không giữ `doctorId` và `responsibleClinicianId` như hai nguồn sự thật lâm sàng cạnh tranh nhau. Dữ liệu hiện có phải được bảo toàn qua một migration được review trong tương lai.

**B. Clinician assignment/handover**

Receptionist được phép gán clinician + room trước khi khám. Pilot default clinician là BS Thái, resolve qua configuration/data hợp lệ, không hard-code unsafe identity. Responsible clinician có thể thay đổi trong quá trình Encounter (handover); handover phải giữ lịch sử và audit provenance; handover bởi actor không được ủy quyền hoặc cross-tenant phải bị REJECT.

**C. Tenant / Facility / Room**

Tenant = customer/security workspace. Facility/Location/Room = physical care location, tách biệt khỏi Tenant. Một patient/CareEpisode có thể có Encounter tại nhiều physical location khác nhau trong cùng một tenant.

**D. Encounter và CareEpisode**

`Encounter.episodeId` vẫn nullable. Hemorrhoid examination ban đầu không bắt buộc phải có Episode. Không tự động tạo hoặc suy luận CareEpisode. Việc gắn một Encounter lịch sử vào một CareEpisode sau này phải là hành vi application tường minh, dưới một contract riêng trong tương lai.

**Hemorrhoid Examination v1 — approved field set (29 GENERAL_HEMORRHOID_EXAM concepts):**

1 historyConstipation · 2 historyPriorAnorectalSurgery · 3 historyRespiratoryDisease · 4 historyDiabetes · 5 historyCirrhosis · 6 historyOtherPregnancyDietBowelHabit · 7 weight · 8 height · 9 pulse · 10 temperature · 11 systolicBloodPressure · 12 diastolicBloodPressure · 13 anemiaStatus · 14 otherGeneralFinding · 15 hemorrhoidGoligherGrade · 16 internalHemorrhoidCount · 17 internalHemorrhoidLocation · 18 externalHemorrhoidCount · 19 externalHemorrhoidLocation · 20 mixedHemorrhoidCount · 21 mixedHemorrhoidLocation · 22 mainHemorrhoidSize · 23 hemorrhoidProlapse · 24 hemorrhoidFibrosis · 25 hemorrhoidBleeding · 26 sphincterTone · 27 rectalMucosaFinding · 28 associatedAnorectalLesion · 29 skinTagFinding

Tất cả field đều available; không field nào required. Một examination submission hoàn toàn rỗng vẫn được phép COMPLETE — không thêm rule "tối thiểu một field phải có giá trị".

**Implementation generalization decisions (approved generalization của evidence concepts, không phải scoring system mới):**

- Internal/External/Mixed hemorrhoid: mỗi nhóm có count/location/size riêng; không dùng cấu trúc lặp per-lesion trong v1.
- Goligher: đúng một field `goligherGrade` mỗi examination (I/II/III/IV), không gắn theo từng hemorrhoid lesion.
- Prolapse tách thành `prolapseSymptom` (patient-reported) và `prolapseObserved` (clinician-observed).
- Bleeding tách thành `bleedingSymptom` (patient-reported) và `bleedingObserved` (clinician-observed).

**Vital copy-forward (weight, height, pulse, temperature, systolicBloodPressure, diastolicBloodPressure):**

Lookup strictly theo cùng `tenantId + patientId`; chỉ xét prior clinical record đã COMPLETED (loại DRAFT); latest xác định theo `Encounter.occurredAt` (không dùng `createdAt`); pre-fill và cho phép edit; persist snapshot của Encounter hiện tại kể cả khi không đổi; amendment lịch sử không được mutate snapshot đã lưu ở record mới hơn; cần deterministic tie-break khi `occurredAt` bằng nhau.

**Deferred / out of Vertical Slice 1** (không mở trong slice này): Diagnosis, Treatment Decision, Medical Treatment, Procedure, generic Surgery, Investigation Order, Investigation Result, HDSS, SHS-HD, anal dilation scoring, Longo difficulty scoring, rectoscopy interpretation, AI, CORE-05 Case Intelligence. CORE-04 Longo vẫn là reusable baseline và clinical semantics đã lock không bị viết lại. Real-patient runtime tiếp tục `NOT AUTHORIZED`.

**Căn cứ:** Owner explicit authorization dated 2026-08-24, dựa trên external sanitized evidence classification (LONGO_ATOMIC_FIELD_DICTIONARY_v1.md, 118/118 concepts classified, 0 missing, 0 duplicate).

---

### DEC-011 — Close Hemorrhoid Vertical Slice 1 and open Vertical Slice 2 Discovery

**Ngày:** 2026-08-25

**Trạng thái:** OWNER LOCKED

**Thẩm quyền:** Explicit Owner authorization dated 2026-08-25 after independent correction re-check.

Owner quyết định:
1. Đóng `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 1` ở mức Technical Acceptance.
2. Accepted baseline: initial `d67e1014b7a21b91f2d04112cf031773f61ed52c`; final correction `2ea529ee200a0a37a77cebb9a750f70adde57618` trên branch `discovery/hemorrhoid-real-world-workflow`.
3. Independent lineage: Codex audit `FAIL` (2 blockers) → correction → targeted verification PASS → focused Codex re-check `PASS` → READY FOR TECHNICAL ACCEPTANCE: YES.
4. Correction evidence: Hemorrhoid E2E `36/36 PASS`; CORE-01 E2E `42/42 PASS`; backend build `PASS`; `git diff --check PASS`; new blockers `NONE`.
5. DEC-010 tiếp tục là authoritative Owner Decision cho Vertical Slice 1; DEC-011 không supersede DEC-010.
6. Mở `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2 DISCOVERY`.
7. Target: `Hemorrhoid Examination → Diagnosis → Treatment Decision → CarePlan / Follow-up`.
8. Slice 2 chỉ được phép Discovery; implementation CHƯA được phép.
9. Discovery phải resolve workflow, Diagnosis/Treatment Decision semantics, CarePlan reuse, follow-up semantics, domain/schema, RBAC, audit/provenance, Timeline, acceptance criteria, implementation contract và unresolved Owner questions = 0.
10. Reuse-first là bắt buộc; đánh giá `Encounter`, `ClinicalFormSubmission`, `CarePlan`, `CarePlanVersion`, `CareTask`, `AuditEvent`, Timeline trước khi tạo model mới.
11. `docs/10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md` là authoritative Hemorrhoid clinical SSOT.
12. `docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md` tiếp tục là authoritative verified Longo sub-workflow SSOT.
13. Procedure, generic Surgery, Investigation, HDSS, SHS-HD, deferred scoring/interpretation, historical import, AI và CORE-05 không tự động được mở.
14. `CORE-05 = CASE INTELLIGENCE — NOT OPENED`.
15. Implementation/test/acceptance: `SYNTHETIC DATA ONLY`.
16. Real-patient runtime và production: `NOT AUTHORIZED`.
17. Slice 2 chỉ chuyển sang implementation bằng Owner Decision mới sau Discovery Gate.

---

### DEC-012 — Lock Hemorrhoid Vertical Slice 2 semantics and authorize implementation

**Ngày:** 2026-08-25

**Trạng thái:** OWNER LOCKED

**Thẩm quyền:** Explicit Owner approval dated 2026-08-25.

**Nguồn chuẩn:**

- `docs/10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md`;
- `docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md`;
- accepted Discovery baseline `eeadfc31ed9819e06fb80c545573a4bba76d952a`.

Owner quyết định:

1. Đóng `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2 DISCOVERY`; Discovery Gate đạt đủ điều kiện và unresolved Owner questions = 0.
2. Mở `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2 IMPLEMENTATION`.
3. Implementation được phép theo `docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md` và không vượt contract.
4. **CD-01:** mỗi Encounter có đúng một logical `HEMORRHOID_DIAGNOSIS` chain; correction dùng append-only amendment lineage.
5. **CD-02:** Diagnosis v1 có `diagnosisSummary` REQUIRED, free text; không tự suy diagnosis từ Examination/Goligher/symptoms/rules/AI.
6. **CD-03:** v1 không ICD, custom taxonomy hoặc automatic classification. Free-text Diagnosis không phải final analytics representation cho CORE-05.
7. **CD-04:** mỗi Encounter có đúng một logical `HEMORRHOID_TREATMENT_DECISION` chain; `decisionSummary` REQUIRED, free text, không taxonomy. `Treatment Decision ≠ Procedure performed ≠ Surgery performed`.
8. **CD-05:** backend enforce `HEMORRHOID_EXAMINATION COMPLETED → HEMORRHOID_DIAGNOSIS COMPLETED → HEMORRHOID_TREATMENT_DECISION COMPLETED → CarePlan → CarePlan SIGNED`. Upstream amendment không auto-rewrite downstream completed/signed records.
9. **CD-06:** general Hemorrhoid CarePlan v1 có `0..1` next clinical follow-up target; không áp Longo multi-timepoint scheduling.
10. **CD-07:** Return Encounter matching explicit only. Doctor chọn CareTask cần hoàn thành; backend lưu `completedByEncounterId`; không heuristic auto-match.
11. **CD-08:** signed CarePlan amendment thay đổi `followUpDate` phải reconcile linked OPEN generic CareTask tường minh trong cùng transaction bằng `RESCHEDULE`, `CANCEL` hoặc `KEEP_WITH_REASON`; `KEEP_WITH_REASON` bắt buộc reason + audit.
12. Transition: `null→date` tạo OPEN task; `date1→date2` dùng `RESCHEDULE` hoặc `KEEP_WITH_REASON`; `date→null` dùng `CANCEL` hoặc `KEEP_WITH_REASON`; unchanged date không yêu cầu action; historical CLOSED task không rewrite.
13. Signed CarePlan amendment request bắt buộc `expectedCurrentVersionId`; stale version → `409 Conflict`.
14. T4 chọn **Option A — SERIALIZABLE TRANSACTION**. Authoritative CarePlan/current version/OPEN task state phải re-read bên trong transaction.
15. Serialization/write conflict → rollback + `409 Conflict`; không automatic retry clinical amendment; không silent last-write-wins.
16. Concurrent amendments không được tạo lost update, CarePlanVersion fork, duplicate user intent hoặc hơn một OPEN generic CareTask.
17. Reuse-first: `Encounter`, `ClinicalFormSubmission`, `CarePlan`, `CarePlanVersion`, `CareTask`, `AuditEvent`, Patient Timeline read projection.
18. Diagnosis/Treatment Decision v1 dùng `ClinicalFormSubmission`; không tạo Diagnosis/TreatmentDecision table.
19. **Schema boundary:** `NO PRISMA SCHEMA CHANGE`; `NO DATABASE MIGRATION`. Nếu migration cần thiết: STOP và xin Owner Decision.
20. RBAC giữ DOCTOR-only cho Diagnosis, Treatment Decision, CarePlan clinical actions và Return Encounter CareTask linkage.
21. Timeline tiếp tục là read projection; amendment history phải được bảo toàn.
22. T4 là mandatory high-risk gate: sau T4 implementation + targeted concurrency tests + ChatGPT source review PASS, bắt buộc đúng một fresh Independent Codex READ-ONLY audit chỉ cho T4; required verdict `READY FOR T4 ACCEPTANCE: YES`.
23. T1/T2/T3/T5/T6 không mặc định cần independent Codex audit. Nếu T4 production code đổi sau audit PASS, T4 gate mở lại cho affected delta.
24. Procedure, generic Surgery, Investigation, HDSS, SHS-HD, deferred scoring/interpretation, AI và CORE-05 không được mở.
25. `CORE-05 = CASE INTELLIGENCE — NOT OPENED`.
26. Implementation/test/acceptance: `SYNTHETIC DATA ONLY`.
27. Real-patient runtime và production: `NOT AUTHORIZED`.
28. `docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md` được OWNER LOCKED và là execution contract cho Slice 2.

**Căn cứ:** DEC-010; DEC-011; source-level Discovery tại `eeadfc31`; Owner approval CD-01→CD-08; concurrency review chọn Serializable + `expectedCurrentVersionId` + mandatory T4 Codex gate.

---

### DEC-013 — Hemorrhoid Vertical Slice 3 Continuous Care Loop

**Ngày:** 2026-08-27

**Trạng thái:** OWNER LOCKED

**Thẩm quyền:** Explicit Owner Decision dated 2026-08-27.

**Nguồn chuẩn:**

- `docs/10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md`;
- `docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md`.

Owner quyết định:

1. Initial Hemorrhoid Encounter remains permanently ungrouped. No `episodeId` PATCH/backfill.
2. `HEMORRHOID_TREATMENT` CareEpisode starts only at first Return Encounter. Resolve ACTIVE episode by tenant + patient + episodeType. `0` ACTIVE = create; `1` ACTIVE = reuse; `>1` ACTIVE = 409.
3. Follow-up uses `HEMORRHOID_FOLLOW_UP_ASSESSMENT` with required free-text `responseSummary`. No outcome taxonomy in v1.
4. Next clinical decision uses `HEMORRHOID_NEXT_CLINICAL_DECISION` with required free-text `decisionSummary`. Do not reuse initial `HEMORRHOID_TREATMENT_DECISION`.
5. CareEpisode close is explicit DOCTOR action only and requires at least one completed Follow-up Assessment belonging to that episode. No automatic close.
6. A new clinical decision on a Return Encounter may create a NEW CarePlan anchored to that Return Encounter. Do not amend an old CarePlan merely to represent a new clinical occurrence.

Cũng ghi nhận:

- Slice 3 Contract v0.1 = OWNER LOCKED.
- T0 governance activation được ủy quyền.
- Chi tiết thiết kế kỹ thuật/concurrency nằm trong Contract, không nằm trong Decision Log.
- Implementation/test/acceptance: SYNTHETIC DATA ONLY.
- Real-patient runtime: NOT AUTHORIZED.
- `CORE-05 = CASE INTELLIGENCE — NOT OPENED`.
- Procedure/generic Surgery/Investigation/AI nằm ngoài phạm vi Slice 3.

**Căn cứ:** Owner explicit authorization dated 2026-08-27; DEC-012 làm nền cho Slice 2; Slice 3 mở rộng sang continuous-care loop dưới cùng clinical SSOT `docs/10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md`.

---

### DEC-014 — Close Hemorrhoid Vertical Slice 3 Technical Execution and move to Owner Synthetic Product Acceptance

**Ngày:** 2026-08-27

**Trạng thái:** `DRAFT — NOT OWNER LOCKED`

Đây là draft, chưa phải Owner Decision có hiệu lực. Không được diễn giải là OWNER LOCKED cho đến khi có Owner lock rõ ràng.

Nội dung/quyết định đề xuất:

1. Ghi nhận PR #5 (`discovery/hemorrhoid-real-world-workflow` → `main`) đã merge vào `main` tại `4a73a0c8764558d2776adffcf1d26092f6456634`.
2. Ghi nhận Hemorrhoid Vertical Slice 3 T0→T7 technical execution là `COMPLETE`.
3. Ghi nhận raw evidence checkpoints:
   - T4 independent Codex READ-ONLY audit PASS tại HEAD `69808c6a52b4b6ec364b338fdeab39e5719487f6`; 12/12 C1-C4 real-PostgreSQL concurrency tests PASS; blockers NONE.
   - T7 re-verified tại HEAD `24b4abec7b932acd329d711f7cb9ca3773b204f3` sau final implementation checkpoint; targeted T7 acceptance file có 3 `it()` blocks (1 golden-path scenario with internal assertions covering all 22 steps + 2 negative tests).
   - T7 re-confirmed against merged `main` HEAD `4a73a0c8764558d2776adffcf1d26092f6456634`.
4. Ghi nhận T7 raw re-verification thực hiện trực tiếp trên merged `main`:
   - targeted T7 acceptance: 3/3 PASS;
   - backend E2E: 331/331 PASS;
   - frontend unit/component: 37/37 PASS;
   - backend build: PASS;
   - frontend build/typecheck: PASS;
   - Prisma migrations: current, không có migration pending;
   - worktree: clean (trước và sau khi chạy).
5. Nêu rõ: technical acceptance KHÔNG đồng nghĩa với Owner product acceptance.
6. Chuyển current gate sang `OWNER SYNTHETIC PRODUCT ACCEPTANCE — Slice 1→3`.
7. Gate này yêu cầu xác nhận rõ ràng từ Owner/BS Thái và không thể tự đóng bởi GPT, Claude Code, Codex, hoặc automated tests.
8. DEC-014 KHÔNG cấp phép: Slice 4; CORE-05; real-patient runtime; production; Procedure; generic Surgery; Investigation; AI functionality.
9. Current work package sau Slice 3: `NONE` — chờ Owner Synthetic Product Acceptance.
10. Real-patient runtime: `NOT AUTHORIZED`; Production: `NOT AUTHORIZED`; CORE-05: `NOT OPENED`.

**Owner lock:** CHƯA có. DEC-014 vẫn là DRAFT cho đến khi Owner khóa rõ ràng.

---

## WORKING ASSUMPTIONS

| ID | Nội dung | Nguồn gốc | Trạng thái |
|---|---|---|---|
| A-001 | Chuyên khoa đầu tiên: tiêu hóa (gastroenterology). | Working Product Hypothesis từ giai đoạn thiết kế ban đầu. | ACTIVE — chưa Owner-confirmed. |
| A-002 | BS Thái có thể đóng vai trò Design Partner ngoài vai trò first pilot user. | AI recommendation / product working hypothesis. | ACTIVE — chưa Owner-confirmed. |

---

## RECLASSIFIED / MOVED TO NORMATIVE HOME

- A-003 — Domain model candidate được quản lý tại
  `04_CORE_DOMAIN_MODEL.md`.

- A-004 — Patient identity/matching invariant được quản lý tại
  `04_CORE_DOMAIN_MODEL.md` và `05_ARCHITECTURE_BASELINE.md`.

Các mục trên không bị hủy; chúng chỉ không còn thuộc Decision Log.

---

## SUPERSEDED

- DEC-009 §6 (chỉ phần câu "Đây là direction, không phải work package mới được mở bởi quyết định này") — superseded by [[DEC-010]] (2026-08-24), việc mở HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 1. Toàn bộ nội dung khác của DEC-009 (điểm 1–5, 7) không đổi.

---

Nguyên tắc:
- Chỉ Owner có thể tạo Owner Decision.
- Không tự nâng Working Assumption thành Owner Decision.
- Technical/domain invariants phải nằm tại normative home tương ứng,
  không dùng Decision Log làm task tracker hoặc design specification.
