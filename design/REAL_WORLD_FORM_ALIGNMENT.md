# Real-World Clinical Form Alignment — CORE-03

Status: **IMPLEMENTATION EVIDENCE**, not a Documentation Baseline document.
Scope: real-world structural discovery over a de-identified-processing
pipeline, field taxonomy, GastroCare gap analysis, and the resulting
Clinical Forms architecture + first template. Real patient data was used
only as read-only, local, structural design evidence — see "Privacy
pipeline" below. **No real patient data was imported into GastroCare, its
database, tests, fixtures, or this document.**

## 1. Source dataset

- Path: a local, read-only directory of real clinical DOCX records
  (outside this repository). Never copied into the repo, never modified,
  never committed.
- `DOCX_COUNT=270`
- Document identity (from corpus-universal section headings, itself
  boilerplate the source clinic's own template prints on every document —
  not a patient value): a hemorrhoid-surgery (Longo procedure) research
  case-record form, "KẾT QUẢ ĐIỀU TRỊ BỆNH TRĨ BẰNG PHẪU THUẬT LONGO", from
  Hai Phong Medical University Hospital.

### Package inventory (aggregate presence only)

| Part | Coverage |
|---|---|
| Body | 270/270 |
| Tables | 270/270 |
| Headers | 270/270 |
| Footers | 0/270 |
| Comments | 0/270 |
| Footnotes | 270/270 |
| Endnotes | 270/270 |
| Tracked revisions | 0/270 |
| Embedded media | 0 total |
| Embedded objects | 0 total |
| Parser warnings | 0 |

Average 16 tables/document, ~11.8 rows/table — a dense, heavily
table-structured form (consistent with a multi-page clinical CRF).

## 2. Privacy pipeline (how this evidence was produced safely)

Two-stage, local-first pipeline, entirely under a private scratch
workspace outside this repository:

1. **Private local extraction** (`extract.py`, stdlib `zipfile` +
   `xml.etree.ElementTree`, no third-party dependency): iterates the OOXML
   package per document, records structural presence (body/tables/headers/
   footers/comments/footnotes/endnotes/tracked-changes/media/embeddings),
   and writes per-document paragraph/table text to a **private** directory.
   Documents are addressed only by ephemeral `DOC_NNNNNN` IDs; the
   filename↔ID map lives only in the private directory and was never read
   into this conversation. Only aggregate counts were printed to stdout.
2. **Sanitization / structural aggregation** (`aggregate.py`): reads the
   private per-document JSON and computes, across the whole corpus, a
   **frequency-based field dictionary** — a paragraph/table-cell text is
   only reported as a "field label" if it recurs, verbatim, across many
   independent documents (≥5 documents, later tightened to ≥95% of the
   corpus for the table-column-header layer after a heuristic-quality
   issue, see below). Values are never written to the sanitized output;
   only their *type* (number/date/short/enum-with-bounded-options/free
   text) is inferred, and enum option sets are included only when the
   number of distinct values across the whole corpus is small relative to
   document count (i.e. clearly a template-defined category, not a
   per-patient free value).

**One heuristic bug was caught, and its output was model-context-visible
before the fix — this is disclosed here in full rather than minimized.**
An early version of the table-column-header detector mistook one-off,
single-record multi-cell rows for a repeating table's header row, and
surfaced a handful of literal per-patient clinical values (specific
surgery-duration-in-minutes values and specific VAS pain-score values, at
low, implausible per-value corpus frequency such as 26/270 or 43/270 —
i.e. clearly individual answers, not a template label printed on every
document) as if they were structural column labels. That first-pass
output was read into this conversation's context before the defect was
recognized. It was caught by the low, non-universal frequency of those
"header" strings — a genuine template header is printed identically for
every patient, so anything well below 100% is a sign of leaked
per-patient data, not a real header. The fix raised the acceptance
threshold for that layer to ≥95% corpus-wide frequency, the sanitized
output file was regenerated and re-verified to contain only 100%-frequency
entries, and no downstream design or implementation decision in this
document used the pre-fix output. The leaked values existed only in this
conversation's model context and in the private/sanitized scratch
workspace outside this repository (`/tmp/gastrocare-real-form-discovery`);
they were never written to any file inside this repository, any test
fixture, any commit, or reproduced verbatim in this document. See the
final report's PRIVACY section for the explicit before/after account.

Only the sanitized aggregate (`field_dictionary.json`: field labels,
occurrence frequencies/percentages, inferred types, unit hints, bounded
enum option sets, section headings, and near-universal table column
headers) was ever read into this conversation's context. Raw per-document
text, the filename↔ID map, and individual patient values were not — with
the single caught-and-fixed exception described above.

## 3. Structural findings

**Canonical sections** (from corpus-universal section headings, 270/270
unless noted):

1. PHẦN HÀNH CHÍNH (Administrative)
2. LÝ DO VÀO VIỆN (Reason for admission)
3. TIỀN SỬ (History)
4. TRIỆU CHỨNG TOÀN THÂN (General symptoms)
5. THỰC THỂ (Physical exam)
6. CẬN LÂM SÀNG (Paraclinical / labs)
7. KẾT QUẢ TRONG PHẪU THUẬT (Intraoperative result), with sub-sections:
   khám hậu môn/trĩ sau vô cảm, and đánh giá độ khó phẫu thuật Longo (a
   7–35-point surgical-difficulty scale — research-specific, see §5)
8. KẾT QUẢ SỚM SAU MỔ (Early postoperative outcome), with sub-sections:
   kết quả hậu phẫu, kết quả sau 2 tuần, đánh giá sau nong hậu môn
9. KẾT QUẢ XA (Long-term outcome) — contains a distinct, separately
   labeled sub-document, **"PHIẾU KHÁM LẠI BỆNH NHÂN" (patient follow-up
   visit form)**, present in **265/270 (98.1%)** records — the clearest
   longitudinal, repeatable workflow unit in the whole corpus.

**Administrative/identity fields** (100% occurrence, `- Label` paragraph
style): Mã bệnh án (record number), Họ và tên (full name), Số điện thoại
(phone), Địa chỉ (address), Nghề nghiệp (occupation — bounded enum:
Bác sĩ/Công nhân/Giáo viên/Hưu trí/Học sinh/Lao động tự do/Nội trợ/Nữ hộ
sinh/Sinh viên/Thủy thủ/Tự do), Ngày vào viện / Ngày ra viện (admission /
discharge date).

**Universal table structures**: sphincter tone assessment ("Trương lực cơ
thắt" with a "Bình thường" option), rectoscopy ("Soi trực tràng"),
hemorrhoid characteristics ("Tính chất búi trĩ: Sa/xơ/chảy máu" —
prolapse/fibrosis/bleeding), anesthesia type ("Vô cảm"), a difficulty
scoring band (7–14/15–21/22–28/29–35), operative duration in minutes
("Thời gian phẫu thuật … Phút"), postoperative pain on a VAS 0–10 scale
("Đau sau mổ … VAS …/10"), a 4-level criteria grid ("Tiêu chí": Mức 0
Tốt / Mức 1 Chấp nhận được / Mức 2 Trung bình / Mức 3 Nặng/Cảnh báo), and
a 5-point frequency response scale (Không bao giờ / Hiếm khi / Thỉnh
thoảng / Hàng tuần / Hàng ngày) paired with a corpus-universal
**"Đánh giá tổng điểm (0-20 điểm)"** total-score field.

**Scoring instrument identified**: the 0–20 total-score field, paired
with a 5-point Never→Daily frequency response scale, matches the
structure of the published **Wexner (Jorge–Wexner) Continence Grading
Scale** (5 items, each 0–4, summed 0–20) — a standard, publicly
documented clinical instrument, not a source-specific invention. The
corpus also contains an "HDSS"/"SHS"-style 0–4-per-item total labeled
"Tổng điểm" / "Tổng điểm SHS" at corpus-universal frequency, and the
surgical-difficulty 7–35 band under §7.2. Only the Wexner-pattern
instrument had sufficient corpus-wide structural confidence *and* a
clear, non-research, routine-follow-up use to justify implementing in
this pass (see §5); the others are deferred.

## 4. Field taxonomy (sanitized, canonical)

| Canonical field | Section | Type | Occurrence | Classification |
|---|---|---|---|---|
| Mã bệnh án | Admin | number | 270/270 | CORE PATIENT — already covered (Patient.id) |
| Họ và tên | Admin | text | 270/270 | CORE PATIENT — already covered (Patient.fullName) |
| Số điện thoại | Admin | text | 270/270 | CORE PATIENT — already covered (Patient.phone) |
| Địa chỉ | Admin | text | 270/270 | RESEARCH-ONLY / DEFER — not promoted to Core (see §6) |
| Nghề nghiệp | Admin | enum | 270/270 | RESEARCH-ONLY / DEFER — not promoted to Core (see §6) |
| Ngày vào viện / Ngày ra viện | Admin | text (date-like) | 270/270 | CORE ENCOUNTER — already covered (Encounter.createdAt / clinical note) |
| Lý do vào viện | Reason | text | corpus-wide | CORE ENCOUNTER — already covered (Encounter.reasonForVisit) |
| Tiền sử / Triệu chứng / Thực thể / Cận lâm sàng | History/exam/labs | free text, one-time | corpus-wide | SPECIALTY CLINICAL FORM — RESEARCH-ONLY / DEFER (one-time admission CRF, not this pass) |
| Đánh giá độ khó phẫu thuật Longo (7–35) | Intraop | derived score | 270/270 | RESEARCH-ONLY / DO NOT PRODUCTIZE — surgical-difficulty research instrument, no routine clinical-care use |
| Thời gian phẫu thuật | Intraop | number + unit (phút) | 270/270 | PROCEDURE-SPECIFIC FORM — UNKNOWN / DEFER (not in v1 template) |
| Đau sau mổ (VAS 0–10) | Postop | number | 270/270 | OUTCOME / FOLLOW-UP FORM — **IMPLEMENTED (v1 template)** |
| Wexner-pattern continence total (0–20) | Follow-up | DERIVED SCORE | 270/270 | DERIVED SCORE — **IMPLEMENTED (v1 template)** |
| Tiêu chí (Mức 0–3 outcome grid) | Postop | enum grid | 270/270 | OUTCOME / FOLLOW-UP FORM — UNKNOWN / DEFER (insufficient corpus-wide item-level confidence this pass) |
| PHIẾU KHÁM LẠI (follow-up visit sub-form, incl. Ghi nhận thêm ý kiến/than phiền) | Long-term | textarea | 265/270 | CARE PLAN / FOLLOW-UP — **IMPLEMENTED (v1 template, "additionalNotes")** |

**Canonical field count (this pass): 14** (table above).
- CORE PATIENT candidates already supported: 3 (Mã bệnh án → Patient.id,
  Họ và tên → Patient.fullName, Số điện thoại → Patient.phone)
- CORE ENCOUNTER candidates already supported: 2 (Ngày vào viện/ra viện →
  Encounter.createdAt, Lý do vào viện → Encounter.reasonForVisit)
- CARE PLAN / FOLLOW-UP: 1 (follow-up visit note, implemented)
- SPECIALTY CLINICAL FORM: 1 (admission history/exam/labs block, deferred)
- PROCEDURE-SPECIFIC: 1 (operative duration, deferred)
- OUTCOME / FOLLOW-UP: 2 (VAS pain — implemented; outcome criteria grid —
  deferred)
- DERIVED SCORES: 1 (Wexner-pattern total — implemented)
- RESEARCH-ONLY / DEFERRED: 3 (occupation, address, surgical-difficulty
  score)
- UNKNOWN / DEFER: 0 remaining unclassified

## 5. Research vs. routine classification

- **Routine clinical need, implemented**: postoperative pain (VAS),
  continence/Wexner-pattern assessment, and the free-text follow-up note —
  these directly inform ongoing care decisions at a follow-up visit.
- **Research-specific, excluded from GastroCare Core and from the v1
  Clinical Form**: the surgical-difficulty 7–35 scoring band (has no
  routine-care use — it characterizes the *operation*, retrospectively,
  for a study, not the patient's ongoing care), the full one-time
  admission/history/exam/labs block (a research CRF section, better
  suited to its own deliberate future pass if ever productized, not
  bundled into this one), and occupation (a demographic variable useful
  for research stratification, not for this platform's clinical
  workflow).
- **Deferred pending stronger evidence**: the 0–3 "Tiêu chí" outcome
  grid — the sanitized aggregate confirmed the response-scale labels
  (Mức 0–3) are corpus-universal, but the specific criteria row labels
  were not extracted at sufficient corpus-wide confidence in this pass to
  productize responsibly; and operative duration, which is clearly a
  clean numeric+unit field but has no clear "who consumes this in
  ongoing care" story yet.

## 6. GastroCare gap analysis

**Already supported** (no schema change): patient identity/contact
(Patient.fullName/phone), encounter reason and admission timing
(Encounter.reasonForVisit/createdAt), free-text clinical narrative
(Encounter.clinicalNote/assessment), scheduled follow-up
(CareTask type FOLLOW_UP), and the Timeline read projection.

**Structurally missing before this task**: any way to capture
*structured, scored, repeatable* clinical assessments tied to a specific
follow-up visit (pain score, continence score) — previously only
representable as unstructured Encounter free text, which cannot support
a computed score, a range-validated numeric field, or longitudinal
comparison across visits.

**Deliberately kept free-text** (not structured, per §24 "no schema
inflation"): admission history/exam/labs narrative — one-time content
with low cross-workflow reuse, no clear routine scoring need.

**Deliberately not productized this pass**: occupation, address,
surgical-difficulty score, operative duration, and the 0–3 outcome
criteria grid — see §5.

**No Core (Patient/Encounter/CarePlan) schema changes were made.** Only
a new, additive `ClinicalFormSubmission` model was introduced.

## 7. Clinical Forms architecture

- **ClinicalFormTemplate / ClinicalFormTemplateVersion**: implemented as
  **code-configuration**, not database rows (`backend/src/clinical-forms/
  templates/*.ts`), per §31 ("no generic low-code form builder", "keep
  architecture minimal"). A template is identified by
  `(templateKey, version)`; only that identity is persisted per
  submission (`ClinicalFormSubmission.templateKey/templateVersion`), so a
  historical submission always resolves against the exact field
  definitions, validation ranges, and score-calculation logic it was
  captured under — even after a newer version is added to the registry.
  This satisfies "historical submissions remain interpretable after
  template changes" without a schema-in-the-database form builder.
- **ClinicalFormSubmission** (single new Prisma model): Tenant-scoped,
  Patient-linked, Encounter-linked (one submission per
  `(encounterId, templateKey)`, enforced by a unique constraint), `status`
  DRAFT→COMPLETED (no amendment lineage in v1, per §36 "do not invent a
  complex document lifecycle unnecessarily"), `responses` (raw item-level
  answers, server-validated against the template's code-defined field
  schema — type, range, required, enum-membership), `computedScores`
  (deterministic derived totals, recomputed from `responses` at
  completion time — never trusts a client-submitted total, and is a
  convenience cache, not the source of truth).
- **Submission lifecycle**: DRAFT is mutable (partial responses allowed,
  full response-set validation only at completion); COMPLETED is
  immutable — no update route exists once completed (mirrors the
  Encounter "no PATCH" and CarePlan DRAFT/SIGNED precedents already in
  this codebase).
- **Longitudinal model**: no `followup_1month`/`followup_3month`-style
  columns. Each follow-up visit is its own Encounter; each Encounter can
  carry its own `ClinicalFormSubmission` of the same `templateKey`. The
  visit's ordinal position and elapsed time are captured as ordinary
  template fields (`visitNumber`, `monthsPostOp`), not schema columns.
  History is simply "all submissions for a patient, ordered by
  creation/completion time" (`GET /clinical-forms?patientId=`).
- **Score calculation**: `computeScores()` deterministically sums the
  five Wexner item fields from `responses` — never accepts a
  client-submitted total, and returns `null` for a still-incomplete
  DRAFT so the UI can show "—" instead of a misleading 0.
- **Audit**: `CLINICAL_FORM_CREATED` and `CLINICAL_FORM_COMPLETED`
  AuditEvent rows, metadata limited to `{templateKey, templateVersion}` —
  never raw `responses` (verified by an automated test, see §8).
- **RBAC**: `ClinicalFormsController` is DOCTOR-only at the class level
  (RECEPTIONIST fully denied — 403 on every route, including list/read,
  not just write).
- **Tenant isolation**: identical pattern to every other Core service —
  `findFirst({ id, tenantId })`, cross-tenant access returns 404, never
  403 (existence not leaked). Verified by an automated cross-tenant test
  suite mirroring `core03-hardening.e2e-spec.ts`'s pattern.
- **Timeline integration**: a new `CLINICAL_FORM_SUBMITTED` event type,
  sourced by a `findMany({tenantId, patientId, status: 'COMPLETED'})`
  query added to the existing `getTimeline()` read projection — no new
  writable table, Timeline remains a pure read projection.

## 8. First sanitized template

- **Template key**: `HEMORRHOID_LONGO_FOLLOWUP`
- **Display name**: "Khám lại sau phẫu thuật Longo (trĩ)"
- **Version**: 1
- **Sections**: Thông tin lần khám lại (visitNumber, monthsPostOp) → Đánh
  giá đau (vasPain, 0–10) → Đánh giá khả năng tự chủ hậu môn — thang điểm
  Wexner (5 single-choice items, 0–4 each) → Ghi nhận thêm
  (additionalNotes, free text)
- **Field count**: 8 (2 context + 1 pain + 5 Wexner items) + 1 optional
  free-text note
- **Score instruments**: Wexner-pattern continence total, 0–20,
  deterministically summed from the 5 item fields
- **Follow-up/timepoint handling**: `visitNumber` + `monthsPostOp` as
  ordinary fields on each submission, one submission per follow-up
  Encounter — no hardcoded timepoint columns
- **Research-only fields excluded**: surgical-difficulty score, occupation,
  address, operative duration, admission history/exam/labs block, the 0–3
  outcome criteria grid (all deferred — see §5)
- **Item wording note**: the 5 Wexner item field labels use the
  *standard published* Wexner instrument wording (a public clinical
  instrument, independent of this dataset), because the source's own
  per-item labels were not extractable at sufficient corpus-wide
  structural confidence in this pass — only the item-response scale
  (Never/Rarely/Sometimes/Weekly/Daily) and the 0–20 total range were
  corpus-confirmed. This is disclosed here explicitly rather than implied
  as a verbatim source quote.

## 9. Deferred items (explicit)

- Admission history/exam/labs narrative block (one-time CRF content)
- Surgical-difficulty scoring instrument (research-only)
- Occupation, address (Core-promotion deferred, insufficient
  cross-workflow evidence this pass)
- Operative duration field
- 0–3 postoperative outcome criteria grid (insufficient per-criterion
  corpus-wide confidence this pass)
- A second/later template version incorporating any of the above, should
  future evidence and Owner direction justify it

None of the above required a Core (Patient/Encounter/CarePlan) schema
change to defer safely — they simply are not yet represented anywhere in
GastroCare, which is the correct "not yet built" state, not a workaround.

## 10. Browser E2E verification outcome

The implementation session ran in a sandbox with no working Chromium
runtime (missing `libnspr4`/`libnss3`/`libnssutil3`/`libasound.so.2`, no
root/`apt-get update` access, confirmed absent anywhere on the filesystem
by exhaustive search). The Owner independently executed the full
Playwright suite in a working WSL environment, closing that gap. That run
surfaced one real defect:

- **Symptom**: after clicking "Hoàn tất phiếu khám lại" (complete), the UI
  never showed the completed state.
- **Root cause**: `FormEditor.completeForm()` (`frontend/src/pages/
  ClinicalFormPage.tsx`) called only `clinicalFormsApi.complete(id)`,
  which finalizes whatever `responses` are currently persisted on the
  server-side DRAFT — not the values the doctor had just typed/selected
  in the browser but never explicitly saved. The backend correctly
  rejected completion of an incomplete draft (400, missing required
  fields), and the frontend showed an error rather than a false success —
  but the doctor's just-entered answers were silently not what got
  validated, which is a real usability/correctness defect, not merely a
  test issue: "complete" must act on what the doctor just filled in.
- **Fix**: `completeForm()` now calls `updateDraft(id, { responses })`
  (persisting the in-editor values) immediately before `complete(id)`.
  One function, no schema/architecture change. A regression test was
  added at `frontend/src/pages/__tests__/ClinicalFormPage.test.tsx`
  asserting `updateDraft` is called with the exact in-editor values
  before `complete`.
- A second, unrelated defect was found and fixed in the Playwright test
  itself (not the application): the second longitudinal Encounter's ID
  was read from `page.url()` immediately after a button click, without
  first awaiting navigation to the resulting page — a classic
  read-before-navigation-settles race. Fixed by adding the same
  `await expect(page).toHaveURL(...)` guard already used for the first
  Encounter.

Final verified state: browser 4/4, backend 99/99, frontend 20/20,
backup/restore PASS.
