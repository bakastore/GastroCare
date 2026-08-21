# GastroCare — Roadmap and Gates

Cập nhật: 2026-08-21

Roadmap này CAPABILITY-DRIVEN — không có mốc thời gian tuần/tháng cố định. Mỗi phase chỉ bắt đầu khi entry conditions của nó được thỏa, và chỉ coi là hoàn thành khi acceptance gate được thỏa. Điều này nhất quán với DEC-003 ([DECISION_LOG.md](DECISION_LOG.md)) — Owner chấp nhận runway đủ dài, không time-box cố định.

```
FOUNDATION → GASTROCARE CORE → CONTINUOUS CARE → PRODUCT REFINEMENT
    → COMMERCIAL VALIDATION → AI VALUE-ADDED LAYER → FUTURE INTELLIGENT CARE
```

AI không được phép quay lại vào Core ban đầu ở bất kỳ phase nào trước AI VALUE-ADDED LAYER (P-01, P-02).

---

## Phase: FOUNDATION

**OBJECTIVE:** Có Documentation Baseline đã được Owner review, và nền tảng kỹ thuật tối thiểu (auth, tenant isolation, migration review) sẵn sàng để bắt đầu implement Core một cách an toàn.

**ENTRY CONDITIONS:** Documentation Baseline v1.0 tồn tại đủ 10 tài liệu (trạng thái hiện tại của repo này).

**DELIVERABLES:**
- Documentation Baseline v1.0 — RELEASE CANDIDATE, đã qua self-review.
- Owner review hoàn tất cho baseline.
- Bootstrap kỹ thuật tối thiểu: auth hoạt động, tenant isolation kiểm chứng được, migration review process được định nghĩa (xem [06_SAFETY_PRIVACY_AND_GOVERNANCE.md](06_SAFETY_PRIVACY_AND_GOVERNANCE.md)).

Phase FOUNDATION có hai gate độc lập — gate sau KHÔNG tự động thỏa mãn chỉ vì gate trước đã đạt:

**GATE 1 — DOCUMENTATION ACCEPTANCE GATE:** Owner chấp nhận Documentation Baseline v1.0 (OWNER REVIEW → OWNER ACCEPTED, ghi vào [PROJECT_STATE.md](PROJECT_STATE.md) chỉ khi Owner tự xác nhận). Gate này chỉ xác nhận nội dung tài liệu, không xác nhận bất kỳ deliverable kỹ thuật nào.

**GATE 2 — TECHNICAL FOUNDATION ACCEPTANCE:** xác nhận độc lập rằng các deliverable kỹ thuật của Phase FOUNDATION (auth hoạt động, tenant isolation đã kiểm chứng, migration review process đã định nghĩa) thực sự tồn tại và hoạt động đúng — không được suy ra từ việc Documentation Baseline đã được Owner chấp nhận. Gate này chỉ đạt khi có kiểm chứng kỹ thuật thật (vd test, review kỹ thuật), không phải khi tài liệu mô tả deliverable đã "PROPOSED".

**OUT OF SCOPE:** bất kỳ tính năng lâm sàng, UI bác sĩ, hay AI nào.

---

## Phase: GASTROCARE CORE

**OBJECTIVE:** BS Thái có thể dùng GastroCare thay giấy/Zalo/trí nhớ cho toàn bộ vòng đời một lượt khám: đăng ký bệnh nhân → khám → CarePlan → follow-up task → tái khám, hoàn toàn thủ công, không AI (DEC-001).

**ENTRY CONDITIONS:** Phase FOUNDATION đạt cả GATE 1 (Documentation Acceptance) và GATE 2 (Technical Foundation Acceptance).

**DELIVERABLES:**
- Entity Core hoạt động: Patient, Encounter, CarePlan, CareTask, Patient Timeline, AuditEvent (xem [04_CORE_DOMAIN_MODEL.md](04_CORE_DOMAIN_MODEL.md)).
- Follow-up Queue dùng CareTask + derived OVERDUE.
- Không có tính năng AI nào trong luồng chính.

**ACCEPTANCE GATE:** BS Thái hoàn thành ít nhất một chu kỳ khám → follow-up → tái khám thật (không phải synthetic case) trong hệ thống, không cần fallback về giấy cho luồng đó.

**OUT OF SCOPE:** CareEpisode UI riêng cho bác sĩ, multi-doctor, AI, billing.

---

## Phase: CONTINUOUS CARE

**OBJECTIVE:** Mở rộng từ "một lượt khám" sang "theo dõi liên tục" — CareEpisode trở thành công cụ hữu ích thực sự cho các ca theo dõi dài hạn (vd GERD, polyp).

**ENTRY CONDITIONS:** Phase GASTROCARE CORE đạt acceptance gate, và có dữ liệu quan sát thật (P-06) cho thấy nhu cầu nhóm nhiều Encounter theo vấn đề.

**DELIVERABLES:**
- Patient Timeline hiển thị theo CareEpisode.
- Cơ chế review CareEpisode không hoạt động (gợi ý, không tự động đóng — xem 04_CORE_DOMAIN_MODEL.md).

**ACCEPTANCE GATE:** Owner + quan sát từ BS Thái xác nhận CareEpisode giảm được thời gian/nhầm lẫn khi tra cứu ca theo dõi dài hạn.

**OUT OF SCOPE:** AI-assisted grouping, multi-specialty.

---

## Phase: PRODUCT REFINEMENT

**OBJECTIVE:** Dựa trên Discovery Round 1 thật với BS Thái (không còn synthetic hypothesis), tinh chỉnh workflow/UI để giảm ma sát vận hành thật.

**ENTRY CONDITIONS:** Đã có đủ dữ liệu sử dụng thật từ Phase GASTROCARE CORE + CONTINUOUS CARE để thay Working Product Hypothesis bằng evidence thật (P-06).

**DELIVERABLES:** Cập nhật [03_CLINICAL_WORKFLOW_BASELINE.md](03_CLINICAL_WORKFLOW_BASELINE.md) từ ASSUMED BASELINE sang VALIDATED, dựa trên quan sát thật.

**ACCEPTANCE GATE:** Workflow baseline được đánh dấu VALIDATED thay vì WORKING HYPOTHESIS.

**OUT OF SCOPE:** mở rộng chuyên khoa, AI.

---

## Phase: COMMERCIAL VALIDATION

**OBJECTIVE:** Xác nhận GastroCare Core tạo giá trị đủ để mở rộng ra ngoài BS Thái (phòng khám khác, có thể cùng hoặc khác chuyên khoa).

**ENTRY CONDITIONS:** Phase PRODUCT REFINEMENT đạt acceptance gate.

**DELIVERABLES:** Đánh giá lại A-001 (chuyên khoa tiêu hóa là chuyên khoa duy nhất hay chuyên khoa đầu tiên trong nhiều chuyên khoa) — cần Owner Decision mới, không tự suy diễn.

**ACCEPTANCE GATE:** Owner Decision rõ ràng về hướng mở rộng (số lượng pilot tiếp theo, có multi-specialty hay không).

**OUT OF SCOPE:** AI, cho đến khi Core đã validated thương mại.

---

## Phase: AI VALUE-ADDED LAYER

**OBJECTIVE:** Thêm AI như lớp giá trị gia tăng (P-02), dựa trên dữ liệu có cấu trúc đã được workflow Core tạo ra (P-03) — không thay thế Core.

**ENTRY CONDITIONS:** Core đã chứng minh giá trị độc lập không cần AI (Phase COMMERCIAL VALIDATION đạt gate), và [06_SAFETY_PRIVACY_AND_GOVERNANCE.md](06_SAFETY_PRIVACY_AND_GOVERNANCE.md) mục "AI-Specific Privacy/Processing" đã được giải quyết.

**DELIVERABLES:** UNKNOWN / OPEN ITEM — không định nghĩa tính năng AI cụ thể ở Documentation Baseline v1.0 (P-09); danh sách candidate (AI Scribe, v.v.) thuộc Anti-Scope hiện tại cho đến khi phase này mở.

**ACCEPTANCE GATE:** Domain layer vẫn hoạt động đầy đủ nếu tắt AI layer (kiểm chứng lại invariant "Domain independence from AI providers" — [05_ARCHITECTURE_BASELINE.md](05_ARCHITECTURE_BASELINE.md)).

**OUT OF SCOPE:** AI thay thế quyết định lâm sàng của bác sĩ (P-07).

---

## Phase: FUTURE INTELLIGENT CARE

**OBJECTIVE:** UNKNOWN / OPEN ITEM — placeholder cho định hướng dài hạn, không được định nghĩa chi tiết ở Documentation Baseline v1.0.

**ENTRY CONDITIONS:** Phase AI VALUE-ADDED LAYER đạt acceptance gate.

**DELIVERABLES:** Không định nghĩa ở baseline này (P-09 — không đóng băng chi tiết chưa cần).

**ACCEPTANCE GATE:** Chưa định nghĩa.

**OUT OF SCOPE:** Toàn bộ nội dung phase này là FUTURE OPTION, không phải cam kết.

---

## Anti-Scope (áp dụng xuyên suốt mọi phase Core)

Không nằm trong bất kỳ phase nào trước AI VALUE-ADDED LAYER: AI Scribe, AI diagnosis, AI prescription, patient AI chatbot, full HIS, full EMR, Research OS, advanced analytics, native mobile requirement, insurance platform, complex billing, multi-specialty expansion (trước khi có Owner Decision ở Phase COMMERCIAL VALIDATION), hospital-wide integration. Xem đầy đủ tại [01_PRODUCT_VISION_AND_SCOPE.md](01_PRODUCT_VISION_AND_SCOPE.md).
