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

export interface CareTask {
  id: string;
  patientId: string;
  carePlanId: string;
  status: CareTaskStatus;
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  overdue: boolean;
}

export type TimelineEventType =
  | 'ENCOUNTER'
  | 'CARE_PLAN_SIGNED'
  | 'CARE_TASK'
  | 'CLINICAL_FORM_SUBMITTED';

export interface TimelineEvent {
  type: TimelineEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export type ClinicalFormStatus = 'DRAFT' | 'COMPLETED';

export interface ClinicalFormSubmission {
  id: string;
  patientId: string;
  encounterId: string;
  templateKey: string;
  templateVersion: number;
  status: ClinicalFormStatus;
  responses: Record<string, number | string>;
  computedScores: Record<string, number | null> | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
