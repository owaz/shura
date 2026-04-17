

import React, { useState, useEffect, useRef } from 'react';
import { mockTherapists } from '../data/therapists';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config/api';

interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  dob?: string;
  created_at: string;
}


const ClientProfilePage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    dob: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Demo: 2FA enabled state
  const [twoFAEnabled, setTwoFAEnabled] = useState(true);

  // Reflection modal state
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [reflectionText, setReflectionText] = useState("");

  // Join session state (move to top level to fix Rules of Hooks)
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [videoToken, setVideoToken] = useState<string|null>(null);

  // Scroll animation
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set());
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Settings tab state
  const [activeSettingsTab, setActiveSettingsTab] = useState<'dashboard' | 'profile' | 'preferences' | 'account'>('dashboard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load initial settings from localStorage or use defaults
  const getInitialSettings = () => {
    const savedSettings = localStorage.getItem('shura-profile-settings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (e) {
        console.log('Failed to parse saved settings');
      }
    }
    return {
      display_name: 'Assalamualaikum User',
      bio: 'I am seeking support for personal growth and spiritual alignment.',
      profile_picture: 'https://randomuser.me/api/portraits/women/1.jpg',
      spiritual_integration: 7,
      preferred_language: 'English',
      focus_areas: ['Personal Growth', 'Anxiety Management'],
      timezone: 'Asia/Kolkata',
      email_notifications: true,
      sms_notifications: false,
    };
  };

  const [settings, setSettings] = useState(getInitialSettings());
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Custom dropdown states
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [timezoneDropdownOpen, setTimezoneDropdownOpen] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const timezoneDropdownRef = useRef<HTMLDivElement>(null);

  // Session modal state
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionModalMessage, setSessionModalMessage] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setLanguageDropdownOpen(false);
      }
      if (timezoneDropdownRef.current && !timezoneDropdownRef.current.contains(event.target as Node)) {
        setTimezoneDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const currentRefs = sectionRefs.current.filter(ref => ref !== null);
    if (currentRefs.length === 0) return;

    const observers = currentRefs.map((ref, index) => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleSections((prev) => new Set(prev).add(index));
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
      );
      observer.observe(ref);
      return observer;
    });

    return () => {
      observers.forEach((observer) => observer?.disconnect());
    };
  }, [profile]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('shura-auth-token');
      if (!token) throw new Error('No auth token found. Please log in again.');
      const response = await fetch(`${config.apiUrl}/api/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data.user);
      setFormData({
        full_name: data.user.full_name || '',
        email: data.user.email || '',
        phone: data.user.phone || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Update settings with profile data
      setSettings(prev => ({
        ...prev,
        display_name: data.user.display_name || prev.display_name,
        bio: data.user.bio || prev.bio,
        profile_picture: data.user.profile_picture || prev.profile_picture,
        spiritual_integration: data.user.spiritual_integration || prev.spiritual_integration,
        preferred_language: data.user.preferred_language || prev.preferred_language,
        timezone: data.user.timezone || prev.timezone,
        focus_areas: data.user.focus_areas || prev.focus_areas,
        email_notifications: data.user.email_notifications !== undefined ? data.user.email_notifications : prev.email_notifications,
        sms_notifications: data.user.sms_notifications !== undefined ? data.user.sms_notifications : prev.sms_notifications,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Auto-save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('shura-profile-settings', JSON.stringify(settings));
  }, [settings]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    // Validate passwords if user wants to change them
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        setError('Current password is required to set a new password');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('New passwords do not match');
        return;
      }
      if (formData.newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }
    }

    try {
      const token = localStorage.getItem('shura-auth-token');
      const updateData: any = {
        full_name: formData.full_name,
        phone: formData.phone
      };

      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await fetch(`${config.apiUrl}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      const data = await response.json();
      setProfile(data.user);
      setMessage('Profile updated successfully!');
      setEditing(false);
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-white to-cream flex items-center justify-center">
        <div className="text-brown-dark text-xl font-semibold animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-white to-cream flex items-center justify-center">
        <div className="text-brown-dark text-xl font-semibold">Profile not found</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .animate-section {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .animate-section.visible {
          opacity: 1;
          transform: translateY(0);
        }
        /* Custom dropdown styling */
        select option {
          background-color: #F5F1ED !important;
          color: #5C5043 !important;
          padding: 12px;
        }
        select option:hover {
          background-color: #E6DED4 !important;
        }
        select option:checked {
          background-color: #b4845c !important;
          color: white !important;
        }
      `}</style>
      <div className="min-h-screen bg-[#F3E9DC] relative">
      {/* Watermark */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none select-none z-0">
        <img 
          src="https://res.cloudinary.com/dyqspp2ud/image/upload/e_background_removal/v1762852351/grey_shura_logo_cdrwgs.png"
          alt="Shura Logo Watermark"
          className="opacity-5"
          style={{width: '400px', height: '400px', objectFit: 'contain'}}
        />
      </div>
      <div className="relative max-w-6xl mx-auto px-6 py-12 z-10">

        {/* Session Modal */}
        {sessionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-2xl p-8 shadow-lg w-full max-w-md text-center">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full bg-[#b4845c] flex items-center justify-center mx-auto mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-[#5C5043] mb-3">{sessionModalMessage}</h2>
                <p className="text-[#8D7B68] mb-6">Please wait for the session to start at the scheduled time.</p>
              </div>
              <button
                onClick={() => setSessionModalOpen(false)}
                style={{
                  background: 'linear-gradient(135deg, #b4845c 0%, #e2b07a 40%, #c49a6c 60%, #a97c50 100%)',
                  color: 'white',
                }}
                className="w-full py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#5C5043] font-serif">My Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#b4845c] flex items-center justify-center border-4 border-white shadow-lg">
              {/* Avatar placeholder, exclude face */}
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff" className="inline-block"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 16-4 16 0" /></svg>
            </div>
            <div>
              <div className="font-semibold text-[#5C5043]">Assalamualaikum</div>
              <div className="text-xs text-[#8D7B68]">Member Since January 19, 2026</div>
            </div>
          </div>
          {/* Removed Back to Dashboard button */}
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-t-lg shadow-sm mb-0">
          <div className="flex gap-8 border-b border-gray-200">
            <button
              onClick={() => setActiveSettingsTab('dashboard')}
              className={`py-4 px-2 font-semibold border-b-2 transition-colors ${
                activeSettingsTab === 'dashboard'
                  ? 'border-[#b4845c] text-[#5C5043]'
                  : 'border-transparent text-[#8D7B68] hover:text-[#5C5043]'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveSettingsTab('profile')}
              className={`py-4 px-2 font-semibold border-b-2 transition-colors ${
                activeSettingsTab === 'profile'
                  ? 'border-[#b4845c] text-[#5C5043]'
                  : 'border-transparent text-[#8D7B68] hover:text-[#5C5043]'
              }`}
            >
              Personal Profile
            </button>
            <button
              onClick={() => setActiveSettingsTab('preferences')}
              className={`py-4 px-2 font-semibold border-b-2 transition-colors ${
                activeSettingsTab === 'preferences'
                  ? 'border-[#b4845c] text-[#5C5043]'
                  : 'border-transparent text-[#8D7B68] hover:text-[#5C5043]'
              }`}
            >
              Consultation Preferences
            </button>
            <button
              onClick={() => setActiveSettingsTab('account')}
              className={`py-4 px-2 font-semibold border-b-2 transition-colors ${
                activeSettingsTab === 'account'
                  ? 'border-[#b4845c] text-[#5C5043]'
                  : 'border-transparent text-[#8D7B68] hover:text-[#5C5043]'
              }`}
            >
              Account & Privacy
            </button>
          </div>
        </div>

        {/* Content - Dashboard Tab */}
        {activeSettingsTab === 'dashboard' && (
        <div className="bg-[#FAF7F3] rounded-b-lg shadow min-h-screen">
          <div className="p-8 flex justify-center pb-16">
        {/* Main centered column */}
        <div className="w-full max-w-2xl flex flex-col gap-8">
            {/* Care Journey */}
            <div ref={(el) => (sectionRefs.current[0] = el)} className={`bg-white rounded-2xl shadow p-6 animate-section ${visibleSections.has(0) ? 'visible' : ''}`}>
              <div className="font-semibold text-[#5C5043] mb-2 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#C5A059" className="inline-block"><path d="M12 2l2.09 6.26L20 9.27l-5 3.64L16.18 20 12 16.77 7.82 20 9 12.91l-5-3.64 5.91-.01z"/></svg>
                Your Care Journey
              </div>
              {/* --- Session Time Logic --- */}
              {(() => {
                // TODO: Replace with real session data from backend
                const sessionId = 1; // Demo sessionId
                const sessionDate = new Date('2026-01-25T14:00:00');
                const now = new Date();
                // Allow joining 10 minutes before and up to 1 hour after start
                const joinWindowStart = new Date(sessionDate.getTime() - 10 * 60 * 1000);
                const joinWindowEnd = new Date(sessionDate.getTime() + 60 * 60 * 1000);
                const isLive = now >= joinWindowStart && now <= joinWindowEnd;
                // Demo: use first therapist from mockTherapists
                const therapist = mockTherapists[0];
                const therapistPhotoUrl = therapist?.imageUrl;

                const handleJoinSession = async () => {
                  setJoinError('');
                  setJoinLoading(true);
                  try {
                    const token = localStorage.getItem('shura-auth-token');
                    const response = await fetch(`${config.apiUrl}/api/calls/join`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ sessionId })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to join session');
                    setVideoToken(data.videoToken);
                    setSessionModalMessage('Session not yet started');
                    setSessionModalOpen(true);
                    // navigate('/session'); // Uncomment when session page is ready
                  } catch (err: any) {
                    setJoinError(err.message || 'Failed to join session');
                  } finally {
                    setJoinLoading(false);
                  }
                };

                return (
                  <div className="bg-[#D4C4B0] rounded-xl p-6 flex flex-col items-center text-center mb-4">
                    <div className="text-[#4d3c2f] font-semibold text-lg mb-2">Upcoming Session</div>
                    <div className="text-[#4d3c2f] text-sm mb-3">Next: Thursday, Jan 25, 2026 at 2:00 PM</div>
                    {isLive && <div className="text-[#C5A059] font-bold mb-3">Session is live!</div>}
                    {/* Therapist photo or fallback circle */}
                    {therapistPhotoUrl ? (
                      <img
                        src={therapistPhotoUrl}
                        alt="Therapist"
                        className="w-16 h-16 rounded-full border-2 border-white object-cover mb-4"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-[#C5A059] border-2 border-white mb-4" />
                    )}
                    <button
                      className={`px-6 py-2 rounded-lg font-semibold shadow ${isLive ? 'bg-[#5C5043] text-white hover:bg-[#4a3f35]' : 'bg-[#E6DED4] text-[#5C5043] hover:bg-[#d9cec2]'}`}
                      onClick={handleJoinSession}
                      disabled={joinLoading}
                    >
                      {joinLoading ? 'Joining...' : 'Join Session'}
                    </button>
                    {!isLive && (
                      <div className="text-[#8D7B68] text-xs mt-3">
                        Sessions can be joined within 10 minutes before start.
                      </div>
                    )}
                    {joinError && <div className="text-red-500 text-sm mt-2">{joinError}</div>}
                  </div>
                );
              })()}
            </div>
            {/* Therapist's Notes */}
            <div ref={(el) => (sectionRefs.current[1] = el)} className={`bg-white rounded-2xl shadow p-6 animate-section ${visibleSections.has(1) ? 'visible' : ''}`}>
              <div className="font-semibold text-[#4d3c2f] mb-4 text-center text-lg">Therapist's Notes</div>
              <div className="bg-[#f7f3ee] rounded-lg p-3 mb-2 text-[#4d3c2f] text-center font-serif text-lg">"أبارَكِي مُثنَانِ البَرَغَاد"</div>
              <div className="text-[#4d3c2f] text-sm mb-4 text-center">Week 1: Introduction to Gratitud on 3 blessings daily</div>
              <div className="flex justify-center">
                <button
                  style={{
                    background: 'linear-gradient(135deg, #b4845c 0%, #e2b07a 40%, #c49a6c 60%, #a97c50 100%)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 1rem',
                    fontWeight: 600,
                    transition: 'background 0.3s'
                  }}
                  className="font-semibold focus:outline-none metallic-bronze-btn"
                  onClick={() => setShowReflectionModal(true)}
                >
                  Add Reflection
                </button>
              </div>
            </div>
        </div>
        </div>
        </div>
        )}

        {/* Content - Personal Profile Tab */}
        {activeSettingsTab === 'profile' && (
        <div className="bg-[#FAF7F3] rounded-b-lg shadow p-8 space-y-8">
          {message && (
            <div className="p-4 bg-[#E0F4F3] border border-[#24585D] rounded-lg text-[#24585D]">
              {message}
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}
          <div>
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
                  className="absolute bottom-0 right-0 bg-[#b4845c] text-white rounded-full p-2 hover:bg-[#8D7B68] transition-colors shadow-lg"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
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
                    }
                  }}
                  className="hidden"
                />
              </div>
              <div>
                <p className="text-[#8D7B68] text-sm">Click the + button to upload a new picture</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[#5C5043] mb-4">Display Name</h2>
            <input
              type="text"
              value={settings.display_name}
              onChange={(e) => setSettings(prev => ({ ...prev, display_name: e.target.value }))}
              className="w-full max-w-md px-4 py-3 border-2 border-[#D4C4B0] rounded-2xl focus:outline-none focus:border-[#b4845c] focus:ring-2 focus:ring-[#b4845c]/20 bg-white text-[#5C5043] placeholder:text-[#8D7B68]"
              placeholder="Your Display Name"
            />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Email Address</h2>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full max-w-md px-4 py-3 border-2 border-[#D4C4B0] rounded-2xl focus:outline-none focus:border-[#b4845c] focus:ring-2 focus:ring-[#b4845c]/20 bg-white text-[#5C5043] placeholder:text-[#8D7B68]"
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[#5C5043] mb-4">Contact No</h2>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full max-w-md px-4 py-3 border-2 border-[#D4C4B0] rounded-2xl focus:outline-none focus:border-[#b4845c] focus:ring-2 focus:ring-[#b4845c]/20 bg-white text-[#5C5043] placeholder:text-[#8D7B68]"
              placeholder="Your phone number"
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[#5C5043] mb-4">Date of Birth</h2>
            <input
              type="date"
              value={formData.dob || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
              className="w-full max-w-md px-4 py-3 border-2 border-[#D4C4B0] rounded-2xl focus:outline-none focus:border-[#b4845c] focus:ring-2 focus:ring-[#b4845c]/20 bg-white text-[#5C5043] placeholder:text-[#8D7B68]"
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[#5C5043] mb-4">About You</h2>
            <textarea
              value={settings.bio}
              onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-[#D4C4B0] rounded-2xl focus:outline-none focus:border-[#b4845c] focus:ring-2 focus:ring-[#b4845c]/20 bg-white text-[#5C5043] placeholder:text-[#8D7B68]"
              rows={4}
              placeholder="Tell us about yourself..."
            />
          </div>

          <button 
            onClick={async () => {
              setLoading(true);
              setMessage('');
              setError('');
              try {
                const token = localStorage.getItem('shura-auth-token');
                
                // Try the profile endpoint first
                try {
                  const response = await fetch(`${config.apiUrl}/api/auth/profile`, {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      full_name: formData.full_name,
                      phone: formData.phone,
                      dob: formData.dob,
                      display_name: settings.display_name,
                      bio: settings.bio,
                      profile_picture: settings.profile_picture,
                      spiritual_integration: settings.spiritual_integration,
                      preferred_language: settings.preferred_language,
                      timezone: settings.timezone,
                      focus_areas: settings.focus_areas,
                      email_notifications: settings.email_notifications,
                      sms_notifications: settings.sms_notifications,
                    }),
                  });

                  if (response.ok) {
                    const data = await response.json();
                    setProfile(data.user);
                    setMessage('Profile saved successfully!');
                    return;
                  }
                } catch (e) {
                  console.log('Settings endpoint not available, using fallback');
                }

                // Fallback: save to localStorage
                localStorage.setItem('shura-profile-settings', JSON.stringify(settings));
                setMessage('Profile saved successfully!');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="px-6 py-2 bg-[#b4845c] text-white rounded-lg font-semibold hover:bg-[#8D7B68] transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
        )}

        {/* Content - Consultation Preferences Tab */}
        {activeSettingsTab === 'preferences' && (
        <div className="bg-[#FAF7F3] rounded-b-lg shadow p-8 space-y-8">
          {message && (
            <div className="p-4 bg-[#E0F4F3] border border-[#24585D] rounded-lg text-[#24585D]">
              {message}
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-[#5C5043] mb-3">Spiritual Integration Level</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#8D7B68] min-w-fit">Minimal</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={settings.spiritual_integration}
                  onChange={(e) => setSettings(prev => ({ ...prev, spiritual_integration: parseInt(e.target.value) }))}
                  className="w-full h-1.5 accent-[#b4845c]"
                  style={{
                    background: `linear-gradient(to right, #b4845c 0%, #b4845c ${(settings.spiritual_integration - 1) * 11.11}%, #D4C4B0 ${(settings.spiritual_integration - 1) * 11.11}%, #D4C4B0 100%)`
                  }}
                />
                <span className="text-xs text-[#8D7B68] min-w-fit">Integrated</span>
              </div>
              <p className="text-xs text-center text-[#b4845c] font-semibold">Level {settings.spiritual_integration}/10</p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[#5C5043] mb-4">Preferred Language</h2>
            <div className="relative w-full max-w-md" ref={languageDropdownRef}>
              <button
                type="button"
                onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
                className="w-full px-6 py-4 rounded-2xl text-[#5C5043] font-medium bg-white border-2 border-[#D4C4B0] focus:outline-none focus:border-[#b4845c] focus:ring-2 focus:ring-[#b4845c]/20 transition-all text-left flex items-center justify-between"
              >
                <span>{settings.preferred_language}</span>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${languageDropdownOpen ? 'rotate-180' : ''}`}>
                  <path d="M1 1L6 6L11 1" stroke="#5C5043" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              {languageDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border-2 border-[#D4C4B0] rounded-2xl shadow-lg overflow-hidden">
                  {['English', 'Urdu', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada'].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, preferred_language: lang }));
                        setLanguageDropdownOpen(false);
                      }}
                      className={`w-full px-6 py-3 text-left hover:bg-[#F5F1ED] transition-colors ${settings.preferred_language === lang ? 'bg-[#b4845c] text-white font-semibold' : 'text-[#5C5043]'}`}
                    >
                      {settings.preferred_language === lang && <span className="mr-2">✓</span>}
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border-2 border-[#D4C4B0]">
            <h2 className="text-lg font-semibold text-[#5C5043] mb-4">Focus Areas</h2>
            <p className="text-[#8D7B68] text-sm mb-4">Select the topics you'd like to explore in therapy</p>
            <div className="grid grid-cols-2 gap-3">
              {['Youth Guidance', 'Marriage & Relationships', 'General Mental Health', 'Anxiety Management', 'Depression Support', 'Personal Growth', 'Family Issues', 'Career Guidance'].map(area => (
                <label key={area} className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.focus_areas.includes(area)}
                      onChange={() => setSettings(prev => ({
                        ...prev,
                        focus_areas: prev.focus_areas.includes(area)
                          ? prev.focus_areas.filter(a => a !== area)
                          : [...prev.focus_areas, area]
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-6 h-6 rounded-lg bg-[#F5F1ED] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.7)] peer-checked:bg-[#b4845c] peer-checked:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] transition-all flex items-center justify-center">
                      {settings.focus_areas.includes(area) && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[#5C5043]">{area}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={async () => {
              setLoading(true);
              setMessage('');
              setError('');
              try {
                const token = localStorage.getItem('shura-auth-token');
                
                try {
                  const response = await fetch(`${config.apiUrl}/api/auth/settings`, {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(settings),
                  });

                  if (response.ok) {
                    setMessage('Preferences saved successfully!');
                    return;
                  }
                } catch (e) {
                  console.log('Settings endpoint not available, using fallback');
                }

                localStorage.setItem('shura-preferences', JSON.stringify(settings));
                setMessage('Preferences saved successfully!');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="px-6 py-2 bg-[#b4845c] text-white rounded-lg font-semibold hover:bg-[#8D7B68] transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
        )}

        {/* Content - Account & Privacy Tab */}
        {activeSettingsTab === 'account' && (
        <div className="bg-[#FAF7F3] rounded-b-lg shadow p-8 space-y-8">
          {message && (
            <div className="p-4 bg-[#E0F4F3] border border-[#24585D] rounded-lg text-[#24585D]">
              {message}
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Email Address</h2>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-[#8D7B68]"
            />
            <p className="text-[#8D7B68] text-sm mt-2">Contact support to change your email</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Change Password</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-[#5C5043] font-medium text-sm mb-2">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#b4845c]"
                />
              </div>
              <div>
                <label className="block text-[#5C5043] font-medium text-sm mb-2">New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#b4845c]"
                />
              </div>
              <div>
                <label className="block text-[#5C5043] font-medium text-sm mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#b4845c]"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Timezone</h2>
            <div className="relative w-full max-w-md" ref={timezoneDropdownRef}>
              <button
                type="button"
                onClick={() => setTimezoneDropdownOpen(!timezoneDropdownOpen)}
                className="w-full px-6 py-4 rounded-2xl text-[#5C5043] font-medium bg-white border-2 border-[#D4C4B0] focus:outline-none focus:border-[#b4845c] focus:ring-2 focus:ring-[#b4845c]/20 transition-all text-left flex items-center justify-between"
              >
                <span>{settings.timezone}</span>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${timezoneDropdownOpen ? 'rotate-180' : ''}`}>
                  <path d="M1 1L6 6L11 1" stroke="#5C5043" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              {timezoneDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border-2 border-[#D4C4B0] rounded-2xl shadow-lg overflow-hidden">
                  {['Asia/Kolkata', 'Asia/Dubai', 'Europe/London'].map((tz) => (
                    <button
                      key={tz}
                      type="button"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, timezone: tz }));
                        setTimezoneDropdownOpen(false);
                      }}
                      className={`w-full px-6 py-3 text-left hover:bg-[#F5F1ED] transition-colors ${settings.timezone === tz ? 'bg-[#b4845c] text-white font-semibold' : 'text-[#5C5043]'}`}
                    >
                      {settings.timezone === tz && <span className="mr-2">✓</span>}
                      {tz}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#5C5043] mb-4">Notifications</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={settings.email_notifications}
                    onChange={(e) => setSettings(prev => ({ ...prev, email_notifications: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-6 h-6 rounded-lg bg-[#F5F1ED] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.7)] peer-checked:bg-[#b4845c] peer-checked:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] transition-all flex items-center justify-center">
                    {settings.email_notifications && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[#5C5043]">Email reminders for upcoming sessions</span>
              </label>
            </div>
          </div>

          <button 
            onClick={async () => {
              setLoading(true);
              setError('');
              setMessage('');
              try {
                const token = localStorage.getItem('shura-auth-token');
                
                try {
                  const response = await fetch(`${config.apiUrl}/api/auth/settings`, {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(settings),
                  });

                  if (response.ok) {
                    setMessage('Settings saved successfully!');
                    return;
                  }
                } catch (e) {
                  console.log('Settings endpoint not available, using fallback');
                }

                localStorage.setItem('shura-account-settings', JSON.stringify(settings));
                setMessage('Settings saved successfully!');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="px-6 py-2 bg-[#b4845c] text-white rounded-lg font-semibold hover:bg-[#8D7B68] transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
        )}

        {/* Reflection Modal */}
        {showReflectionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-xl font-semibold text-[#5C5043]">Add Your Reflection</h3>
              <textarea
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                placeholder="Share your thoughts and feelings about this week's session..."
                className="w-full px-4 py-3 border-2 border-[#D4C4B0] rounded-2xl focus:outline-none focus:border-[#b4845c] focus:ring-2 focus:ring-[#b4845c]/20 bg-white text-[#5C5043] placeholder:text-[#8D7B68]"
                rows={5}
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowReflectionModal(false);
                    setReflectionText("");
                  }}
                  className="px-4 py-2 bg-[#D4C4B0] text-[#5C5043] rounded-lg font-semibold hover:bg-[#C5A59C] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (reflectionText.trim()) {
                      try {
                        const token = localStorage.getItem('shura-auth-token');
                        const response = await fetch(`${config.apiUrl}/api/auth/reflection`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ reflection_text: reflectionText }),
                        });
                        
                        if (response.ok) {
                          setMessage('Reflection saved successfully!');
                          setShowReflectionModal(false);
                          setReflectionText("");
                        } else {
                          setError('Failed to save reflection');
                        }
                      } catch (err) {
                        setError('Error saving reflection: ' + (err instanceof Error ? err.message : 'Unknown error'));
                      }
                    }
                  }}
                  className="px-4 py-2 bg-[#b4845c] text-white rounded-lg font-semibold hover:bg-[#8D7B68] transition-colors"
                >
                  Save Reflection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default ClientProfilePage;
