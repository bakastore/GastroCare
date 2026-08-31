import { api } from './client';
import type {
  TreatmentPathway,
  Investigation,
  InvestigationOrder,
  InvestigationResult,
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
  EncounterWorkflowKind,
  Facility,
  Patient,
  PatientTimeline,
  Room,
  VitalsCopyForwardResult,
} from '../types/domain';

export interface AuthMe {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string | null;
  role: 'DOCTOR' | 'RECEPTIONIST' | 'NURSE';
  isClinicAdmin: boolean;
  status: 'ACTIVE' | 'DISABLED';
  mustChangePassword: boolean;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.postAuth<{ accessToken: string }>('/auth/login', { email, password }),
  me: () => api.get<AuthMe>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ accessToken: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    }),
};

export interface ClinicAdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'DOCTOR' | 'RECEPTIONIST' | 'NURSE';
  status: 'ACTIVE' | 'DISABLED';
  isClinicAdmin: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicAdminUserAuditEntry {
  id: string;
  seq: number;
  action: string;
  actorId: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export const clinicAdminUsersApi = {
  list: (search?: string) =>
    api.get<ClinicAdminUser[]>(
      `/clinic-admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  getById: (id: string) => api.get<ClinicAdminUser>(`/clinic-admin/users/${id}`),
  create: (dto: {
    email: string;
    role: string;
    displayName?: string;
    isClinicAdmin?: boolean;
  }) =>
    api.post<{ user: ClinicAdminUser; temporaryPassword: string }>(
      '/clinic-admin/users',
      dto,
    ),
  update: (
    id: string,
    dto: { displayName?: string; role?: string; isClinicAdmin?: boolean },
  ) => api.patch<ClinicAdminUser>(`/clinic-admin/users/${id}`, dto),
  disable: (id: string) =>
    api.post<ClinicAdminUser>(`/clinic-admin/users/${id}/disable`),
  reactivate: (id: string) =>
    api.post<ClinicAdminUser>(`/clinic-admin/users/${id}/reactivate`),
  resetPassword: (id: string) =>
    api.post<{ user: ClinicAdminUser; temporaryPassword: string }>(
      `/clinic-admin/users/${id}/reset-password`,
    ),
  getAudit: (id: string) =>
    api.get<ClinicAdminUserAuditEntry[]>(`/clinic-admin/users/${id}/audit`),
};

// ---- DEC-019 — Staff Profile & Credential Management v1 ----

export type StaffSpecialty =
  | 'GASTROENTEROLOGY'
  | 'COLORECTAL_SURGERY'
  | 'GENERAL_SURGERY'
  | 'OTHER';
export type StaffCredentialType = 'LICENSE' | 'CERTIFICATE' | 'TRAINING';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'COLLABORATOR';

export interface StaffProfile {
  id: string;
  authUserId: string;
  fullName: string;
  professionalTitle: string | null;
  workPhone: string | null;
  primarySpecialty: StaffSpecialty | null;
  secondarySpecialties: StaffSpecialty[];
  specialtyOtherLabel: string | null;
  biography: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffCredential {
  id: string;
  staffProfileId: string;
  credentialType: StaffCredentialType;
  name: string;
  credentialNumber: string | null;
  issuingOrganization: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: 'ACTIVE' | 'REVOKED';
  effectiveStatus: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmploymentRecord {
  id: string;
  staffProfileId: string;
  organizationName: string;
  department: string | null;
  positionTitle: string | null;
  startDate: string | null;
  endDate: string | null;
  employmentType: EmploymentType | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FacilityAssignment {
  id: string;
  staffProfileId: string;
  facilityId: string;
  isPrimary: boolean;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffAuditEntry {
  id: string;
  seq: number;
  action: string;
  actorId: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface SelfStaffProfile {
  account: {
    userId: string;
    email: string;
    displayName: string | null;
    role: 'DOCTOR' | 'RECEPTIONIST' | 'NURSE';
    isClinicAdmin: boolean;
    status: 'ACTIVE' | 'DISABLED';
  };
  profile: StaffProfile | null;
  credentials: StaffCredential[];
}

const staffBase = (id: string) => `/clinic-admin/users/${id}`;

export const staffApi = {
  getProfile: (id: string) =>
    api.get<{ userId: string; profile: StaffProfile | null }>(
      `${staffBase(id)}/profile`,
    ),
  putProfile: (
    id: string,
    dto: Partial<{
      fullName: string;
      professionalTitle: string | null;
      workPhone: string | null;
      primarySpecialty: StaffSpecialty | null;
      secondarySpecialties: StaffSpecialty[];
      specialtyOtherLabel: string | null;
      biography: string | null;
    }>,
  ) => api.put<StaffProfile>(`${staffBase(id)}/profile`, dto),

  listCredentials: (id: string) =>
    api.get<StaffCredential[]>(`${staffBase(id)}/credentials`),
  addCredential: (id: string, dto: Record<string, unknown>) =>
    api.post<StaffCredential>(`${staffBase(id)}/credentials`, dto),
  updateCredential: (
    id: string,
    credentialId: string,
    dto: Record<string, unknown>,
  ) =>
    api.patch<StaffCredential>(
      `${staffBase(id)}/credentials/${credentialId}`,
      dto,
    ),
  deleteCredential: (id: string, credentialId: string) =>
    api.delete<{ deleted: boolean }>(
      `${staffBase(id)}/credentials/${credentialId}`,
    ),

  listEmployment: (id: string) =>
    api.get<EmploymentRecord[]>(`${staffBase(id)}/employment-history`),
  addEmployment: (id: string, dto: Record<string, unknown>) =>
    api.post<EmploymentRecord>(`${staffBase(id)}/employment-history`, dto),
  updateEmployment: (id: string, recordId: string, dto: Record<string, unknown>) =>
    api.patch<EmploymentRecord>(
      `${staffBase(id)}/employment-history/${recordId}`,
      dto,
    ),
  deleteEmployment: (id: string, recordId: string) =>
    api.delete<{ deleted: boolean }>(
      `${staffBase(id)}/employment-history/${recordId}`,
    ),

  listAssignments: (id: string) =>
    api.get<FacilityAssignment[]>(`${staffBase(id)}/facility-assignments`),
  addAssignment: (
    id: string,
    dto: { facilityId: string; startDate: string; makePrimary?: boolean },
  ) => api.post<FacilityAssignment>(`${staffBase(id)}/facility-assignments`, dto),
  patchAssignment: (
    id: string,
    assignmentId: string,
    dto: {
      makePrimary?: boolean;
      end?: boolean;
      endDate?: string;
      replacementPrimaryAssignmentId?: string;
    },
  ) =>
    api.patch<FacilityAssignment>(
      `${staffBase(id)}/facility-assignments/${assignmentId}`,
      dto,
    ),

  getStaffAudit: (id: string) =>
    api.get<StaffAuditEntry[]>(`${staffBase(id)}/staff-audit`),

  getSelfProfile: () => api.get<SelfStaffProfile>('/auth/me/profile'),
};

export const patientsApi = {
  list: () => api.get<Patient[]>('/patients'),
  getById: (id: string) => api.get<Patient>(`/patients/${id}`),
  create: (dto: { fullName: string; dateOfBirth: string; gender: string; phone: string }) =>
    api.post<CreatePatientResult>('/patients', dto),
  checkDuplicates: (dto: { fullName: string; dateOfBirth: string; phone: string }) =>
    api.post<Patient[]>('/patients/duplicate-check', dto),
  getTimeline: (id: string) => api.get<PatientTimeline>(`/patients/${id}/timeline`),
};

export const encountersApi = {
  create: (dto: {
    patientId: string;
    episodeId?: string;
    treatmentPathwayId?: string;
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
    /**
     * DEC-015 — only the initial Hemorrhoid Encounter sets this
     * ('HEMORRHOID_INITIAL'). Generic new-encounter flows must NOT send it;
     * never combined with episodeId (backend rejects 400).
     */
    workflowKind?: EncounterWorkflowKind;
  }) => api.post<Encounter>('/encounters', dto),
  getById: (id: string) => api.get<Encounter>(`/encounters/${id}`),
  /** Clinician handover — DOCTOR-only (DEC-010 §B). */
  handover: (id: string, dto: { newClinicianId: string; reason?: string }) =>
    api.post<Encounter>(`/encounters/${id}/handover`, dto),
  getClinicianHistory: (id: string) =>
    api.get<ClinicianAssignmentHistoryEntry[]>(`/encounters/${id}/clinician-history`),
  /**
   * Dedicated atomic Return Encounter orchestration — Hemorrhoid Vertical
   * Slice 3 T2 (DEC-013; docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md
   * §H). Deliberately does not accept patientId/episodeId/clinicalNote/
   * assessment — the backend derives patientId from the CareTask and
   * resolves/creates the CareEpisode itself.
   */
  createHemorrhoidReturn: (dto: {
    careTaskId: string;
    occurredAt: string;
    reasonForVisit: string;
    responsibleClinicianId?: string;
    roomId?: string;
    // DEC-020 Package A T10 P1-01 — explicit recurrence choice carried on
    // the Return request so the reopen/start-new lifecycle work and the
    // Return commit atomically. Never call the standalone
    // careEpisodesApi.reopen / .create as a pre-step for a recurrence.
    recurrenceAction?: 'REOPEN_EXISTING' | 'START_NEW';
    recurrenceClosedEpisodeId?: string;
    recurrenceReason?: string;
  }) => api.post<Encounter>('/encounters/hemorrhoid-return', dto),
};

/** Stable backend error code (see ApiError.code) — the Return resolver
 * needs an explicit recurrence choice (0 ACTIVE episode + CLOSED history). */
export const HEMORRHOID_RECURRENCE_CHOICE_REQUIRED =
  'HEMORRHOID_RECURRENCE_CHOICE_REQUIRED';

/** Facility lookup/management (DEC-010 §C). */
export const facilitiesApi = {
  list: () => api.get<Facility[]>('/facilities'),
  getById: (id: string) => api.get<Facility>(`/facilities/${id}`),
  create: (name: string) => api.post<Facility>('/facilities', { name }),
};

/** Room lookup/management (DEC-010 §C). */
export const roomsApi = {
  listByFacility: (facilityId: string) => api.get<Room[]>(`/rooms?facilityId=${facilityId}`),
  getById: (id: string) => api.get<Room>(`/rooms/${id}`),
  create: (dto: { facilityId: string; name: string }) => api.post<Room>('/rooms', dto),
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
  /**
   * Optional `completedByEncounterId` — explicit Return Encounter linkage
   * (DEC-012 §16). Never inferred by the frontend; the doctor must pick the
   * Encounter explicitly and the backend validates tenant/patient/OPEN.
   */
  complete: (id: string, completedByEncounterId?: string) =>
    api.post<CareTask>(`/care-tasks/${id}/complete`, {
      completedByEncounterId,
    }),
  cancel: (id: string) => api.post<CareTask>(`/care-tasks/${id}/cancel`),
  /** Generic operational reschedule (DEC-012 §15) — distinct from the
   * CarePlan.followUpDate signed clinical intent amended via carePlansApi.amend. */
  reschedule: (id: string, dueDate: string) =>
    api.post<CareTask>(`/care-tasks/${id}/reschedule`, { dueDate }),
};

export const clinicalFormsApi = {
  create: (dto: { encounterId: string; templateKey: string; responses: ClinicalFormResponses }) =>
    api.post<ClinicalFormSubmission>('/clinical-forms', dto),
  getById: (id: string) => api.get<ClinicalFormSubmission>(`/clinical-forms/${id}`),
  listByPatient: (patientId: string) =>
    api.get<ClinicalFormSubmission[]>(`/clinical-forms?patientId=${patientId}`),
  updateDraft: (id: string, dto: { responses: ClinicalFormResponses }) =>
    api.patch<ClinicalFormSubmission>(`/clinical-forms/${id}/draft`, dto),
  complete: (id: string) => api.post<ClinicalFormSubmission>(`/clinical-forms/${id}/complete`),
  amend: (id: string, dto: { responses: ClinicalFormResponses; amendmentReason: string }) =>
    api.post<ClinicalFormSubmission>(`/clinical-forms/${id}/amend`, dto),
  getHistory: (id: string) =>
    api.get<{
      revisions: ClinicalFormSubmission[];
      current: ClinicalFormSubmission;
    }>(`/clinical-forms/${id}/history`),
  getTemplate: (templateKey: string, version?: number) =>
    api.get<ClinicalFormTemplateDef>(
      `/clinical-forms/templates/${templateKey}${version ? `?version=${version}` : ''}`,
    ),
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

export const treatmentPathwaysApi = {
  list: (caseId: string) =>
    api.get<TreatmentPathway[]>(`/care-episodes/${caseId}/treatment-pathways`),
  create: (dto: {
    caseId: string;
    modality: TreatmentPathway['modality'];
    methodCode?: string;
    startedAt: string;
  }) => api.post<TreatmentPathway>('/treatment-pathways', dto),
};
export const investigationsApi = {
  list: (caseId: string) => api.get<Investigation[]>(`/care-episodes/${caseId}/investigations`),
  assigned: () => api.get<Investigation[]>('/investigations/assigned'),
  assignees: () =>
    api.get<{ id: string; email: string; role: string }[]>('/investigations/assignees'),
  create: (dto: {
    caseId: string;
    label: string;
    origin: Investigation['origin'];
    parentInvestigationId?: string;
  }) => api.post<Investigation>('/investigations', dto),
  order: (
    id: string,
    dto: {
      requestedAt: string;
      requestText: string;
      assignedToUserId?: string;
    },
  ) => api.post<InvestigationOrder>(`/investigations/${id}/orders`, dto),
  result: (id: string, dto: { observedAt: string; rawText: string; orderId?: string }) =>
    api.post<InvestigationResult>(`/investigations/${id}/results`, dto),
};
