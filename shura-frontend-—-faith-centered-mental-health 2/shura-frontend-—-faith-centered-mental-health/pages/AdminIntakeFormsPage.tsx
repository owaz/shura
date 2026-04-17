import React, { useState, useEffect } from 'react';
import AdminPortalLayout from '../components/AdminPortalLayout';

interface IntakeForm {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  main_concerns: string;
  concern_severity: string;
  previous_therapy: boolean;
  medication: boolean;
  suicidal_thoughts: boolean;
  submitted_at: string;
}

const AdminIntakeFormsPage: React.FC = () => {
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedForm, setSelectedForm] = useState<IntakeForm | null>(null);

  useEffect(() => {
    fetchIntakeForms();
  }, []);

  const fetchIntakeForms = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:5001/api/admin/intake-forms', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch intake forms');
      }

      const data = await response.json();
      setForms(data.forms || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'severe':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'moderate':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'mild':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <AdminPortalLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brown-soft mx-auto"></div>
          <p className="ml-4 text-brown-soft">Loading intake forms...</p>
        </div>
      </AdminPortalLayout>
    );
  }

  return (
    <AdminPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-ivory rounded-lg shadow-sm p-6 border border-brown-soft/20">
          <h1 className="text-3xl font-bold text-brown-dark mb-2">Intake Forms</h1>
          <p className="text-brown-soft">Review client intake forms and mental health assessments</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-ivory p-6 rounded-lg shadow-sm border border-brown-soft/20">
            <p className="text-sm text-brown-soft mb-1">Total Forms</p>
            <p className="text-3xl font-bold text-brown-dark">{forms.length}</p>
          </div>
          <div className="bg-ivory p-6 rounded-lg shadow-sm border border-brown-soft/20">
            <p className="text-sm text-brown-soft mb-1">Severe Cases</p>
            <p className="text-3xl font-bold text-red-600">
              {forms.filter(f => f.concern_severity.toLowerCase() === 'severe').length}
            </p>
          </div>
          <div className="bg-ivory p-6 rounded-lg shadow-sm border border-brown-soft/20">
            <p className="text-sm text-brown-soft mb-1">Moderate Cases</p>
            <p className="text-3xl font-bold text-orange-600">
              {forms.filter(f => f.concern_severity.toLowerCase() === 'moderate').length}
            </p>
          </div>
          <div className="bg-ivory p-6 rounded-lg shadow-sm border border-brown-soft/20">
            <p className="text-sm text-brown-soft mb-1">Suicidal Thoughts</p>
            <p className="text-3xl font-bold text-red-700">
              {forms.filter(f => f.suicidal_thoughts).length}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Forms Table */}
        <div className="bg-ivory rounded-lg shadow-sm overflow-hidden border border-brown-soft/20">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sand border-b border-brown-soft/20">
                <tr>
                  <th className="text-left p-4 text-brown-dark font-semibold">Client</th>
                  <th className="text-left p-4 text-brown-dark font-semibold">Severity</th>
                  <th className="text-left p-4 text-brown-dark font-semibold">Main Concerns</th>
                  <th className="text-left p-4 text-brown-dark font-semibold">Alerts</th>
                  <th className="text-left p-4 text-brown-dark font-semibold">Submitted</th>
                  <th className="text-left p-4 text-brown-dark font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-brown-soft">
                      No intake forms submitted yet
                    </td>
                  </tr>
                ) : (
                  forms.map((form) => (
                    <tr key={form.id} className="border-b border-brown-soft/10 hover:bg-sand/50 transition">
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-brown-dark">{form.user_name}</p>
                          <p className="text-sm text-brown-soft">{form.user_email}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(form.concern_severity)}`}>
                          {form.concern_severity}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-brown-dark truncate max-w-xs">
                          {form.main_concerns}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col space-y-1">
                          {form.suicidal_thoughts && (
                            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded border border-red-200">
                              ⚠️ Suicidal Thoughts
                            </span>
                          )}
                          {form.medication && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded border border-blue-200">
                              💊 On Medication
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-brown-soft">
                        {formatDate(form.submitted_at)}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setSelectedForm(form)}
                          className="text-brown-soft hover:text-brown-dark font-medium transition"
                        >
                          View Details
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

      {/* Detail Modal */}
      {selectedForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ivory rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-brown-soft to-brown-dark p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Intake Form Details</h2>
              <button
                onClick={() => setSelectedForm(null)}
                className="text-white hover:text-beige-light transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Client Info */}
              <div className="bg-sand p-4 rounded-lg border border-brown-soft/20">
                <h3 className="font-semibold text-brown-dark mb-3">Client Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-brown-soft">Name</p>
                    <p className="font-medium text-brown-dark">{selectedForm.user_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-brown-soft">Email</p>
                    <p className="font-medium text-brown-dark">{selectedForm.user_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-brown-soft">Severity Level</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(selectedForm.concern_severity)}`}>
                      {selectedForm.concern_severity}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-brown-soft">Submitted</p>
                    <p className="font-medium text-brown-dark">{formatDate(selectedForm.submitted_at)}</p>
                  </div>
                </div>
              </div>

              {/* Main Concerns */}
              <div>
                <h3 className="font-semibold text-brown-dark mb-2">Main Concerns</h3>
                <p className="text-brown-dark bg-sand p-4 rounded-lg border border-brown-soft/20">
                  {selectedForm.main_concerns}
                </p>
              </div>

              {/* Risk Factors */}
              <div>
                <h3 className="font-semibold text-brown-dark mb-3">Risk Assessment</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-sand rounded-lg border border-brown-soft/20">
                    <span className="text-brown-dark">Suicidal Thoughts</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedForm.suicidal_thoughts ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                      {selectedForm.suicidal_thoughts ? 'Yes - Urgent' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-sand rounded-lg border border-brown-soft/20">
                    <span className="text-brown-dark">Previous Therapy</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedForm.previous_therapy ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                      {selectedForm.previous_therapy ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-sand rounded-lg border border-brown-soft/20">
                    <span className="text-brown-dark">Currently on Medication</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedForm.medication ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                      {selectedForm.medication ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4 border-t border-brown-soft/20">
                <button
                  onClick={() => setSelectedForm(null)}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-brown-soft to-brown-dark text-white rounded-lg hover:from-brown-dark hover:to-brown-soft transition font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminPortalLayout>
  );
};

export default AdminIntakeFormsPage;
