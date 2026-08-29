// DEC-018 — the tenant access token carries only `sub`, `realm` and
// `sessionVersion` (plus `iat`/`exp`). It is NOT an authorization document:
// role / tenant / capability are resolved from GET /auth/me on every load and
// re-checked server-side on every request. This decoder exists only so the
// app can drop an obviously-expired token before making a request with it.

export interface TenantJwtClaims {
  sub: string;
  realm?: string;
  sessionVersion?: number;
  exp: number;
}

export function decodeJwtClaims(token: string): TenantJwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(payloadJson) as TenantJwtClaims;
    if (!claims.sub || typeof claims.exp !== 'number') {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function isExpired(claims: TenantJwtClaims): boolean {
  return claims.exp * 1000 <= Date.now();
}

/** True when a stored token is well-formed and not past its expiry. */
export function isTokenUsable(token: string): boolean {
  const claims = decodeJwtClaims(token);
  return claims !== null && !isExpired(claims);
}
