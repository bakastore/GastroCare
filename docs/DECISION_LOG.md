# GastroCare — Decision Log

Cập nhật: 2026-08-24

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
