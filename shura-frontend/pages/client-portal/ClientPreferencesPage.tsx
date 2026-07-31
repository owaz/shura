import React, { useEffect, useState } from 'react';
import { clientPortalApi } from './clientPortalApi';
import type { ClientOptions, ClientPreferences, ClientProfile } from './clientPortalTypes';
import { CheckboxGrid, ChoiceCards, ErrorState, PageSkeleton, PortalCard, Toast, Toggle } from './PortalUi';
import { defaultPhoneCodes } from './portalOptions';

const fallbackOptions: ClientOptions = {
  languages: ['Arabic', 'English', 'French', 'Hindi', 'Malay', 'Turkish', 'Urdu'],
  specialisations: ['Anxiety', 'Depression', 'Trauma/PTSD', 'Grief', 'Relationships', 'Marriage/Couples', 'Parenting', 'Work Stress', 'Identity'],
  phoneCountryCodes: defaultPhoneCodes,
};

const days = [
  ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'], ['thursday', 'Thursday'],
  ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday'],
] as const;

const ClientPreferencesPage: React.FC = () => {
  const [preferences, setPreferences] = useState<ClientPreferences | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [options, setOptions] = useState<ClientOptions>(fallbackOptions);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingKeys, setSavingKeys] = useState<Set<keyof ClientPreferences>>(new Set());
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const load = async () => {
    setLoading(true); setLoadError('');
    try {
      const [result, settings] = await Promise.all([clientPortalApi.getProfile(), clientPortalApi.getSettings()]);
      setPreferences(result.preferences); setProfile(result.profile);
      setOptions(settings.options.languages?.length ? settings.options : fallbackOptions);
    } catch (err) { setLoadError(err instanceof Error ? err.message : 'Your preferences could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (toast?.kind !== 'success') return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const save = async <K extends keyof ClientPreferences>(key: K, value: ClientPreferences[K]) => {
    if (!preferences) return;
    const previous = preferences;
    setPreferences({ ...preferences, [key]: value });
    setSavingKeys((current) => new Set(current).add(key));
    try {
      const result = await clientPortalApi.updatePreferences({ [key]: value } as Partial<ClientPreferences>);
      setPreferences((current) => current ? { ...current, [key]: result.preferences[key] } : current);
      setToast({ kind: 'success', message: 'Preference saved.' });
    } catch (err) {
      setPreferences(previous);
      setToast({ kind: 'error', message: err instanceof Error ? err.message : 'That preference could not be saved.' });
    } finally {
      setSavingKeys((current) => { const next = new Set(current); next.delete(key); return next; });
    }
  };

  const saveIndicator = (key: keyof ClientPreferences) => savingKeys.has(key) ? <span className="ml-2 text-xs font-normal text-brown-soft" role="status">Saving…</span> : null;

  if (loading) return <PageSkeleton />;
  if (loadError || !preferences || !profile) return <ErrorState message={loadError} onRetry={() => void load()} />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8C624E]">Your comfort</p><h1 className="mt-2 font-serif text-3xl md:text-4xl">Preferences</h1><p className="mt-2 max-w-2xl leading-7 text-brown-soft">These settings shape your matching and session experience. Changes save automatically.</p></div>

      <PortalCard>
        <h2 className="font-serif text-2xl">Therapist Preferences</h2><p className="mt-2 text-sm text-brown-soft">These preferences guide how we match you with therapists.</p>
        <div className="mt-7 space-y-8">
          <fieldset><legend className="mb-3 font-semibold">Therapist gender preference {saveIndicator('therapistGenderPreference')}</legend><ChoiceCards name="preferenceGender" value={preferences.therapistGenderPreference} onChange={(value) => void save('therapistGenderPreference', value as ClientPreferences['therapistGenderPreference'])} options={[{ value: 'female_only', label: 'Female therapist only' }, { value: 'male_only', label: 'Male therapist only' }, { value: 'no_preference', label: 'No preference' }]} /><p className="mt-3 rounded-xl bg-[#F8F2EC] p-3 text-sm leading-6 text-brown-soft">We respect that this may be important to you for religious or personal reasons. We will always honour this preference.</p></fieldset>
          <fieldset><legend className="mb-3 font-semibold">I prefer sessions in: {saveIndicator('languages')}</legend><CheckboxGrid name="preferenceLanguages" values={preferences.languages} options={options.languages} onChange={(values) => void save('languages', values)} /></fieldset>
          <fieldset><legend className="mb-3 font-semibold">Islamic approach preference {saveIndicator('islamicApproach')}</legend><ChoiceCards name="preferenceApproach" value={preferences.islamicApproach} onChange={(value) => void save('islamicApproach', value as ClientPreferences['islamicApproach'])} options={[{ value: 'faith_integrated', label: 'Faith-integrated therapy', description: 'Your therapist may actively incorporate Islamic teachings, Quran, and Hadith into sessions.' }, { value: 'faith_aware', label: 'Faith-aware therapy', description: 'Your therapist understands Islam and is sensitive to your values without actively integrating faith.' }, { value: 'no_preference', label: 'No preference', description: 'Focus on evidence-based therapy approaches without a specific integration preference.' }]} /></fieldset>
          <fieldset><legend className="mb-3 font-semibold">I am primarily seeking help with: {saveIndicator('specialisationInterests')}</legend><p className="mb-3 text-sm text-brown-soft">Optional — choose any areas that feel relevant.</p><CheckboxGrid name="specialisations" values={preferences.specialisationInterests} options={options.specialisations} onChange={(values) => void save('specialisationInterests', values)} /></fieldset>
        </div>
      </PortalCard>

      <PortalCard>
        <h2 className="font-serif text-2xl">Session Preferences</h2>
        <div className="mt-7 space-y-8">
          <fieldset><legend className="mb-3 font-semibold">Preferred session type {saveIndicator('sessionTypePreference')}</legend><ChoiceCards name="sessionType" value={preferences.sessionTypePreference} onChange={(value) => void save('sessionTypePreference', value as ClientPreferences['sessionTypePreference'])} options={[{ value: 'video', label: 'Video' }, { value: 'audio', label: 'Audio only' }, { value: 'text', label: 'Text' }, { value: 'no_preference', label: 'No preference' }]} /></fieldset>
          <fieldset><legend className="mb-3 font-semibold">Preferred session duration {saveIndicator('sessionDurationPreference')}</legend><ChoiceCards name="sessionDuration" value={preferences.sessionDurationPreference} onChange={(value) => void save('sessionDurationPreference', value as ClientPreferences['sessionDurationPreference'])} options={[{ value: '30', label: '30 minutes' }, { value: '50', label: '50 minutes' }, { value: '80', label: '80 minutes' }, { value: 'no_preference', label: 'No preference' }]} /></fieldset>
          <fieldset><legend className="mb-3 font-semibold">Preferred days {saveIndicator('preferredDays')}</legend><CheckboxGrid name="preferredDays" values={preferences.preferredDays.map((day) => days.find(([value]) => value === day)?.[1] || day)} options={days.map(([, label]) => label)} onChange={(values) => void save('preferredDays', values.map((label) => days.find(([, dayLabel]) => dayLabel === label)?.[0] || label.toLowerCase()))} /></fieldset>
          <fieldset><legend className="mb-3 font-semibold">Preferred time of day {saveIndicator('preferredTimeOfDay')}</legend><ChoiceCards name="timeOfDay" value={preferences.preferredTimeOfDay} onChange={(value) => void save('preferredTimeOfDay', value as ClientPreferences['preferredTimeOfDay'])} options={[{ value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'evening', label: 'Evening' }, { value: 'night', label: 'Night' }, { value: 'no_preference', label: 'No preference' }]} /></fieldset>
        </div>
      </PortalCard>

      <PortalCard>
        <h2 className="font-serif text-2xl">Notification Preferences</h2><p className="mt-2 text-sm text-brown-soft">Choose the reminders and updates that are helpful to you.</p>
        <div className="mt-4">
          <Toggle label="Email: Session reminders (24 hours before)" checked={preferences.notificationEmailReminder24h} disabled={savingKeys.has('notificationEmailReminder24h')} onChange={(value) => void save('notificationEmailReminder24h', value)} />
          <Toggle label="Email: Session reminders (1 hour before)" checked={preferences.notificationEmailReminder1h} disabled={savingKeys.has('notificationEmailReminder1h')} onChange={(value) => void save('notificationEmailReminder1h', value)} />
          {profile.phone ? <Toggle label="SMS: Session reminders (1 hour before)" checked={preferences.notificationSmsReminder1h} disabled={savingKeys.has('notificationSmsReminder1h')} onChange={(value) => void save('notificationSmsReminder1h', value)} /> : <div className="border-b border-sand py-4"><p className="font-medium text-brown-dark">SMS: Session reminders</p><p className="mt-1 text-sm text-brown-soft">Add a phone number to your profile to enable SMS reminders.</p></div>}
          <Toggle label="Email: Booking confirmations" checked={preferences.notificationBookingConfirmation} disabled={savingKeys.has('notificationBookingConfirmation')} onChange={(value) => void save('notificationBookingConfirmation', value)} />
          <Toggle label="Email: Cancellation notifications" checked={preferences.notificationCancellation} disabled={savingKeys.has('notificationCancellation')} onChange={(value) => void save('notificationCancellation', value)} />
          <Toggle label="Email: Platform announcements and updates" checked={preferences.notificationPlatformUpdates} disabled={savingKeys.has('notificationPlatformUpdates')} onChange={(value) => void save('notificationPlatformUpdates', value)} />
        </div>
      </PortalCard>

      <PortalCard>
        <h2 className="font-serif text-2xl">Privacy</h2>
        <div className="mt-4">
          <Toggle label="Allow my therapist to see my About Me section before our first session" checked={preferences.privacyShareAboutMe} disabled={savingKeys.has('privacyShareAboutMe')} onChange={(value) => void save('privacyShareAboutMe', value)} />
          <Toggle label="Allow anonymised data to be used for platform improvement" description="This helps us understand which parts of Shura are useful. Your name, contact details, messages, and session content are never included." checked={preferences.privacyAllowAnonymisedData} disabled={savingKeys.has('privacyAllowAnonymisedData')} onChange={(value) => void save('privacyAllowAnonymisedData', value)} />
        </div>
      </PortalCard>

      {toast && <Toast kind={toast.kind} message={toast.message} onClose={toast.kind === 'error' ? () => setToast(null) : undefined} />}
    </div>
  );
};

export default ClientPreferencesPage;
