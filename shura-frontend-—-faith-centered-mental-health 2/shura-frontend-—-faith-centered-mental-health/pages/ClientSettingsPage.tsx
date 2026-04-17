import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config/api';
import { Watermark } from '../components/Watermark';

interface UserSettings {
  display_name: string;
  bio: string;
  profile_picture: string;
  spiritual_integration: number;
  preferred_language: string;
  focus_areas: string[];
  timezone: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  email: string;
}

const ClientSettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'account'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<UserSettings>({
    display_name: 'Assalamualaikum User',
    bio: 'I am seeking support for personal growth and spiritual alignment.',
    profile_picture: 'https://randomuser.me/api/portraits/women/1.jpg',
    spiritual_integration: 7,
    preferred_language: 'English',
    focus_areas: ['Personal Growth', 'Anxiety Management'],
    timezone: 'Asia/Karachi',
    email_notifications: true,
    sms_notifications: false,
    email: currentUser?.email || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const focusAreaOptions = ['Youth Guidance', 'Marriage & Relationships', 'General Mental Health', 'Anxiety Management', 'Depression Support', 'Personal Growth', 'Family Issues', 'Career Guidance'];
  const languageOptions = ['English', 'Urdu', 'Arabic', 'Hindi', 'Spanish'];
  const timezoneOptions = ['Asia/Karachi', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'Asia/Singapore'];

  const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSettings(prev => ({
          ...prev,
          profile_picture: event.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
      setMessage('Profile picture updated successfully!');
    }
  };

  const handleSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const token = localStorage.getItem('shura-auth-token');
      const response = await fetch(`${config.apiUrl}/api/auth/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      setMessage('Settings updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('shura-auth-token');
      const response = await fetch(`${config.apiUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to change password');
      }

      setMessage('Password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleFocusArea = (area: string) => {
    setSettings(prev => ({
      ...prev,
      focus_areas: prev.focus_areas.includes(area)
        ? prev.focus_areas.filter(a => a !== area)
        : [...prev.focus_areas, area]
    }));
  };

  return (
    <>
      <Watermark />
      <div className="min-h-screen bg-[#F3E9DC] relative z-10">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <h1 className="text-3xl font-bold text-[#5C5043] font-serif">My Dashboard</h1>
            <p className="text-[#8D7B68] mt-1">Manage your profile, preferences, and account settings</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 px-2 font-semibold border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-[#b4845c] text-[#5C5043]'
                    : 'border-transparent text-[#8D7B68] hover:text-[#5C5043]'
                }`}
              >
                Personal Profile
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`py-4 px-2 font-semibold border-b-2 transition-colors ${
                  activeTab === 'preferences'
                    ? 'border-[#b4845c] text-[#5C5043]'
                    : 'border-transparent text-[#8D7B68] hover:text-[#5C5043]'
                }`}
              >
                Consultation Preferences
              </button>
              <button
                onClick={() => setActiveTab('account')}
                className={`py-4 px-2 font-semibold border-b-2 transition-colors ${
                  activeTab === 'account'
                    ? 'border-[#b4845c] text-[#5C5043]'
                    : 'border-transparent text-[#8D7B68] hover:text-[#5C5043]'
                }`}
              >
                Account & Privacy
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* Messages */}
          {message && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          {/* Tab 1: Personal Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSettingsUpdate} className="space-y-8">
              {/* Profile Picture */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Profile Picture</h2>
                <div className="flex items-center gap-8">
                  <div className="relative">
                    <img
                      src={settings.profile_picture}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-4 border-[#b4845c]"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 bg-[#b4845c] text-white rounded-full p-2 hover:bg-[#8D7B68] transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureUpload}
                    className="hidden"
                  />
                  <div>
                    <p className="text-[#8D7B68] text-sm">Click the + button to upload a new picture</p>
                    <p className="text-[#8D7B68] text-xs mt-1">Recommended: Square image, JPG or PNG, max 5MB</p>
                  </div>
                </div>
              </div>

              {/* Display Name */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Display Name</h2>
                <p className="text-[#8D7B68] text-sm mb-3">This is the name your therapist will see during sessions</p>
                <input
                  type="text"
                  value={settings.display_name}
                  onChange={(e) => setSettings(prev => ({ ...prev, display_name: e.target.value }))}
                  className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#b4845c]"
                  placeholder="Your Display Name"
                />
              </div>

              {/* Bio/Context */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-[#5C5043] mb-4">About You</h2>
                <p className="text-[#8D7B68] text-sm mb-3">Share your background or what you're looking for in therapy</p>
                <textarea
                  value={settings.bio}
                  onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#b4845c]"
                  rows={4}
                  placeholder="Tell us about yourself..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-[#b4845c] text-white rounded-lg font-semibold hover:bg-[#8D7B68] transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          )}

          {/* Tab 2: Consultation Preferences */}
          {activeTab === 'preferences' && (
            <form onSubmit={handleSettingsUpdate} className="space-y-8">
              {/* Spiritual Integration Level */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Spiritual Integration Level</h2>
                <p className="text-[#8D7B68] text-sm mb-4">How much would you like Islamic principles incorporated into your sessions?</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8D7B68]">Minimal</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={settings.spiritual_integration}
                      onChange={(e) => setSettings(prev => ({ ...prev, spiritual_integration: parseInt(e.target.value) }))}
                      className="w-full max-w-xs mx-4"
                    />
                    <span className="text-[#8D7B68]">Fully Integrated</span>
                  </div>
                  <p className="text-center text-[#b4845c] font-semibold">Level {settings.spiritual_integration}/10</p>
                </div>
              </div>

              {/* Preferred Language */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Preferred Language</h2>
                <p className="text-[#8D7B68] text-sm mb-3">We'll match you with a therapist who speaks this language</p>
                <select
                  value={settings.preferred_language}
                  onChange={(e) => setSettings(prev => ({ ...prev, preferred_language: e.target.value }))}
                  className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#b4845c]"
                >
                  {languageOptions.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              {/* Focus Areas */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Focus Areas</h2>
                <p className="text-[#8D7B68] text-sm mb-4">Select the topics you'd like to explore in therapy</p>
                <div className="grid grid-cols-2 gap-3">
                  {focusAreaOptions.map(area => (
                    <label key={area} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.focus_areas.includes(area)}
                        onChange={() => toggleFocusArea(area)}
                        className="w-4 h-4 accent-[#b4845c]"
                      />
                      <span className="text-[#5C5043]">{area}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-[#b4845c] text-white rounded-lg font-semibold hover:bg-[#8D7B68] transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Preferences'}
              </button>
            </form>
          )}

          {/* Tab 3: Account & Privacy */}
          {activeTab === 'account' && (
            <div className="space-y-8">
              {/* Email */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Email Address</h2>
                <input
                  type="email"
                  value={settings.email}
                  disabled
                  className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-[#8D7B68]"
                />
                <p className="text-[#8D7B68] text-sm mt-2">Contact support to change your email</p>
              </div>

              {/* Change Password */}
              <form onSubmit={handlePasswordChange} className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Change Password</h2>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-[#5C5043] font-medium text-sm mb-2">Current Password</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#b4845c]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[#5C5043] font-medium text-sm mb-2">New Password</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#b4845c]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[#5C5043] font-medium text-sm mb-2">Confirm Password</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#b4845c]"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-[#b4845c] text-white rounded-lg font-semibold hover:bg-[#8D7B68] transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>

              {/* Timezone */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Timezone</h2>
                <p className="text-[#8D7B68] text-sm mb-3">Ensures your booking times are accurate</p>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#b4845c]"
                >
                  {timezoneOptions.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              {/* Notifications */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Notifications</h2>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.email_notifications}
                      onChange={(e) => setSettings(prev => ({ ...prev, email_notifications: e.target.checked }))}
                      className="w-4 h-4 accent-[#b4845c]"
                    />
                    <span className="text-[#5C5043]">Email reminders for upcoming sessions</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.sms_notifications}
                      onChange={(e) => setSettings(prev => ({ ...prev, sms_notifications: e.target.checked }))}
                      className="w-4 h-4 accent-[#b4845c]"
                    />
                    <span className="text-[#5C5043]">SMS reminders for upcoming sessions</span>
                  </label>
                </div>
              </div>

              <button
                onClick={handleSettingsUpdate}
                disabled={loading}
                className="px-6 py-2 bg-[#b4845c] text-white rounded-lg font-semibold hover:bg-[#8D7B68] transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ClientSettingsPage;
