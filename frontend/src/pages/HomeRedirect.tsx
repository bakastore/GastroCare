import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={user.role === 'DOCTOR' ? '/today' : '/patients'} replace />;
}
