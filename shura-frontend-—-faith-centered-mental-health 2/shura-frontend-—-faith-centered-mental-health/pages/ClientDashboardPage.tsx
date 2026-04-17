import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config/api';
import { Watermark } from '../components/Watermark';

interface Booking {
  id: number;
  therapist_id: number;
  therapist_name: string;
  date: string;
  time: string;
  session_type: string;
  status: string;
  created_at: string;
}

interface Payment {
  id: number;
  amount: number;
  status: string;
  created_at: string;
  booking_id: number;
}

const ClientDashboardPage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bookings' | 'payments'>('bookings');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showProfileMenu && !target.closest('.profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('shura-auth-token');

      if (!token) {
        console.log('No auth token found');
        setLoading(false);
        return;
      }

      // Use clientFetch to attach token and handle 401/403
      const { clientFetch } = await import('../utils/clientApi');

      // Fetch bookings
      try {
        const bookingsRes = await clientFetch(`${config.apiUrl}/api/bookings/my-bookings`);
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          setBookings(bookingsData.bookings || []);
        } else {
          console.error('Failed to fetch bookings:', bookingsRes.status);
        }
      } catch (err) {
        console.error('Error fetching bookings:', err);
      }

      // Fetch payments
      try {
        const paymentsRes = await clientFetch(`${config.apiUrl}/api/payments/my-payments`);
        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          setPayments(paymentsData.payments || []);
        } else {
          console.error('Failed to fetch payments:', paymentsRes.status);
        }
      } catch (err) {
        console.error('Error fetching payments:', err);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      const token = localStorage.getItem('shura-auth-token');
      const response = await fetch(`${config.apiUrl}/api/bookings/${bookingId}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to cancel booking');
      }

      alert('Booking cancelled successfully. You will receive a refund within 5-7 business days.');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel booking');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-brown-dark">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="container mx-auto px-6 py-12">
        {/* Header with Profile Dropdown */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-serif font-bold text-brown-dark mb-2">
              Welcome back, {currentUser?.full_name || 'Client'}
            </h1>
            <p className="text-brown-soft">Manage your appointments and view your history</p>
          </div>
          
          {/* Profile Menu Button */}
          <div className="relative profile-menu-container">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center justify-center w-14 h-14 rounded-full bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl z-50 border border-gray-100">
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-500 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">My Profile</h3>
                      <p className="text-sm text-gray-500">/client/profile</p>
                      <p className="text-xs text-gray-400 mt-1">Edit your name, phone, change password.</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      navigate('/bookings');
                      setShowProfileMenu(false);
                    }}
                    className="w-full px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">View bookings</p>
                      <p className="text-sm text-gray-500">payment history, statistics</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      navigate('/book');
                      setShowProfileMenu(false);
                    }}
                    className="w-full px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Book Session <span className="text-gray-400">/book</span></p>
                      <p className="text-sm text-gray-500">Schedule new sessions</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      logout();
                      setShowProfileMenu(false);
                    }}
                    className="w-full px-6 py-4 flex items-start gap-4 hover:bg-red-50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-50">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-red-600">Logout</p>
                      <p className="text-sm text-gray-500">Sign out of your account</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-brown-soft text-sm mb-2">Total Bookings</h3>
            <p className="text-3xl font-bold text-brown-dark">{bookings.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-brown-soft text-sm mb-2">Upcoming Sessions</h3>
            <p className="text-3xl font-bold text-slate-blue">
              {bookings.filter(b => b.status === 'confirmed' && new Date(b.date) > new Date()).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-brown-soft text-sm mb-2">Total Spent</h3>
            <p className="text-3xl font-bold text-gold">
              ₹{payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="border-b border-taupe flex">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'bookings'
                  ? 'bg-slate-blue text-white'
                  : 'text-brown-soft hover:bg-sand'
              }`}
            >
              My Bookings
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'payments'
                  ? 'bg-slate-blue text-white'
                  : 'text-brown-soft hover:bg-sand'
              }`}
            >
              Payment History
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'bookings' && (
              <div className="space-y-4">
                {bookings.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-brown-soft mb-4">You don't have any bookings yet</p>
                    <button
                      onClick={() => navigate('/book')}
                      className="px-6 py-2 bg-slate-blue text-white rounded-md hover:bg-opacity-90 transition-colors"
                    >
                      Book Your First Session
                    </button>
                  </div>
                ) : (
                  bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="border border-taupe rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-brown-dark">
                              {booking.therapist_name}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                              {booking.status}
                            </span>
                          </div>
                          <div className="space-y-1 text-brown-soft">
                            <p>
                              <span className="font-medium">Date:</span>{' '}
                              {new Date(booking.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p>
                              <span className="font-medium">Time:</span> {booking.time}
                            </p>
                            <p>
                              <span className="font-medium">Session Type:</span> {booking.session_type}
                            </p>
                            <p className="text-sm">
                              Booking ID: #{booking.id}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {booking.status === 'confirmed' && new Date(booking.date) > new Date() && (
                            <>
                              <button
                                onClick={() => navigate(`/chat/${booking.therapist_id}`)}
                                className="px-4 py-2 border border-slate-blue text-slate-blue rounded-md hover:bg-slate-blue hover:text-white transition-colors"
                              >
                                Chat
                              </button>
                              <button
                                onClick={() => handleCancelBooking(booking.id)}
                                className="px-4 py-2 border border-red-500 text-red-500 rounded-md hover:bg-red-500 hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-4">
                {payments.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-brown-soft">No payment history yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-sand">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-brown-dark uppercase tracking-wider">
                            Payment ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-brown-dark uppercase tracking-wider">
                            Booking ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-brown-dark uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-brown-dark uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-brown-dark uppercase tracking-wider">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-taupe">
                        {payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-sand transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-brown-dark">
                              #{payment.id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-brown-dark">
                              #{payment.booking_id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brown-dark">
                              ₹{payment.amount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                                {payment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-brown-soft">
                              {new Date(payment.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-brown-dark mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/therapists')}
              className="p-4 border border-taupe rounded-md hover:shadow-md transition-all text-left group"
            >
              <div className="text-slate-blue text-2xl mb-2">👥</div>
              <h3 className="font-medium text-brown-dark group-hover:text-slate-blue transition-colors">
                Browse Therapists
              </h3>
              <p className="text-sm text-brown-soft mt-1">Find the right therapist for you</p>
            </button>
            
            <button
              onClick={() => navigate('/shura-hub')}
              className="p-4 border border-taupe rounded-md hover:shadow-md transition-all text-left group"
            >
              <div className="text-slate-blue text-2xl mb-2">🧘</div>
              <h3 className="font-medium text-brown-dark group-hover:text-slate-blue transition-colors">
                Healing Hub
              </h3>
              <p className="text-sm text-brown-soft mt-1">Access wellness resources</p>
            </button>
            
            <button
              onClick={() => navigate('/contact')}
              className="p-4 border border-taupe rounded-md hover:shadow-md transition-all text-left group"
            >
              <div className="text-slate-blue text-2xl mb-2">💬</div>
              <h3 className="font-medium text-brown-dark group-hover:text-slate-blue transition-colors">
                Contact Support
              </h3>
              <p className="text-sm text-brown-soft mt-1">Get help when you need it</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboardPage;
