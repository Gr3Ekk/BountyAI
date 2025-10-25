import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types/auth';

interface RequireAuthProps {
  allowedRoles?: UserRole[];
}

export function RequireAuth({ allowedRoles }: RequireAuthProps) {
  const {
    state: { status, role },
  } = useAuth();
  const location = useLocation();

  if (status !== 'authenticated') {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const fallback = role === 'manager' ? '/manager' : '/developer';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
