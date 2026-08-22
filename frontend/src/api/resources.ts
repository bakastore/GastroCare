import { api } from './client';
import type {
  CarePlan,
  CareTask,
  ClinicalFormSubmission,
  CreatePatientResult,
  Encounter,
  Patient,
  TimelineEvent,
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
  getTimeline: (id: string) => api.get<TimelineEvent[]>(`/patients/${id}/timeline`),
};

export const encountersApi = {
  create: (dto: {
    patientId: string;
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
    responses: Record<string, number | string>;
  }) => api.post<ClinicalFormSubmission>('/clinical-forms', dto),
  getById: (id: string) => api.get<ClinicalFormSubmission>(`/clinical-forms/${id}`),
  listByPatient: (patientId: string) =>
    api.get<ClinicalFormSubmission[]>(`/clinical-forms?patientId=${patientId}`),
  updateDraft: (id: string, dto: { responses: Record<string, number | string> }) =>
    api.patch<ClinicalFormSubmission>(`/clinical-forms/${id}/draft`, dto),
  complete: (id: string) =>
    api.post<ClinicalFormSubmission>(`/clinical-forms/${id}/complete`),
};
