/**
 * DEC-018 user-management audit vocabulary. These are the only actions the
 * Clinic Admin user-management surface writes, and the only ones the user
 * audit read endpoint exposes. Never audit a password / temporary password /
 * password hash / token / secret in the metadata of any of these.
 */
export const USER_MANAGEMENT_AUDIT_ACTIONS = [
  'USER_CREATED',
  'USER_PROFILE_UPDATED',
  'USER_ROLE_CHANGED',
  'USER_CLINIC_ADMIN_GRANTED',
  'USER_CLINIC_ADMIN_REVOKED',
  'USER_DISABLED',
  'USER_REACTIVATED',
  'USER_PASSWORD_RESET',
] as const;

export const FACILITY_ROOM_AUDIT_ACTIONS = ['FACILITY_CREATED', 'ROOM_CREATED'] as const;

export type UserManagementAuditAction =
  (typeof USER_MANAGEMENT_AUDIT_ACTIONS)[number];
