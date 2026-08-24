import { api } from './client';
import type {
  CareEpisode,
  CarePlan,
  CareTask,
  ClinicalFormResponses,
  ClinicalFormSubmission,
  ClinicalFormTemplateDef,
  CreatePatientResult,
  Encounter,
  Patient,
  PatientTimeline,
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
    occurredAt: string;
    reasonForVisit: string;
    clinicalNote: string;
    assessment: string;
  }) => api.post<Encounter>('/encounters', dto),
  getById: (id: string) => api.get<Encounter>(`/encounters/${id}`),
};

export const carePlansApi = {
  create: (dto: { encounterId: string; instructions: string; followUpDate?: string }) =>
    api.post<CarePlan>('/care-plans', dto),
  getById: (id: string) => api.get<CarePlan>(`/care-plans/${id}`),
  updateDraft: (id: string, dto: { instructions?: string; followUpDate?: string }) =>
    api.patch<CarePlan>(`/care-plans/${id}/draft`, dto),
  sign: (id: string) => api.post<CarePlan>(`/care-plans/${id}/sign`),
  amend: (id: string, dto: { instructions: string; followUpDate?: string; reason: string }) =>
    api.post<CarePlan>(`/care-plans/${id}/amend`, dto),
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
