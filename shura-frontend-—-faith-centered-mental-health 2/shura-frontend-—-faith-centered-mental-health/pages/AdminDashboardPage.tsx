import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminPortalLayout from '../components/AdminPortalLayout';

interface DashboardStats {
  totalClients: number;
  activeTherapists: number;
  activeAssignments: number;
  totalIntakeForms: number;
}

const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      try {
        const { adminFetch } = await import('../utils/adminApi');
        const response = await adminFetch('http://localhost:5001/api/admin/auth/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        setStats(data.stats);
      } catch (err) {
        throw err;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Clients',
      value: stats?.totalClients || 0,
      icon: '👥',
      color: 'bg-gradient-to-br from-brown-soft to-brown-dark',
      link: '/admin/client-assignment',
    },
    {
      title: 'Active Therapists',
      value: stats?.activeTherapists || 0,
      icon: '🩺',
      color: 'bg-gradient-to-br from-beige to-brown-soft',
      link: '/admin/client-assignment',
    },
    {
      title: 'Active Assignments',
      value: stats?.activeAssignments || 0,
      icon: '🔗',
      color: 'bg-gradient-to-br from-brown-dark to-brown-soft',
      link: '/admin/client-assignment',
    },
    {
      title: 'Intake Forms',
      value: stats?.totalIntakeForms || 0,
      icon: '📋',
      color: 'bg-gradient-to-br from-cream to-beige',
      link: '/admin/intake-forms',
    },
  ];

  return (
    <AdminPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-ivory rounded-lg shadow-sm p-6 border border-brown-soft/20">
          <h1 className="text-3xl font-bold text-brown-dark mb-2">Dashboard</h1>
          <p className="text-brown-soft">Welcome to the Shura Admin Portal</p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brown-soft mx-auto"></div>
            <p className="mt-4 text-brown-soft">Loading statistics...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((card) => (
              <Link
                key={card.title}
                to={card.link}
                className="bg-ivory rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow border border-brown-soft/20"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-brown-soft text-sm font-medium mb-1">{card.title}</p>
                    <p className="text-3xl font-bold text-brown-dark">{card.value}</p>
                  </div>
                  <div className={`${card.color} w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg`}>
                    {card.icon}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-ivory rounded-lg shadow-sm p-6 border border-brown-soft/20">
          <h2 className="text-xl font-bold text-brown-dark mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/admin/therapist-approvals"
              className="flex items-center space-x-3 p-4 border border-brown-soft/30 rounded-lg hover:border-brown-soft hover:bg-beige-light transition"
            >
              <div className="bg-green-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-brown-dark">Therapist Approvals</p>
                <p className="text-sm text-brown-soft">Review pending applications</p>
              </div>
            </Link>

            <Link
              to="/admin/client-assignment"
              className="flex items-center space-x-3 p-4 border border-brown-soft/30 rounded-lg hover:border-brown-soft hover:bg-beige-light transition"
            >
              <div className="bg-brown-soft/10 p-3 rounded-lg">
                <svg className="w-6 h-6 text-brown-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-brown-dark">Client-Therapist Matches</p>
                <p className="text-sm text-brown-soft">View auto-matched pairs</p>
              </div>
            </Link>

            <Link
              to="/admin/profile"
              className="flex items-center space-x-3 p-4 border border-brown-soft/30 rounded-lg hover:border-brown-soft hover:bg-beige-light transition"
            >
              <div className="bg-beige p-3 rounded-lg">
                <svg className="w-6 h-6 text-brown-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-brown-dark">My Profile</p>
                <p className="text-sm text-brown-soft">View and edit profile</p>
              </div>
            </Link>

            <button
              onClick={fetchStats}
              className="flex items-center space-x-3 p-4 border border-brown-soft/30 rounded-lg hover:border-brown-soft hover:bg-beige-light transition"
            >
              <div className="bg-cream p-3 rounded-lg">
                <svg className="w-6 h-6 text-brown-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-brown-dark">Refresh Stats</p>
                <p className="text-sm text-brown-soft">Update dashboard data</p>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-ivory rounded-lg shadow-sm p-6 border border-brown-soft/20">
          <h2 className="text-xl font-bold text-brown-dark mb-4">Recent Activity</h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-beige-light rounded-lg">
              <div className="bg-brown-soft/20 p-2 rounded-full">
                <svg className="w-5 h-5 text-brown-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-brown-dark">System initialized</p>
                <p className="text-xs text-brown-soft">Admin portal is ready</p>
              </div>
              <span className="text-xs text-brown-soft">Just now</span>
            </div>
          </div>
        </div>
      </div>
    </AdminPortalLayout>
  );
};

export default AdminDashboardPage;
