export type AuthRole = 'DOCTOR' | 'RECEPTIONIST';

export type PatientGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface Patient {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: PatientGender;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientResult {
  patient: Patient;
  possibleDuplicates: Patient[];
}

export interface Encounter {
  id: string;
  patientId: string;
  episodeId: string | null;
  occurredAt: string;
  reasonForVisit: string;
  clinicalNote: string;
  assessment: string;
  createdAt: string;
}

export type CarePlanStatus = 'DRAFT' | 'SIGNED';

export interface CarePlan {
  id: string;
  encounterId: string;
  patientId: string;
  status: CarePlanStatus;
  instructions: string;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CareTaskStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';

export type FollowUpTimepoint = 'TWO_WEEK' | 'MONTH_1' | 'MONTH_3' | 'MONTH_6';

export interface CareTask {
  id: string;
  patientId: string;
  carePlanId: string | null;
  status: CareTaskStatus;
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  overdue: boolean;
  sourceEncounterId: string | null;
  timepointCode: FollowUpTimepoint | null;
  completedByEncounterId: string | null;
  scheduleReviewRequired: boolean;
}

export type CareEpisodeStatus = 'ACTIVE' | 'CLOSED';

export interface CareEpisode {
  id: string;
  patientId: string;
  episodeType: string;
  status: CareEpisodeStatus;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

export type TimelineEventType =
  | 'ENCOUNTER'
  | 'CARE_PLAN_SIGNED'
  | 'CARE_TASK'
  | 'CLINICAL_FORM_SUBMITTED'
  | 'FOLLOW_UP_TASK';

export interface TimelineEvent {
  type: TimelineEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface TimelineEpisodeGroup {
  episode: CareEpisode;
  events: TimelineEvent[];
}

/**
 * CORE-04 T11 — the Timeline read projection groups events by CareEpisode
 * and separates Encounters (and everything hung off them) that do not
 * belong to any Episode into `ungroupedEncounters` — see
 * docs/09_CORE04_IMPLEMENTATION_CONTRACT.md T11.
 */
export interface PatientTimeline {
  episodes: TimelineEpisodeGroup[];
  ungroupedEncounters: TimelineEvent[];
}

export function flattenTimeline(timeline: PatientTimeline): TimelineEvent[] {
  return [
    ...timeline.episodes.flatMap((group) => group.events),
    ...timeline.ungroupedEncounters,
  ];
}

// Mirrors backend/src/clinical-forms/templates/types.ts — the frontend
// generic form renderer consumes this shape from
// GET /clinical-forms/templates/:templateKey rather than hand-duplicating
// field definitions (which live only in backend code, per T3: no generic
// DB form builder).
export type ClinicalFieldType =
  | 'number'
  | 'text'
  | 'textarea'
  | 'single_choice'
  | 'boolean'
  | 'multi_select';

export interface ClinicalFieldOption {
  value: number | string;
  label: string;
}

export interface ClinicalFieldDef {
  type: ClinicalFieldType;
  key: string;
  label: string;
  required: boolean;
  min?: number;
  max?: number;
  unit?: string;
  maxLength?: number;
  options?: ClinicalFieldOption[];
}

export interface ClinicalSectionDef {
  key: string;
  label: string;
  fields: ClinicalFieldDef[];
}

export interface ClinicalScoreInstrumentDef {
  key: string;
  label: string;
  itemFieldKeys: string[];
  minTotal: number;
  maxTotal: number;
}

export interface ClinicalFormTemplateDef {
  templateKey: string;
  version: number;
  displayName: string;
  sections: ClinicalSectionDef[];
  scoreInstruments: ClinicalScoreInstrumentDef[];
}

export type ClinicalFormStatus = 'DRAFT' | 'COMPLETED';

export type ClinicalFormResponseValue =
  | number
  | string
  | boolean
  | (number | string)[];
export type ClinicalFormResponses = Record<string, ClinicalFormResponseValue>;

export interface ClinicalFormSubmission {
  id: string;
  patientId: string;
  encounterId: string;
  templateKey: string;
  templateVersion: number;
  status: ClinicalFormStatus;
  responses: ClinicalFormResponses;
  computedScores: Record<string, number | null> | null;
  logicalGroupId: string;
  revisionNumber: number;
  previousSubmissionId: string | null;
  amendmentReason: string | null;
  amendedByUserId: string | null;
  completedByUserId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
