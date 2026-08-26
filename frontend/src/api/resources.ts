import { api } from './client';
import type {
  CareEpisode,
  CarePlan,
  CareTask,
  Clinician,
  ClinicianAssignmentHistoryEntry,
  ClinicalFormResponses,
  ClinicalFormSubmission,
  ClinicalFormTemplateDef,
  CreatePatientResult,
  Encounter,
  Facility,
  Patient,
  PatientTimeline,
  Room,
  VitalsCopyForwardResult,
} from '../types/domain';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ accessToken: string }>('/auth/login', { email, password }),
};

export const patientsApi = {
  list: () => api.get<Patient[]>('/patients'),
  getById: (id: string) => api.get<Patient>(`/patients/${id}`),
  create: (dto: {
    fullName: string;
    dateOfBirth: string;
    gender: string;
    phone: string;
  }) => api.post<CreatePatientResult>('/patients', dto),
  checkDuplicates: (dto: { fullName: string; dateOfBirth: string; phone: string }) =>
    api.post<Patient[]>('/patients/duplicate-check', dto),
  getTimeline: (id: string) => api.get<PatientTimeline>(`/patients/${id}/timeline`),
};

export const encountersApi = {
  create: (dto: {
    patientId: string;
    episodeId?: string;
    /** DEC-010 §B — omit to resolve the default pilot clinician server-side. */
    responsibleClinicianId?: string;
    /** DEC-010 §C — physical room, optional. */
    roomId?: string;
    occurredAt: string;
    reasonForVisit: string;
    /** Optional — a Receptionist creating the Encounter Context has no
     * clinical content yet (DEC-010 §B/§D). */
    clinicalNote?: string;
    assessment?: string;
  }) => api.post<Encounter>('/encounters', dto),
  getById: (id: string) => api.get<Encounter>(`/encounters/${id}`),
  /** Clinician handover — DOCTOR-only (DEC-010 §B). */
  handover: (id: string, dto: { newClinicianId: string; reason?: string }) =>
    api.post<Encounter>(`/encounters/${id}/handover`, dto),
  getClinicianHistory: (id: string) =>
    api.get<ClinicianAssignmentHistoryEntry[]>(
      `/encounters/${id}/clinician-history`,
    ),
};

/** Facility lookup/management (DEC-010 §C). */
export const facilitiesApi = {
  list: () => api.get<Facility[]>('/facilities'),
  getById: (id: string) => api.get<Facility>(`/facilities/${id}`),
  create: (name: string) => api.post<Facility>('/facilities', { name }),
};

/** Room lookup/management (DEC-010 §C). */
export const roomsApi = {
  listByFacility: (facilityId: string) =>
    api.get<Room[]>(`/rooms?facilityId=${facilityId}`),
  getById: (id: string) => api.get<Room>(`/rooms/${id}`),
  create: (dto: { facilityId: string; name: string }) =>
    api.post<Room>('/rooms', dto),
};

/** Selectable DOCTOR-role clinician lookup (DEC-010 §B). */
export const cliniciansApi = {
  list: () => api.get<Clinician[]>('/clinicians'),
};

export const carePlansApi = {
  create: (dto: { encounterId: string; instructions: string; followUpDate?: string }) =>
    api.post<CarePlan>('/care-plans', dto),
  getById: (id: string) => api.get<CarePlan>(`/care-plans/${id}`),
  updateDraft: (id: string, dto: { instructions?: string; followUpDate?: string }) =>
    api.patch<CarePlan>(`/care-plans/${id}/draft`, dto),
  sign: (id: string) => api.post<CarePlan>(`/care-plans/${id}/sign`),
  amend: (
    id: string,
    dto: {
      instructions: string;
      followUpDate?: string;
      reason: string;
      expectedCurrentVersionId: string;
      followUpTaskAction?: 'RESCHEDULE' | 'CANCEL' | 'KEEP_WITH_REASON';
      followUpTaskReason?: string;
    },
  ) => api.post<CarePlan>(`/care-plans/${id}/amend`, dto),
};

export const careTasksApi = {
  list: () => api.get<CareTask[]>('/care-tasks'),
  complete: (id: string) => api.post<CareTask>(`/care-tasks/${id}/complete`),
  cancel: (id: string) => api.post<CareTask>(`/care-tasks/${id}/cancel`),
};

export const clinicalFormsApi = {
  create: (dto: {
    encounterId: string;
    templateKey: string;
    responses: ClinicalFormResponses;
  }) => api.post<ClinicalFormSubmission>('/clinical-forms', dto),
  getById: (id: string) => api.get<ClinicalFormSubmission>(`/clinical-forms/${id}`),
  listByPatient: (patientId: string) =>
    api.get<ClinicalFormSubmission[]>(`/clinical-forms?patientId=${patientId}`),
  updateDraft: (id: string, dto: { responses: ClinicalFormResponses }) =>
    api.patch<ClinicalFormSubmission>(`/clinical-forms/${id}/draft`, dto),
  complete: (id: string) =>
    api.post<ClinicalFormSubmission>(`/clinical-forms/${id}/complete`),
  amend: (id: string, dto: { responses: ClinicalFormResponses; amendmentReason: string }) =>
    api.post<ClinicalFormSubmission>(`/clinical-forms/${id}/amend`, dto),
  getHistory: (id: string) =>
    api.get<{ revisions: ClinicalFormSubmission[]; current: ClinicalFormSubmission }>(
      `/clinical-forms/${id}/history`,
    ),
  getTemplate: (templateKey: string) =>
    api.get<ClinicalFormTemplateDef>(`/clinical-forms/templates/${templateKey}`),
  /**
   * Vital-sign copy-forward for a new HEMORRHOID_EXAMINATION (DEC-010 §6).
   * Finding 2 correction — target-aware: pass the target Encounter id, not
   * a patientId. The backend resolves tenant/patient/occurredAt from that
   * Encounter itself and enforces `source.occurredAt < target.occurredAt`;
   * the frontend must never compute/decide this clinical ordering.
   */
  getVitalsCopyForward: (targetEncounterId: string) =>
    api.get<VitalsCopyForwardResult | null>(
      `/clinical-forms/vitals-copy-forward?targetEncounterId=${targetEncounterId}`,
    ),
};

export const careEpisodesApi = {
  create: (dto: { patientId: string; episodeType: string; startedAt: string }) =>
    api.post<CareEpisode>('/care-episodes', dto),
  listByPatient: (patientId: string) =>
    api.get<CareEpisode[]>(`/patients/${patientId}/care-episodes`),
  close: (id: string) => api.post<CareEpisode>(`/care-episodes/${id}/close`),
  reopen: (id: string, dto: { reason: string }) =>
    api.post<CareEpisode>(`/care-episodes/${id}/reopen`, dto),
};

export const followUpTasksApi = {
  listByPatient: (patientId: string) =>
    api.get<CareTask[]>(`/follow-up-tasks?patientId=${patientId}`),
  generate: (sourceEncounterId: string) =>
    api.post<CareTask[]>('/follow-up-tasks/generate', { sourceEncounterId }),
  reschedule: (id: string, dueDate: string) =>
    api.patch<CareTask>(`/follow-up-tasks/${id}/reschedule`, { dueDate }),
};
