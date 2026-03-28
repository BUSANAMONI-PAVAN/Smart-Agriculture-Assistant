import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../services/api';

type ProtectedRouteProps = {
  children: ReactNode;
  roles?: UserRole[];
  featureKey?: string;
};

export function ProtectedRoute({ children, roles, featureKey }: ProtectedRouteProps) {
  const { loading, isAuthenticated, user, canAccessAdmin, isFeatureEnabled } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f4f6ef] text-lg font-semibold text-[#294833]">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles?.length) {
    const roleAllowed =
      Boolean(user) &&
      ((user ? roles.includes(user.role) : false) || (roles.includes('admin') && canAccessAdmin));

    if (!roleAllowed) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (featureKey && !isFeatureEnabled(featureKey) && !canAccessAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
