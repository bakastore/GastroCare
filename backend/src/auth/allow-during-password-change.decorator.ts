import { SetMetadata } from '@nestjs/common';

export const ALLOW_DURING_PASSWORD_CHANGE_KEY = 'allowDuringPasswordChange';

/**
 * Marks the handful of endpoints that stay reachable while an authenticated
 * user has `mustChangePassword = true` (DEC-018 T2): GET /auth/me and
 * POST /auth/change-password. Every other application route is rejected by
 * MustChangePasswordGuard until the password is changed.
 */
export const AllowDuringPasswordChange = () =>
  SetMetadata(ALLOW_DURING_PASSWORD_CHANGE_KEY, true);
