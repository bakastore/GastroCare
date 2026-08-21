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
  return <Outlet />;
}

// Frontend visibility is NOT the security boundary — the backend re-checks
// role/tenant on every request. This only gives the user a clear
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
