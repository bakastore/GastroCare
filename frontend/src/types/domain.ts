export type AuthRole = 'DOCTOR' | 'RECEPTIONIST' | 'NURSE';

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

/**
 * DEC-015 — persisted, explicit Encounter workflow discriminator. v1 value:
 * 'HEMORRHOID_INITIAL' (the initial Hemorrhoid Encounter). Generic ungrouped
 * Encounters, Longo Encounters and Hemorrhoid Return Encounters are all
 * `null` (the latter two derive identity from CareEpisode.episodeType).
 * Never inferred from text / form existence / URL / frontend state.
 */
export type EncounterWorkflowKind = 'HEMORRHOID_INITIAL';

export interface Encounter {
  id: string;
  patientId: string;
  episodeId: string | null;
  workflowKind: EncounterWorkflowKind | null;
  treatmentPathwayId?: string | null;
  /**
   * The clinician clinically responsible for this Encounter — DEC-010 §A.
   * Distinct from provenance (who created the row); may change over time
   * via handover.
   */
  responsibleClinicianId: string;
  /** Physical room this Encounter takes place in — DEC-010 §C. Nullable. */
  roomId: string | null;
  occurredAt: string;
  reasonForVisit: string;
  clinicalNote: string;
  assessment: string;
  createdAt: string;
}

/** Facility — physical care location, tenant-scoped (DEC-010 §C). */
export interface Facility {
  id: string;
  name: string;
  createdAt: string;
}

/** Room — physical location within a Facility (DEC-010 §C). */
export interface Room {
  id: string;
  facilityId: string;
  name: string;
  createdAt: string;
}

/** Selectable DOCTOR-role clinician (DEC-010 §B) — id/email only. */
export interface Clinician {
  id: string;
  email: string;
}

/** One entry in an Encounter's responsible-clinician provenance trail. */
export interface ClinicianAssignmentHistoryEntry {
  id: string;
  encounterId: string;
  clinicianId: string;
  previousClinicianId: string | null;
  assignedByUserId: string;
  reason: string | null;
  assignedAt: string;
}

/** Vital-sign copy-forward result for a new HEMORRHOID_EXAMINATION (DEC-010 §6). */
export interface VitalsCopyForwardResult {
  sourceSubmissionId: string;
  sourceEncounterId: string;
  sourceOccurredAt: string;
  vitals: Partial<
    Record<
      | 'weight'
      | 'height'
      | 'pulse'
      | 'temperature'
      | 'systolicBloodPressure'
      | 'diastolicBloodPressure',
      number
    >
  >;
}

export type CarePlanStatus = 'DRAFT' | 'SIGNED';

export interface CarePlan {
  id: string;
  encounterId: string;
  patientId: string;
  status: CarePlanStatus;
  instructions: string;
  followUpDate: string | null;
  currentVersionId: string | null;
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
  /**
   * DEC-016 F2 — additive, read-only linkage resolved from the task's source
   * Encounter (CareTask -> sourceEncounter -> episodeId / treatmentPathwayId).
   * Present on the GET /care-tasks list projection. A Longo timepoint task
   * (timepointCode != null) is owned by a TreatmentPathway; the frontend uses
   * this authoritative linkage to route into the correct Longo clinical
   * follow-up flow instead of offering generic manual completion.
   */
  sourceEpisodeId?: string | null;
  treatmentPathwayId?: string | null;
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
  'ENCOUNTER' | 'CARE_PLAN_SIGNED' | 'CARE_TASK' | 'CLINICAL_FORM_SUBMITTED' | 'FOLLOW_UP_TASK';

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
  return [...timeline.episodes.flatMap((group) => group.events), ...timeline.ungroupedEncounters];
}

// Mirrors backend/src/clinical-forms/templates/types.ts — the frontend
// generic form renderer consumes this shape from
// GET /clinical-forms/templates/:templateKey rather than hand-duplicating
// field definitions (which live only in backend code, per T3: no generic
// DB form builder).
export type ClinicalFieldType =
  'number' | 'text' | 'textarea' | 'single_choice' | 'boolean' | 'multi_select';

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

export type ClinicalFormResponseValue = number | string | boolean | (number | string)[];
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

export interface TreatmentPathway {
  id: string;
  caseId: string;
  patientId: string;
  modality: 'MEDICAL' | 'PROCEDURE' | 'SURGERY';
  methodCode: string | null;
  startedAt: string;
  legacyEpisodeId: string | null;
}
export interface InvestigationOrder {
  id: string;
  requestText: string;
  assignedToUserId: string | null;
  requestedAt: string;
}
export interface InvestigationResult {
  id: string;
  rawText: string;
  observedAt: string;
  orderId: string | null;
}
export interface Investigation {
  id: string;
  caseId: string;
  patientId: string;
  label: string;
  origin: 'INTERNAL_CURRENT' | 'ECOSYSTEM_PRIOR' | 'EXTERNAL_PRIOR';
  parentInvestigationId: string | null;
  orders: InvestigationOrder[];
  results: InvestigationResult[];
  patient: { id: string; fullName: string; dateOfBirth: string };
  careCase: { id: string; status: string; episodeType: string };
}
