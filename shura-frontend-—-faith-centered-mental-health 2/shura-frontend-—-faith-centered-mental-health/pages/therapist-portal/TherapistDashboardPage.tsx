
import React from 'react';
import type { Client, Appointment } from '../../types';
import { Link } from 'react-router-dom';

const mockClients: Client[] = [
  { id: 1, name: 'Aisha P.', avatarUrl: 'https://i.pravatar.cc/150?u=aisha' },
  { id: 2, name: 'Omar F.', avatarUrl: 'https://i.pravatar.cc/150?u=omar' },
  { id: 3, name: 'Fatima K.', avatarUrl: 'https://i.pravatar.cc/150?u=fatima' },
];

const mockAppointments: Appointment[] = [
  { id: 1, client: mockClients[0], dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), sessionType: 'Video', status: 'Upcoming' },
  { id: 2, client: mockClients[1], dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), sessionType: 'Audio', status: 'Upcoming' },
  { id: 3, client: mockClients[2], dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), sessionType: 'Video', status: 'Upcoming' },
];

const StatCard: React.FC<{ title: string; value: string; description: string }> = ({ title, value, description }) => (
    <div className="bg-ivory p-6 rounded-xl shadow-sm">
        <h3 className="text-sm font-semibold text-taupe">{title}</h3>
        <p className="text-3xl font-bold text-brown-dark mt-1">{value}</p>
        <p className="text-xs text-brown-soft mt-1">{description}</p>
    </div>
);

const TherapistDashboardPage: React.FC = () => {
    // Get therapist info from localStorage
    const storedUser = localStorage.getItem('shura-current-user');
    const therapist = storedUser ? JSON.parse(storedUser) : null;
    const therapistName = therapist ? `Dr. ${therapist.full_name || therapist.name || 'Therapist'}` : 'Dr. Zaina Ahmed';

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif font-bold text-brown-dark">Welcome back, {therapistName}</h1>
                <p className="text-brown-soft mt-1">Here's a snapshot of your practice today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Upcoming Sessions" value={mockAppointments.length.toString()} description="in the next 7 days" />
                <StatCard title="Active Clients" value="12" description="this month" />
                <StatCard title="Profile Views" value="84" description="in the last 30 days" />
            </div>

            {/* Upcoming Appointments */}
            <div className="bg-ivory p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-serif font-semibold text-brown-dark mb-4">Upcoming Appointments</h2>
                <div className="space-y-4">
                    {mockAppointments.map(app => (
                        <div key={app.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-sand">
                            <div className="flex items-center gap-4">
                                <img src={app.client.avatarUrl} alt={app.client.name} className="w-12 h-12 rounded-full object-cover" />
                                <div>
                                    <p className="font-semibold text-brown-dark">{app.client.name}</p>
                                    <p className="text-sm text-brown-soft">
                                        {new Date(app.dateTime).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                                        {' @ '}
                                        {new Date(app.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-medium bg-sand text-brown-soft px-3 py-1 rounded-full">{app.sessionType}</span>
                                <button className="font-semibold text-brown-soft hover:underline text-sm">Join Call</button>
                            </div>
                        </div>
                    ))}
                     {mockAppointments.length === 0 && (
                        <p className="text-center text-brown-soft py-4">No upcoming appointments.</p>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
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
