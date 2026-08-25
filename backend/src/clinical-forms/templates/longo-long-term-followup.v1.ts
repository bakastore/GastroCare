import { ClinicalFormTemplate } from './types';
import { createPainVasField } from './shared/vas-pain.section';
import {
  createWexnerSection,
  createWexnerScoreInstrument,
} from './shared/wexner.section';
import { createSatisfactionSection } from './shared/satisfaction.section';

// LONGO_LONG_TERM_FOLLOWUP v1 — CORE-04 T9
// (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md v0.3.1, T9 field contract).
//
// ONE template reused for MONTH_1, MONTH_3 and MONTH_6 — never three
// separate templates (docs/08 §11.10, §7 "16 quyết định" #7).
// `plannedTimepoint` is the workflow-identity field: required = true, used
// by T10 to deterministically match a completed submission at this
// Encounter to the correct scheduled CareTask timepoint. This required-ness
// is intentionally scoped to this one workflow-identity field only — it is
// not extended to any other clinical field on this template.
//
// Wexner (5 items, 0-4 each, deterministic total 0-20) is part of this
// template unconditionally — since this template is ONLY ever used at
// MONTH_1/MONTH_3/MONTH_6, embedding it here satisfies "Wexner prospective
// routine bắt đầu từ MONTH_1 và áp dụng tại MONTH_1/MONTH_3/MONTH_6"
// without a separate per-timepoint template. LONGO_TWO_WEEK_FOLLOWUP (T7)
// is a structurally different template that never imports this section —
// that is how "no Wexner at two weeks" is enforced.
//
// Other locked fields: recurrence + location, stenosis, dilation/post-
// dilation outcome (this is the outcome as recalled/observed at this
// long-term visit — a separate real dilation event is still its own T8
// Encounter/submission), VAS 0-10, skin tags, management (free text),
// defecation status (free text), tenesmus, anal discharge, satisfaction
// (reused from T3 shared section) and comments.
export const longoLongTermFollowupV1: ClinicalFormTemplate = {
  templateKey: 'LONGO_LONG_TERM_FOLLOWUP',
  version: 1,
  displayName: 'Tái khám dài hạn sau phẫu thuật Longo',
  sections: [
    {
      key: 'workflowIdentity',
      label: 'Mốc tái khám',
      fields: [
        {
          type: 'single_choice',
          key: 'plannedTimepoint',
          label: 'Mốc tái khám dự kiến',
          required: true,
          options: [
            { value: 'MONTH_1', label: 'Tháng 1' },
            { value: 'MONTH_3', label: 'Tháng 3' },
            { value: 'MONTH_6', label: 'Tháng 6' },
          ],
        },
      ],
    },
    {
      key: 'outcome',
      label: 'Đánh giá kết quả dài hạn',
      fields: [
        {
          type: 'boolean',
          key: 'recurrencePresent',
          label: 'Tái phát',
          required: false,
        },
        {
          type: 'textarea',
          key: 'recurrenceLocationNote',
          label: 'Vị trí tái phát',
          required: false,
        },
        {
          type: 'boolean',
          key: 'stenosisPresent',
          label: 'Hẹp hậu môn',
          required: false,
        },
        {
          type: 'boolean',
          key: 'dilationPerformed',
          label: 'Đã nong hậu môn',
          required: false,
        },
        {
          type: 'textarea',
          key: 'dilationOutcomeNote',
          label: 'Kết quả sau nong',
          required: false,
        },
        createPainVasField('longTerm'),
        {
          type: 'boolean',
          key: 'skinTagsPresent',
          label: 'Da thừa (mấu da)',
          required: false,
        },
        {
          type: 'textarea',
          key: 'managementNote',
          label: 'Xử trí',
          required: false,
        },
        {
          type: 'textarea',
          key: 'defecationStatusNote',
          label: 'Tình trạng đại tiện',
          required: false,
        },
        {
          type: 'boolean',
          key: 'tenesmus',
          label: 'Mót rặn',
          required: false,
        },
        {
          type: 'boolean',
          key: 'analDischargePresent',
          label: 'Tiết dịch hậu môn',
          required: false,
        },
      ],
    },
    createWexnerSection('longTerm'),
    createSatisfactionSection('longTerm'),
    {
      key: 'other',
      label: 'Ghi nhận khác',
      fields: [
        {
          type: 'textarea',
          key: 'additionalComments',
          label: 'Ghi chú thêm',
          required: false,
        },
      ],
    },
  ],
  scoreInstruments: [createWexnerScoreInstrument('longTerm')],
};
