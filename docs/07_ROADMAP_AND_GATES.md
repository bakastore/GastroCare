# GastroCare — Roadmap và Acceptance Gates

**Cập nhật:** 25/08/2026

Roadmap này được điều khiển bởi năng lực, không có mốc tuần/tháng cố định. Một phase (giai đoạn) chỉ hoàn thành khi acceptance gate (cổng chấp nhận) tương ứng được thỏa.

```text
FOUNDATION
→ GASTROCARE CORE
→ CONTINUOUS CARE
→ PRODUCT REFINEMENT
→ COMMERCIAL VALIDATION
→ AI VALUE-ADDED LAYER
→ FUTURE INTELLIGENT CARE
```

## 1. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| FOUNDATION | CLOSED |
| Technical Foundation | CLOSED |
| CORE-01 | CLOSED |
| CORE-02 | CLOSED |
| CORE-03 / Technical Core | CLOSED — baseline `technical-core-v0.1` |
| Real-world evidence alignment | COMPLETE |
| Clinical architecture | LOCKED |
| Longo Clinical Workflow v1.0 | OWNER LOCKED |
| Real-world Clinical Core implementation | IN PROGRESS — Hemorrhoid Vertical Slice 1 TECHNICALLY ACCEPTED |
| Hemorrhoid Vertical Slice 1 | CLOSED — TECHNICAL ACCEPTANCE at `2ea529ee200a0a37a77cebb9a750f70adde57618` |
| Hemorrhoid Vertical Slice 2 | DISCOVERY ONLY — implementation NOT AUTHORIZED |
| GASTROCARE CORE tổng thể | IN PROGRESS |
| CONTINUOUS CARE | NOT COMPLETE |
| PRODUCT REFINEMENT / UI-UX | NOT STARTED — bị chặn đến khi Clinical Core được chấp nhận |
| AI VALUE-ADDED LAYER | DEFERRED |

Technical Core đã đóng tại SHA `1a95f57f0b19bddbfcd817101d5c0c1135d90686`, tag `technical-core-v0.1`. Việc đã có primitive `CareTask` không đủ để đánh dấu Continuous Care hoàn tất. Việc Technical Core đã đóng cũng không đóng toàn bộ GastroCare Core.

## 2. FOUNDATION — CLOSED

**Mục tiêu:** hoàn tất Documentation Baseline được Owner review và nền kỹ thuật tối thiểu gồm xác thực, tenant isolation (cô lập tenant) và quy trình rà soát migration.

**Kết quả:**

- Gate 1 — Documentation Acceptance: CLOSED.
- Gate 2 — Technical Foundation Acceptance: CLOSED.
- Technical Foundation: CLOSED.

## 3. GASTROCARE CORE — IN PROGRESS

**Mục tiêu:** cung cấp Clinical CRM + Follow-up SaaS vận hành thủ công, không phụ thuộc AI, cho toàn bộ vòng đời chăm sóc cốt lõi.

### 3.1 Các work package/checkpoint đã đóng

- CORE-01 — Clinical Core Walking Skeleton: CLOSED.
- CORE-02 — Doctor Experience / Web UI v0.1: CLOSED.
- CORE-03 — Pilot Readiness, Operational Hardening và Technical Core: CLOSED.
- Real-world evidence alignment: COMPLETE, dựa trên kiểm toán 270/270 DOCX.
- Kiến trúc `CareEpisode`: LOCKED.
- Clinician Review: LOCKED FOR v1 SCOPE.
- Longo Clinical Workflow v1.0: OWNER LOCKED.
- CORE-04 Longo: independently verified technical/clinical baseline; Longo-only Gate G đã RETIRED BY OWNER.
- Hemorrhoid Real-World Workflow — Vertical Slice 1: TECHNICALLY ACCEPTED tại `2ea529ee200a0a37a77cebb9a750f70adde57618`.

### 3.2 Work package hiện tại

**HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2 DISCOVERY**

Authority: DEC-011.

Target:

```text
Hemorrhoid Examination
→ Diagnosis
→ Treatment Decision
→ CarePlan / Follow-up
```

Authoritative clinical workflow SSOT: [`10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md`](10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md)

Vertical Slice 2 hiện chỉ được phép Discovery (khám phá/phân tích).

Discovery phải resolve Diagnosis semantics, Treatment Decision semantics, CarePlan reuse decision, follow-up semantics, domain/schema impact, RBAC, audit/provenance, Timeline behavior, acceptance criteria, implementation contract và unresolved Owner questions = 0.

Không tự động tạo entity/model mới nếu Core primitive hiện có đáp ứng được.
Không tự động mở Procedure, generic Surgery, Investigation, AI hoặc CORE-05.
Implementation/test hiện tiếp tục dùng synthetic data. Real-patient runtime tiếp tục `NOT AUTHORIZED`.

### 3.3 Preserved Longo Clinical Core baseline

CORE-04 Longo tiếp tục là preserved verified baseline, không phải active product gate.
Longo-only Owner Synthetic Clinical Acceptance Gate G đã `RETIRED BY OWNER` theo DEC-009 và không được mở lại ngầm.

### 3.4 Hemorrhoid Vertical Slice 2 Discovery Gate

Discovery chỉ được coi là CLOSED khi có:
1. clinician-confirmed workflow;
2. Diagnosis semantics resolved;
3. Treatment Decision semantics resolved;
4. CarePlan reuse decision;
5. follow-up semantics resolved;
6. domain/schema impact analysis;
7. RBAC impact analysis;
8. audit/provenance requirements;
9. Timeline behavior;
10. acceptance criteria;
11. implementation contract;
12. unresolved Owner questions = 0.

Gate này KHÔNG cấp quyền implementation. Vertical Slice 2 chỉ được chuyển sang implementation bằng Owner Decision rõ ràng sau Discovery.

### 3.5 AUTHORIZED REAL-WORLD PILOT ACCEPTANCE — FUTURE GATE

Gate này chỉ được mở sau khi đồng thời thỏa các điều kiện:
- real-patient runtime được Owner cho phép;
- các yêu cầu legal/privacy cần thiết đã hoàn thành;
- hệ thống đã đạt các gate kỹ thuật và lâm sàng trước đó.

**Acceptance criterion (tiêu chí chấp nhận):** BS Thái hoàn thành ít nhất một chu kỳ thực tế trong GastroCare mà không phải fallback (quay lại sử dụng) giấy/Zalo cho luồng cốt lõi:

```text
Patient
→ Encounter/clinical workflow
→ follow-up
→ return visit
```

Cho đến khi gate này được Owner chấp nhận:

```text
GASTROCARE CORE = IN PROGRESS
```

Technical Acceptance hoặc Synthetic Clinical Acceptance không phải real-world product validation và không được dùng để tự cấp quyền dùng dữ liệu bệnh nhân thật.
## 4. CONTINUOUS CARE — NOT COMPLETE

**Mục tiêu:** mở rộng từ một lượt khám sang theo dõi liên tục và chứng minh `CareEpisode` giúp giảm thời gian hoặc nhầm lẫn trong chăm sóc dài hạn.

**Điều kiện vào:** GastroCare Core đạt acceptance gate và có bằng chứng sử dụng phù hợp được phép.

**Acceptance gate:** Owner xác nhận năng lực chăm sóc liên tục tạo giá trị trong vận hành. Sự tồn tại của `CareTask`, Timeline hoặc `CareEpisode` primitive không tự thỏa gate này.

## 5. PRODUCT REFINEMENT — NOT STARTED

**Trạng thái:** DEFERRED; bị chặn đến khi Clinical Core workflow hiện hành đạt acceptance gate (cổng chấp nhận) phù hợp.

**Mục tiêu:** tinh chỉnh workflow/UI-UX dựa trên bằng chứng sử dụng và kết quả nghiệm thu Clinical Core, không làm thay đổi các quyết định lâm sàng đã Owner-lock nếu chưa có change control (kiểm soát thay đổi) phù hợp.

**Acceptance gate:** workflow và trải nghiệm được Owner chấp nhận trên cơ sở bằng chứng, với mọi thay đổi SSOT được quản trị rõ ràng.

## 6. COMMERCIAL VALIDATION — NOT STARTED

**Mục tiêu:** xác nhận GastroCare Core tạo đủ giá trị để mở rộng ngoài pilot đầu tiên.

**Điều kiện vào:** Product Refinement đạt acceptance gate.

**Acceptance gate:** có quyết định Owner rõ ràng về hướng mở rộng, số pilot tiếp theo và phạm vi chuyên khoa.

## 7. AI VALUE-ADDED LAYER — DEFERRED

AI chỉ là lớp giá trị gia tăng sau khi Core chứng minh giá trị độc lập và các yêu cầu privacy/processing được giải quyết. Core phải hoạt động đầy đủ khi tắt AI.

AI không được thay thế quyết định lâm sàng của bác sĩ hoặc trở thành phụ thuộc bắt buộc của Core.

## 8. FUTURE INTELLIGENT CARE — FUTURE OPTION

Chưa định nghĩa deliverable hoặc acceptance gate chi tiết. Đây không phải cam kết hiện tại.

## 9. Ranh giới xuyên suốt

- Không dùng dữ liệu bệnh nhân thật cho runtime, triển khai, kiểm thử hoặc nghiệm thu khi chưa được Owner cấp phép rõ ràng và chưa vượt các gate an toàn/pháp lý liên quan.
- Historical import nằm ngoài work package hiện tại.
- Không biến định nghĩa lâm sàng chưa giải quyết thành dữ kiện: chấm điểm nong hậu môn đầy đủ, HDSS, SHS-HD, tương đương trường sau vô cảm và các mục độ khó Longo vẫn giữ trạng thái hoãn theo SSOT.
- Research-extension fields (trường mở rộng nghiên cứu) được tính đến nhưng không thuộc quy trình lâm sàng thường ngày mặc định.
- Không đưa AI Scribe, AI diagnosis, AI prescription, patient AI chatbot, full HIS, full EMR, Research OS, advanced analytics, complex billing hoặc mở rộng đa chuyên khoa vào Core nếu chưa có quyết định Owner tương ứng.

## 10. Kiểm soát thay đổi

Thứ bậc thẩm quyền:

```text
Quyết định Owner rõ ràng mới nhất
> Quyết định Owner trước đó
> Trạng thái dự án đã xác minh
> Baseline đã phê duyệt
> Giả định đang làm việc
> Khuyến nghị của AI
```

Mọi thay đổi đối với Longo Clinical Workflow v1.0 phải tuân theo mục Change Control của SSOT. Không tài liệu roadmap nào được làm yếu, diễn giải lại hoặc tự mở lại quyết định Owner đã khóa.
