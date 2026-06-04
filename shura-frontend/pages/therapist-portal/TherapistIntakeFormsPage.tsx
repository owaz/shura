import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon, UserIcon } from '../../components/Icons';
import { apiFetch } from '../../config/api';

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
      const storedUser = localStorage.getItem('shura-current-user');
      const therapistId = storedUser ? JSON.parse(storedUser).id : null;

      if (!therapistId) {
        setError('Therapist session not found. Please log in again.');
        return;
      }

      const response = await apiFetch(`/intake/therapist/${therapistId}`);
      const data = await response.json();

      if (response.ok) {
        setIntakeForms(data.intakeForms);
      } else {
        setError(data.message || 'Failed to load intake forms');
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
                    {/* Personal & Background */}
                    <section>
                      <h4 className="font-semibold text-brown-dark mb-3 text-lg">
                        Personal & Background
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoItem label="Marital Status" value={form.marital_status} />
                        <InfoItem label="Has Children" value={form.has_children} />
                        {form.children_details && (
                          <InfoItem label="Children Details" value={form.children_details} fullWidth />
                        )}
                        <InfoItem label="Living Situation" value={form.living_situation} />
                        <InfoItem label="Religious Practice" value={form.religious_practice} />
                        <InfoItem label="Prayer Frequency" value={form.prayer_frequency} />
                        <InfoItem label="Quran Engagement" value={form.quran_engagement} />
                        <InfoItem label="Community Involvement" value={form.community_involvement} />
                      </div>
                    </section>

                    {/* Mental Health & Concerns */}
                    <section>
                      <h4 className="font-semibold text-brown-dark mb-3 text-lg">
                        Mental Health & Concerns
                      </h4>
                      <div className="space-y-4">
                        <InfoItem label="Main Concerns" value={form.main_concerns} fullWidth multiline />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <InfoItem label="Duration" value={form.concern_duration} />
                          <InfoItem label="Severity" value={`${form.concern_severity}/10`} />
                        </div>
                        <InfoItem label="Therapy Goals" value={form.therapy_goals} fullWidth multiline />
                        {form.mood_symptoms && form.mood_symptoms.length > 0 && (
                          <InfoItem label="Mood Symptoms" value={form.mood_symptoms.join(', ')} fullWidth />
                        )}
                        {form.anxiety_symptoms && form.anxiety_symptoms.length > 0 && (
                          <InfoItem label="Anxiety Symptoms" value={form.anxiety_symptoms.join(', ')} fullWidth />
                        )}
                        {form.sleep_issues && form.sleep_issues.length > 0 && (
                          <InfoItem label="Sleep Issues" value={form.sleep_issues.join(', ')} fullWidth />
                        )}
                        {form.appetite_issues && form.appetite_issues.length > 0 && (
                          <InfoItem label="Appetite Issues" value={form.appetite_issues.join(', ')} fullWidth />
                        )}
                        <div className={form.suicidal_thoughts === 'Yes, currently' ? 'bg-red-50 p-4 rounded-lg border border-red-200' : ''}>
                          <InfoItem label="Suicidal Thoughts" value={form.suicidal_thoughts} />
                          {form.suicidal_details && (
                            <InfoItem label="Details" value={form.suicidal_details} fullWidth multiline />
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Health & Support */}
                    <section>
                      <h4 className="font-semibold text-brown-dark mb-3 text-lg">
                        Health & Support
                      </h4>
                      <div className="space-y-4">
                        {form.trauma_history && form.trauma_history.length > 0 && (
                          <InfoItem label="Trauma History" value={form.trauma_history.join(', ')} fullWidth />
                        )}
                        {form.trauma_impact && (
                          <InfoItem label="Trauma Impact" value={form.trauma_impact} fullWidth multiline />
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <InfoItem label="Relationship Quality" value={form.relationship_quality} />
                          <InfoItem label="Social Support" value={form.social_support} />
                        </div>
                        {form.relationship_difficulties && form.relationship_difficulties.length > 0 && (
                          <InfoItem label="Relationship Difficulties" value={form.relationship_difficulties.join(', ')} fullWidth />
                        )}
                        <InfoItem label="Physical Health" value={form.physical_health} fullWidth />
                        {form.medical_conditions && (
                          <InfoItem label="Medical Conditions" value={form.medical_conditions} fullWidth multiline />
                        )}
                        {form.current_medications && (
                          <InfoItem label="Current Medications" value={form.current_medications} fullWidth multiline />
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <InfoItem label="Previous Therapy" value={form.previous_therapy} />
                        </div>
                        {form.previous_therapy_details && (
                          <InfoItem label="Previous Therapy Details" value={form.previous_therapy_details} fullWidth multiline />
                        )}
                        {form.coping_mechanisms && form.coping_mechanisms.length > 0 && (
                          <InfoItem label="Coping Mechanisms" value={form.coping_mechanisms.join(', ')} fullWidth />
                        )}
                        <InfoItem label="Spiritual Connection" value={form.spiritual_connection} fullWidth multiline />
                        {form.additional_info && (
                          <InfoItem label="Additional Information" value={form.additional_info} fullWidth multiline />
                        )}
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

const InfoItem: React.FC<{
  label: string;
  value: string;
  fullWidth?: boolean;
  multiline?: boolean;
}> = ({ label, value, fullWidth, multiline }) => (
  <div className={fullWidth ? 'col-span-full' : ''}>
    <label className="text-sm font-medium text-brown-soft block mb-1">
      {label}
    </label>
    <div className={`text-brown-dark ${multiline ? 'whitespace-pre-wrap' : ''} ${!value ? 'text-brown-soft/50 italic' : ''}`}>
      {value || 'Not provided'}
    </div>
  </div>
);

export default TherapistIntakeFormsPage;
