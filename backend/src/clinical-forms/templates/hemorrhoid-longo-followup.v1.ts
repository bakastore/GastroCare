import { ClinicalFormTemplate } from './types';

const WEXNER_FREQUENCY_OPTIONS = [
  { value: 0, label: 'Không bao giờ' },
  { value: 1, label: 'Hiếm khi (<1 lần/tháng)' },
  { value: 2, label: 'Thỉnh thoảng (<1 lần/tuần, ≥1 lần/tháng)' },
  { value: 3, label: 'Hàng tuần (<1 lần/ngày, ≥1 lần/tuần)' },
  { value: 4, label: 'Hàng ngày (≥1 lần/ngày)' },
];

const WEXNER_ITEM_KEYS = [
  'wexnerSolidStool',
  'wexnerLiquidStool',
  'wexnerGas',
  'wexnerPadWearing',
  'wexnerLifestyleAlteration',
];

const WEXNER_ITEM_LABELS = [
  'Đại tiện không tự chủ với phân rắn',
  'Đại tiện không tự chủ với phân lỏng',
  'Không tự chủ với hơi',
  'Phải mang băng vệ sinh/tã',
  'Thay đổi lối sống do rối loạn tự chủ',
];

// HEMORRHOID_LONGO_FOLLOWUP v1
//
// First sanitized Clinical Forms template, derived from real-world
// structural discovery evidence (design/REAL_WORLD_FORM_ALIGNMENT.md) over
// a 270-document hemorrhoid-surgery (Longo procedure) case-record corpus.
// The source documents contain a distinct, recurring "PHIẾU KHÁM LẠI BỆNH
// NHÂN" (patient follow-up visit) sub-section present in 265/270 (98.1%)
// records — the clearest longitudinal, repeatable workflow in the dataset —
// so it is the first workflow formalized here, rather than the full
// admission/intraoperative case-record (which is a one-time, research-CRF
// style document better suited to a later, more deliberate pass; see the
// design doc's RESEARCH-ONLY / DEFERRED classification).
//
// Fields captured with high confidence from corpus-wide structural
// frequency (see field_dictionary aggregate; no per-patient values were
// used to build this definition):
//   - VAS postoperative pain (0-10) — corpus-universal field with an
//     explicit "…/10" range marker.
//   - A continence/incontinence total score in the 0-20 range, evidenced by
//     a corpus-universal "Đánh giá tổng điểm (0-20 điểm)" field alongside a
//     corpus-universal 5-point frequency response scale (Never/Rarely/
//     Sometimes/Weekly/Daily). This range and item-response-scale shape
//     matches the published Wexner (Jorge–Wexner) Continence Grading Scale,
//     a standard clinical instrument, not a source-specific invention — the
//     item wording below is the standard published instrument, applied to
//     this workflow; the source's own item labels were not extractable at
//     sufficient corpus-wide confidence to quote verbatim.
//
// Explicitly excluded from this v1 template (see design doc for full
// classification): admission/administrative fields (already covered by
// Patient/Encounter), intraoperative surgical-difficulty scoring (a
// research-specific instrument with no routine-clinical-care use), and the
// postoperative outcome criteria grid (insufficient corpus-wide structural
// confidence in this pass — deferred).
export const hemorrhoidLongoFollowupV1: ClinicalFormTemplate = {
  templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
  version: 1,
  displayName: 'Khám lại sau phẫu thuật Longo (trĩ)',
  sections: [
    {
      key: 'visit_context',
      label: 'Thông tin lần khám lại',
      fields: [
        {
          type: 'number',
          key: 'visitNumber',
          label: 'Lần khám lại thứ',
          required: true,
          min: 1,
          max: 20,
        },
        {
          type: 'number',
          key: 'monthsPostOp',
          label: 'Số tháng sau phẫu thuật',
          required: true,
          min: 0,
          max: 120,
        },
      ],
    },
    {
      key: 'pain',
      label: 'Đánh giá đau',
      fields: [
        {
          type: 'number',
          key: 'vasPain',
          label: 'Đau (thang điểm VAS)',
          required: true,
          min: 0,
          max: 10,
          unit: '/10',
        },
      ],
    },
    {
      key: 'continence',
      label: 'Đánh giá khả năng tự chủ hậu môn (thang điểm Wexner)',
      fields: WEXNER_ITEM_KEYS.map((key, index) => ({
        type: 'single_choice',
        key,
        label: WEXNER_ITEM_LABELS[index],
        required: true,
        options: WEXNER_FREQUENCY_OPTIONS,
      })),
    },
    {
      key: 'notes',
      label: 'Ghi nhận thêm',
      fields: [
        {
          type: 'textarea',
          key: 'additionalNotes',
          label: 'Ghi nhận thêm ý kiến/than phiền từ bệnh nhân',
          required: false,
          maxLength: 2000,
        },
      ],
    },
  ],
  scoreInstruments: [
    {
      key: 'wexner',
      label: 'Tổng điểm Wexner',
      itemFieldKeys: WEXNER_ITEM_KEYS,
      minTotal: 0,
      maxTotal: 20,
    },
  ],
};
