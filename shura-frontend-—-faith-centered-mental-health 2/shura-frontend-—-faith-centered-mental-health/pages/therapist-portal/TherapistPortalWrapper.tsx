import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import TherapistSidebar from './TherapistSidebar';

interface TherapistPortalWrapperProps {
  children: React.ReactNode;
}

const TherapistPortalWrapper: React.FC<TherapistPortalWrapperProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Check if we're on a therapist portal route
  const isTherapistPortal = location.pathname.startsWith('/therapist-portal/');

  if (!isTherapistPortal) {
    return <>{children}</>;
  }

  return (
    <div className="flex">
      <TherapistSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        onOpen={() => setSidebarOpen(true)}
      />
      <div className="flex-1 md:ml-64 pt-0">
        {children}
      </div>
    </div>
  );
};

export default TherapistPortalWrapper;
