import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon, UserIcon } from '../../components/Icons';

interface IntakeForm {
  id: number;
  user_id: number;
  submitted_at: string;
  email: string;
  full_name: string;
  marital_status: string;
  has_children: string;
  children_details: string;
  living_situation: string;
  religious_practice: string;
  prayer_frequency: string;
  quran_engagement: string;
  community_involvement: string;
  main_concerns: string;
  concern_duration: string;
  concern_severity: number;
  therapy_goals: string;
  mood_symptoms: string[];
  anxiety_symptoms: string[];
  sleep_issues: string[];
  appetite_issues: string[];
  suicidal_thoughts: string;
  suicidal_details: string;
  trauma_history: string[];
  trauma_impact: string;
  relationship_quality: string;
  relationship_difficulties: string[];
  social_support: string;
  physical_health: string;
  medical_conditions: string;
  current_medications: string;
  previous_therapy: string;
  previous_therapy_details: string;
  coping_mechanisms: string[];
  spiritual_connection: string;
  additional_info: string;
}

const TherapistIntakeFormsPage: React.FC = () => {
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchIntakeForms();
  }, []);

  const fetchIntakeForms = async () => {
    try {
      const token = localStorage.getItem('shura-auth-token');
      
      if (!token) {
        setError('You are not logged in. Please login again.');
        setLoading(false);
        return;
      }
      
      console.log('Fetching intake forms with token:', token ? 'exists' : 'missing');
      
      const response = await fetch(`http://localhost:5001/api/therapist/intake/forms`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        setIntakeForms(data.forms || []);
      } else {
        if (response.status === 403 || response.status === 401) {
          setError('Session expired or unauthorized. Please login again as a therapist.');
        } else {
          setError(data.message || data.error || 'Failed to load intake forms');
        }
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Fetch intake forms error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-brown-soft">Loading intake forms...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-bold text-brown-dark mb-2">
          Client Intake Forms
        </h1>
        <p className="text-brown-soft">
          View completed intake forms from your clients
        </p>
      </div>

      {intakeForms.length === 0 ? (
        <div className="bg-cream rounded-lg p-8 text-center">
          <p className="text-brown-soft text-lg">No intake forms submitted yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {intakeForms.map((form) => (
            <div
              key={form.id}
              className="bg-white rounded-lg shadow-sm border border-sand overflow-hidden"
            >
              {/* Header - Always visible */}
              <div
                onClick={() => toggleExpand(form.id)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-cream transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-brown-soft/20 rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-brown-soft" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-brown-dark">
                      {form.full_name}
                    </h3>
                    <p className="text-sm text-brown-soft">{form.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-brown-soft">
                      Submitted {formatDate(form.submitted_at)}
                    </p>
                    <p className="text-xs text-brown-soft/70">
                      Severity: {form.concern_severity}/10
                    </p>
                  </div>
                  {expandedId === form.id ? (
                    <ChevronUpIcon className="w-5 h-5 text-brown-soft" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5 text-brown-soft" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === form.id && (
                <div className="border-t border-sand p-6 bg-cream/30">
                  <div className="space-y-6">
                    {/* Personal & Background Section */}
                    <section>
                      <h4 className="font-semibold text-brown-dark mb-3 text-lg border-b border-brown-soft/20 pb-2">
                        Personal & Background
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border border-brown-soft/20 rounded-lg overflow-hidden">
                          <thead className="bg-brown-soft/10">
                            <tr>
                              <th className="text-left p-3 font-semibold text-brown-dark w-1/3 border-b border-brown-soft/20">Field</th>
                              <th className="text-left p-3 font-semibold text-brown-dark border-b border-brown-soft/20">Response</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            <TableRow label="Marital Status" value={form.marital_status} />
                            <TableRow label="Has Children" value={form.has_children} />
                            {form.children_details && (
                              <TableRow label="Children Details" value={form.children_details} />
                            )}
                            <TableRow label="Living Situation" value={form.living_situation} />
                            <TableRow label="Religious Practice" value={form.religious_practice} />
                            <TableRow label="Prayer Frequency" value={form.prayer_frequency} />
                            <TableRow label="Quran Engagement" value={form.quran_engagement} />
                            <TableRow label="Community Involvement" value={form.community_involvement} />
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* Mental Health & Concerns Section */}
                    <section>
                      <h4 className="font-semibold text-brown-dark mb-3 text-lg border-b border-brown-soft/20 pb-2">
                        Mental Health & Concerns
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border border-brown-soft/20 rounded-lg overflow-hidden">
                          <thead className="bg-brown-soft/10">
                            <tr>
                              <th className="text-left p-3 font-semibold text-brown-dark w-1/3 border-b border-brown-soft/20">Field</th>
                              <th className="text-left p-3 font-semibold text-brown-dark border-b border-brown-soft/20">Response</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            <TableRow label="Main Concerns" value={form.main_concerns} multiline />
                            <TableRow label="Concern Duration" value={form.concern_duration} />
                            <TableRow 
                              label="Severity Level" 
                              value={
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  form.concern_severity >= 8 ? 'bg-red-100 text-red-800' :
                                  form.concern_severity >= 5 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {form.concern_severity}/10
                                </span>
                              } 
                            />
                            <TableRow label="Therapy Goals" value={form.therapy_goals} multiline />
                            {form.mood_symptoms && form.mood_symptoms.length > 0 && (
                              <TableRow label="Mood Symptoms" value={form.mood_symptoms.join(', ')} />
                            )}
                            {form.anxiety_symptoms && form.anxiety_symptoms.length > 0 && (
                              <TableRow label="Anxiety Symptoms" value={form.anxiety_symptoms.join(', ')} />
                            )}
                            {form.sleep_issues && form.sleep_issues.length > 0 && (
                              <TableRow label="Sleep Issues" value={form.sleep_issues.join(', ')} />
                            )}
                            {form.appetite_issues && form.appetite_issues.length > 0 && (
                              <TableRow label="Appetite Issues" value={form.appetite_issues.join(', ')} />
                            )}
                            <TableRow 
                              label="Suicidal Thoughts" 
                              value={form.suicidal_thoughts}
                              className={form.suicidal_thoughts === 'Yes, currently' ? 'bg-red-50' : ''}
                            />
                            {form.suicidal_details && (
                              <TableRow 
                                label="Suicidal Thoughts - Details" 
                                value={form.suicidal_details} 
                                multiline
                                className="bg-red-50"
                              />
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* Health & Support Section */}
                    <section>
                      <h4 className="font-semibold text-brown-dark mb-3 text-lg border-b border-brown-soft/20 pb-2">
                        Health & Support
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border border-brown-soft/20 rounded-lg overflow-hidden">
                          <thead className="bg-brown-soft/10">
                            <tr>
                              <th className="text-left p-3 font-semibold text-brown-dark w-1/3 border-b border-brown-soft/20">Field</th>
                              <th className="text-left p-3 font-semibold text-brown-dark border-b border-brown-soft/20">Response</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {form.trauma_history && form.trauma_history.length > 0 && (
                              <TableRow label="Trauma History" value={form.trauma_history.join(', ')} />
                            )}
                            {form.trauma_impact && (
                              <TableRow label="Trauma Impact" value={form.trauma_impact} multiline />
                            )}
                            <TableRow label="Relationship Quality" value={form.relationship_quality} />
                            <TableRow label="Social Support" value={form.social_support} />
                            {form.relationship_difficulties && form.relationship_difficulties.length > 0 && (
                              <TableRow label="Relationship Difficulties" value={form.relationship_difficulties.join(', ')} />
                            )}
                            <TableRow label="Physical Health" value={form.physical_health} />
                            {form.medical_conditions && (
                              <TableRow label="Medical Conditions" value={form.medical_conditions} multiline />
                            )}
                            {form.current_medications && (
                              <TableRow label="Current Medications" value={form.current_medications} multiline />
                            )}
                            <TableRow label="Previous Therapy" value={form.previous_therapy} />
                            {form.previous_therapy_details && (
                              <TableRow label="Previous Therapy Details" value={form.previous_therapy_details} multiline />
                            )}
                            {form.coping_mechanisms && form.coping_mechanisms.length > 0 && (
                              <TableRow label="Coping Mechanisms" value={form.coping_mechanisms.join(', ')} />
                            )}
                            <TableRow label="Spiritual Connection" value={form.spiritual_connection} multiline />
                            {form.additional_info && (
                              <TableRow label="Additional Information" value={form.additional_info} multiline />
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TableRow: React.FC<{
  label: string;
  value: string | React.ReactNode;
  multiline?: boolean;
  className?: string;
}> = ({ label, value, multiline, className = '' }) => (
  <tr className={`border-b border-brown-soft/10 hover:bg-cream/50 transition-colors ${className}`}>
    <td className="p-3 text-brown-soft font-medium align-top">
      {label}
    </td>
    <td className={`p-3 text-brown-dark ${multiline ? 'whitespace-pre-wrap' : ''} ${!value ? 'text-brown-soft/50 italic' : ''}`}>
      {value || 'Not provided'}
    </td>
  </tr>
);

export default TherapistIntakeFormsPage;
