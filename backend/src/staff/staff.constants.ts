/**
 * DEC-019 — Staff Profile & Credential Management v1 audit vocabulary.
 * These are the only actions the DEC-019 staff surface writes, and the only
 * ones GET /clinic-admin/users/:id/staff-audit exposes. DEC-018's
 * USER_MANAGEMENT_AUDIT_ACTIONS are deliberately disjoint and unchanged.
 *
 * Audit minimization (Contract T5): never copy biography / workPhone / note /
 * credentialNumber into metadata. Profile updates carry `changedFields` only.
 */
export const STAFF_AUDIT_ACTIONS = [
  'STAFF_PROFILE_CREATED',
  'STAFF_PROFILE_UPDATED',
  'CREDENTIAL_ADDED',
  'CREDENTIAL_UPDATED',
  'CREDENTIAL_REMOVED',
  'EMPLOYMENT_RECORD_ADDED',
  'EMPLOYMENT_RECORD_UPDATED',
  'EMPLOYMENT_RECORD_REMOVED',
  'FACILITY_ASSIGNMENT_ADDED',
  'FACILITY_ASSIGNMENT_PRIMARY_CHANGED',
  'FACILITY_ASSIGNMENT_ENDED',
] as const;

export type StaffAuditAction = (typeof STAFF_AUDIT_ACTIONS)[number];

export const STAFF_PROFILE_ENTITY = 'StaffProfile';
export const STAFF_CREDENTIAL_ENTITY = 'StaffCredential';
export const EMPLOYMENT_HISTORY_ENTITY = 'EmploymentHistory';
export const STAFF_FACILITY_ASSIGNMENT_ENTITY = 'StaffFacilityAssignment';
