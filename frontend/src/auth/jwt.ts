import type { AuthRole } from '../types/domain';

export interface JwtClaims {
  sub: string;
  tenantId: string;
  email: string;
  role: AuthRole;
  exp: number;
}

// Decodes (does not verify) the payload of a server-issued JWT purely to
// drive role-aware navigation. This is NOT a security check — the token is
// opaque to the frontend for authorization purposes; every protected route
// re-checks role/tenant server-side (see Owner Execution Contract section 7).
export function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(payloadJson) as JwtClaims;
    if (!claims.sub || !claims.role || !claims.tenantId) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function isExpired(claims: JwtClaims): boolean {
  return claims.exp * 1000 <= Date.now();
}
