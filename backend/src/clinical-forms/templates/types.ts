// Clinical Form template definitions are code-configuration, not database
// rows — see schema.prisma header comment and
// design/REAL_WORLD_FORM_ALIGNMENT.md. A template is identified by
// (templateKey, version); each ClinicalFormSubmission stores the exact
// version it was captured under, so historical submissions stay
// interpretable even after a new version is added here.
//
// CORE-04 T3 (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md) widens this to a
// reusable framework capable of representing the six Longo form families
// (T4-T9) without implementing any of them here. `boolean` and
// `multi_select` are new field types; `min`/`max`/`maxLength` become
// optional so a field is not forced to declare a medical range/length it
// has no locked definition for (see docs/08_LONGO_CLINICAL_WORKFLOW_v1.0.md
// — "không tự đặt medical ranges").

export type FieldType =
  'number' | 'text' | 'textarea' | 'single_choice' | 'boolean' | 'multi_select';

export interface NumberFieldDef {
  type: 'number';
  key: string;
  label: string;
  required: boolean;
  /** Optional — only validated when the template declares it. */
  min?: number;
  /** Optional — only validated when the template declares it. */
  max?: number;
  unit?: string;
}

export interface TextFieldDef {
  type: 'text' | 'textarea';
  key: string;
  label: string;
  required: boolean;
  /** Optional — only validated when the template declares it. */
  maxLength?: number;
}

export interface ChoiceOption {
  value: number | string;
  label: string;
}

export interface SingleChoiceFieldDef {
  type: 'single_choice';
  key: string;
  label: string;
  required: boolean;
  options: ChoiceOption[];
}

export interface BooleanFieldDef {
  type: 'boolean';
  key: string;
  label: string;
  required: boolean;
}

export interface MultiSelectFieldDef {
  type: 'multi_select';
  key: string;
  label: string;
  required: boolean;
  options: ChoiceOption[];
}

export type FieldDef =
  | NumberFieldDef
  | TextFieldDef
  | SingleChoiceFieldDef
  | BooleanFieldDef
  | MultiSelectFieldDef;

export interface SectionDef {
  key: string;
  label: string;
  fields: FieldDef[];
}

export interface ScoreInstrumentDef {
  key: string;
  label: string;
  /** Field keys (within this template) summed to produce the total. Every
   * item field's response must be a number for the total to compute — see
   * computeScores() in validation.ts for the fail-safe-to-null rule. */
  itemFieldKeys: string[];
  minTotal: number;
  maxTotal: number;
}

export interface ClinicalFormTemplate {
  templateKey: string;
  version: number;
  displayName: string;
  sections: SectionDef[];
  scoreInstruments: ScoreInstrumentDef[];
}

export type ClinicalFormResponseValue =
  number | string | boolean | (number | string)[];

export type ClinicalFormResponses = Record<string, ClinicalFormResponseValue>;
