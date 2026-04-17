import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

interface AdminPortalLayoutProps {
  children: React.ReactNode;
}

const AdminPortalLayout: React.FC<AdminPortalLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');

  const menuItems = [
    {
      name: 'Dashboard',
      path: '/admin/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Client Assignment',
      path: '/admin/client-assignment',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      name: 'My Profile',
      path: '/admin/profile',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-beige-light">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-brown-soft to-brown-dark text-white transition-all duration-300 z-40 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-brown-dark/30">
            {sidebarOpen && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <span className="text-brown-dark font-bold text-lg">S</span>
                </div>
                <span className="font-bold text-lg">Shura Admin</span>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-brown-dark/30 rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 p-3 rounded-lg transition ${
                  location.pathname === item.path
                    ? 'bg-white text-brown-dark shadow-lg'
                    : 'hover:bg-brown-dark/30 text-white'
                }`}
              >
                {item.icon}
                {sidebarOpen && <span className="font-medium">{item.name}</span>}
              </Link>
            ))}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-brown-dark/30">
            <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'}`}>
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-brown-dark font-bold">
                {adminUser.full_name?.charAt(0).toUpperCase() || 'A'}
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{adminUser.full_name || 'Admin'}</p>
                  <p className="text-xs text-beige-light truncate">{adminUser.email || ''}</p>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <button
                onClick={handleLogout}
                className="w-full mt-3 px-4 py-2 bg-brown-dark/50 hover:bg-brown-dark/70 rounded-lg transition text-sm font-medium"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        {/* Top Bar */}
        <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-brown-soft/20">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-brown-dark">
              {menuItems.find((item) => item.path === location.pathname)?.name || 'Admin Portal'}
            </h2>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-brown-soft">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 bg-sand min-h-screen">{children}</div>
      </main>
    </div>
  );
};

export default AdminPortalLayout;
