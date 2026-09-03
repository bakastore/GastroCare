import { ClinicalFormTemplate } from './types';
import {
  GOLIGHER_OPTIONS,
  CLOCK_FACE_OPTIONS,
} from './shared/anorectal-exam.section';

// HEMORRHOID_EXAMINATION v2 — DEC-020 Package B (Clinical Form Fidelity +
// Functional Clinical UX), T1 field map. Source clinical-form evidence:
// `BỆNH ÁN NGOẠI KHOA_TRI_Temp-form_v2_31.08.2026.docx` (specialized
// hemorrhoid surgical examination form) +
// `BỘ CÂU HỎI TRAO ĐỔI VỚI BS THÁI_30.08.2026.docx`.
//
// Design rules held from v1 and the Package B Contract:
//
//  - Template definitions stay code-configuration, never DB rows (see
//    templates/types.ts). Adding v2 here is NOT a Prisma migration and does
//    not touch backend/prisma/schema.prisma.
//
//  - EVERY clinical field is `required: false` (Contract §7 / DEC-020:
//    Hemorrhoid Examination clinical fields are OPTIONAL by default). There
//    is no template-specific completion gate — a fully blank v2 examination
//    must still go DRAFT -> COMPLETED, and nothing here blocks Diagnosis.
//    No `validate*` hook is registered for this template in validation.ts.
//
//  - v2 is a strict SUPERSET of the v1 field keys that mean the same thing
//    (history flags, vitals, whole-examination Goligher grade, aggregate
//    INTERNAL/EXTERNAL/MIXED morphology, patient-vs-doctor prolapse/bleeding
//    split, other anorectal findings). Keeping those keys byte-identical
//    keeps deterministic vital copy-forward (getVitalsCopyForward reads any
//    COMPLETED HEMORRHOID_EXAMINATION regardless of version) and cross-
//    version readability working. v1 submissions keep templateVersion = 1
//    and continue to validate/amend against v1.
//
//  - Administrative fields on the paper form (name / DOB / sex / phone /
//    occupation / ethnicity / nationality / address / insurance / identity
//    document / relative contact / arrival time / doctor identity) are NOT
//    duplicated here — they are already owned by Patient / Encounter /
//    Facility / Staff (Contract §6.1).
//
//  - No invented clinical scale / VAS / ICD / automatic abnormal
//    classification / structured hypertension diagnosis from BP / automatic
//    diagnosis from Goligher. `scoreInstruments: []` — no derived score.
//
//  - BMI: the paper form has a BMI blank, but there is no existing OWNER-
//    approved BMI derivation/display behaviour in this codebase, so per
//    Contract §6.2 ("BMI display/derivation only if existing approved
//    behavior supports it") NO BMI field is added and none is derived.
//
//  - Investigation context (CBC / flexible rectoscopy / other) from the
//    source form is captured here ONLY as a lightweight "noted on the form"
//    context flag/free-text — never as duplicate Investigation result truth
//    (Contract §6.2 / T7). Authoritative ordering/result/review stays in the
//    Investigation module.
//
//  - Respiratory rate / SpO2 are captured here as Examination responses
//    (same mechanism as the other vitals) because the Encounter model has
//    no structured vitals columns at all — there is no authoritative
//    Encounter-level vitals store to duplicate (Contract §8 / T3). They are
//    added to the deterministic vital copy-forward key set in
//    clinical-forms.service.ts.
//
// Section keys follow the Contract §9 (T4) grouping 1..8. Diagnosis (9),
// treatment plan (10), conclusion/instructions (11) and doctor
// confirmation (12) are deliberately NOT Examination fields — they remain
// their own templates / workflow steps (HEMORRHOID_DIAGNOSIS,
// HEMORRHOID_TREATMENT_DECISION, CarePlan), per DEC-020 T5/T6.

const YES_NO_ABNORMAL_OPTIONS = [
  { value: 'NORMAL', label: 'Bình thường' },
  { value: 'ABNORMAL', label: 'Bất thường' },
];

export const hemorrhoidExaminationV2: ClinicalFormTemplate = {
  templateKey: 'HEMORRHOID_EXAMINATION',
  version: 2,
  displayName: 'Khám trĩ',
  sections: [
    // 1. Lý do khám / triệu chứng
    {
      key: 'reasonAndSymptoms',
      label: 'Lý do khám / triệu chứng',
      fields: [
        {
          type: 'textarea',
          key: 'reasonForVisitDetail',
          label: 'Lý do vào khám / vấn đề sức khỏe',
          required: false,
        },
        {
          type: 'number',
          key: 'diseaseDay',
          label: 'Ngày thứ mấy của bệnh',
          required: false,
          unit: 'ngày',
        },
        {
          type: 'boolean',
          key: 'diseaseDayUnknown',
          label: 'Không rõ ngày khởi phát',
          required: false,
        },
        {
          type: 'textarea',
          key: 'diseaseCourse',
          label: 'Quá trình bệnh lý và diễn biến lâm sàng',
          required: false,
        },
        {
          type: 'boolean',
          key: 'symptomAnalPain',
          label: 'Đau hậu môn',
          required: false,
        },
        {
          type: 'boolean',
          key: 'symptomAnalBleeding',
          label: 'Chảy máu hậu môn',
          required: false,
        },
        {
          type: 'boolean',
          key: 'symptomProlapseLump',
          label: 'Khối sa vùng hậu môn',
          required: false,
        },
        {
          type: 'textarea',
          key: 'symptomOther',
          label: 'Triệu chứng cơ năng khác',
          required: false,
        },
      ],
    },
    // 2. Tiền sử / dị ứng
    {
      key: 'historyAndAllergy',
      label: 'Tiền sử / dị ứng',
      fields: [
        {
          type: 'boolean',
          key: 'allergyDrug',
          label: 'Dị ứng thuốc',
          required: false,
        },
        {
          type: 'text',
          key: 'allergyDrugManifestation',
          label: 'Dị ứng thuốc — biểu hiện',
          required: false,
        },
        {
          type: 'boolean',
          key: 'allergyChemicalCosmetic',
          label: 'Dị ứng hóa chất / mỹ phẩm',
          required: false,
        },
        {
          type: 'text',
          key: 'allergyChemicalCosmeticManifestation',
          label: 'Dị ứng hóa chất / mỹ phẩm — biểu hiện',
          required: false,
        },
        {
          type: 'boolean',
          key: 'allergyFood',
          label: 'Dị ứng thực phẩm',
          required: false,
        },
        {
          type: 'text',
          key: 'allergyFoodManifestation',
          label: 'Dị ứng thực phẩm — biểu hiện',
          required: false,
        },
        // v1 history flags — kept byte-identical.
        {
          type: 'boolean',
          key: 'historyConstipation',
          label: 'Tiền sử táo bón',
          required: false,
        },
        {
          type: 'text',
          key: 'historyConstipationNote',
          label: 'Tiền sử táo bón — biểu hiện',
          required: false,
        },
        {
          type: 'boolean',
          key: 'historyPriorAnorectalSurgery',
          label: 'Tiền sử phẫu thuật hậu môn - trực tràng',
          required: false,
        },
        {
          type: 'text',
          key: 'historyPriorAnorectalSurgeryNote',
          label: 'Tiền sử phẫu thuật hậu môn - trực tràng — biểu hiện',
          required: false,
        },
        {
          type: 'boolean',
          key: 'historyRespiratoryDisease',
          label: 'Tiền sử bệnh hô hấp',
          required: false,
        },
        {
          type: 'text',
          key: 'historyRespiratoryDiseaseNote',
          label: 'Tiền sử bệnh hô hấp — biểu hiện',
          required: false,
        },
        {
          type: 'boolean',
          key: 'historyDiabetes',
          label: 'Tiền sử đái tháo đường',
          required: false,
        },
        {
          type: 'text',
          key: 'historyDiabetesNote',
          label: 'Tiền sử đái tháo đường — biểu hiện',
          required: false,
        },
        {
          type: 'boolean',
          key: 'historyCirrhosis',
          label: 'Tiền sử xơ gan',
          required: false,
        },
        {
          type: 'text',
          key: 'historyCirrhosisNote',
          label: 'Tiền sử xơ gan — biểu hiện',
          required: false,
        },
        {
          type: 'textarea',
          key: 'historyOtherPregnancyDietBowelHabit',
          label: 'Tiền sử khác (thai kỳ / chế độ ăn / thói quen đại tiện)',
          required: false,
        },
      ],
    },
    // 3. Toàn thân / sinh hiệu
    {
      key: 'generalExamAndVitals',
      label: 'Toàn thân / sinh hiệu',
      fields: [
        { type: 'number', key: 'pulse', label: 'Mạch', required: false, unit: 'lần/phút' },
        {
          type: 'number',
          key: 'temperature',
          label: 'Nhiệt độ',
          required: false,
          unit: '°C',
        },
        {
          type: 'number',
          key: 'systolicBloodPressure',
          label: 'Huyết áp tâm thu',
          required: false,
          unit: 'mmHg',
        },
        {
          type: 'number',
          key: 'diastolicBloodPressure',
          label: 'Huyết áp tâm trương',
          required: false,
          unit: 'mmHg',
        },
        {
          type: 'number',
          key: 'respiratoryRate',
          label: 'Nhịp thở',
          required: false,
          unit: 'lần/phút',
        },
        { type: 'number', key: 'weight', label: 'Cân nặng', required: false, unit: 'kg' },
        { type: 'number', key: 'height', label: 'Chiều cao', required: false, unit: 'cm' },
        { type: 'number', key: 'spo2', label: 'SpO2', required: false, unit: '%' },
        {
          type: 'boolean',
          key: 'anemiaStatus',
          label: 'Có tình trạng thiếu máu',
          required: false,
        },
        {
          type: 'textarea',
          key: 'otherGeneralFinding',
          label: 'Ghi nhận toàn thân khác',
          required: false,
        },
      ],
    },
    // 4. Thăm trực tràng
    {
      key: 'digitalRectalExam',
      label: 'Thăm trực tràng',
      fields: [
        {
          type: 'single_choice',
          key: 'stoolStatus',
          label: 'Phân',
          required: false,
          options: YES_NO_ABNORMAL_OPTIONS,
        },
        {
          type: 'text',
          key: 'stoolCharacteristics',
          label: 'Phân — tính chất bất thường',
          required: false,
        },
        {
          type: 'boolean',
          key: 'palpableTumor',
          label: 'Sờ thấy u',
          required: false,
        },
        {
          type: 'number',
          key: 'palpableTumorDistanceCm',
          label: 'Khối u cách rìa hậu môn',
          required: false,
          unit: 'cm',
        },
        {
          type: 'boolean',
          key: 'douglasPouchAbnormal',
          label: 'Túi cùng Douglas (có bất thường / căng đau)',
          required: false,
        },
        {
          type: 'single_choice',
          key: 'analSphincterExam',
          label: 'Cơ thắt hậu môn (thăm khám)',
          required: false,
          options: YES_NO_ABNORMAL_OPTIONS,
        },
        {
          type: 'textarea',
          key: 'digitalRectalOther',
          label: 'Thăm trực tràng — ghi nhận khác',
          required: false,
        },
      ],
    },
    // 5. Đặc điểm búi trĩ — aggregate by type only (v1 keys preserved).
    {
      key: 'hemorrhoidMorphology',
      label: 'Đặc điểm búi trĩ',
      fields: [
        {
          type: 'single_choice',
          key: 'hemorrhoidGoligherGrade',
          label: 'Phân độ Goligher (một giá trị chung)',
          required: false,
          options: GOLIGHER_OPTIONS,
        },
        {
          type: 'number',
          key: 'internalHemorrhoidCount',
          label: 'Số lượng búi trĩ nội',
          required: false,
        },
        {
          type: 'multi_select',
          key: 'internalHemorrhoidLocation',
          label: 'Vị trí búi trĩ nội (theo mặt đồng hồ)',
          required: false,
          options: CLOCK_FACE_OPTIONS,
        },
        {
          type: 'text',
          key: 'internalHemorrhoidSize',
          label: 'Kích thước búi trĩ nội',
          required: false,
        },
        {
          type: 'number',
          key: 'externalHemorrhoidCount',
          label: 'Số lượng búi trĩ ngoại',
          required: false,
        },
        {
          type: 'multi_select',
          key: 'externalHemorrhoidLocation',
          label: 'Vị trí búi trĩ ngoại (theo mặt đồng hồ)',
          required: false,
          options: CLOCK_FACE_OPTIONS,
        },
        {
          type: 'text',
          key: 'externalHemorrhoidSize',
          label: 'Kích thước búi trĩ ngoại',
          required: false,
        },
        {
          type: 'number',
          key: 'mixedHemorrhoidCount',
          label: 'Số lượng búi trĩ hỗn hợp',
          required: false,
        },
        {
          type: 'multi_select',
          key: 'mixedHemorrhoidLocation',
          label: 'Vị trí búi trĩ hỗn hợp (theo mặt đồng hồ)',
          required: false,
          options: CLOCK_FACE_OPTIONS,
        },
        {
          type: 'text',
          key: 'mixedHemorrhoidSize',
          label: 'Kích thước búi trĩ hỗn hợp',
          required: false,
        },
        {
          type: 'textarea',
          key: 'otherMorphologyFinding',
          label: 'Đặc điểm búi trĩ — ghi nhận khác',
          required: false,
        },
      ],
    },
    // 6. Sa / chảy máu — patient-reported vs doctor-observed kept distinct
    //    (v1 keys preserved).
    {
      key: 'prolapseAndBleeding',
      label: 'Sa / chảy máu',
      fields: [
        {
          type: 'boolean',
          key: 'prolapseSymptom',
          label: 'Sa búi trĩ (bệnh nhân khai)',
          required: false,
        },
        {
          type: 'boolean',
          key: 'prolapseObserved',
          label: 'Sa búi trĩ (bác sĩ ghi nhận khi khám)',
          required: false,
        },
        {
          type: 'boolean',
          key: 'hemorrhoidFibrosis',
          label: 'Xơ hóa búi trĩ',
          required: false,
        },
        {
          type: 'boolean',
          key: 'bleedingSymptom',
          label: 'Chảy máu (bệnh nhân khai)',
          required: false,
        },
        {
          type: 'boolean',
          key: 'bleedingObserved',
          label: 'Chảy máu (bác sĩ ghi nhận khi khám)',
          required: false,
        },
      ],
    },
    // 7. Ghi nhận hậu môn-trực tràng khác (v1 keys preserved + free-text
    //    catch-all for thrombosis / inflammation / ulcer / incarceration /
    //    fissure / polyp / fistula / abscess / rectal mucosal prolapse).
    {
      key: 'otherAnorectalFindings',
      label: 'Ghi nhận hậu môn-trực tràng khác',
      fields: [
        {
          type: 'text',
          key: 'sphincterTone',
          label: 'Trương lực cơ thắt hậu môn',
          required: false,
        },
        {
          type: 'textarea',
          key: 'rectalMucosaFinding',
          label: 'Tình trạng niêm mạc trực tràng',
          required: false,
        },
        {
          type: 'textarea',
          key: 'associatedAnorectalLesion',
          label: 'Tổn thương hậu môn - trực tràng phối hợp',
          required: false,
        },
        {
          type: 'textarea',
          key: 'skinTagFinding',
          label: 'Ghi nhận da thừa (mấu da)',
          required: false,
        },
        {
          type: 'textarea',
          key: 'otherAnorectalFinding',
          label: 'Ghi nhận hậu môn - trực tràng khác (mô tả tự do)',
          required: false,
        },
      ],
    },
    // 8. Cận lâm sàng liên quan — context flags only, NOT result truth.
    {
      key: 'relatedInvestigations',
      label: 'Cận lâm sàng liên quan',
      fields: [
        {
          type: 'boolean',
          key: 'cbcNotedOnForm',
          label: 'Tổng phân tích tế bào máu ngoại vi (ghi nhận trên phiếu)',
          required: false,
        },
        {
          type: 'boolean',
          key: 'flexibleRectoscopyNotedOnForm',
          label: 'Nội soi trực tràng ống mềm (ghi nhận trên phiếu)',
          required: false,
        },
        {
          type: 'textarea',
          key: 'relatedInvestigationNote',
          label: 'Cận lâm sàng liên quan — ghi chú (không thay kết quả trong mục Cận lâm sàng)',
          required: false,
        },
      ],
    },
  ],
  scoreInstruments: [],
};
