import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as anonymously accessible. Gate 2 allowlist: POST /auth/login, GET /health.
 * Every other route created by Gate 2 is protected by default via the global JwtAuthGuard.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
