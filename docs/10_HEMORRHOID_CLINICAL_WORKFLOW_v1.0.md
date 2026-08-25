# GastroCare — Hemorrhoid Clinical Workflow v1.0

**Status:** OWNER LOCKED
**Version:** 1.0
**Date:** 2026-08-25
**Authority:** DEC-010 + DEC-011
**Real-patient runtime:** NOT AUTHORIZED
**Implementation/test data:** SYNTHETIC DATA ONLY
**AI dependency:** NONE

---

## 1. Purpose
Authoritative clinical SSOT cho GastroCare Hemorrhoid real-world workflow. Các section `DISCOVERY REQUIRED` không phải clinical facts đã được xác nhận.

## 2. Authority boundary
Owner Decisions có thẩm quyền cao hơn tài liệu này. Không supersede DEC-006/007/008 hoặc `08_LONGO_CLINICAL_WORKFLOW_v1.0.md`. Longo tiếp tục là verified sub-workflow.

## 3. Product workflow frame
```text
Patient
→ Encounter Context
→ Hemorrhoid Examination
→ Diagnosis
→ Treatment Decision
→ CarePlan / Follow-up
→ Return Encounter
```
Core manual-first, không phụ thuộc AI.

## 4. Implementation map
Vertical Slice 1: TECHNICALLY ACCEPTED. Initial `d67e1014...`; accepted correction baseline `2ea529ee200a0a37a77cebb9a750f70adde57618`. Independent Codex audit FAIL (2 blockers) → correction → focused re-check PASS.

Vertical Slice 2: DISCOVERY ONLY. Implementation `NOT AUTHORIZED`.

## 5. Encounter Context
Patient, Tenant, Facility/Room khi có, responsible clinician, `occurredAt`, provenance actor. `Encounter.episodeId` nullable. Không tự tạo/suy luận CareEpisode.

## 6. Responsible clinician
Doctor generic create không chọn clinician → authenticated Doctor actor sau tenant/role validation. Receptionist không chọn clinician → configured pilot default, fail-closed. Không silent fallback.

## 7. Clinician handover
Explicit, DOCTOR-authorized, tenant-safe, preserve history/audit, transactionally consistent, concurrency-safe. No-op `A → A` reject trước mutation/history/audit. Real `A → B` giữ optimistic concurrency guard.

## 8. Facility / Room
Tenant là security/customer boundary; Facility/Room là physical care location. Cross-tenant ancestry/reference reject.

## 9. Hemorrhoid Examination v1
Tất cả field optional; empty completion allowed; completed immutable; amendment append-only. Internal/External/Mixed có count/location/size riêng; một Goligher grade/exam; prolapse và bleeding tách symptom/observed; không đưa `mainHemorrhoidSize` trở lại; không fabricate scoring/vocabulary; `sphincterTone` không ép vocabulary chưa khóa.

## 10. Vital copy-forward
Same tenant/patient, COMPLETED only, prior by `Encounter.occurredAt`, không dùng `createdAt`, không future→backdated copy, editable pre-fill, frozen snapshot, deterministic tie-break.

## 11. Diagnosis — DISCOVERY REQUIRED
Resolve structured/free text/hybrid, cardinality, Encounter relation, lifecycle, amendment, provenance, Timeline, coding requirement. Không tự chọn ICD/coding system. Không mặc định tạo Diagnosis entity.

## 12. Treatment Decision — DISCOVERY REQUIRED
Resolve representation, lifecycle, provenance, Diagnosis/CarePlan relation, amendment, distinction giữa decision và performed treatment. `Treatment Decision ≠ Procedure performed ≠ Surgery performed`. Không tự tạo taxonomy.

## 13. CarePlan — REUSE FIRST
Ưu tiên reuse `CarePlan`/`CarePlanVersion`; resolve creation time, Encounter relation, minimum content, lifecycle/versioning, follow-up intent, Treatment Decision relation.

## 14. Follow-up — REUSE FIRST
Ưu tiên reuse `CareTask`; resolve trigger, automatic vs clinician-decided, due date, completion, cancellation/reschedule, return Encounter matching. Không tự áp Longo scheduling semantics.

## 15. Return Encounter
Occurrence mới; không overwrite Encounter cũ; history qua Timeline read projection.

## 16. Timeline
Read projection, không là independent source of truth. Khi capability được implement, cần trình bày Encounter, Examination, Diagnosis, Treatment Decision, CarePlan/version, Follow-up task, Return Encounter.

## 17. Vertical Slice 2 Discovery Gate
CLOSED khi có clinician-confirmed workflow; Diagnosis/Treatment Decision semantics; CarePlan reuse; follow-up semantics; domain/schema impact; RBAC; audit/provenance; Timeline; acceptance criteria; implementation contract; unresolved Owner questions = 0. Sau đó Owner mới có thể mở implementation.

## 18. Deferred / out of current scope
Procedure, generic Surgery, Investigation Order/Result, HDSS, SHS-HD, anal dilation scoring, Longo difficulty scoring, rectoscopy interpretation, historical import, AI Scribe/diagnosis/prescription/chatbot, CORE-05, production, real-patient runtime.

## 19. Safety and privacy boundary
Synthetic data only. Real patient data/runtime NOT AUTHORIZED. Production NOT AUTHORIZED. Historical import OUT OF CURRENT SCOPE. Sanitized evidence không phải synthetic runtime data.

## 20. Change Control
Không nâng AI recommendation thành clinical fact hoặc working assumption thành Owner Decision nếu không có authority phù hợp.
