import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { clientPortalApi, PortalApiError } from './clientPortalApi';
import type { ClientOptions, ClientPreferences, ClientProfile, OnboardingData } from './clientPortalTypes';
import { CheckboxGrid, ChoiceCards, ErrorState, Field, PageSkeleton, Toast, inputClass } from './PortalUi';
import { defaultPhoneCodes, detectedTimezone, timezoneOptions } from './portalOptions';

const fallbackOptions: ClientOptions = {
  languages: ['Arabic', 'English', 'French', 'Hindi', 'Malay', 'Turkish', 'Urdu'],
  specialisations: ['Anxiety', 'Depression', 'Trauma/PTSD', 'Grief', 'Relationships', 'Marriage/Couples', 'Parenting', 'Work Stress', 'Identity'],
  phoneCountryCodes: defaultPhoneCodes,
};

const splitPhone = (phone: string, codes = defaultPhoneCodes) => {
  const match = [...codes].sort((a, b) => b.code.length - a.code.length).find(({ code }) => phone.startsWith(code));
  return { code: match?.code || '+971', number: match ? phone.slice(match.code.length) : phone.replace(/^\+/, '') };
};

const ClientOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [preferences, setPreferences] = useState<ClientPreferences | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [options, setOptions] = useState<ClientOptions>(fallbackOptions);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [pageError, setPageError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [onboarding, settings] = await Promise.all([
        clientPortalApi.getOnboarding(),
        clientPortalApi.getSettings(),
      ]);
      const nextProfile = {
        ...onboarding.profile,
        timezone: onboarding.profile.timezone || detectedTimezone(),
      };
      setData(onboarding);
      setProfile(nextProfile);
      setPreferences(onboarding.preferences);
      setGoals(onboarding.goals);
      setNotes(onboarding.notes);
      setOptions(settings.options.languages?.length ? settings.options : fallbackOptions);
      setStep(Math.min(5, Math.max(1, onboarding.currentStep || 1)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'We could not load your setup.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const phoneParts = useMemo(() => splitPhone(profile?.phone || '', options.phoneCountryCodes), [profile?.phone, options.phoneCountryCodes]);
  const updatePhone = (code: string, number: string) => {
    if (!profile) return;
    const digits = number.replace(/\D/g, '');
    setProfile({ ...profile, phone: digits ? `${code}${digits}` : '' });
  };

  const next = async () => {
    if (!profile || !preferences || step === 5) return;
    setSaving(true);
    setPageError('');
    setErrors({});
    try {
      if (step === 1) await clientPortalApi.saveOnboarding({ step: 1 });
      if (step === 2) {
        await clientPortalApi.saveOnboarding({
          step: 2,
          profile: {
            firstName: profile.firstName,
            lastName: profile.lastName,
            dateOfBirth: profile.dateOfBirth,
            gender: profile.gender,
            timezone: profile.timezone,
            phone: profile.phone || null,
          },
        });
      }
      if (step === 3) {
        await clientPortalApi.saveOnboarding({
          step: 3,
          preferences: {
            therapistGenderPreference: preferences.therapistGenderPreference,
            languages: preferences.languages,
            islamicApproach: preferences.islamicApproach,
          },
        });
      }
      if (step === 4) await clientPortalApi.saveOnboarding({ step: 4, goals, notes });
      setStep((value) => Math.min(5, value + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof PortalApiError && err.details) setErrors(err.details);
      setPageError(err instanceof Error ? err.message : 'Your progress could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const complete = async () => {
    setSaving(true);
    setPageError('');
    try {
      const result = await clientPortalApi.completeOnboarding();
      await refreshSession();
      navigate(result.assignedTherapist ? '/portal/therapist' : '/therapists', { replace: true });
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'We could not finish your setup.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#FAF7F2] px-5 py-12"><div className="mx-auto max-w-3xl"><PageSkeleton /></div></div>;
  if (loadError || !profile || !preferences) return <div className="min-h-screen bg-[#FAF7F2] px-5 py-16"><ErrorState message={loadError} onRetry={() => void load()} /></div>;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#F2E5D7,transparent_45%),#FAF7F2] px-4 py-7 text-brown-dark sm:px-6 md:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2"><Logo className="h-9 w-9" /><span className="font-serif text-xl font-bold">Shura</span></div>
          <p className="text-sm font-medium text-brown-soft">Step {step} of 5</p>
        </header>

        <div className="mb-8 flex gap-2" aria-label={`Onboarding progress: step ${step} of 5`}>
          {[1, 2, 3, 4, 5].map((item) => <div key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? 'bg-[#8A5A44]' : 'bg-[#E4D7CA]'}`} />)}
        </div>

        <section className="rounded-3xl border border-[#E5D8CB] bg-white p-6 shadow-[0_20px_60px_rgba(92,80,67,0.09)] sm:p-9 md:p-12">
          {step === 1 && (
            <div className="py-6 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8C624E]">Where Faith Meets Healing</p>
              <h1 className="mt-5 font-serif text-4xl leading-tight md:text-5xl">Assalamu Alaikum, {profile.firstName || profile.fullName?.split(' ')[0] || 'friend'}.</h1>
              <p className="mx-auto mt-6 max-w-xl text-[17px] leading-8 text-brown-soft">Welcome to Shura, a calm and confidential space connecting you with qualified Muslim therapists who understand both your wellbeing and your values.</p>
              <p className="mt-5 font-medium text-brown-dark">Let’s get you set up — it takes about 2 minutes.</p>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8C624E]">About you</p>
              <h1 className="mt-3 font-serif text-3xl md:text-4xl">A little about yourself</h1>
              <p className="mt-3 text-brown-soft">These details help us keep session times accurate and your account secure.</p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <Field label="First name" htmlFor="firstName" required error={errors.firstName}><input id="firstName" value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} className={inputClass} autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} /></Field>
                <Field label="Last name" htmlFor="lastName" required error={errors.lastName}><input id="lastName" value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} className={inputClass} autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} /></Field>
                <Field label="Date of birth" htmlFor="dateOfBirth" required error={errors.dateOfBirth}><input id="dateOfBirth" type="date" max={new Date().toISOString().slice(0, 10)} value={profile.dateOfBirth} onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value })} className={inputClass} aria-invalid={Boolean(errors.dateOfBirth)} /></Field>
                <Field label="Gender" htmlFor="gender" required error={errors.gender}><select id="gender" value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value })} className={inputClass}><option value="">Select an option</option><option value="male">Male</option><option value="female">Female</option><option value="prefer_not_to_say">Prefer not to say</option></select></Field>
                <Field label="Timezone" htmlFor="timezone" required hint="We detected this automatically. You can change it." error={errors.timezone}><input id="timezone" list="onboarding-timezones" value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} className={inputClass} /><datalist id="onboarding-timezones">{timezoneOptions.map((timezone) => <option value={timezone} key={timezone} />)}</datalist></Field>
                <Field label="Phone number" htmlFor="phoneNumber" hint="Optional, in international format" error={errors.phone}>
                  <div className="mt-2 flex gap-2"><select aria-label="Country calling code" value={phoneParts.code} onChange={(event) => updatePhone(event.target.value, phoneParts.number)} className={`${inputClass} mt-0 w-36 shrink-0`}>{options.phoneCountryCodes.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select><input id="phoneNumber" type="tel" inputMode="tel" value={phoneParts.number} onChange={(event) => updatePhone(phoneParts.code, event.target.value)} className={`${inputClass} mt-0`} autoComplete="tel-national" /></div>
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8C624E]">Your preferences</p>
              <h1 className="mt-3 font-serif text-3xl md:text-4xl">Help us find the right fit</h1>
              <p className="mt-3 text-brown-soft">This helps us match you with the right therapist. You can change these preferences later.</p>
              <div className="mt-8 space-y-8">
                <fieldset><legend className="mb-3 font-semibold">Therapist gender preference <span className="text-[#A75035]">*</span></legend><ChoiceCards name="therapistGender" value={preferences.therapistGenderPreference} onChange={(value) => setPreferences({ ...preferences, therapistGenderPreference: value as ClientPreferences['therapistGenderPreference'] })} options={[{ value: 'female_only', label: 'Female therapist only' }, { value: 'male_only', label: 'Male therapist only' }, { value: 'no_preference', label: 'No preference' }]} />{errors.therapistGenderPreference && <p className="mt-2 text-sm text-[#A54236]">{errors.therapistGenderPreference}</p>}</fieldset>
                <fieldset><legend className="mb-3 font-semibold">I prefer sessions in: <span className="text-[#A75035]">*</span></legend><CheckboxGrid name="languages" values={preferences.languages} options={options.languages} onChange={(languages) => setPreferences({ ...preferences, languages })} />{errors.languages && <p className="mt-2 text-sm text-[#A54236]">{errors.languages}</p>}</fieldset>
                <fieldset><legend className="mb-3 font-semibold">Islamic approach preference <span className="text-[#A75035]">*</span></legend><ChoiceCards name="islamicApproach" value={preferences.islamicApproach} onChange={(value) => setPreferences({ ...preferences, islamicApproach: value as ClientPreferences['islamicApproach'] })} options={[{ value: 'faith_integrated', label: 'Faith-integrated therapy', description: 'Islamic teachings, Quran, and Hadith may be actively incorporated into sessions.' }, { value: 'faith_aware', label: 'Faith-aware therapy', description: 'Your therapist understands Islam and is sensitive to your values.' }, { value: 'no_preference', label: 'No preference', description: 'Focus on evidence-based approaches without a specific faith-integration preference.' }]} />{errors.islamicApproach && <p className="mt-2 text-sm text-[#A54236]">{errors.islamicApproach}</p>}</fieldset>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8C624E]">Your goals</p>
              <h1 className="mt-3 font-serif text-3xl md:text-4xl">What are you hoping to work on?</h1>
              <p className="mt-3 text-brown-soft">This step is optional. What you share is visible only to your matched therapist.</p>
              <div className="mt-8"><CheckboxGrid name="goals" values={goals} options={options.specialisations} onChange={setGoals} /></div>
              <Field label="Anything else you’d like your therapist to know?" htmlFor="goalNotes" hint="Shared only with your matched therapist" error={errors.notes}>
                <textarea id="goalNotes" value={notes} maxLength={500} rows={5} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
                <p className="mt-1 text-right text-xs text-brown-soft">{notes.length}/500</p>
              </Field>
            </div>
          )}

          {step === 5 && (
            <div className="py-3 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F0E3] text-3xl text-[#54704D]" aria-hidden="true">✓</div>
              <h1 className="mt-6 font-serif text-4xl">You’re ready.</h1>
              <p className="mt-3 text-brown-soft">Here’s what happens next:</p>
              <ol className="mx-auto mt-8 grid max-w-xl gap-4 text-left sm:grid-cols-3">
                {['We match you with a therapist', 'You confirm or choose from suggestions', 'You book your first session'].map((text, index) => <li key={text} className="rounded-2xl bg-[#F8F2EC] p-4"><span className="text-sm font-bold text-[#8C624E]">{index + 1}</span><p className="mt-2 text-sm leading-6 text-brown-dark">{text}</p></li>)}
              </ol>
            </div>
          )}

          <div className="mt-10 flex items-center justify-between gap-4 border-t border-sand pt-6">
            {step > 1 && step < 5 ? <button type="button" onClick={() => setStep((value) => value - 1)} disabled={saving} className="rounded-full px-5 py-3 font-semibold text-brown-soft hover:bg-sand focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]">Back</button> : <span />}
            {step < 5 ? <button type="button" onClick={() => void next()} disabled={saving} className="rounded-full bg-[#8C4F3A] px-7 py-3 font-semibold text-white shadow-sm hover:bg-[#74412F] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:opacity-60">{saving ? 'Saving…' : step === 1 ? 'Get Started' : step === 4 && !goals.length && !notes ? 'Skip for now' : 'Continue'}</button> : <button type="button" onClick={() => void complete()} disabled={saving} className="rounded-full bg-[#70866A] px-7 py-3 font-semibold text-white hover:bg-[#5D7457] focus:outline-none focus:ring-2 focus:ring-[#5D7457] focus:ring-offset-2 disabled:opacity-60">{saving ? 'Finishing…' : data?.assignedTherapist ? 'Meet Your Therapist' : 'Find My Therapist'}</button>}
          </div>
        </section>
      </div>
      {pageError && <Toast kind="error" message={pageError} onClose={() => setPageError('')} />}
    </main>
  );
};

export default ClientOnboardingPage;
