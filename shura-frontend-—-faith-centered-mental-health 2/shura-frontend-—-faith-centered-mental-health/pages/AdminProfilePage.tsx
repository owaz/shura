import React, { useEffect, useState } from 'react';
import AdminPortalLayout from '../components/AdminPortalLayout';

interface AdminProfile {
  id: number;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
}

const AdminProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5001/api/admin/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data);
      setFormData({ full_name: data.full_name, phone: data.phone || '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5001/api/admin/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      setProfile(data);
      setEditing(false);
      setSuccess('Profile updated successfully!');
      
      // Update stored admin info
      const storedAdmin = localStorage.getItem('adminUser');
      if (storedAdmin) {
        const adminData = JSON.parse(storedAdmin);
        localStorage.setItem('adminUser', JSON.stringify({ ...adminData, ...data }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({ full_name: profile.full_name, phone: profile.phone || '' });
    }
    setEditing(false);
    setError('');
  };

  if (loading) {
    return (
      <AdminPortalLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brown-soft mx-auto"></div>
          <p className="mt-4 text-brown-soft">Loading profile...</p>
        </div>
      </AdminPortalLayout>
    );
  }

  return (
    <AdminPortalLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-ivory rounded-lg shadow-sm p-6 border border-brown-soft/20">
          <h1 className="text-3xl font-bold text-brown-dark mb-2">Admin Profile</h1>
          <p className="text-brown-soft">View and manage your account information</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-600">{success}</p>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-ivory rounded-lg shadow-sm overflow-hidden border border-brown-soft/20">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-brown-soft to-brown-dark px-6 py-8">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-brown-dark">
                {profile?.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="text-white">
                <h2 className="text-2xl font-bold">{profile?.full_name}</h2>
                <p className="text-beige-light">{profile?.role?.replace('_', ' ').toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-brown-dark mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-brown-soft/30 rounded-lg bg-beige-light text-brown-soft cursor-not-allowed"
                />
                <p className="text-xs text-brown-soft mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-brown-dark mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editing ? formData.full_name : profile?.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  disabled={!editing}
                  className={`w-full px-4 py-2 border border-brown-soft/30 rounded-lg ${
                    editing ? 'focus:ring-2 focus:ring-brown-soft' : 'bg-beige-light cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brown-dark mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editing ? formData.phone : profile?.phone || 'Not provided'}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!editing}
                  className={`w-full px-4 py-2 border border-brown-soft/30 rounded-lg ${
                    editing ? 'focus:ring-2 focus:ring-brown-soft' : 'bg-beige-light cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brown-dark mb-2">
                  Member Since
                </label>
                <input
                  type="text"
                  value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ''}
                  disabled
                  className="w-full px-4 py-2 border border-brown-soft/30 rounded-lg bg-beige-light text-brown-soft cursor-not-allowed"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-4 border-t border-brown-soft/20">
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="px-6 py-2 bg-gradient-to-r from-brown-soft to-brown-dark text-white rounded-lg hover:from-brown-dark hover:to-brown-soft transition"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-gradient-to-r from-brown-soft to-brown-dark text-white rounded-lg hover:from-brown-dark hover:to-brown-soft transition disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-6 py-2 bg-beige text-brown-dark rounded-lg hover:bg-beige-light transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-cream border border-brown-soft/30 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <svg className="w-6 h-6 text-brown-dark mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold text-brown-dark mb-1">Account Security</h3>
              <p className="text-sm text-brown-soft">
                To change your password or modify security settings, please contact the system administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminPortalLayout>
  );
};

export default AdminProfilePage;
