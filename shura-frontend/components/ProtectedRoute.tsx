import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, redirectTo = '/login-hub' }) => {
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream text-brown-soft">
        Loading your session...
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{
          from: location,
          redirectTo: `${location.pathname}${location.search}${location.hash}`,
          paymentData: location.state,
        }}
      />
    );
  }

  if (allowedRoles?.length && !allowedRoles.includes(currentUser.role)) {
    const roleDestination: Record<UserRole, string> = {
      client: '/portal/home',
      therapist: '/therapist-portal/dashboard',
      admin: '/admin/therapists/pending',
    };
    return <Navigate to={roleDestination[currentUser.role]} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
