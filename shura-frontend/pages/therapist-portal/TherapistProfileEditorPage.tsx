import React, { useEffect, useMemo, useState } from 'react';
import { CheckIcon } from '../../components/Icons';
import { apiFetch } from '../../config/api';

type SessionType = 'video' | 'audio' | 'text';

type TherapistProfile = {
  full_name: string;
  specialization: string;
  experience_years: number;
  specialties: string[];
  session_types: SessionType[];
  rate_60min: number;
  bio: string;
  profile_image_url: string;
  languages: string[];
  gender: string;
  location: string;
};

const EMPTY_PROFILE: TherapistProfile = {
  full_name: '',
  specialization: '',
  experience_years: 0,
  specialties: [],
  session_types: [],
  rate_60min: 0,
  bio: '',
  profile_image_url: '',
  languages: [],
  gender: '',
  location: '',
};

const toCommaSeparated = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

const labelForSessionType: Record<SessionType, string> = {
  video: 'Video',
  audio: 'Audio',
  text: 'Text',
};

const TherapistProfileEditorPage: React.FC = () => {
  const [formData, setFormData] = useState<TherapistProfile>(EMPTY_PROFILE);
  const [specialtiesInput, setSpecialtiesInput] = useState('');
  const [languagesInput, setLanguagesInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await apiFetch('/auth/therapist/profile');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load therapist profile');

        if (isMounted && data.profile) {
          const profile = data.profile as TherapistProfile;
          setFormData({
            ...EMPTY_PROFILE,
            ...profile,
            specialties: Array.isArray(profile.specialties) ? profile.specialties : [],
            session_types: Array.isArray(profile.session_types) ? profile.session_types : [],
            languages: Array.isArray(profile.languages) ? profile.languages : [],
            experience_years: Number(profile.experience_years || 0),
            rate_60min: Number(profile.rate_60min || 0),
          });
          setSpecialtiesInput((profile.specialties || []).join(', '));
          setLanguagesInput((profile.languages || []).join(', '));
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load profile');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const canSave = useMemo(() => formData.full_name.trim().length > 0, [formData.full_name]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'experience_years' || name === 'rate_60min' ? Number(value || 0) : value,
    }));
  };

  const handleSessionTypeToggle = (sessionType: SessionType) => {
    setFormData((prev) => ({
      ...prev,
      session_types: prev.session_types.includes(sessionType)
        ? prev.session_types.filter((value) => value !== sessionType)
        : [...prev.session_types, sessionType],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setIsSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        ...formData,
        specialties: toCommaSeparated(specialtiesInput),
        languages: toCommaSeparated(languagesInput),
      };

      const response = await apiFetch('/auth/therapist/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save profile');

      const profile = data.profile as TherapistProfile;
      setFormData({
        ...EMPTY_PROFILE,
        ...profile,
        specialties: Array.isArray(profile.specialties) ? profile.specialties : [],
        session_types: Array.isArray(profile.session_types) ? profile.session_types : [],
        languages: Array.isArray(profile.languages) ? profile.languages : [],
        experience_years: Number(profile.experience_years || 0),
        rate_60min: Number(profile.rate_60min || 0),
      });
      setSpecialtiesInput((profile.specialties || []).join(', '));
      setLanguagesInput((profile.languages || []).join(', '));
      setMessage('Profile updated successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-brown-dark">Edit Your Profile</h1>
        <p className="text-brown-soft mt-1">This information will be visible to clients on your public profile page.</p>
      </div>

      {isLoading && <p className="text-sm text-brown-soft">Loading your profile...</p>}
      {message && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">{message}</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>}

      <div className="bg-ivory p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-serif font-semibold text-brown-dark border-b border-sand pb-3 mb-4">Personal Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="profile_image_url" className="block text-sm font-medium text-brown-soft">Profile Image URL</label>
            <input id="profile_image_url" name="profile_image_url" type="url" value={formData.profile_image_url} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="full_name" className="block text-sm font-medium text-brown-soft">Full Name</label>
            <input id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" required />
          </div>
          <div>
            <label htmlFor="specialization" className="block text-sm font-medium text-brown-soft">Professional Title</label>
            <input id="specialization" name="specialization" value={formData.specialization} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" />
          </div>
          <div>
            <label htmlFor="experience_years" className="block text-sm font-medium text-brown-soft">Years of Experience</label>
            <input id="experience_years" name="experience_years" type="number" min={0} value={formData.experience_years} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-brown-soft">Gender</label>
            <input id="gender" name="gender" value={formData.gender} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="Female / Male / Other" />
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-brown-soft">Location</label>
            <input id="location" name="location" value={formData.location} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="City or Online" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="bio" className="block text-sm font-medium text-brown-soft">Full Bio</label>
            <textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} rows={6} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" />
          </div>
        </div>
      </div>

      <div className="bg-ivory p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-serif font-semibold text-brown-dark border-b border-sand pb-3 mb-4">Areas of Expertise</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="specialties" className="block text-sm font-medium text-brown-soft">Specialties / Concerns</label>
            <textarea id="specialties" value={specialtiesInput} onChange={(e) => setSpecialtiesInput(e.target.value)} rows={3} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="CBT, Anxiety, Couples Therapy" />
          </div>
          <div>
            <label htmlFor="languages" className="block text-sm font-medium text-brown-soft">Languages</label>
            <textarea id="languages" value={languagesInput} onChange={(e) => setLanguagesInput(e.target.value)} rows={3} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="English, Urdu, Arabic" />
          </div>
        </div>
      </div>

      <div className="bg-ivory p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-serif font-semibold text-brown-dark border-b border-sand pb-3 mb-4">Practice Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-brown-soft mb-2">Session Types</label>
            <div className="flex flex-wrap gap-4">
              {(['video', 'audio', 'text'] as SessionType[]).map((sessionType) => {
                const checked = formData.session_types.includes(sessionType);
                return (
                  <label key={sessionType} className={`flex items-center gap-3 cursor-pointer p-3 border-2 rounded-lg transition-colors bg-white ${checked ? 'border-brown-dark' : 'border-sand hover:border-taupe/50'}`}>
                    <input type="checkbox" checked={checked} onChange={() => handleSessionTypeToggle(sessionType)} className="sr-only" />
                    <div className={`w-6 h-6 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${checked ? 'bg-brown-dark border-brown-dark' : 'bg-white border-taupe'}`}>
                      {checked && <CheckIcon className="w-4 h-4 text-white" />}
                    </div>
                    <span className="font-medium text-brown-dark select-none">{labelForSessionType[sessionType]}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <label htmlFor="rate_60min" className="block text-sm font-medium text-brown-soft">Rate (60 min)</label>
            <input id="rate_60min" name="rate_60min" type="number" min={0} value={formData.rate_60min} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="e.g., 2000" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={!canSave || isSaving || isLoading} className="bg-brown-soft text-white py-3 px-8 rounded-lg font-semibold hover:bg-opacity-90 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default TherapistProfileEditorPage;
