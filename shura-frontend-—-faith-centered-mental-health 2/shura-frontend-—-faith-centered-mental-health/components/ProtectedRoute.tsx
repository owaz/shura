
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const token = localStorage.getItem('shura-auth-token');
  const user = localStorage.getItem('shura-current-user');
  const isTherapistAuthenticated = token && user ? true : false;

  if (!isAuthenticated && !isTherapistAuthenticated) {
    // Redirect them to the therapist login page if they are not authenticated
    return <Navigate to="/therapist-login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
