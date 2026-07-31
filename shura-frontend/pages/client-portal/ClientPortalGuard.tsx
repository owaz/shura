import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ClientPortalGuard: React.FC = () => {
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="min-h-screen bg-cream flex items-center justify-center text-brown-soft">Loading your sanctuary...</div>;
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (currentUser.role !== 'client') {
    const destination = currentUser.role === 'therapist'
      ? '/therapist-portal/dashboard'
      : '/admin/therapists/pending';
    return <Navigate to={destination} replace />;
  }

  const isOnboarding = location.pathname === '/portal/onboarding';
  if (!currentUser.onboardingCompleted && !isOnboarding) {
    return <Navigate to="/portal/onboarding" replace />;
  }
  if (currentUser.onboardingCompleted && isOnboarding) {
    return <Navigate to="/portal/home" replace />;
  }

  return <Outlet />;
};

export default ClientPortalGuard;
