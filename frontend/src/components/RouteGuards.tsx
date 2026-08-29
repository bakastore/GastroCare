import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { AuthRole } from '../types/domain';

export function RequireAuth() {
  const { user, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  // DEC-018 — a user mid forced-password-change may only reach the
  // change-password screen (and /auth/me, handled by the API layer).
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

// Frontend visibility is NOT the security boundary — the backend re-checks
// role/tenant/capability on every request. This only gives the user a clear
// access-denied state instead of a confusing dead screen (section 8/11).
export function RequireRole({ allowed }: { allowed: AuthRole[] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!allowed.includes(user.role)) {
    return <Navigate to="/not-authorized" replace />;
  }
  return <Outlet />;
}

// DEC-018 — Clinic Admin is a capability, not an operational role. Gated on
// `isClinicAdmin` resolved from GET /auth/me, never from the token.
export function RequireClinicAdmin() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.isClinicAdmin) {
    return <Navigate to="/not-authorized" replace />;
  }
  return <Outlet />;
}
