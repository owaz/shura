
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const isTherapistAuthenticated = localStorage.getItem('shura-auth') === 'true';

  if (!isAuthenticated && !isTherapistAuthenticated) {
    // Redirect them to the therapist login page if they are not authenticated
    return <Navigate to="/therapist-login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
