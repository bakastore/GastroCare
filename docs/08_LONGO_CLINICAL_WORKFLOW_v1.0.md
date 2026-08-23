# GASTROCARE — QUY TRÌNH LÂM SÀNG LONGO v1.0 — OWNER LOCKED

**Loại tài liệu:** Clinical Workflow (quy trình lâm sàng) / Product-Domain SSOT (nguồn sự thật duy nhất cho sản phẩm và miền nghiệp vụ)  
**Trạng thái:** OWNER LOCKED (Chủ dự án đã khóa)  
**Phiên bản:** 1.0  
**Ngày:** 23/08/2026  
**Repository root (thư mục gốc kho mã nguồn):** GastroCare repository  
**Nhánh nền kỹ thuật:** `core/core-03-technical-core-completion`  
**SHA nền kỹ thuật:** `1a95f57f0b19bddbfcd817101d5c0c1135d90686`  
**Tag nền kỹ thuật:** `technical-core-v0.1`  
**Trạng thái triển khai:** NOT STARTED (chưa bắt đầu)  
**Dữ liệu bệnh nhân thật trong runtime (môi trường chạy ứng dụng):** NOT AUTHORIZED (chưa được phép)  

---

# 1. Mục đích tài liệu

Tài liệu này khóa **Quy trình lâm sàng Longo v1.0** của GastroCare dựa trên:

- Technical Core (lõi kỹ thuật) đã hoàn thành;
- 270 hồ sơ DOCX thực tế đã được kiểm toán cấu trúc theo chế độ read-only (chỉ đọc);
- kiến trúc CareEpisode đã được phản biện và khóa;
- Atomic Field Dictionary (từ điển trường dữ liệu nguyên tử) gồm 118 khái niệm;
- các quyết định của Owner (Chủ dự án) và clinician review (rà soát lâm sàng).

Mục tiêu là đưa GastroCare từ một Technical Core dùng dữ liệu giả sang một **Clinical Core (lõi lâm sàng) bám quy trình thực tế**, nhưng không làm sản phẩm trượt thành:

- HIS (Hospital Information System — hệ thống thông tin bệnh viện);
- EMR (Electronic Medical Record — bệnh án điện tử tổng quát);
- cơ sở dữ liệu nghiên cứu thuần túy;
- hệ thống AI-first (lấy AI làm điều kiện tồn tại của sản phẩm);
- generic form builder (trình tạo biểu mẫu tổng quát trong cơ sở dữ liệu).

Longo là **quy trình chuyên khoa đầu tiên được xác thực end-to-end (đầu-cuối)** để kiểm nghiệm kiến trúc Core có thể dùng lại cho các quy trình tiêu hóa khác. Longo không phải toàn bộ định nghĩa của GastroCare.

---

# 2. Định vị sản phẩm không thay đổi

GastroCare vẫn được định vị là:

> **Clinical CRM + Follow-up SaaS (hệ thống quản lý quan hệ lâm sàng và theo dõi sau khám/điều trị dạng dịch vụ) dành cho phòng khám tiêu hóa và ngoại tiêu hóa.**

Các nguyên tắc bắt buộc giữ:

1. Doctor-centered (lấy bác sĩ làm trung tâm).
2. Mobile-first (ưu tiên trải nghiệm trên thiết bị di động).
3. Multi-tenant (đa cơ sở/đa tenant) từ Core.
4. Manual-first clinical truth (sự thật lâm sàng do con người xác nhận trước, hệ thống không tự suy diễn).
5. Patient identity (định danh bệnh nhân) không được tự động merge (gộp).
6. Clinical record (hồ sơ lâm sàng) sau khi hoàn tất phải immutable (bất biến).
7. Correction (sửa sai) phải có amendment lineage (chuỗi phiên bản sửa đổi), không ghi đè âm thầm.
8. Timeline là read projection (hình chiếu chỉ đọc), không phải bảng dữ liệu nguồn độc lập.
9. Follow-up (theo dõi) là workflow (quy trình) hạng nhất, không phải ghi chú phụ.
10. AI không phải dependency (phụ thuộc bắt buộc) để Core hoạt động đúng.
11. Historical source fidelity (tính trung thực dữ liệu lịch sử) phải tách khỏi prospective capture (cách thu thập dữ liệu mới trong tương lai).
12. Research extension (phần mở rộng nghiên cứu) phải được tính đến nhưng không được làm nặng routine clinical workflow (quy trình lâm sàng thường ngày).

---

# 3. Baseline (đường nền) kỹ thuật đã được khóa

## 3.1 Nền mã nguồn

```text
Repository root:
  GastroCare repository

Branch:
  core/core-03-technical-core-completion

SHA:
  1a95f57f0b19bddbfcd817101d5c0c1135d90686

Tag:
  technical-core-v0.1
```

Trạng thái tại thời điểm khóa:

```text
Working tree: CLEAN
Untracked files: NONE
Stash: NONE
Remote: NOT CONFIGURED
```

## 3.2 Lineage (chuỗi lịch sử commit)

```text
5434218  Khởi tạo dự án greenfield
   ↓
0e11554  Documentation Baseline v1.0
   ↓
4102015  Gate 2 — Technical Foundation
   ↓
208a75e  CORE-01 — Clinical Walking Skeleton
   ↓
b33a29c  CORE-02 — Doctor Web UI
   ↓
1a95f57  Technical Core + Clinical Forms
          tag: technical-core-v0.1
```

## 3.3 Những thành phần đã có trong Technical Core

- Patient;
- Encounter;
- CarePlan;
- CarePlanVersion;
- CareTask;
- AuditEvent;
- Timeline read projection;
- ClinicalFormSubmission;
- versioned template (biểu mẫu có phiên bản) cấu hình bằng code;
- DRAFT → COMPLETED lifecycle (vòng đời bản nháp → hoàn tất);
- một biểu mẫu Longo follow-up tối thiểu;
- backend test;
- frontend test;
- browser E2E (kiểm thử đầu-cuối trên trình duyệt);
- pilot seed (dữ liệu giả dùng thử);
- OPERATIONS.md;
- backup/restore verification (xác minh sao lưu/khôi phục).

---

# 4. Evidence (bằng chứng) thực tế đã sử dụng

## 4.1 Full-corpus audit (kiểm toán toàn bộ tập hồ sơ)

Đã xử lý:

```text
270 / 270 DOCX
0 failure
```

Đã xác nhận cấu trúc quy trình Longo xuyên suốt:

```text
Hành chính
→ nhập viện / lý do vào viện
→ tiền sử
→ đánh giá toàn thân
→ khám hậu môn-trực tràng trước mổ
→ cận lâm sàng
→ đánh giá sau vô cảm
→ phẫu thuật Longo
→ hậu phẫu sớm
→ tái khám 2 tuần
→ nong hậu môn khi cần
→ tái khám tháng 1
→ tái khám tháng 3
→ tái khám tháng 6
→ đánh giá kết quả dài hạn
```

## 4.2 Longitudinal evidence (bằng chứng theo chiều dọc thời gian)

Kết quả apparent population (dấu hiệu có nội dung được điền) ở các mốc:

```text
Tháng 1: 79/270
Tháng 3: 81/270
Tháng 6: 68/270
Đủ cả 3 mốc: 11/270
Không xác định được cả 3: 97/270
```

Kết luận:

- corpus có mixed longitudinal pattern (mô hình theo dõi dọc hỗn hợp);
- metadata nội bộ cho thấy tài liệu được chỉnh sửa qua thời gian;
- không được suy diễn mỗi lần chỉnh sửa là một lần tái khám.

## 4.3 Atomic Field Dictionary

Đã chuẩn hóa:

```text
118 atomic concepts (khái niệm nguyên tử)
118/118 accounted for (được tính đến)
0 unmapped (không có khái niệm bị bỏ rơi)
```

Tại thời điểm audit:

```text
62 evidence-clear
56 cần clinical/scoring/Owner decision
```

Mục tiêu của chính sách này là:

> **100% accounted for (được tính đến), không đồng nghĩa 100% phải biến thành field nhập liệu thường ngày.**

## 4.4 Wexner / HDSS / SHS-HD historical capture

Narrow audit (kiểm tra hẹp) toàn bộ 270 file đã khóa ranh giới bằng chứng:

| Instrument (thang đo) | Template representability (khả năng biểu diễn trong mẫu) | Verified historical actual capture (dữ liệu lịch sử thực sự xác minh được) |
|---|---|---|
| Wexner | có cấu trúc item + total | UNDETERMINED |
| HDSS | có cấu trúc item + total | UNDETERMINED |
| SHS-HD | có cấu trúc total | UNDETERMINED |

Không được:

- suy ra item từ total;
- coi bảng tham chiếu là dữ liệu bệnh nhân;
- coi giá trị giống nhau trên toàn corpus là dữ liệu thật nếu không phân biệt được với boilerplate (nội dung mẫu).

---

# 5. Kiến trúc miền đã khóa

## 5.1 Sơ đồ tổng thể

```text
Tenant
└── Patient
    ├── CareEpisode (0..n)
    │   └── Encounter* (có episodeId đối với workflow Longo)
    │       ├── ClinicalFormSubmission*
    │       └── CarePlan? 
    │           └── CareTask*
    │
    └── Encounter* (episodeId = null với chăm sóc chung không thuộc episode)

Timeline = read projection
AuditEvent = append-only provenance
```

Lưu ý:

- đây không phải ownership chain (chuỗi sở hữu) cứng;
- ClinicalFormSubmission và CarePlan là các record cùng nằm trong context (ngữ cảnh) Encounter;
- không nhân bản `episodeId` xuống mọi bảng.

---

# 6. CareEpisode — khóa vai trò và vòng đời

CareEpisode là **tập hợp định danh một đợt điều trị**.

Không phải “bệnh án tổng”.

## 6.1 Minimum schema (lược đồ tối thiểu)

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

## 6.2 Quy tắc bắt buộc

`episodeType`:

```text
LONGO_TREATMENT
```

được lưu dưới dạng stable code/string (mã chuỗi ổn định), không dùng database enum (enum ở tầng cơ sở dữ liệu) mở rộng liên tục.

`status`:

```text
ACTIVE
CLOSED
```

## 6.3 Start (bắt đầu)

Episode chỉ bắt đầu bằng explicit authorized action (hành động rõ ràng, có quyền).

Không tự động suy ra từ:

- ngày nhập viện;
- Patient creation;
- Encounter creation;
- Clinical Form creation.

`startedAt` là thời điểm bắt đầu đợt điều trị do người có thẩm quyền xác nhận.

## 6.4 Close (đóng)

Đóng Episode là explicit authorized action.

Không auto-close (tự động đóng) dựa trên:

- ngày ra viện;
- hoàn thành task;
- thời gian không hoạt động;
- đủ mốc tái khám.

## 6.5 Reopen (mở lại)

Cho phép mở lại Episode đã CLOSED khi cần:

- late documentation (ghi chép muộn);
- correction (sửa sai);
- hoạt động lâm sàng hợp lệ phát sinh sau khi đóng.

Bắt buộc:

```text
reason
actor
AuditEvent
```

---

# 7. Encounter — khóa ý nghĩa

Encounter là clinical occurrence container (container của một sự kiện/tiếp xúc lâm sàng).

Thêm:

```text
episodeId?
occurredAt
```

## 7.1 `episodeId`

- nullable (có thể null) ở Core;
- bắt buộc bởi application validation (kiểm tra ở tầng ứng dụng) đối với workflow Longo;
- Encounter chung ngoài workflow Episode vẫn có thể không có `episodeId`.

## 7.2 `occurredAt`

`occurredAt` là thời điểm sự kiện lâm sàng thực sự xảy ra.

Tách rõ:

```text
occurredAt = clinical time (thời gian lâm sàng)
createdAt  = persistence time (thời gian ghi vào hệ thống)
```

Không dùng `createdAt` làm thời điểm khám/mổ.

## 7.3 Không thêm rigid stage enum

Không thêm enum cứng:

```text
ADMISSION
PREOP
SURGERY
POSTOP
FOLLOWUP
```

vào Core chỉ để phục vụ Longo.

Stage (giai đoạn) được thể hiện bởi workflow/form/context, tránh làm Core bị phụ thuộc chuyên khoa.

---

# 8. ClinicalFormSubmission — khóa liên kết

ClinicalFormSubmission chỉ link tới:

```text
Encounter
```

Không thêm trực tiếp:

```text
episodeId
```

Episode context được suy ra:

```text
ClinicalFormSubmission
→ Encounter
→ CareEpisode
```

Không duplicate (nhân bản) ancestry (quan hệ tổ tiên) nếu chưa có bằng chứng kỹ thuật bắt buộc.

---

# 9. Immutability và Amendment Lineage

## 9.1 Lifecycle

```text
DRAFT
  ↓
COMPLETED
```

COMPLETED = immutable (bất biến).

Không sửa trực tiếp row đã hoàn tất.

## 9.2 Sửa sai

Sửa một Clinical Form hoàn tất bằng amendment (bản sửa đổi) mới.

Lineage phải giữ được tối thiểu:

```text
previousSubmissionId
logicalGroupId
revisionNumber
amendmentReason
amendedByUserId
completedAt
full corrected snapshot
```

Bản cũ không bị mất.

## 9.3 Unique constraint hiện tại

Unique constraint hiện tại:

```text
(encounterId, templateKey)
```

phải được thiết kế lại khi implement amendment lineage.

Không phá constraint tùy tiện trước khi lock migration (khóa thiết kế migration).

---

# 10. Surgery Anchor — mốc tính thời gian sau mổ

Nguồn sự thật duy nhất để tính postoperative interval (khoảng thời gian sau mổ):

```text
Surgery Encounter.occurredAt
```

Không dùng:

```text
createdAt
admission date
discharge date
manual monthsPostOp
```

Nếu `occurredAt` của ca mổ được sửa:

- không tự động sửa lịch follow-up âm thầm;
- các CareTask liên quan phải được đưa vào trạng thái cần review;
- mọi thay đổi phải audit.

---

# 11. Quy trình Longo đầu-cuối

## 11.1 Bước 1 — Patient

Tạo mới hoặc chọn Patient hiện có.

Giữ nguyên:

- immutable Patient.id;
- duplicate warning;
- no auto-merge.

## 11.2 Bước 2 — Start Longo Episode

Bác sĩ/người được phân quyền thực hiện:

```text
Start Longo treatment episode
```

Tạo:

```text
CareEpisode
episodeType = LONGO_TREATMENT
status = ACTIVE
startedAt = thời điểm được xác nhận
```

## 11.3 Bước 3 — Pre-op Encounter

Tạo Encounter thuộc Episode.

Sử dụng:

```text
LONGO_PREOP_ASSESSMENT
```

Nhóm nội dung:

- tiền sử liên quan;
- bệnh đồng mắc;
- đánh giá toàn thân;
- sinh hiệu và đo lường;
- cận lâm sàng;
- khám hậu môn-trực tràng trước mổ;
- nội soi/soi trực tràng ở mức v1 phù hợp;
- free text cho nội dung không chuẩn hóa tốt.

## 11.4 Bước 4 — Surgery Encounter

Tạo Encounter ca mổ.

```text
occurredAt = thời điểm mổ thực tế
```

Sử dụng:

```text
LONGO_INTRAOP_RECORD
```

Đây là index surgery (ca mổ mốc) để tính lịch follow-up.

## 11.5 Bước 5 — Post-anesthesia assessment

Kết quả sau vô cảm được ghi như observation (quan sát) riêng theo stage.

Không overwrite dữ liệu trước mổ.

Có thể reuse field definition (dùng lại định nghĩa field) khi semantics (ý nghĩa) thực sự tương đương.

## 11.6 Bước 6 — Early Post-op

Sử dụng:

```text
LONGO_EARLY_POSTOP
```

Có thể gắn vào cùng Surgery/Admission Encounter nếu vẫn là cùng một clinical occurrence.

Không tạo Encounter mới chỉ vì có form mới.

## 11.7 Bước 7 — Generate Follow-up CareTasks

Sau explicit completed surgery milestone (mốc xác nhận phẫu thuật đã hoàn tất), hệ thống tạo CareTask:

```text
~14 ngày
~1 tháng
~3 tháng
~6 tháng
```

Yêu cầu:

- idempotent (chạy lặp không sinh bản ghi trùng);
- stable schedule key (khóa lịch ổn định);
- editable (được chỉnh);
- cancellable (được hủy);
- audited (được kiểm toán);
- task ≠ visit;
- task ≠ attendance proof (bằng chứng đã tái khám);
- không tự complete bởi một Encounter không liên quan;
- không auto-close Episode.

## 11.8 Bước 8 — Follow-up 2 tuần

Tạo Encounter thực tế.

Sử dụng:

```text
LONGO_TWO_WEEK_FOLLOWUP
```

Nội dung v1:

- đau/VAS;
- chảy máu;
- sa;
- da thừa;
- tình trạng đại tiện;
- hẹp hậu môn sớm;
- đã nong hậu môn hay chưa.

`twoWeekDilationPerformed` chỉ là summary/intervention flag (cờ tóm tắt can thiệp).

## 11.9 Bước 9 — Anal Dilation

Nếu thực hiện nong hậu môn:

```text
Encounter riêng
+
ANAL_DILATION_ASSESSMENT
```

Mỗi lần nong là một clinical occurrence riêng.

Không overwrite lần nong cũ.

## 11.10 Bước 10 — Follow-up dài hạn

Không tạo 3 template khác nhau cho tháng 1/3/6.

Dùng một template:

```text
LONGO_LONG_TERM_FOLLOWUP
```

Mỗi lần khám:

```text
Encounter riêng
plannedTimepoint
actual occurredAt
derived elapsed time
```

`plannedTimepoint`:

```text
MONTH_1
MONTH_3
MONTH_6
```

## 11.11 Bước 11 — CareTask completion

Task chỉ được complete rõ ràng bởi hành động có chủ đích.

Encounter hoàn thành task phải là Encounter tương ứng đúng:

- Episode;
- timepoint;
- CareTask.

## 11.12 Bước 12 — Episode Closure

Episode chỉ đóng bằng explicit action.

Không tự đóng.

---

# 12. Sáu Form Family đã khóa

```text
LONGO_PREOP_ASSESSMENT
LONGO_INTRAOP_RECORD
LONGO_EARLY_POSTOP
LONGO_TWO_WEEK_FOLLOWUP
ANAL_DILATION_ASSESSMENT
LONGO_LONG_TERM_FOLLOWUP
```

Reusable building blocks (khối dùng lại):

```text
ANORECTAL_EXAM
WEXNER
SATISFACTION
```

Representable nhưng chưa routine-finalized:

```text
HDSS
SHS_HD
```

---

# 13. 16 quyết định Clinician Review đã khóa

## 13.1 Ngày sinh / tuổi

Future Patient model (mô hình Patient tương lai):

```text
dateOfBirth
```

Tuổi là derived (tính ra).

Age-only historical data (dữ liệu cũ chỉ có tuổi) xử lý sau trong import layer.

## 13.2 Giới

Dùng vocabulary (bộ giá trị) Patient đã được phê duyệt.

Không tạo vocabulary riêng theo Word.

## 13.3 Huyết áp

Tách:

```text
systolicBloodPressure
diastolicBloodPressure
```

Đơn vị:

```text
mmHg
```

## 13.4 Đo lường toàn thân

```text
weight       kg
height       cm
pulse        bpm
temperature  °C
```

## 13.5 Thiếu máu

Cho phép structured clinical assessment (đánh giá lâm sàng có cấu trúc).

Không tự động suy ra anemiaStatus từ Hct/Hb khi chưa có rule (quy tắc) được phê duyệt.

## 13.6 Goligher

Khóa:

```text
I
II
III
IV
```

Ghi rõ provenance (nguồn căn cứ):

> Owner/clinician-validated (được Owner/bác sĩ xác nhận), dựa trên phân loại Goligher chuẩn và mẫu nguồn trực tiếp; không tuyên bố đã enumerate (liệt kê kiểm chứng) đầy đủ trên 270 file.

## 13.7 Vị trí búi trĩ

Dùng clock-face location (vị trí theo mặt đồng hồ).

Cho phép:

```text
1h ... 12h
```

Multi-select (chọn nhiều).

Ví dụ:

```text
[3, 8, 11]
```

## 13.8 Pre-op và Post-anesthesia

Được dùng chung atomic field definition khi ý nghĩa tương đương.

Nhưng dữ liệu ở mỗi stage là observation độc lập.

Không overwrite.

## 13.9 Rectoscopy

V1 dùng:

- structured subsection tối thiểu;
- free-text impression (nhận xét tự do).

Không tạo first-class Rectoscopy entity riêng.

## 13.10 Thông số trong mổ

```text
operativeDuration → minute
bloodLoss         → mL
```

## 13.11 Đau hậu phẫu sớm

```text
VAS 0–10
```

## 13.12 Đau ở 2 tuần và dài hạn

Dùng:

```text
VAS 0–10
```

`0 = không đau`.

Không tạo thêm boolean pain nếu không có nhu cầu lâm sàng rõ ràng.

## 13.13 Anal Dilation Assessment

5 tiêu chí:

```text
anal diameter
dilation resistance
pain
bleeding
defecation ability
```

Chưa tính total score cho tới khi toàn bộ mapping 0–3 được clinician xác nhận.

## 13.14 Wexner

Prospective routine-care (thu thập mới trong chăm sóc thường ngày):

```text
5 items
mỗi item 0–4
deterministic total 0–20
```

Historical actual capture:

```text
UNDETERMINED
```

Không reconstruct (dựng ngược) item lịch sử.

## 13.15 HDSS / SHS-HD

Giữ trong product knowledge (tri thức sản phẩm) và data model strategy (chiến lược mô hình dữ liệu).

Chưa bật routine form cho tới khi scoring semantics được clinician xác nhận.

Historical actual capture:

```text
UNDETERMINED
```

## 13.16 Research Extension

Các field sau được accounted for nhưng không mặc định xuất hiện trong routine UI:

- address;
- occupation;
- research collector;
- Longo difficulty score;
- historical import provenance;
- external source record code.

Không được silently discard (bỏ âm thầm).

---

# 14. Chính sách Structured / Free text / Derived

## 14.1 STRUCTURED

Ưu tiên structured với:

- boolean;
- measurement;
- Goligher;
- hemorrhoid count;
- clock-face location;
- complication;
- VAS;
- fixed intervention flag;
- Wexner;
- satisfaction;
- dilation criterion.

## 14.2 FREE TEXT

Ưu tiên free text với:

- admission reason;
- heterogeneous other history;
- other finding;
- other complication;
- management detail;
- additional comments.

## 14.3 SYSTEM DERIVED

Hệ thống tự tính:

- Wexner total;
- elapsed postoperative time;
- overdue;
- planned vs actual timing context.

---

# 15. ANORECTAL_EXAM

ANORECTAL_EXAM là reusable section building blocks (các khối trường dùng lại).

Không phải independent entity (thực thể độc lập).

Nguyên tắc:

```text
shared definition
+
stage context
+
independent observation
```

Có thể dùng lại các field khi semantics đủ rõ:

- prolapse;
- bleeding;
- mucosa;
- skin tag;
- count;
- location;
- size.

Nhưng không ép một section giống hệt cho mọi stage.

---

# 16. WEXNER

Wexner được cấu hình bằng versioned code definition (định nghĩa code có phiên bản).

Bắt buộc:

```text
5 item keys
allowed values 0–4
completion rule
deterministic total
range 0–20
instrument version
```

Không dùng dữ liệu lịch sử để suy ra item.

---

# 17. HDSS và SHS-HD

## 17.1 HDSS

Chưa routine-finalized.

Cần xác nhận:

- item wording;
- scale mapping 0–4;
- total range;
- missing-item behavior;
- interpretation.

## 17.2 SHS-HD

Historical representability và actual capture phải tách.

Không dựng item từ total.

Prospective item capture chưa khóa cho tới khi có validated definition.

---

# 18. Satisfaction

Sử dụng một structured single item (một câu hỏi có cấu trúc):

```text
Rất hài lòng
Hài lòng
Trung bình
Không hài lòng
Rất không hài lòng
```

Không coi là multi-item instrument.

---

# 19. Chính sách đối với 118 atomic concepts

Mỗi concept phải rơi vào đúng một disposition (trạng thái xử lý):

```text
IMPLEMENT_NOW
FREE_TEXT
RESEARCH_EXTENSION_ONLY
DEFERRED_WITH_REASON
SYSTEM_DERIVED
```

Không field nào được silently dropped.

DEFERRED_WITH_REASON phải ghi lý do.

---

# 20. Các phần còn DEFERRED_WITH_REASON

Không được tự đoán:

- exact post-anesthesia field equivalence;
- anal-dilation full 0–3 definitions;
- HDSS scoring;
- SHS-HD scoring;
- Longo difficulty item definitions;
- full rectoscopy vocabulary;
- combined historical labels chưa rõ cách split;
- stage-specific VAS rule chưa được khóa.

Các defer này không block toàn bộ Clinical Core.

Chỉ block đúng field/instrument liên quan.

---

# 21. Provenance

## 21.1 System provenance

Cần phân biệt:

```text
createdByUserId
completedByUserId
amendedByUserId
AuditEvent.actor
```

## 21.2 Research collector

“Người thu thập thông tin” trong Word không tự động tương đương:

- creator;
- completer;
- document author;
- AuditEvent actor.

Đây là research/import provenance khi có scope tương ứng.

Routine workflow không bắt bác sĩ nhập trường này.

---

# 22. Historical data policy

Quy tắc tuyệt đối:

1. Không suy item từ total.
2. Không coi bảng tham chiếu là observation.
3. Không coi default/boilerplate là dữ liệu bệnh nhân.
4. Không suy clinical visit từ revision count.
5. Không dùng filesystem mtime làm clinical time.
6. Historical import chưa nằm trong v1 implementation scope.
7. Kiến trúc không được tự khóa cửa cho import về sau.

---

# 23. Privacy và Safety Boundary

Mọi xử lý corpus thực tế tiếp tục:

```text
local-first
read-only
bằng chứng/kết quả tổng hợp đã được khử thông tin nhận dạng
```

Known sanitizer incidents (các sự cố sanitizer đã biết) phải được giữ trong governance history.

Current sanitized evidence status:

```text
PASS
```

Chưa cho phép đưa real patient data vào:

- runtime;
- seed;
- test fixture;
- screenshot;
- browser E2E;
- documentation example;
- Git.

Trước khi vượt cổng cho phép sử dụng dữ liệu bệnh nhân thật, toàn bộ quá trình triển khai, kiểm thử và nghiệm thu chỉ sử dụng synthetic data (dữ liệu giả lập).

---

# 24. RBAC và authorization

Các action mới phải qua authorization:

- start Episode;
- close Episode;
- reopen Episode;
- create/update draft Clinical Form;
- complete Clinical Form;
- amend completed form;
- generate/edit/cancel follow-up task;
- complete follow-up task.

Reopen và Amendment cần audit mạnh hơn draft editing thông thường.

---

# 25. Tenant / Patient invariants

Bắt buộc:

```text
same tenant
same patient ancestry
```

Phải reject:

- cross-tenant episode link;
- Encounter gắn Episode của Patient khác;
- Form suy ra Episode qua ancestry sai;
- bất kỳ cross-patient relationship nào.

---

# 26. Timeline

Timeline vẫn là read projection.

Yêu cầu mới:

```text
Patient
├── Episode A
│   ├── Encounter
│   ├── Form completion/amendment
│   ├── CarePlan
│   └── Follow-up
├── Episode B
│   └── ...
└── Ungrouped Encounter
```

Không tạo writable Timeline table.

---

# 27. Work Packages triển khai

Triển khai phải bắt đầu từ:

```text
1a95f57f0b19bddbfcd817101d5c0c1135d90686
```

Work packages:

```text
T1  CareEpisode + Encounter.occurredAt
T2  ClinicalForm amendment lineage
T3  Reusable section/instrument framework
T4  LONGO_PREOP_ASSESSMENT
T5  LONGO_INTRAOP_RECORD
T6  LONGO_EARLY_POSTOP
T7  LONGO_TWO_WEEK_FOLLOWUP
T8  ANAL_DILATION_ASSESSMENT
T9  LONGO_LONG_TERM_FOLLOWUP
T10 Follow-up scheduling
T11 Episode-aware Timeline
T12 Migration / seed / backup-restore
T13 Backend regression + new tests
T14 Frontend functional workflow
T15 Browser E2E
T16 Independent post-implementation audit
```

---

# 28. Implementation Invariants

Phải giữ:

- Patient identity invariant;
- no auto-merge;
- tenant isolation;
- RBAC;
- CarePlan append-only lineage;
- Clinical Form immutability;
- amendment lineage;
- Timeline read projection;
- CareTask stored statuses;
- overdue derived;
- no automatic Episode closure;
- idempotent follow-up scheduling;
- no fabricated historical score items;
- test/seed chỉ dùng synthetic data (dữ liệu giả lập).

---

# 29. Phạm vi Frontend trong Clinical Core

Giai đoạn này chỉ làm functional UX (trải nghiệm chức năng), chưa làm full UI/UX redesign.

Cần đủ chức năng:

- nhìn thấy Episode ACTIVE/CLOSED;
- start/close/reopen;
- Episode-aware Timeline;
- nhập `occurredAt`;
- sáu Longo forms;
- amendment history;
- follow-up queue;
- planned vs actual;
- repeated dilation sessions.

Full Product Refinement/UI-UX để sau khi Clinical Core acceptance.

---

# 30. Explicit Non-goals

Không làm trong phase này:

- generic EMR;
- HIS;
- generic lab module;
- generic procedure engine;
- generic DB form builder;
- AI clinical reasoning;
- AI auto-documentation;
- historical patient-data import;
- real-patient runtime;
- billing;
- claims;
- pharmacy;
- inventory;
- subscription/commercial logic;
- full visual redesign;
- mở rộng đa chuyên khoa quy mô lớn.

---

# 31. Acceptance Gates

## Gate A — Domain / Schema

PASS khi:

- CareEpisode tối thiểu tồn tại;
- Encounter có `episodeId?` và `occurredAt`;
- tenant/patient invariants PASS;
- không thêm episode ancestry dư thừa.

## Gate B — Clinical Record Lifecycle

PASS khi:

- COMPLETED immutable;
- Amendment append-only;
- provenance rõ;
- original record không đổi.

## Gate C — Longo Forms

PASS khi:

- sáu form family tồn tại;
- field đã khóa được implement;
- field defer có lý do;
- không bịa scoring.

## Gate D — Follow-up

PASS khi:

- surgery anchor đúng;
- schedule idempotent;
- planned/actual tách;
- task completion đúng visit;
- no auto-close.

## Gate E — Timeline

PASS khi:

- group theo Episode;
- Encounter không thuộc Episode vẫn hỗ trợ;
- Timeline read-only.

## Gate F — Regression

PASS khi:

- backend tests xanh;
- frontend tests xanh;
- browser E2E xanh;
- backup/restore PASS;
- không regression invariant cũ.

## Gate G — Owner Synthetic Clinical Acceptance

Owner phải chạy được bằng synthetic data (dữ liệu giả lập):

```text
Patient
→ Start Longo Episode
→ Pre-op
→ Surgery
→ Early Post-op
→ Follow-up Schedule
→ 2-week Visit
→ Anal Dilation nếu cần
→ Month 1
→ Month 3
→ Month 6
→ Amendment scenario
→ Explicit Episode Closure
```

Chỉ sau Gate G mới xem xét đóng Clinical Core.

---

# 32. Trạng thái trong Roadmap

```text
FOUNDATION
✅ CLOSED

TECHNICAL FOUNDATION
✅ CLOSED

CORE-01
✅ CLOSED

CORE-02
✅ CLOSED

CORE-03 / TECHNICAL CORE
✅ CLOSED
baseline: technical-core-v0.1

REAL-WORLD EVIDENCE ALIGNMENT
✅ COMPLETE

CARE EPISODE / DOMAIN ARCHITECTURE
✅ LOCKED

ATOMIC FIELD DISCOVERY
✅ COMPLETE

CLINICIAN REVIEW
✅ LOCKED FOR v1

LONGO CLINICAL WORKFLOW v1.0
✅ OWNER LOCKED

REAL-WORLD CLINICAL CORE IMPLEMENTATION
🟡 NEXT

PRODUCT REFINEMENT / UI-UX
⛔ AFTER CLINICAL CORE ACCEPTANCE

CONTINUOUS CARE EXPANSION
⛔ AFTER CORE CLOSEOUT

COMMERCIAL VALIDATION
⛔ LATER

AI VALUE-ADDED LAYER
⛔ DEFERRED
```

---

# 33. Change Control

Tài liệu này dựa trên Technical Baseline:

```text
SHA:
1a95f57f0b19bddbfcd817101d5c0c1135d90686

Tag:
technical-core-v0.1
```

Muốn thay đổi locked workflow phải có:

1. evidence hoặc operational need mới;
2. rationale rõ;
3. Owner decision;
4. cập nhật Decision Log.

Implementation detail được phép thay đổi nếu không phá locked invariant.

---

# 34. Owner Lock Statement

Các nội dung sau được coi là khóa ở v1.0:

- CareEpisode tồn tại và chỉ là treatment-course grouping;
- explicit start/close/reopen;
- `Encounter.episodeId?`;
- `Encounter.occurredAt`;
- surgery Encounter làm postoperative anchor;
- ClinicalFormSubmission link Encounter;
- không duplicate episodeId xuống Form/Plan/Task ở v1;
- completed-form amendment lineage;
- sáu Longo form families;
- một reusable long-term follow-up template;
- repeated anal-dilation occurrence;
- Wexner prospective item-first + deterministic total;
- HDSS/SHS-HD deferred pending clinical validation;
- research-extension separation;
- idempotent follow-up scheduling;
- Timeline read projection;
- không auto-infer clinical truth;
- chưa dùng real patient runtime;
- triển khai và nghiệm thu dùng synthetic data (dữ liệu giả lập).

---

# 35. Trạng thái cuối tài liệu

```text
GASTROCARE LONGO CLINICAL WORKFLOW v1.0

STATUS:
OWNER LOCKED

BASELINE:
technical-core-v0.1
1a95f57f0b19bddbfcd817101d5c0c1135d90686

NEXT:
IMPLEMENTATION CONTRACT
```
