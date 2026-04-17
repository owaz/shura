import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon } from '../components/Icons';
import { Link } from 'react-router-dom';
import AdminPortalLayout from '../components/AdminPortalLayout';

interface Client {
  id: number;
  full_name: string;
  email: string;
  created_at: string;
  intake_forms_count: number;
  assigned_therapists_count: number;
}

interface Therapist {
  id: number;
  full_name: string;
  email: string;
  specialties: string[];
  status: string;
  assigned_clients_count: number;
}

interface Assignment {
  id: number;
  client_id: number;
  client_name: string;
  client_email: string;
  therapist_id: number;
  therapist_name: string;
  therapist_email: string;
  therapist_specialties: string[];
  assigned_at: string;
  status: string;
  assignment_source: string;
}

const AdminClientAssignmentPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Use the admin token for all admin endpoints; client tokens will 401 because requireAdmin enforces role/type admin.
      const token = localStorage.getItem('adminToken');

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        setError('You must be logged in as admin. Please log in again.');
        setLoading(false);
        return;
      }

      // Fetch clients, therapists, and assignments in parallel
      const [clientsRes, therapistsRes, assignmentsRes] = await Promise.all([
        fetch('http://localhost:5001/api/admin/clients', { headers }),
        fetch('http://localhost:5001/api/admin/therapists', { headers }),
        fetch('http://localhost:5001/api/admin/assignments', { headers })
      ]);

      if (!clientsRes.ok || !therapistsRes.ok || !assignmentsRes.ok) {
        throw new Error('Failed to fetch data (admin auth required)');
      }

      const [clientsData, therapistsData, assignmentsData] = await Promise.all([
        clientsRes.json(),
        therapistsRes.json(),
        assignmentsRes.json()
      ]);

      setClients(clientsData.clients || []);
      setTherapists(therapistsData.therapists || []);
      setAssignments(assignmentsData.assignments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (assignmentId: number) => {
    if (!confirm('Are you sure you want to remove this match? The client and therapist will no longer be connected.')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('adminToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        setError('You must be logged in as admin. Please log in again.');
        return;
      }
      
      const response = await fetch(`http://localhost:5001/api/admin/assign/${assignmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unassign client');
      }

      setSuccess('Match removed successfully!');
      
      // Refresh data
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove match');
    }
  };

  if (loading) {
    return (
      <AdminPortalLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-center text-brown-soft">Loading...</p>
        </div>
      </AdminPortalLayout>
    );
  }

  return (
    <AdminPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-brown-dark">Client-Therapist Matches</h1>
          <p className="text-brown-soft mt-2">View automatically matched client-therapist pairs based on intake assessments</p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-ivory p-6 rounded-xl shadow-sm">
            <h3 className="text-sm font-semibold text-taupe">Total Clients</h3>
            <p className="text-3xl font-bold text-brown-dark mt-1">{clients.length}</p>
            <p className="text-xs text-brown-soft mt-1">Registered users</p>
          </div>
          <div className="bg-ivory p-6 rounded-xl shadow-sm">
            <h3 className="text-sm font-semibold text-taupe">Active Therapists</h3>
            <p className="text-3xl font-bold text-brown-dark mt-1">{therapists.length}</p>
            <p className="text-xs text-brown-soft mt-1">Approved therapists</p>
          </div>
          <div className="bg-ivory p-6 rounded-xl shadow-sm">
            <h3 className="text-sm font-semibold text-taupe">Matched Pairs</h3>
            <p className="text-3xl font-bold text-brown-dark mt-1">{assignments.length}</p>
            <p className="text-xs text-brown-soft mt-1">Auto-matched by system</p>
          </div>
        </div>

        {/* Matched Pairs Table */}
        <div className="bg-ivory rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-sand">
            <h2 className="text-xl font-serif font-semibold text-brown-dark">Matched Client-Therapist Pairs</h2>
            <p className="text-sm text-brown-soft mt-1">Automatically matched based on client intake assessments and therapist specialties</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sand">
                <tr>
                  <th className="text-left p-4 text-brown-soft font-semibold">Client</th>
                  <th className="text-left p-4 text-brown-soft font-semibold">Therapist</th>
                  <th className="text-left p-4 text-brown-soft font-semibold">Specialties</th>
                  <th className="text-left p-4 text-brown-soft font-semibold">Matched Date</th>
                  <th className="text-left p-4 text-brown-soft font-semibold">Match Source</th>
                  <th className="text-left p-4 text-brown-soft font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-brown-soft">
                      No matches yet. Clients will be automatically matched with therapists after completing their intake assessment.
                    </td>
                  </tr>
                ) : (
                  assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-sand hover:bg-cream/50">
                      <td className="p-4">
                        <div>
                          <p className="font-semibold text-brown-dark">{assignment.client_name}</p>
                          <p className="text-sm text-brown-soft">{assignment.client_email}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-semibold text-brown-dark">{assignment.therapist_name}</p>
                          <p className="text-sm text-brown-soft">{assignment.therapist_email}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {assignment.therapist_specialties && assignment.therapist_specialties.length > 0 ? (
                            assignment.therapist_specialties.slice(0, 2).map((specialty, idx) => (
                              <span key={idx} className="text-xs bg-sand text-brown-soft px-2 py-1 rounded-full">
                                {specialty}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-brown-soft italic">No specialties listed</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-brown-dark">
                        {new Date(assignment.assigned_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          assignment.assignment_source === 'auto' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {assignment.assignment_source === 'auto' ? '🤖 Auto-Matched' : '📋 Intake Form'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleUnassign(assignment.id)}
                          className="text-red-600 hover:text-red-800 font-semibold text-sm"
                        >
                          Remove Match
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminPortalLayout>
  );
};

export default AdminClientAssignmentPage;
