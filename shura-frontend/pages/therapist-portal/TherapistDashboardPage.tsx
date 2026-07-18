import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../config/api';

type DashboardStats = {
  upcoming_sessions: number;
  active_clients: number;
  total_earnings_cents: number;
  monthly_earnings_cents: number;
  profile_views: number;
};

type UpcomingAppointment = {
  id: number;
  date: string;
  time: string;
  session_type: string;
  status: string;
  client_name: string;
  client_email: string;
};

const formatDateOnly = (value: string) => String(value || '').slice(0, 10);

const StatCard: React.FC<{ title: string; value: string; description: string }> = ({ title, value, description }) => (
  <div className="bg-ivory p-6 rounded-xl shadow-sm">
    <h3 className="text-sm font-semibold text-taupe">{title}</h3>
    <p className="text-3xl font-bold text-brown-dark mt-1">{value}</p>
    <p className="text-xs text-brown-soft mt-1">{description}</p>
  </div>
);

const TherapistDashboardPage: React.FC = () => {
  const storedUser = localStorage.getItem('shura-current-user');
  const therapist = storedUser ? JSON.parse(storedUser) : null;
  const therapistName = therapist ? `Dr. ${therapist.full_name || therapist.name || 'Therapist'}` : 'Dr. Therapist';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadDashboard = async () => {
      setError('');
      try {
        const response = await apiFetch('/bookings/therapist/dashboard');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load dashboard');
        if (isMounted) {
          setStats(data.stats || null);
          setUpcomingAppointments(Array.isArray(data.upcomingAppointments) ? data.upcomingAppointments : []);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard');
        }
      }
    };
    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalEarnings = useMemo(() => `₹${((stats?.total_earnings_cents || 0) / 100).toLocaleString('en-IN')}`, [stats]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-brown-dark">Welcome back, {therapistName}</h1>
        <p className="text-brown-soft mt-1">Here's a snapshot of your practice today.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Upcoming Sessions" value={String(stats?.upcoming_sessions || 0)} description="in the next 7 days" />
        <StatCard title="Active Clients" value={String(stats?.active_clients || 0)} description="in the last 30 days" />
        <StatCard title="Total Earnings" value={totalEarnings} description="lifetime completed payments" />
      </div>

      <div className="bg-ivory p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-serif font-semibold text-brown-dark mb-4">Upcoming Appointments</h2>
        <div className="space-y-4">
          {upcomingAppointments.map((app) => (
            <div key={app.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-sand">
              <div>
                <p className="font-semibold text-brown-dark">{app.client_name}</p>
                <p className="text-sm text-brown-soft">
                  {formatDateOnly(app.date)} @ {String(app.time).slice(0, 5)} ({app.session_type})
                </p>
              </div>
              <span className="text-sm font-medium bg-sand text-brown-soft px-3 py-1 rounded-full">{app.status}</span>
            </div>
          ))}
          {upcomingAppointments.length === 0 && (
            <p className="text-center text-brown-soft py-4">No upcoming appointments.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-ivory p-6 rounded-xl shadow-sm flex flex-col items-center text-center">
          <h3 className="text-lg font-serif font-semibold text-brown-dark">Manage Your Profile</h3>
          <p className="text-brown-soft text-sm my-2 flex-grow">Keep your bio, specialties, and availability up to date to attract the right clients.</p>
          <Link to="/therapist-portal/profile" className="mt-auto bg-brown-soft text-white px-6 py-2 rounded-lg hover:bg-brown-dark transition-colors font-semibold">
            Edit Profile
          </Link>
        </div>
        <div className="bg-ivory p-6 rounded-xl shadow-sm flex flex-col items-center text-center">
          <h3 className="text-lg font-serif font-semibold text-brown-dark">View Your Schedule</h3>
          <p className="text-brown-soft text-sm my-2 flex-grow">Access your full calendar to manage your bookings and set your availability.</p>
          <Link to="/therapist-portal/calendar" className="mt-auto bg-brown-soft text-white px-6 py-2 rounded-lg hover:bg-brown-dark transition-colors font-semibold">
            View Calendar
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TherapistDashboardPage;
