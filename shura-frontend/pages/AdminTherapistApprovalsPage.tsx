import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../config/api';
import { Logo } from '../components/Logo';

const ADMIN_TOKEN_KEY = 'shura-admin-token';

type PendingTherapist = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  license_number?: string | null;
  experience_years?: number | null;
  specialties: string[];
  session_types: string[];
  availability: string[];
  rate_60min?: number | null;
  created_at: string;
};

const AdminTherapistApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const [therapists, setTherapists] = useState<PendingTherapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeaders = () => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadPending = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const response = await apiFetch('/admin/therapists/pending', {
        headers: authHeaders(),
      });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        navigate('/admin/login');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Failed to load pending therapists');
      setTherapists(data.therapists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending therapists');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!localStorage.getItem(ADMIN_TOKEN_KEY)) {
      navigate('/admin/login');
      return;
    }
    loadPending();
  }, [loadPending, navigate]);

  const updateStatus = async (id: number, action: 'approve' | 'reject') => {
    try {
      const response = await apiFetch(`/admin/therapists/${id}/${action}`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${action} therapist`);
      setTherapists((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action} therapist`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-sand p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="font-serif text-3xl font-bold text-brown-dark">Shura Admin</span>
          </Link>
          <button
            onClick={handleLogout}
            className="text-brown-soft hover:text-brown-dark font-semibold"
          >
            Logout
          </button>
        </div>

        <div className="bg-ivory rounded-xl shadow-lg p-6">
          <h1 className="font-serif text-3xl font-bold text-brown-dark mb-2">Pending Therapist Applications</h1>
          <p className="text-brown-soft mb-6">Review and approve therapist applications.</p>

          {loading && <p className="text-brown-soft">Loading...</p>}
          {error && <p className="text-red-600 mb-4">{error}</p>}
          {!loading && !error && therapists.length === 0 && (
            <p className="text-brown-soft">No pending applications.</p>
          )}

          <div className="space-y-4">
            {therapists.map((therapist) => (
              <div key={therapist.id} className="bg-white border border-sand rounded-lg p-4">
                <h2 className="text-xl font-semibold text-brown-dark">{therapist.full_name}</h2>
                <p className="text-brown-soft text-sm">{therapist.email}</p>
                <div className="mt-3 text-sm text-brown-soft space-y-1">
                  <p><span className="font-semibold text-brown-dark">Phone:</span> {therapist.phone || 'N/A'}</p>
                  <p><span className="font-semibold text-brown-dark">License:</span> {therapist.license_number || 'N/A'}</p>
                  <p><span className="font-semibold text-brown-dark">Experience:</span> {therapist.experience_years ?? 'N/A'} years</p>
                  <p><span className="font-semibold text-brown-dark">Specialties:</span> {therapist.specialties?.join(', ') || 'N/A'}</p>
                  <p><span className="font-semibold text-brown-dark">Session Types:</span> {therapist.session_types?.join(', ') || 'N/A'}</p>
                  <p><span className="font-semibold text-brown-dark">Availability:</span> {therapist.availability?.join(', ') || 'N/A'}</p>
                  <p><span className="font-semibold text-brown-dark">Rate:</span> {therapist.rate_60min ? `₹${therapist.rate_60min}` : 'N/A'}</p>
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => updateStatus(therapist.id, 'approve')}
                    className="bg-green-700 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-800 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateStatus(therapist.id, 'reject')}
                    className="bg-red-700 text-white px-4 py-2 rounded-md font-semibold hover:bg-red-800 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTherapistApprovalsPage;
