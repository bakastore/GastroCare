# GastroCare — Roadmap và Acceptance Gates

**Cập nhật:** 28/08/2026

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
| Real-world Clinical Core implementation | IN PROGRESS — Hemorrhoid Vertical Slice 1 TECHNICALLY ACCEPTED; Vertical Slice 2 technical execution complete (historical); Vertical Slice 3 technical execution complete và đã MERGED vào `main` |
| Hemorrhoid Vertical Slice 1 | CLOSED — TECHNICAL ACCEPTANCE at `2ea529ee200a0a37a77cebb9a750f70adde57618` (historical) |
| Hemorrhoid Vertical Slice 2 | TECHNICAL EXECUTION COMPLETE (historical completed work package) — DEC-012 + Contract v0.1 OWNER LOCKED; Owner product acceptance NOT CLAIMED |
| Hemorrhoid Vertical Slice 3 | TECHNICAL EXECUTION COMPLETE và đã MERGED vào `main` tại `4a73a0c8764558d2776adffcf1d26092f6456634` — DEC-013 + Contract `docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md` OWNER LOCKED; Owner product acceptance NOT CLAIMED |
| Current checkpoint | DEC-016 Session A T0→M7 technical execution PASS; next: FRESH CODEX SESSION B — INDEPENDENT READ-ONLY AUDIT; chưa commit; Owner product acceptance NOT CLAIMED |
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

### 3.2 Historical completed work package — Hemorrhoid Vertical Slice 2

**HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 2 IMPLEMENTATION** — `TECHNICAL EXECUTION COMPLETE` (không còn là work package hiện tại; giữ lại làm hồ sơ lịch sử).

Authority:
- DEC-012 — OWNER LOCKED;
- [`11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md`](11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md) — OWNER LOCKED.

Target:

```text
Hemorrhoid Examination
→ Diagnosis
→ Treatment Decision
→ CarePlan
→ Follow-up
→ Return Encounter
```

Discovery Gate CLOSED; unresolved Owner questions = 0.

Sequence:
`T0 → T1 Diagnosis → T2 Treatment Decision → T3 CarePlan sequence → T4 reconciliation/concurrency → mandatory focused Independent Codex T4 audit → T5 CareTask/Return Encounter → T6 Timeline/frontend → T7 targeted synthetic acceptance`.

Expected boundary: `NO PRISMA SCHEMA CHANGE / NO DATABASE MIGRATION`.
Synthetic data only. Real-patient runtime `NOT AUTHORIZED`.
Procedure/Surgery/Investigation/AI/CORE-05 không được mở.

Owner product acceptance: NOT CLAIMED.

### 3.2.1 Historical completed work package — Hemorrhoid Vertical Slice 3 (MERGED)

**HEMORRHOID REAL-WORLD WORKFLOW — VERTICAL SLICE 3 (CONTINUOUS CARE LOOP)** — `TECHNICAL EXECUTION COMPLETE` và đã `MERGED` vào `main` (không còn là work package hiện tại).

Authority: DEC-013 — OWNER LOCKED; [`12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md`](12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md) — OWNER LOCKED.

PR #5 (`discovery/hemorrhoid-real-world-workflow` → `main`): MERGED. Merged main baseline: `4a73a0c8764558d2776adffcf1d26092f6456634`. Final T7 implementation commit (lịch sử): `24b4abec7b932acd329d711f7cb9ca3773b204f3`.

T4/T7 gates: CLOSED — PASS (xem chi tiết tại §3.4.1 và `docs/PROJECT_STATE.md` §4.3). Schema/migration: NO CHANGE. Owner product acceptance: NOT CLAIMED.

### 3.2.2 Historical gate — Post-Slice-3 Owner Synthetic Product Acceptance

Sau khi Slice 3 đã merge vào `main`, Owner Synthetic Product Acceptance từng là current checkpoint. DEC-016 mở work package mới bên dưới; điều kiện product acceptance sau đây vẫn giữ nguyên.

**Technical PASS (build/test/audit/browser acceptance ở mọi gate T0-T7) không đồng nghĩa với Owner product acceptance.** Đây là hai khái niệm tách biệt theo authority hierarchy của roadmap này.

Gate này chỉ được đóng bằng xác nhận rõ ràng, tường minh từ Owner/BS Thái — không được tự suy ra, không được tự đóng bởi kết quả kỹ thuật, và không được Claude Code/AI tự ghi nhận PASS.

Cho đến khi Owner/BS Thái xác nhận:

- `GASTROCARE CORE` tiếp tục `IN PROGRESS` (không đóng).
- `CONTINUOUS CARE` tiếp tục `NOT COMPLETE` (không mở).
- `PRODUCT REFINEMENT` tiếp tục `DEFERRED` (không mở).
- `CORE-05` tiếp tục `NOT OPENED` (không mở).
- Real-patient runtime và production tiếp tục `NOT AUTHORIZED`.

### 3.2.3 Current package — DEC-016 Case / Pathway / Investigation

Authority: [DEC016_OWNER_AUTHORITY.md](DEC016_OWNER_AUTHORITY.md), Owner cho phép Session A thực hiện liên tục T0 → M0 schema/reconciliation proof → M1 Case → M2 TreatmentPathway/Longo → M3 Initial/Return → M4 Decision v2 → M5 Investigation → M6 workspace → M7 synthetic acceptance. Toàn bộ technical execution PASS, chưa commit/push.

Next gate: **FRESH CODEX SESSION B — INDEPENDENT READ-ONLY AUDIT**. Session A không phải independent audit. [Bằng chứng implementation](13_DEC016_CASE_PATHWAY_IMPLEMENTATION.md). Clinical Core chưa Owner product accepted; CORE-05, AI, real-patient runtime, production và PDF/image storage không mở. Giới hạn Procedure/Surgery/Investigation của package cũ không phủ quyết phạm vi DEC-016 đã được Owner khóa mới hơn.

### 3.3 Preserved Longo Clinical Core baseline

CORE-04 Longo tiếp tục là preserved verified baseline, không phải active product gate.
Longo-only Owner Synthetic Clinical Acceptance Gate G đã `RETIRED BY OWNER` theo DEC-009 và không được mở lại ngầm.

### 3.4 Hemorrhoid Vertical Slice 2 Gates

**Discovery Gate:** CLOSED — DEC-012 approved; Contract v0.1 OWNER LOCKED; unresolved Owner questions = 0.

**Implementation gates:**
1. T0 preflight PASS.
2. T1 Diagnosis PASS.
3. T2 Treatment Decision PASS.
4. T3 CarePlan sequence PASS.
5. T4 Serializable reconciliation + concurrency tests PASS.
6. ChatGPT T4 source review PASS.
7. Fresh Independent Codex READ-ONLY T4 audit: `READY FOR T4 ACCEPTANCE: YES`.
8. T5 generic CareTask + explicit Return Encounter linkage PASS.
9. T6 Timeline/frontend PASS.
10. T7 targeted synthetic acceptance PASS.

T4 independent audit là mandatory focused gate, không phải full-Slice audit.
Nếu T4 production code thay đổi sau PASS, T4 independent gate mở lại cho affected delta.
Nếu cần schema/migration: STOP trước scope expansion.

### 3.4.1 Hemorrhoid Vertical Slice 3 Gates (technical execution complete, MERGED)

**Governance Gate:** T0 CLOSED — DEC-013 OWNER LOCKED; Contract v0.1 OWNER LOCKED.

**Implementation gates:** T1 (templates/ancestry/sequence) PASS; T2 (atomic Return Encounter orchestration) PASS; T3 (two-branch CarePlan enforcement + continuous loop) PASS; T4 (episode lifecycle/concurrency, C1-C4 real-PostgreSQL) `CLOSED — PASS`, fresh Independent Codex READ-ONLY audit PASS; T5 (Timeline/backend integration) PASS; T6 (frontend) PASS; T7 (targeted synthetic acceptance, backend + focused Playwright browser acceptance) `CLOSED — PASS`.

**Merge:** PR #5 (`discovery/hemorrhoid-real-world-workflow` → `main`) MERGED at `4a73a0c8764558d2776adffcf1d26092f6456634`. T7 raw re-verified directly on merged main: targeted 3/3 PASS, backend 331/331 PASS, frontend 37/37 PASS, builds PASS, worktree CLEAN, blockers NONE.

Slice 3 technical execution complete và merge sequence hoàn tất không tự động đóng `OWNER SYNTHETIC PRODUCT ACCEPTANCE` (§3.2.2) — hai gate này tách biệt.

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
