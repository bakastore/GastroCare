// Clinical Form template definitions are code-configuration, not database
// rows — see schema.prisma header comment and
// design/REAL_WORLD_FORM_ALIGNMENT.md. A template is identified by
// (templateKey, version); each ClinicalFormSubmission stores the exact
// version it was captured under, so historical submissions stay
// interpretable even after a new version is added here.

export type FieldType = 'number' | 'text' | 'textarea' | 'single_choice';

export interface NumberFieldDef {
  type: 'number';
  key: string;
  label: string;
  required: boolean;
  min: number;
  max: number;
  unit?: string;
}

export interface TextFieldDef {
  type: 'text' | 'textarea';
  key: string;
  label: string;
  required: boolean;
  maxLength: number;
}

export interface SingleChoiceFieldDef {
  type: 'single_choice';
  key: string;
  label: string;
  required: boolean;
  options: { value: number; label: string }[];
}

export type FieldDef = NumberFieldDef | TextFieldDef | SingleChoiceFieldDef;

export interface SectionDef {
  key: string;
  label: string;
  fields: FieldDef[];
}

export interface ScoreInstrumentDef {
  key: string;
  label: string;
  /** Field keys (within this template) summed to produce the total. */
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

export type ClinicalFormResponses = Record<string, number | string>;
