import React, { useEffect, useState } from 'react';
import AdminPortalLayout from '../components/AdminPortalLayout';

interface PendingTherapist {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  license_number: string;
  experience_years: number;
  specialties: string[];
  session_types: string[];
  rate_60min: number;
  availability: string[];
  created_at: string;
}

const AdminTherapistApprovalsPage: React.FC = () => {
  const [therapists, setTherapists] = useState<PendingTherapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState<PendingTherapist | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    fetchPendingTherapists();
  }, []);

  const fetchPendingTherapists = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5001/api/admin/therapists/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending therapists');
      }

      const data = await response.json();
      setTherapists(data.therapists || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    if (!confirm('Are you sure you want to approve this therapist?')) return;

    try {
      setProcessing(id);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5001/api/admin/therapists/${id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to approve therapist');
      }

      // Remove from list
      setTherapists(therapists.filter(t => t.id !== id));
      setSelectedTherapist(null);
      alert('Therapist approved successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return; // User cancelled

    try {
      setProcessing(id);
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`http://localhost:5001/api/admin/therapists/${id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject therapist');
      }

      // Remove from list
      setTherapists(therapists.filter(t => t.id !== id));
      setSelectedTherapist(null);
      alert('Therapist application rejected');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <AdminPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-ivory rounded-lg shadow-sm p-6 border border-brown-soft/20">
          <h1 className="text-3xl font-bold text-brown-dark mb-2">Therapist Approvals</h1>
          <p className="text-brown-soft">Review and approve pending therapist applications</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brown-soft mx-auto"></div>
            <p className="mt-4 text-brown-soft">Loading applications...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-600">{error}</p>
          </div>
        ) : therapists.length === 0 ? (
          <div className="bg-ivory border border-brown-soft/20 rounded-lg p-12 text-center">
            <p className="text-xl text-brown-soft">✅ No pending applications</p>
            <p className="text-brown-soft/70 mt-2">All therapist applications have been reviewed</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* List of pending therapists */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-brown-dark">
                Pending Applications ({therapists.length})
              </h2>
              {therapists.map((therapist) => (
                <div
                  key={therapist.id}
                  onClick={() => setSelectedTherapist(therapist)}
                  className={`bg-ivory border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedTherapist?.id === therapist.id
                      ? 'border-brown-dark shadow-md'
                      : 'border-brown-soft/20 hover:border-brown-soft hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-brown-dark">{therapist.full_name}</h3>
                      <p className="text-sm text-brown-soft">{therapist.email}</p>
                      <p className="text-xs text-brown-soft/70 mt-1">
                        Applied: {new Date(therapist.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                        Pending
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Details panel */}
            <div className="lg:sticky lg:top-6 lg:self-start">
              {selectedTherapist ? (
                <div className="bg-ivory border border-brown-soft/20 rounded-lg p-6 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-brown-dark mb-1">
                      {selectedTherapist.full_name}
                    </h2>
                    <p className="text-brown-soft">{selectedTherapist.email}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-brown-dark mb-1">Phone</label>
                      <p className="text-brown-soft">{selectedTherapist.phone || 'N/A'}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-brown-dark mb-1">License Number</label>
                      <p className="text-brown-soft">{selectedTherapist.license_number || 'N/A'}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-brown-dark mb-1">Experience</label>
                      <p className="text-brown-soft">{selectedTherapist.experience_years} years</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-brown-dark mb-1">Specialties</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedTherapist.specialties?.map((specialty, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-beige text-brown-dark text-sm rounded-full"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-brown-dark mb-1">Session Types</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedTherapist.session_types?.map((type, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-cream text-brown-dark text-sm rounded-full"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-brown-dark mb-1">Rate (60 min)</label>
                      <p className="text-brown-soft">${selectedTherapist.rate_60min}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-brown-dark mb-1">Availability</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedTherapist.availability?.map((day, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-ivory-dark text-brown-dark text-sm rounded-full border border-brown-soft/20"
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-4 pt-4 border-t border-brown-soft/20">
                    <button
                      onClick={() => handleApprove(selectedTherapist.id)}
                      disabled={processing === selectedTherapist.id}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      {processing === selectedTherapist.id ? 'Processing...' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(selectedTherapist.id)}
                      disabled={processing === selectedTherapist.id}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      {processing === selectedTherapist.id ? 'Processing...' : '✗ Reject'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-ivory border border-brown-soft/20 rounded-lg p-12 text-center">
                  <p className="text-brown-soft">Select an application to review details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminPortalLayout>
  );
};

export default AdminTherapistApprovalsPage;
