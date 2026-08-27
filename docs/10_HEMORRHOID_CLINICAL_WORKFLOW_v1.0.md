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

Vertical Slice 2: `AUTHORIZED FOR IMPLEMENTATION` under DEC-012 and `docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md`.

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

## 11. Diagnosis v1 — OWNER LOCKED

Mỗi Encounter có đúng một logical `HEMORRHOID_DIAGNOSIS` chain.

Field bắt buộc: `diagnosisSummary` — free text.

Không tự suy Diagnosis từ Hemorrhoid Examination, Goligher grade, symptoms, observed findings, rule engine hoặc AI.
V1 không ICD, custom taxonomy hoặc automatic classification.
Free-text Diagnosis v1 không phải final analytics representation cho CORE-05.

## 12. Treatment Decision v1 — OWNER LOCKED

Mỗi Encounter có đúng một logical `HEMORRHOID_TREATMENT_DECISION` chain.
Field bắt buộc: `decisionSummary` — free text. Không taxonomy trong v1.

Invariant: `Treatment Decision ≠ Procedure performed ≠ Surgery performed`.

## 13. CarePlan — REUSE LOCKED

Reuse `CarePlan` và `CarePlanVersion`; không tạo Hemorrhoid-specific CarePlan.

Backend-authoritative sequence:
`HEMORRHOID_EXAMINATION COMPLETED → HEMORRHOID_DIAGNOSIS COMPLETED → HEMORRHOID_TREATMENT_DECISION COMPLETED → CarePlan → CarePlan SIGNED`.

Upstream amendment không auto-rewrite downstream completed/signed record.

## 14. Follow-up v1 — OWNER LOCKED

General Hemorrhoid CarePlan có `0..1` next clinical follow-up target.
Không áp Longo multi-timepoint schedule.

Return Encounter matching explicit: Doctor chọn CareTask; backend validate same tenant/patient và lưu `completedByEncounterId`; không heuristic auto-match.

Signed CarePlan amendment thay đổi `followUpDate` phải reconcile tường minh bằng `RESCHEDULE`, `CANCEL` hoặc `KEEP_WITH_REASON`. `KEEP_WITH_REASON` bắt buộc reason + audit.

Reconciliation là atomic transaction concern; không silent drift.

## 15. Return Encounter

Return Encounter là clinical occurrence mới; không overwrite Encounter cũ.
General follow-up completion: Return Encounter mới → Doctor explicitly selects OPEN CareTask → backend validates same tenant/patient → stores `completedByEncounterId`.
History tiếp tục qua Timeline read projection.

## 16. Timeline

Timeline tiếp tục là read projection, không phải independent source of truth.
Khi Slice 2 được implement, Timeline trình bày rõ Encounter, Hemorrhoid Examination, Diagnosis, Treatment Decision, CarePlan/version, Follow-up task và Return Encounter.
Completed/amended historical revisions không bị che mất.

## 17. Vertical Slice 2 Implementation Authority

Status: `AUTHORIZED FOR IMPLEMENTATION`.

Authority:
- DEC-012 — OWNER LOCKED;
- `docs/11_HEMORRHOID_SLICE2_IMPLEMENTATION_CONTRACT.md` — OWNER LOCKED.

Boundary:
- reuse-first;
- no Diagnosis/TreatmentDecision table;
- no Prisma schema change;
- no database migration;
- synthetic data only;
- T4 uses Serializable transaction + `expectedCurrentVersionId` + conflict→409 + mandatory focused Independent Codex audit.

Nếu implementation cần schema/migration hoặc clinical semantic mới: STOP và xin Owner Decision.
## 18. Deferred / out of current scope
Procedure, generic Surgery, Investigation Order/Result, HDSS, SHS-HD, anal dilation scoring, Longo difficulty scoring, rectoscopy interpretation, historical import, AI Scribe/diagnosis/prescription/chatbot, CORE-05, production, real-patient runtime.

## 19. Safety and privacy boundary
Synthetic data only. Real patient data/runtime NOT AUTHORIZED. Production NOT AUTHORIZED. Historical import OUT OF CURRENT SCOPE. Sanitized evidence không phải synthetic runtime data.

## 20. Change Control
Không nâng AI recommendation thành clinical fact hoặc working assumption thành Owner Decision nếu không có authority phù hợp.

## 21. Vertical Slice 3 — Continuous Care Loop — OWNER LOCKED

Authority: DEC-013 — OWNER LOCKED.

Contract: `docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md`.

- Continuous-care loop mở rộng workflow sau Return Encounter.
- Initial Hemorrhoid Encounter tiếp tục ungrouped (`episodeId = null`) vĩnh viễn; không PATCH/backfill.
- `HEMORRHOID_TREATMENT` CareEpisode chỉ bắt đầu tại Return Encounter đầu tiên.
- Follow-up Assessment = `HEMORRHOID_FOLLOW_UP_ASSESSMENT` với `responseSummary` free-text bắt buộc.
- Next Clinical Decision = `HEMORRHOID_NEXT_CLINICAL_DECISION` với `decisionSummary` free-text bắt buộc.
- Return Encounter có thể tạo CarePlan mới sau khi Next Clinical Decision hoàn tất.
- Các Return Encounter sau tái sử dụng cùng một ACTIVE Hemorrhoid episode.
- CareEpisode close là hành động tường minh và yêu cầu ít nhất một Follow-up Assessment đã COMPLETED.
- Không tự động suy luận lâm sàng hoặc taxonomy kết quả.
- Synthetic data only; real-patient runtime NOT AUTHORIZED.
