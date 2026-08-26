# GastroCare — Trạng thái dự án

**Cập nhật:** 25/08/2026 — Vertical Slice 2 Discovery CLOSED; DEC-012 + Implementation Contract v0.1 OWNER LOCKED; Slice 2 AUTHORIZED FOR IMPLEMENTATION

**Loại dự án:** GREENFIELD

**Định hướng sản phẩm:** CORE-FIRST

**Phương thức nhập liệu ban đầu:** MANUAL

**AI:** DEFERRED — lớp giá trị gia tăng trong tương lai

Tài liệu này chỉ ghi nhận trạng thái đã được xác minh. Thứ bậc thẩm quyền:

```text
Quyết định Owner rõ ràng mới nhất
> Quyết định Owner trước đó
> Trạng thái dự án đã xác minh
> Baseline đã phê duyệt
> Giả định đang làm việc
> Khuyến nghị của AI
```

## 1. Trạng thái tổng thể

| Hạng mục | Trạng thái |
|---|---|
| FOUNDATION | CLOSED |
| Technical Foundation (nền tảng kỹ thuật) | CLOSED |
| CORE-01 | CLOSED — OWNER ACCEPTED |
| CORE-02 | CLOSED — OWNER ACCEPTED |
| CORE-03 / Technical Core (lõi kỹ thuật) | CLOSED — OWNER ACCEPTED |
| GastroCare Core tổng thể | IN PROGRESS |
| Real-world Clinical Core implementation (triển khai lõi lâm sàng theo thực tế) | IN PROGRESS — Hemorrhoid Vertical Slice 1 TECHNICALLY ACCEPTED; Vertical Slice 2 AUTHORIZED FOR IMPLEMENTATION under DEC-012 |
| Owner Synthetic Clinical Acceptance | Longo-only Gate G: RETIRED BY OWNER — không tiếp tục vì workflow sản phẩm đã đổi; không suy ra CORE-04 Owner product acceptance |
| AUTHORIZED REAL-WORLD PILOT ACCEPTANCE | FUTURE GATE — chưa được phép mở |
| Continuous Care (chăm sóc liên tục) | NOT COMPLETE |
| Product Refinement / UI-UX (tinh chỉnh sản phẩm/giao diện-trải nghiệm) | DEFERRED đến khi Clinical Core được chấp nhận |
| AI Value-Added Layer | DEFERRED |
| Hemorrhoid Vertical Slice 1 | `TECHNICALLY ACCEPTED` — Independent Codex Gate CLOSED; accepted baseline `2ea529ee200a0a37a77cebb9a750f70adde57618` |
| Hemorrhoid Vertical Slice 2 | `AUTHORIZED FOR IMPLEMENTATION` — Diagnosis → Treatment Decision → CarePlan/Follow-up → Return Encounter; T4 focused Independent Codex Gate mandatory |
| Current product direction | `HEMORRHOID REAL-WORLD CLINICAL WORKFLOW` — active under DEC-010 + DEC-011 + DEC-012 |
| CORE-05 | `CASE INTELLIGENCE` — giữ nguyên; chưa mở trong checkpoint này |

Không được diễn giải việc Technical Core đã đóng là toàn bộ GastroCare Core đã đóng.

### Bối cảnh pilot và chuyên khoa

| Hạng mục | Trạng thái |
|---|---|
| First pilot user | BS Thái — OWNER CONFIRMED |
| First specialty | Gastroenterology (tiêu hóa) — WORKING ASSUMPTION, chưa được Owner xác nhận thành quyết định mới |

Giả định về chuyên khoa đầu tiên không phải Owner Decision.

## 2. Baseline kỹ thuật

| Thuộc tính | Giá trị |
|---|---|
| Nhánh | `core/core-03-technical-core-completion` |
| SHA | `1a95f57f0b19bddbfcd817101d5c0c1135d90686` |
| Tag | `technical-core-v0.1` |
| Technical Core | CLOSED |
| Kiểm toán kỹ thuật cuối | PASSED |
| Backend | 99/99 |
| Frontend | 20/20 |
| Browser E2E | 4/4, ổn định qua hai lần chạy toàn bộ liên tiếp |
| Sao lưu/khôi phục | PASSED, gồm `ClinicalFormSubmission` |
| Quét privacy/Git cuối | PASSED |

Technical Core hiện có các primitive (thành phần nền tảng) như `Patient`, `Encounter`, `CarePlan`, `CarePlanVersion`, `CareTask`, `AuditEvent`, Timeline dạng read projection (hình chiếu chỉ đọc) và `ClinicalFormSubmission`. Việc có `CareTask` không đồng nghĩa Continuous Care đã hoàn tất.

## 3. Đồng bộ bằng chứng thực tế

| Hạng mục | Trạng thái |
|---|---|
| Real-world evidence alignment (đồng bộ bằng chứng thực tế) | COMPLETE |
| Kiểm toán toàn bộ corpus | 270/270 DOCX đã xử lý |
| CareEpisode/domain architecture (kiến trúc miền) | LOCKED |
| Atomic Field Dictionary | 118/118 khái niệm đã được tính đến; 0 unmapped |
| Clinician Review | LOCKED FOR v1 SCOPE |
| Longo Clinical Workflow v1.0 | OWNER LOCKED |

`118/118 accounted for` chỉ có nghĩa mọi khái niệm đều được tính đến, không có nghĩa mọi khái niệm đã sẵn sàng triển khai hoặc phải trở thành trường nhập liệu thường ngày.

### Ranh giới bằng chứng lịch sử của các thang đo

| Thang đo | Dữ liệu lịch sử thực tế đã xác minh |
|---|---|
| Wexner | UNDETERMINED |
| HDSS | UNDETERMINED |
| SHS-HD | UNDETERMINED |

Không được biến các trạng thái `UNDETERMINED` thành dữ kiện đã xác nhận. Định nghĩa/chấm điểm HDSS và SHS-HD thường quy vẫn chờ xác nhận lâm sàng.

## 4. Clinical Workflow SSOTs

### 4.1 Longo

[`08_LONGO_CLINICAL_WORKFLOW_v1.0.md`](08_LONGO_CLINICAL_WORKFLOW_v1.0.md) tiếp tục là authoritative SSOT (nguồn sự thật duy nhất có thẩm quyền) cho Longo sub-workflow (quy trình con Longo).

```text
Status: OWNER LOCKED
Version: 1.0
Implementation status: CORE-04 TECHNICAL/CLINICAL BASELINE INDEPENDENTLY VERIFIED
Owner product acceptance: NOT CLAIMED
Longo-only Gate G: RETIRED BY OWNER
Real-patient runtime: NOT AUTHORIZED
```

Longo là reusable verified baseline (baseline đã kiểm chứng có thể tái sử dụng); không bị Hemorrhoid workflow supersede hoặc viết lại.

### 4.2 Hemorrhoid

[`10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md`](10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md) là authoritative clinical SSOT cho Hemorrhoid real-world workflow theo DEC-011.

```text
Status: OWNER LOCKED
Version: 1.0
Vertical Slice 1: TECHNICALLY ACCEPTED
Accepted baseline: 2ea529ee200a0a37a77cebb9a750f70adde57618
Vertical Slice 2: AUTHORIZED FOR IMPLEMENTATION
Vertical Slice 2 authority: DEC-012 + docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md
T4 independent audit: MANDATORY FOCUSED CODEX GATE
Real-patient runtime: NOT AUTHORIZED
```
## 5. Giai đoạn và hướng tiếp theo

**Giai đoạn hiện tại:** GASTROCARE CORE — IN PROGRESS

**Hướng sản phẩm hiện tại:** HEMORRHOID REAL-WORLD CLINICAL WORKFLOW

**Last completed checkpoint:** `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2 DISCOVERY`

Discovery Gate CLOSED: Diagnosis/Treatment Decision/CarePlan/follow-up/Return Encounter semantics, concurrency model, schema impact, RBAC, audit, Timeline và acceptance criteria đều RESOLVED; unresolved Owner questions = 0.

**Work package hiện tại:** `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2 IMPLEMENTATION`

**Authority:** DEC-012 + `docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md`, đều OWNER LOCKED.

Target:

```text
Hemorrhoid Examination
→ Diagnosis
→ Treatment Decision
→ CarePlan
→ Follow-up
→ Return Encounter
```

Implementation được phép tuần tự T0 → T7 theo Contract.

T4 là high-risk transaction/concurrency gate: sau implementation + targeted concurrency tests + ChatGPT source review PASS, bắt buộc fresh Independent Codex READ-ONLY audit chỉ cho T4.

Expected schema boundary: `NO PRISMA SCHEMA CHANGE / NO DATABASE MIGRATION`.
Nếu cần migration, Diagnosis/TreatmentDecision entity hoặc clinical semantic mới: STOP và xin Owner Decision.

Implementation/test/acceptance: SYNTHETIC DATA ONLY.
`CORE-05 = CASE INTELLIGENCE — NOT OPENED`.
Real-patient runtime và production: `NOT AUTHORIZED`.
## 6. Ranh giới vận hành và an toàn

| Hạng mục | Trạng thái |
|---|---|
| Real-patient runtime | NOT AUTHORIZED |
| Dữ liệu bệnh nhân thật | NOT AUTHORIZED |
| Pilot chính thức với BS Thái | NOT STARTED |
| Production | NOT AUTHORIZED |
| Cơ sở dữ liệu production | NONE |
| Legal / privacy review | OPEN / REQUIRED |
| Historical import implementation | OUT OF CURRENT SCOPE |

Chỉ được dùng synthetic data (dữ liệu giả lập) cho triển khai, kiểm thử và nghiệm thu hiện tại. Bằng chứng từ corpus thực tế chỉ được ghi nhận dưới dạng bằng chứng/kết quả tổng hợp đã được khử thông tin nhận dạng. Các sự cố sanitizer lịch sử vẫn thuộc hồ sơ quản trị; tài liệu SSOT không tái tạo giá trị bị lộ, dữ liệu định danh hoặc nội dung lâm sàng thô.

## 7. CURRENT EXECUTION CONTEXT

| Thuộc tính | Giá trị |
|---|---|
| Current branch | `discovery/hemorrhoid-real-world-workflow` |
| Discovery baseline | `eeadfc31ed9819e06fb80c545573a4bba76d952a` |
| Current phase | `GASTROCARE CORE — IN PROGRESS` |
| Last technically accepted implementation | `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 1` at `2ea529ee200a0a37a77cebb9a750f70adde57618` |
| Last completed work package | `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2 DISCOVERY` |
| Discovery status | `CLOSED — OWNER ACCEPTED` |
| Current work package | `HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2 IMPLEMENTATION` |
| Current authority | `DEC-012 — OWNER LOCKED` |
| Implementation Contract | `docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md — OWNER LOCKED` |
| Current authorized task | `T0 → T7 IMPLEMENTATION SEQUENCE` |
| Slice 2 implementation | `AUTHORIZED FOR IMPLEMENTATION` |
| Diagnosis | `1 logical HEMORRHOID_DIAGNOSIS chain/Encounter; diagnosisSummary required free text; no coding v1` |
| Treatment Decision | `1 logical HEMORRHOID_TREATMENT_DECISION chain/Encounter; decisionSummary required free text; no taxonomy v1` |
| Follow-up | `0..1 next clinical follow-up target/CarePlan; explicit Return Encounter matching` |
| T4 concurrency model | `SERIALIZABLE + expectedCurrentVersionId + no automatic retry + conflict → 409` |
| T4 independent gate | `MANDATORY — fresh Codex READ-ONLY audit limited to T4 after implementation/tests/ChatGPT review PASS` |
| Schema/migration expectation | `NO CHANGE / NO MIGRATION` |
| Current authoritative Hemorrhoid SSOT | `docs/10_HEMORRHOID_CLINICAL_WORKFLOW_v1.0.md` |
| Longo SSOT role | `docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md` — VERIFIED SUB-WORKFLOW BASELINE |
| CORE-05 | `CASE INTELLIGENCE — NOT OPENED` |
| Implementation/test data | `SYNTHETIC DATA ONLY` |
| Real-patient runtime | `NOT AUTHORIZED` |
| Production | `NOT AUTHORIZED` |
| AI | `DEFERRED` |

`CURRENT EXECUTION CONTEXT` là trạng thái vận hành, không phải hồ sơ lịch sử. Cập nhật section này khi accepted checkpoint thay đổi current work package, authority, gate hoặc implementation status.

Không âm thầm sửa đổi Owner Decisions khi cập nhật section này.
