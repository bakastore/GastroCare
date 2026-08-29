/**
 * Tenant JWT v1 (DEC-018).
 *
 * The tenant access token contains ONLY these three claims. It is a proof of
 * "this session belongs to AuthUser `sub` at session generation `sessionVersion`"
 * — nothing more. Role, tenantId, email and isClinicAdmin are deliberately NOT
 * encoded: every request resolves them fresh from the AuthUser row so that a
 * role change / capability revoke / disable / password reset takes effect on
 * the very next request that reuses an already-issued token.
 */
export const TENANT_REALM = 'TENANT' as const;

export interface TenantJwtPayload {
  sub: string;
  realm: typeof TENANT_REALM;
  sessionVersion: number;
}
