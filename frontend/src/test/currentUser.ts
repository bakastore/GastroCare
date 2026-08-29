import type { CurrentUser } from '../auth/AuthContext';
import type { AuthRole } from '../types/domain';

/** Test factory for a fully-shaped CurrentUser (DEC-018). */
export function makeCurrentUser(
  overrides: Partial<CurrentUser> & { role?: AuthRole } = {},
): CurrentUser {
  return {
    userId: 'u1',
    tenantId: 't1',
    email: 'doctor@example.test',
    displayName: null,
    role: 'DOCTOR',
    isClinicAdmin: false,
    status: 'ACTIVE',
    mustChangePassword: false,
    ...overrides,
  };
}
