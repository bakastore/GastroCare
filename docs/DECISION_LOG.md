# GastroCare — Decision Log

Cập nhật: 2026-08-31

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

### DEC-015 — Encounter Workflow Discriminator v1

**Ngày:** 2026-08-27

**Trạng thái:** OWNER LOCKED

Owner khóa:

1. `Encounter.workflowKind` là persisted nullable workflow discriminator.
2. v1 chỉ định nghĩa `HEMORRHOID_INITIAL`.
3. `workflowKind` là generic extension point của `Encounter`; việc v1 chỉ có
   `HEMORRHOID_INITIAL` không hàm ý Core vĩnh viễn chỉ dùng field này cho
   Hemorrhoid.
4. Generic ungrouped Encounter giữ `workflowKind = NULL`.
5. Initial Hemorrhoid Encounter phải được tạo tường minh với
   `workflowKind = HEMORRHOID_INITIAL`.
6. Longo Encounter và Hemorrhoid Return tiếp tục lấy workflow identity từ
   `CareEpisode.episodeType`; không duplicate identity vào `workflowKind`.
7. Không suy luận `workflowKind` từ `reasonForVisit`, clinical text,
   ClinicalForm existence, CareTask existence, URL, frontend state hoặc
   heuristic khác.
8. Existing rows giữ `NULL`; không heuristic backfill.
9. Timeline read projection phải expose `workflowKind`.
10. Synthetic data only tại gate này; quyết định không cấp phép
    real-patient runtime hoặc production.

**DEC-015 M0 migration checkpoint:** `CLOSED — PASS`.

Verified:
- seeded PRE migration Encounter count = 10;
- APPLY #1 PASS;
- existing 10/10 Encounter giữ workflowKind NULL;
- real DB restore về pre-migration PASS;
- DEC-015 trở lại pending sau restore;
- APPLY #2 PASS;
- backup/restore regression PASS trên 10-migration history;
- no heuristic backfill/data loss.

---

### DEC-016 — Case / TreatmentPathway / Investigation Core

**Ngày:** 2026-08-28

**Trạng thái:** OWNER LOCKED (Owner prompt Session A; Contract v0.3 OWNER LOCKED được Owner xác nhận).

Nguồn được lưu tại [DEC016_OWNER_AUTHORITY.md](DEC016_OWNER_AUTHORITY.md). Không có bản Contract v0.3 đầy đủ trong repository khi T0; Owner cho phép dùng yêu cầu trong prompt, không dừng vì thiếu external convenience copy.

Owner mở T0 → M0 → M7 liên tục, không routine checkpoint approval, implementation/testing và technical docs. Không commit/push/deploy/real data. Case dùng physical CareEpisode; Initial có Case ngay; Return chỉ reuse; TreatmentPathway đa modality, explicit surgery method; Longo đổi ancestry sang Case + SURGERY/LONGO pathway; Decision v2 đa modality; Investigation parent/Order/Result và NURSE assigned raw-result scope. PDF/image storage, AI, CORE-05 vẫn ngoài phạm vi.

DEC-016 supersedes DEC-015 §6 ở phần Longo identity: identity nay qua TreatmentPathway, không còn direct LONGO_TREATMENT Case. Supersedes quy tắc Initial permanently ungrouped và Return creates Case của Slice 2/3, cùng giới hạn không được schema/Investigation/Surgery của các work package cũ. Không đổi clinical scoring, clinical semantics deferred hoặc quyền Owner product acceptance.

Domain/architecture/privacy normative overlays: docs/04, 05, 06. Implementation notes/evidence: [13_DEC016_CASE_PATHWAY_IMPLEMENTATION.md](13_DEC016_CASE_PATHWAY_IMPLEMENTATION.md). Sau M7: **FRESH CODEX SESSION B — INDEPENDENT READ-ONLY AUDIT**; Session A không tự gọi mình là independent auditor.

---

### DEC-017 — SSOT Reconciliation: baseline 6dd8d52, DEC-016 audit outstanding, AppSidebar OWNER LOCKED

**Ngày:** 2026-08-29

**Trạng thái:** OWNER LOCKED

Owner xác nhận commit `6dd8d5226b6f4d2c264227226cb996900aa3d9f6` trên branch
`correction/owner-acceptance-slice1-3` là chủ đích, chấp nhận tạm thời do áp
lực thời gian — cần bản demo UI/UX để trình bày cho BS Thái. Commit này gộp
hai việc: (1) DEC-016 backend implementation T0→M7, (2) Demo UI/UX
(`frontend/src/pages/admin/*`, `AppSidebar.tsx`, các route `/admin/*`).

Owner xác nhận `frontend/src/components/AppSidebar.tsx` — "DEMO UI
NAVIGATION STRUCTURE v1" — là OWNER LOCKED.

Baseline implementation checkpoint thực tế của
`correction/owner-acceptance-slice1-3` tại thời điểm DEC-017 là `6dd8d52`.
Baseline `c0dfe1a4` ghi trong PROJECT_STATE.md trước DEC-017 đã lỗi thời kể
từ checkpoint trên; mô tả "Worktree chưa commit theo lệnh Owner" không còn
phản ánh trạng thái repository checkpoint và được thay thế bởi DEC-017.

Commit/push diễn ra trước khi FRESH CODEX SESSION B — INDEPENDENT READ-ONLY
AUDIT chạy trên DEC-016 backend. Đây không phải waiver cho yêu cầu independent
audit. Tại thời điểm DEC-017, DEC-016 backend giữ trạng thái `TECHNICAL
EXECUTION COMPLETE (SELF-ATTESTED BY SESSION A) — INDEPENDENT AUDIT
OUTSTANDING` cho đến khi Codex Session B chạy trên implementation checkpoint
`6dd8d52` và PASS, hoặc mọi finding được xử lý và đóng theo governance. Điều
kiện này đã được thỏa vào 2026-08-29 — xem "DEC-016 independent audit
closure" bên dưới.

Không đổi: DEC-016 clinical/domain scope
(Case/TreatmentPathway/Investigation), Owner product acceptance và các Owner
Decision trước đó.

Next gate tại thời điểm DEC-017: Codex Session B — Independent Read-only Audit
trên implementation checkpoint `6dd8d52`, không sửa code (đã hoàn tất
2026-08-29). Sau khi audit gate DEC-016 được đóng mới mở DEC-018 — Admin
Boundary / User Management.

**DEC-016 independent audit closure — 2026-08-29**

Fresh Codex Session B completed an independent focused read-only audit against
DEC-016 implementation checkpoint
`6dd8d5226b6f4d2c264227226cb996900aa3d9f6`.

Result: **PASS**.

Audited risk areas:
- Schema/Migration — PASS
- Case/TreatmentPathway domain invariants — PASS
- Investigation/Authorization — PASS
- Transaction/Concurrency — PASS
- Tenant Isolation/Provenance — PASS

Targeted DEC-016/concurrency tests: 27/27 PASS.
PRE-DEC016 → DEC-016 migration deployment probe: PASS.
Prisma schema validation: PASS.
Findings: NONE.
Blockers: NONE.
Audit changed no repository files.

DEC-016 technical status is therefore:
`TECHNICAL EXECUTION COMPLETE — INDEPENDENT FOCUSED AUDIT CLOSED — PASS`.

This closes the technical independent-audit gate only. This audit result is a
verified technical verification, not a new Owner Decision. Owner product
acceptance remains NOT CLAIMED; real-patient runtime, production and CORE-05
remain NOT AUTHORIZED / NOT OPENED.

Next work package eligible to open: DEC-018 — Admin Boundary / User Management
(architecture + Implementation Contract). DEC-018 is not yet OWNER LOCKED and
implementation remains unopened.

---

### DEC-018 — Admin Boundary & Identity Realms

**Ngày:** 2026-08-29

**Trạng thái:** OWNER LOCKED

Operational roles giữ nguyên DOCTOR / NURSE / RECEPTIONIST.

Clinic Admin là capability độc lập (`AuthUser.isClinicAdmin`), không phải
operational role. `AuthUser.tenantId` tiếp tục bắt buộc.

System Admin là identity realm riêng (`SystemAdminUser`) và không có clinical
access mặc định; System Admin implementation deferred ngoài Phase 1.

Tenant JWT v1 chỉ chứa `sub`, `realm=TENANT`, `sessionVersion`. Request
authority (`tenantId`, `role`, `email`, `isClinicAdmin`, `status`,
`mustChangePassword`) phải resolve từ current AuthUser trong DB.

Last Clinic Admin invariant phải concurrency-safe bằng SERIALIZABLE
transaction; no automatic retry; serialization/write conflict map 409;
mandatory concurrent test phải chứng minh ACTIVE Clinic Admin không xuống < 1.

Canonical Clinic Admin routes là `/clinic-admin/*`; legacy frontend
`/admin/*` bị loại bỏ, không compatibility redirect.

DEC-018 supersedes chỉ admin-route/admin-visibility portion của DEC-017 Demo
Navigation v1. Các nguyên tắc navigation còn lại không đổi.

Owner cho phép implementation T0→T8 theo
`docs/14_ADMIN_BOUNDARY_USER_MANAGEMENT_IMPLEMENTATION_CONTRACT.md`
với SYNTHETIC DATA ONLY.

System Admin implementation, real-patient runtime, production, CORE-05,
break-glass access và generic permission engine vẫn OUT OF SCOPE.

External review requirement: CLOSED — PASS.

---

### DEC-018 CLOSURE — Owner Synthetic Acceptance PASS

**Ngày:** 2026-08-30

**Trạng thái:** OWNER ACCEPTED — DEC-018 Admin Boundary / User Management v1
T0 → T8 CLOSED.

Không sửa hay rút gọn phần OWNER LOCKED phía trên; đây là mục bổ sung ghi
nhận việc đóng gate. Contract v0.2 locked requirements không đổi.

**T7 — Fresh Codex independent focused read-only audit:** COMPLETED.

- Kết quả đầu tiên: **FAIL** với đúng 1 finding mức **MEDIUM** — một AuthUser
  đã `DISABLED` (role DOCTOR hoặc NURSE) vẫn có thể xuất hiện trong
  `GET /investigations/assignees` và được chấp nhận làm assignee MỚI qua
  `POST /investigations/:id/orders`, trái với invariant DEC-018 "DISABLED
  account must not be a NEW assignment target".
- Remediation (F1): thêm điều kiện `status = ACTIVE` vào cả hai đường dẫn
  trong `backend/src/investigations/investigations.service.ts` (`order()`
  assignee validation và `assignees()` selectable list); giữ nguyên tenant
  scoping, lifecycle, completion semantics, NURSE result-entry, và các
  historical assignment đã tồn tại. Bổ sung E2E targeted trong
  `backend/test/dec016-case-workspace.e2e-spec.ts` (CASE 1 danh sách,
  CASE 2 validation, CASE 3 active vẫn hợp lệ, CASE 4 tenant isolation, +
  historical assignment sống sót sau khi user bị disable). Full backend
  e2e 378/378.
- Owner đã review remediation và **chấp nhận đóng T7**. Lịch sử FAIL +
  remediation ở trên được giữ nguyên làm hồ sơ.

**T8 — Owner Synthetic Acceptance:** **PASS** (Owner declaration 2026-08-30),
gồm **T8.9 Last Clinic Admin protection PASS** (SERIALIZABLE transaction,
no automatic retry, serialization/write conflict → 409, mandatory concurrent
acceptance test chứng minh ACTIVE Clinic Admin không xuống < 1).

Các correction UX được Owner chấp nhận trong T8:

- reset-password: modal bàn giao mật khẩu tạm một lần (one-time handoff);
- hệ thống thông báo (toast) thống nhất cho mọi mutation DEC-018
  (PROCESSING / SUCCESS / ERROR, chống double-click);
- đơn giản hoá trang Người dùng (tìm kiếm + danh sách + nút "+");
- create-user chuyển sang modal;
- edit-user chuyển từ inline form sang modal.

**Non-blocking UX note (ghi nhận, không chặn acceptance):** tương tác thẻ
Cơ sở/Phòng (Facility/Room card) có thể làm rõ hơn ở một pass sau.

**OUT OF SCOPE không đổi:** System Admin (`SystemAdminUser`,
`/system-admin/*`), production deployment, real-patient runtime, CORE-05,
break-glass access, generic permission engine.

**Next:** chưa mở work package mới. Bước kế tiếp là Owner Decision /
DEC-019 discovery. DEC-019 CHƯA được tạo.

DEC-018 T0→T8 sau đó đã được commit tại remote checkpoint
`7d33e02c36f5e862c50717c340deea86ad046e47` (baseline cho DEC-019).

---

### DEC-019 — Staff Profile & Credential Management v1

**Ngày:** 2026-08-30

**Trạng thái:** OWNER LOCKED

**Thẩm quyền:** Explicit Owner authorization dated 2026-08-30. DEC-019 OWNER LOCKED
và Implementation Contract v0.1 OWNER LOCKED.

**Nguồn chuẩn:**

- `docs/DEC-019_STAFF_PROFILE_CREDENTIAL_MANAGEMENT.md`;
- `docs/15_STAFF_PROFILE_CREDENTIAL_MANAGEMENT_IMPLEMENTATION_CONTRACT.md`;
- baseline DEC-018 CLOSED — OWNER ACCEPTED — remote checkpoint
  `7d33e02c36f5e862c50717c340deea86ad046e47`.

Owner quyết định:

1. Mở work package `STAFF PROFILE & CREDENTIAL MANAGEMENT v1`.
2. `AuthUser` vẫn là entity authentication/account/operational role/Clinic Admin
   capability; roles vẫn chính xác `DOCTOR`, `NURSE`, `RECEPTIONIST`; không thêm
   `ADMIN` role.
3. `StaffProfile` là hồ sơ nghề nghiệp 1:1 optional, tách khỏi `AuthUser`; không
   field nào của StaffProfile trở thành authentication hoặc clinical
   authorization authority. DEC-019 không đổi Clinical Core authorization
   semantics DEC-010→018 và không đổi nghĩa `AuthRole`/clinician assignment.
4. Bốn entity mới: `StaffProfile`, `StaffCredential`, `EmploymentHistory`,
   `StaffFacilityAssignment`; mỗi bảng mang `tenantId` trực tiếp; `tenantId`
   không bao giờ nhận từ request DTO; tenant isolation enforce ở backend.
5. Credential effective `EXPIRED` là derived, không persist; precedence
   `REVOKED > EXPIRED > ACTIVE`. Employment overlap được phép.
6. `StaffFacilityAssignment`: nhiều active facility được phép nhưng đúng một
   active primary khi còn active assignment; đổi primary không kết thúc
   assignment cũ; history không hard-delete; `facilityId`/`staffProfileId` bất
   biến sau tạo. Partial unique indexes trên PostgreSQL là concurrency guard
   cuối cùng — không `SERIALIZABLE`, không automatic retry; unique conflict /
   `P2002` → `409 Conflict`. Change-primary và end-primary dùng ordered writes
   trong một transaction (demote/end trước, promote sau).
7. `StaffCredential` và `EmploymentHistory` được hard-delete với audit atomic;
   `StaffFacilityAssignment` không hard-delete.
8. `avatar`/binary file storage, credential scan/PDF, object storage, Staff
   Directory, `/clinicians` enrichment, roster/scheduling, payroll,
   attendance/leave, employment contracts, CCCD/passport, home address, bank
   account, System Admin, generic permission engine, facility-based clinical
   ACL, CORE-05, AI đều OUT OF SCOPE.
9. A-001 product-specialty hypothesis độc lập với staff specialty; DEC-019 không
   resolve/supersede/phụ thuộc A-001.
10. Execution: Claude Code triển khai liên tục `T0 → T6` theo Contract; `T7` là
    Fresh Codex independent focused read-only audit tách khỏi implementation
    session; `T8` là Owner Synthetic Acceptance — AI/agent không tự đóng PASS.
11. `SYNTHETIC DATA ONLY`; real-patient runtime và production vẫn
    `NOT AUTHORIZED`. Không commit/push/merge/tag nếu chưa có Owner
    authorization riêng.

**Căn cứ:** DEC-018 CLOSED — OWNER ACCEPTED; Owner explicit authorization
2026-08-30; external repo-grounded review CLOSED — PASS (1 MEDIUM execution-order
ambiguity + 1 LOW wording issue corrected trước Owner Lock).

---

### DEC-019 CLOSURE — Owner-directed governance closure

**Ngày:** 2026-08-31

**Trạng thái:** OWNER CLOSED.

Không sửa hay rút gọn phần OWNER LOCKED phía trên; đây là mục bổ sung ghi nhận
việc Owner đóng work package theo chỉ đạo trực tiếp.

Owner quyết định (2026-08-31):

1. `DEC-019 — Staff Profile & Credential Management v1` = **OWNER CLOSED** kể từ
   2026-08-31.
2. `T7` (Fresh Codex independent focused read-only audit) = **WAIVED BY OWNER —
   NOT EXECUTED**.
3. `T8` (Owner Synthetic Acceptance) = **WAIVED BY OWNER — NOT EXECUTED**.
4. Không có tuyên bố PASS / acceptance nào cho DEC-019: không T7 PASS, không T8
   PASS, không Owner Synthetic Acceptance PASS, không Technical Acceptance bổ
   sung, không Product Acceptance.
5. Phần implementation DEC-019 hiện có (schema + additive migration + backend
   `backend/src/staff/` + frontend User Detail / self profile + tests) được giữ
   nguyên trong working tree; không rollback, không xóa.
6. Không có công việc DEC-019 nào khác được authorize. T0→T6 execution history
   được giữ làm hồ sơ; T7/T8 không còn là gate đang chờ.
7. Real-patient runtime và production vẫn `NOT AUTHORIZED`. DEC-019 closure không
   mở real data, pilot thật, production hoặc CORE-05.
8. Clinical/domain semantics của DEC-019 và DEC-010→018 không đổi.

**Căn cứ:** Owner-directed governance closure 2026-08-31; Owner chọn dừng
DEC-019 ở mức implementation hiện có mà không chạy T7/T8.

---

### DEC-020 — Hemorrhoid Clinical Workflow Reconciliation & Functional Clinical UX

**Ngày:** 2026-08-31

**Trạng thái:** OWNER LOCKED

**Locked reference baseline:** `a2059ff6ea2796eee0a798d754b95e70221d2504`
(branch `correction/owner-acceptance-slice1-3`).

**Nguồn chuẩn:**

- `docs/DEC-020_HEMORRHOID_CLINICAL_WORKFLOW_RECONCILIATION_FUNCTIONAL_UX.md` (DEC-020 v0.2);
- `docs/DEC-020_PACKAGE_A_WORKFLOW_SEMANTIC_RECONCILIATION_IMPLEMENTATION_CONTRACT.md` (Package A Contract v0.2);
- baseline DEC-019 — OWNER CLOSED — `a2059ff6ea2796eee0a798d754b95e70221d2504`.

**External pre-lock review:** COMPLETED (one external pass, 2026-08-31).

**Documented baseline-review limitation:** ACCEPTED BY OWNER — reviewer could not
fetch local baseline `a2059ff6...` from the remote (checkpoint chưa push tại thời
điểm review); review repo-grounded against nearest accessible state. Package A T0
local source verification vẫn BẮT BUỘC và BLOCKING trước bất kỳ code change.

Owner quyết định (2026-08-31):

1. `D20-01` … `D20-13` = **AUTHORITATIVE** cho đúng phạm vi nêu trong từng
   section. Selective supersession map (DEC-020 §18) = **AUTHORITATIVE**.
2. Trọng tâm: `CareEpisode` hình thành tại first Return Encounter; Initial
   Hemorrhoid Encounter (`workflowKind = HEMORRHOID_INITIAL`) giữ `episodeId =
   null`; không heuristic Case inference; Doctor-only explicit close; bỏ hard
   Follow-up Assessment prerequisite (chỉ bỏ phần "hard prerequisite"); Doctor
   chọn reopen-cũ vs start-new sau closure; Functional Clinical UX mở trong
   Clinical Core, Full Product Refinement vẫn DEFERRED.
3. DEC-020 dùng **selective supersession**, không blanket-supersede DEC-010→019.
   DEC-019 vẫn **OWNER CLOSED**. Các capability DEC-016 (TreatmentPathway,
   Investigation, provenance, multi-modality Treatment Decision, Longo-as-Pathway)
   **PRESERVED** trừ khi một Contract sau này đổi rõ ràng.
4. Clinical safety boundary (DEC-020 §17) không đổi: automatic diagnosis /
   classification / abnormal-result interpretation / treatment recommendation /
   rule-engine advice / AI clinical reasoning / automatic ICD coding / legal
   e-signature claim đều **OUT OF SCOPE**.

**Implementation decomposition (DEC-020 §19):**

- **Package A — Workflow Semantic Reconciliation — P0** — Contract
  `docs/DEC-020_PACKAGE_A_WORKFLOW_SEMANTIC_RECONCILIATION_IMPLEMENTATION_CONTRACT.md`
  v0.2 = **OWNER LOCKED** (2026-08-31).
  - Execution authority: `T0 → T9 AUTHORIZED` trong một continuous Claude Code
    implementation session, **subject to mandatory T0 STOP conditions**. T0 là
    BLOCKING local source verification gate; nếu một Contract STOP condition xuất
    hiện thì STOP cả session và báo Owner.
  - Post-implementation: `T10` = ChatGPT direct source review; sau đó `T11` =
    fresh Codex focused independent audit (session khác implementation session,
    delta-focused: transaction/concurrency, single-active invariant,
    initial/return Case ancestry, reopen/new race, close side effects, synthetic
    reconciliation).
- **Package B — Hemorrhoid Clinical Fidelity + Functional UX** — Contract
  chuẩn bị/review riêng; implementation **NOT ACTIVE / NOT AUTHORIZED** trong
  DEC-020.
- **Package C — Procedure / Investigation evolution** — DISCOVERY-DEPENDENT;
  implementation **NOT AUTHORIZED** trong DEC-020.

**Không được claim (tại thời điểm ghi nhận DEC-020 vào SSOT, 2026-08-31):**
Package A completed / Package A PASS / Technical Acceptance / Product Acceptance /
`T10` completed / `T11` completed. Không có gate nào của Package A được PASS tại
thời điểm đó. *(Trạng thái hiện tại: xem `DEC-020 PACKAGE A CLOSURE` phía dưới —
`T10` PASS, `T11` focused re-audit PASS — NO P0/P1, Package A OWNER CLOSED;
Product/production acceptance vẫn KHÔNG được claim.)*

**Ranh giới không đổi:** `SYNTHETIC DATA ONLY`; real-patient runtime `NOT
AUTHORIZED`; production `NOT AUTHORIZED`; AI clinical reasoning `NOT AUTHORIZED`.
Git commit / push / merge / tag **KHÔNG** được DEC-020 ngầm cho phép — vẫn cần
Owner authorization riêng theo repository governance.

**Căn cứ:** Explicit Owner Lock 2026-08-31 (DEC-020 v0.2 §24; Package A Contract
v0.2 §21); external pre-lock review COMPLETED; documented baseline-review
limitation EXPLICITLY ACCEPTED BY OWNER.

---

### DEC-020 PACKAGE A CLOSURE — Owner closure of Workflow Semantic Reconciliation

**Ngày:** 2026-08-31

**Trạng thái:** `DEC-020 Package A — Workflow Semantic Reconciliation` = **OWNER
CLOSED**.

Không sửa hay rút gọn phần DEC-020 OWNER LOCKED phía trên; đây là mục bổ sung ghi
nhận việc Owner đóng Package A. DEC-020 v0.2 clinical/domain semantics và Package A
Contract v0.2 implementation semantics **không đổi** — vẫn OWNER LOCKED.

**Execution-START baseline:** `a03b1878dd42ca80956418c67da6f79d0b560572` — nơi
Package A execution bắt đầu. Giữ **distinct** với `A_CLOSED_SHA`; không relabel.

**`A_CLOSED_SHA` = `0c865a26c4425a1c3fe429bb8e42238562025801`** — commit `0c865a2`
`feat: checkpoint DEC-020 Package A owner-closed`. Đây là Package A OWNER-CLOSED
implementation checkpoint (immutable). Package A implementation + T10/T11
corrections + closure governance được included trong checkpoint này và đã
**COMMITTED**. Không amend `0c865a2`.

**Execution / review history (ghi đúng trình tự thực tế, không viết lại như thể
initial T11 đã pass):**

1. `T0 → T9` — COMPLETED (Claude Code implementation session; no Contract STOP
   condition; no Prisma schema change; no migration; SYNTHETIC DATA ONLY).
2. `T10` — ChatGPT direct source review — **PASS**.
3. `T11` initial — fresh Codex independent focused audit — **FAIL — CORRECTION
   REQUIRED**. Initial severity: `P0=0 / P1=1 / P2=2 / P3=0`.
4. Correction batch — **COMPLETED** (addressed the initial `P1` + the two initial
   `P2` items).
5. Focused source recheck — **PASS**.
6. `T11` focused independent re-audit — **PASS — NO P0/P1**. Final severity:
   `P0=0 / P1=0 / P2=1 / P3=0`.

**Owner quyết định (2026-08-31):**

1. Owner **CLOSE** Package A của DEC-020. Execution-START baseline `a03b1878...`;
   Package A OWNER-CLOSED implementation checkpoint `A_CLOSED_SHA` =
   `0c865a26c4425a1c3fe429bb8e42238562025801`.
2. Owner chấp nhận: `T10` PASS; `T11` focused re-audit PASS — NO P0/P1.
3. Residual **P2 — Unicode reason-length parity** = **NON-BLOCKING, DEFERRED** —
   không chặn Package A closure. Technical note: standalone `POST
   /care-episodes/:id/reopen` và atomic Return `REOPEN_EXISTING` khác nhau gần
   biên 500 ký tự Unicode vì transaction lifecycle helper đếm JavaScript
   `String.length` / UTF-16 code units. Ví dụ independent re-audit đưa ra:
   `'r'.repeat(499) + '🙂'` → standalone reopen: accepted; atomic recurrence
   reopen: rejected. **Không** ảnh hưởng transaction atomicity, single-active
   invariant, tenant isolation, audit integrity, hay data corruption/loss.
   Không fix trong task closure; giữ ở trạng thái deferred/known-issue.
4. Owner closure của Package A **KHÔNG** phải Product Acceptance và **KHÔNG** phải
   production acceptance.

**Owner explicitly KHÔNG authorize:**

- Package B implementation — `NOT STARTED, NOT IMPLEMENTATION-AUTHORIZED`.
  Prerequisite "Package A clean checkpoint" **đã SATISFIED** (`A_CLOSED_SHA` =
  `0c865a26c4425a1c3fe429bb8e42238562025801` tồn tại), nhưng Package B vẫn cần một
  chuỗi riêng: authority rebind về `A_CLOSED_SHA` → Package B review / Owner lock
  decision → explicit Owner implementation authorization nếu approve. Không
  activate bất kỳ Package B draft nào; không đổi Package B DRAFT thành OWNER
  LOCKED; không implement gì cho Package B.
- Package C — DISCOVERY-DEPENDENT; implementation NOT AUTHORIZED.
- production deployment — `NOT AUTHORIZED` (Package A closure/checkpoint/push
  không phải production acceptance).
- real-patient runtime / real-patient data — `NOT AUTHORIZED`.
- merge, tag — `NOT AUTHORIZED`.

**Repository state:** Package A implementation + T10/T11 corrections + closure
governance đã **COMMITTED** tại `A_CLOSED_SHA`
`0c865a26c4425a1c3fe429bb8e42238562025801` (commit `0c865a2`). Owner đã authorize
một governance-reconciliation commit (`docs: reconcile DEC-020 Package A closed
checkpoint`) và một fast-forward push của branch
`correction/owner-acceptance-slice1-3` lên `origin` (closure checkpoint +
governance reconciliation commit). Không merge, không tag, không force push.

**Next gate:** Package B authority rebind về `A_CLOSED_SHA`
`0c865a26c4425a1c3fe429bb8e42238562025801` → Package B review / Owner lock
decision → separate Owner implementation authorization nếu approve. Không có audit
loop tiếp theo cho Package A.

**Căn cứ:** Explicit Owner closure decision 2026-08-31; `T10` PASS; `T11` initial
FAIL → correction batch COMPLETED → focused recheck PASS → `T11` focused
independent re-audit PASS — NO P0/P1.

---

### DEC-020 PACKAGE B — OWNER LOCK AND IMPLEMENTATION AUTHORITY

**Ngày:** 2026-08-31.
**Authority:** Owner Lock / implementation decision — Package B
`Clinical Form Fidelity + Functional UX`; đây là record bổ sung, không sửa historical DEC-020 Owner Lock
hoặc Package A closure. Package B chưa được tự động authorize ở thời điểm DEC-020
ban đầu locked; authority dưới đây được Owner cấp sau đó.

1. Package B / Contract v0.2 = **OWNER LOCKED**. Canonical SSOT:
   [`DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_IMPLEMENTATION_CONTRACT.md`](DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_IMPLEMENTATION_CONTRACT.md).
2. External pre-lock review = **COMPLETED — PASS** (theo Owner-supplied reviewed
   artifact / explicit authority; không phải review mới do B-GOV thực hiện).
3. Material blockers = **NONE**.
4. **No clinical/product or T0→T12 substantive implementation requirement changed
   at Owner Lock.** Execution-baseline/checkpoint governance được thay đổi sau đó
   bởi explicit Owner overlay ghi riêng bên dưới; không coi `B_GOV_SHA` là nội
   dung của original reviewed v0.2. External review gốc vẫn historically valid;
   không cần review lần hai cho thay đổi execution-governance-only này.
5. Package A prerequisite = **SATISFIED / OWNER CLOSED**. Package A semantics,
   execution/review history và residual **P2 — Unicode reason-length parity**
   (**NON-BLOCKING, DEFERRED**) giữ nguyên; không mở thêm audit loop cho A.
6. Package B `T0→T12` implementation = **explicitly OWNER AUTHORIZED**, subject to
   Contract T0 blocking verification và STOP conditions. Implementation **NOT YET
   STARTED**; task B-GOV chỉ landing governance, không thực hiện T0→T12.
7. Immutable Package A closure checkpoint **`A_CLOSED_SHA` =
   `0c865a26c4425a1c3fe429bb8e42238562025801`**; execution-START baseline
   `a03b1878dd42ca80956418c67da6f79d0b560572` vẫn là checkpoint khác.
8. **Historical reviewed v0.2 rule:** Contract yêu cầu rebind về clean Package A
   closure/checkpoint SHA; Map yêu cầu literal `A_CLOSED_SHA`. **Newer Owner
   overlay** bên dưới cho phép future clean governance-only descendant
   `B_GOV_SHA` sau corrected B-GOV review và governance commit/push được Owner
   authorize riêng. Đây là thay đổi execution governance sau review gốc.
   Pre-B-GOV checkpoint đã verify:
   `cdc4f2321f7176fd3c50023d7dd17676c0cd92f6`, branch
   `correction/owner-acceptance-slice1-3`; working tree CLEAN; `A_CLOSED_SHA`
   ancestor; post-A delta governance/docs only. Pre-B-GOV HEAD cũng không được
   relabel thành Package B execution baseline.
9. **`B_GOV_SHA` chưa được gán**; không invent SHA trước commit thật. Khi có
   checkpoint sạch, Package B T0 phải satisfy toàn bộ sáu điều kiện overlay bên
   dưới (ancestry, docs-only range, no unexplained application delta, CLEAN,
   đúng branch, actual HEAD ghi thành `PACKAGE_B_BASE_SHA`).
10. Package C = **NOT ACTIVE / DRAFT / DISCOVERY-DEPENDENT / NOT
    IMPLEMENTATION-AUTHORIZED**; không mở C0 trong B-GOV.
11. Production, real-patient runtime/data và AI clinical reasoning vẫn **NOT
    AUTHORIZED**; SYNTHETIC DATA ONLY. Không suy ra Product/production acceptance.
12. Owner authority này **không authorize commit / push / merge / tag**; B-GOV
    không `git add`, commit, push, merge, tag, rebase, reset, stash hoặc tạo PR.

**Coordination map:**
[`DEC-020_MASTER_EXECUTION_MAP.md`](DEC-020_MASTER_EXECUTION_MAP.md) — giữ dependency
A → B → C; được landing từ exact Owner-supplied Master Execution Map v0.2, chỉ
reconcile governance state/gates theo Owner Lock và execution-baseline mechanics
theo subsequent Owner overlay; không gán overlay này cho reviewed v0.2 artifact.

**Next gate:** ChatGPT direct review of corrected B-GOV diff → Owner decision → Owner separately authorizes one governance-only commit/push → actual resulting commit SHA becomes `B_GOV_SHA` → working tree/branch verified clean → Package B T0.

Sau T0→T12: ChatGPT direct source review → Owner + BS Thái browser/workflow
acceptance → Owner Package B closure decision → separately authorized clean
`B_CLOSED_SHA`. Codex focused independent audit không phải default Package B gate;
chỉ relevant nếu xuất hiện Prisma/schema migration, transaction/concurrency
invariant hoặc high-risk authorization/data-integrity delta cần independent
verification, theo Contract và STOP conditions.

**Căn cứ:** Explicit Owner Package B Lock / implementation authority 2026-08-31
và hai exact authoritative artifacts do Owner cung cấp:
`DEC-020_PACKAGE_B_CLINICAL_FORM_FIDELITY_FUNCTIONAL_UX_CONTRACT_DRAFT_v0.2.md`;
`DEC-020_MASTER_EXECUTION_MAP_v0.2.md`. Canonical documents ghi SHA-256
của source artifacts để đối chiếu; historical DEC-020 document và Package A
Contract/closure không bị viết lại.

---

### DEC-020 PACKAGE B — EXECUTION-BASELINE GOVERNANCE OVERLAY

**Newest Owner decision:** 2026-08-31 — **APPROVED**, subsequent to the original
external pre-lock review and Package B Owner Lock. Đây là authority riêng về
execution governance, không rewrite historical DEC-020 / Package A decisions.

1. Reviewed Package B Contract v0.2 originally stated:
   `TO BE REBOUND to the clean Package A closure/checkpoint SHA before implementation`.
2. Reviewed Master Execution Map v0.2 originally stated:
   B execution baseline MUST be rebound to `A_CLOSED_SHA`.
3. Cả hai reviewed rules được giữ như **HISTORICAL REVIEWED AUTHORITY**;
   reviewed v0.2 không chứa `B_GOV_SHA` làm execution-baseline rule.
4. Owner now **SUPERSEDES ONLY** literal `A_CLOSED_SHA` execution-checkpoint mechanic.
5. Package B **MAY** use a clean durable governance-only descendant of
   `A_CLOSED_SHA` as actual execution baseline; immutable Package A closure SHA
   `0c865a26c4425a1c3fe429bb8e42238562025801` không bị thay thế/relabel.
6. Intended future checkpoint: **`B_GOV_SHA`**. Chain: `A_CLOSED_SHA` →
   `cdc4f2321f7176fd3c50023d7dd17676c0cd92f6` (post-A governance reconciliation)
   → current dirty B-GOV governance preparation → separately authorized clean
   `B_GOV_SHA`. `cdc4f232...` không phải Package B execution baseline.
7. **`B_GOV_SHA` NOT YET ASSIGNED / chưa tồn tại** cho đến khi governance commit
   thật tồn tại; không invent SHA. Checkpoint chỉ tạo sau corrected governance
   diff review → Owner authorization riêng → governance-only commit/push.
8. T0 phải chứng minh đủ sáu điều kiện trước implementation:
   - `A_CLOSED_SHA` ancestor of actual HEAD / intended `B_GOV_SHA`;
   - toàn bộ `A_CLOSED_SHA..HEAD` / `A_CLOSED_SHA..B_GOV_SHA` là governance/docs only;
   - không có unexplained application/backend/frontend/schema/migration/test/tooling
     delta trong ancestry range; mọi non-governance delta đều không đạt docs-only;
   - working tree **CLEAN**;
   - branch đúng Owner authorization: `correction/owner-acceptance-slice1-3`;
   - actual verified HEAD được ghi thành **`PACKAGE_B_BASE_SHA`**.
   Không đạt thì STOP theo baseline condition hiện hữu; B-GOV không thực hiện T0.
9. **No clinical/product or T0→T12 substantive implementation requirement changed.**
   Chỉ execution-baseline governance thay đổi bởi newer Owner decision này.
   Package A lifecycle, Package B scope/STOP conditions, privacy/safety,
   Package C boundaries, testing/review/acceptance requirements giữ nguyên.
10. External pre-lock review **COMPLETED — PASS** vẫn historically valid; material
    blockers **NONE**; Package B đã **OWNER LOCKED**. Không cần second pre-lock
    review vì overlay chỉ đổi execution/checkpoint governance; không claim rằng
    overlay đã được original external review xem xét.
11. Package B T0→T12 vẫn **OWNER AUTHORIZED / IMPLEMENTATION NOT YET STARTED**.
    Package C **NOT ACTIVE / NOT IMPLEMENTATION-AUTHORIZED**; C0 không mở.
12. Correction task này **không authorize commit / push / merge / tag**; không
    application/source/test/tooling changes, không reset/revert B-GOV work.
13. **B_GOV_SHA ASSIGNMENT — Owner confirmation 2026-08-31.** Supersedes điểm 7
    ("NOT YET ASSIGNED") của chính overlay này. `B_GOV_SHA = d33d06186333b8ad3d82fea6aa047adc30d1e7df`.
    Xác nhận qua verify độc lập (Claude Chat): branch = `correction/owner-acceptance-slice1-3`;
    HEAD = `d33d06186333b8ad3d82fea6aa047adc30d1e7df`; working tree CLEAN; toàn bộ
    diff `0c865a26c4425a1c3fe429bb8e42238562025801..af32429ab3d06a20e4c88d2ccb8e760636ba540e`
    trên `backend/` và `frontend/` rỗng — chỉ có thay đổi trong `docs/`. Sáu điều kiện
    T0 tại điểm 8 đã thỏa. Package B T0 được phép bắt đầu.

**Next gate:** Package B — T0 mandatory local source verification, sử dụng
`PACKAGE_B_BASE_SHA = B_GOV_SHA = d33d06186333b8ad3d82fea6aa047adc30d1e7df`.

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
