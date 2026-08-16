import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientPortalApi } from './clientPortalApi';
import type { AssignedTherapist } from './clientPortalTypes';
import { ErrorState, PageSkeleton, PortalCard, Toast } from './PortalUi';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const languageFlag = (language: string) => {
  const flags: Record<string, string> = {
    Arabic: '🇦🇪', English: '🇬🇧', French: '🇫🇷', Hindi: '🇮🇳', Malay: '🇲🇾',
    Spanish: '🇪🇸', Turkish: '🇹🇷', Urdu: '🇵🇰', Bengali: '🇧🇩', Persian: '🇮🇷',
  };
  return flags[language] || '🌐';
};

const formatTime = (value: string) => {
  const [hourValue, minuteValue] = value.split(':').map(Number);
  if (!Number.isFinite(hourValue)) return value;
  const suffix = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minuteValue || 0).padStart(2, '0')} ${suffix}`;
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const VerifiedMark: React.FC = () => (
  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6F866B] text-sm font-bold text-white" title="Verified Shura therapist" aria-label="Verified Shura therapist">✓</span>
);

const EmptyTherapistState: React.FC = () => {
  const navigate = useNavigate();
  return (
    <PortalCard className="overflow-hidden p-0 md:p-0">
      <div className="relative grid min-h-[520px] place-items-center overflow-hidden px-6 py-16 text-center">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full border-[42px] border-[#F4E7DA]" aria-hidden="true" />
        <div className="absolute -bottom-20 -right-16 h-64 w-64 rotate-45 rounded-[48px] border-[30px] border-[#E8EFE6]" aria-hidden="true" />
        <div className="relative max-w-xl">
          <div className="mx-auto mb-7 grid h-24 w-24 place-items-center rounded-full bg-[#F4E7DA] shadow-[0_12px_35px_rgba(92,80,67,0.09)]" aria-hidden="true">
            <span className="font-serif text-4xl text-[#8C4F3A]">S</span>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8C6E58]">Your care journey</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-brown-dark md:text-4xl">Let’s find the right therapist for you</h2>
          <p className="mx-auto mt-4 max-w-lg text-[16px] leading-7 text-brown-soft">Browse qualified Muslim therapists or continue with guided matching based on the preferences you shared with Shura.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => navigate('/therapists')} className="rounded-full bg-[#8C4F3A] px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-[#74402F] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2">Browse Therapists</button>
            <button type="button" onClick={() => navigate('/questionnaire')} className="rounded-full border border-[#B9A28E] bg-white px-6 py-3 font-semibold text-brown-dark transition hover:bg-[#FAF3EC] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2">Continue Guided Matching</button>
          </div>
        </div>
      </div>
    </PortalCard>
  );
};

const ReleaseDialog: React.FC<{
  therapistName: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ therapistName, submitting, onCancel, onConfirm }) => {
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, submitting]);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#332B25]/45 px-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onCancel(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="release-title" aria-describedby="release-description" className="w-full max-w-lg rounded-2xl border border-[#E2D5C9] bg-[#FFFCF8] p-6 shadow-2xl md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9B5B43]">Before you continue</p>
        <h2 id="release-title" className="mt-2 font-serif text-3xl font-semibold text-brown-dark">Request a different therapist?</h2>
        <p id="release-description" className="mt-4 leading-7 text-brown-soft">Your assignment with {therapistName} will end, and they will be notified. You’ll then be able to browse or be matched with another therapist.</p>
        <p className="mt-4 rounded-xl border border-[#E5D7C9] bg-[#F8F1E9] px-4 py-3 text-sm leading-6 text-brown-soft">Existing session records are kept according to Shura’s care and cancellation policies.</p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={cancelButton} type="button" disabled={submitting} onClick={onCancel} className="rounded-full border border-[#BDAA98] px-5 py-2.5 font-semibold text-brown-dark hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:opacity-50">Keep My Therapist</button>
          <button type="button" disabled={submitting} onClick={onConfirm} className="rounded-full bg-[#8C4F3A] px-5 py-2.5 font-semibold text-white hover:bg-[#74402F] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{submitting ? 'Updating…' : 'Request Different Therapist'}</button>
        </div>
      </section>
    </div>
  );
};

const ClientTherapistPage: React.FC = () => {
  const navigate = useNavigate();
  const [therapist, setTherapist] = useState<AssignedTherapist | null>(null);
  const [messagingEnabled, setMessagingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [therapistData, settings] = await Promise.all([
        clientPortalApi.getAssignedTherapist(),
        clientPortalApi.getSettings().catch(() => null),
      ]);
      setTherapist(therapistData.therapist);
      setMessagingEnabled(settings?.features?.messagingEnabled === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const availabilityByDay = useMemo(() => {
    const result = new Map<number, AssignedTherapist['availability']>();
    therapist?.availability?.forEach((band) => result.set(band.dayOfWeek, [...(result.get(band.dayOfWeek) || []), band]));
    return result;
  }, [therapist]);

  const closeRelease = useCallback(() => setReleaseOpen(false), []);

  const releaseTherapist = async () => {
    setReleasing(true);
    try {
      await clientPortalApi.releaseTherapist();
      setReleaseOpen(false);
      setTherapist(null);
      navigate('/therapists', { state: { fromPortal: true, message: 'Your therapist preference has been updated.' } });
    } catch (err) {
      setReleaseOpen(false);
      setToast(err instanceof Error ? err.message : 'We could not update your therapist assignment.');
    } finally {
      setReleasing(false);
    }
  };

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!therapist) return <EmptyTherapistState />;

  const subtitle = [therapist.professionalTitle, ...therapist.credentials].filter(Boolean).join(' · ');

  return (
    <div className="space-y-6">
      <PortalCard className="relative overflow-hidden p-0 md:p-0">
        <div className="absolute right-0 top-0 h-44 w-44 translate-x-16 -translate-y-16 rotate-45 rounded-[42px] border-[24px] border-[#EDF2EA]" aria-hidden="true" />
        <div className="relative grid gap-8 p-6 md:p-8 lg:grid-cols-[220px_1fr] lg:p-10">
          <div className="flex justify-center lg:justify-start">
            {therapist.imageUrl ? (
              <img src={therapist.imageUrl} alt={`Portrait of ${therapist.name}`} className="h-48 w-48 rounded-full border-4 border-white object-cover shadow-[0_12px_40px_rgba(92,80,67,0.16)]" />
            ) : (
              <div className="grid h-48 w-48 place-items-center rounded-full border-4 border-white bg-[#E8D5C4] font-serif text-5xl font-semibold text-[#744D3C] shadow-[0_12px_40px_rgba(92,80,67,0.14)]" aria-label={`${therapist.name} profile placeholder`}>{initials(therapist.name)}</div>
            )}
          </div>
          <div className="min-w-0 text-center lg:text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8C6E58]">Your therapist</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <h2 className="font-serif text-3xl font-semibold text-brown-dark md:text-4xl">{therapist.name}</h2>
              {therapist.verified && <VerifiedMark />}
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-[15px] leading-6 text-brown-soft lg:mx-0">{subtitle}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {therapist.reviewCount > 0 ? <span className="rounded-full bg-[#F7EEDC] px-3 py-1.5 text-sm font-semibold text-[#6F5625]" aria-label={`${therapist.rating} out of 5 stars from ${therapist.reviewCount} reviews`}><span aria-hidden="true">★</span> {therapist.rating.toFixed(1)} · {therapist.reviewCount} {therapist.reviewCount === 1 ? 'review' : 'reviews'}</span> : <span className="rounded-full bg-[#F1ECE6] px-3 py-1.5 text-sm font-medium text-brown-soft">New to Shura reviews</span>}
              {therapist.sessionTypes.map((type) => <span key={type} className="rounded-full border border-[#DCCDBF] bg-white px-3 py-1.5 text-sm capitalize text-brown-soft">{type === 'audio' ? 'Audio only' : type}</span>)}
            </div>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <button type="button" onClick={() => navigate(`/portal/book?therapist=${therapist.id}`)} className="rounded-full bg-[#8C4F3A] px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-[#74402F] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2">Book a Session</button>
              {messagingEnabled && <button type="button" onClick={() => navigate(`/chat/${therapist.id}`)} className="rounded-full border border-[#9CA995] bg-[#F2F6EF] px-6 py-3 font-semibold text-[#40573C] transition hover:bg-[#E7EFE3] focus:outline-none focus:ring-2 focus:ring-[#70866A] focus:ring-offset-2">Send Message</button>}
            </div>
          </div>
        </div>
      </PortalCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <PortalCard>
            <h2 className="font-serif text-2xl font-semibold text-brown-dark">About</h2>
            <p className="mt-4 whitespace-pre-line text-[16px] leading-8 text-brown-soft">{therapist.bio || `${therapist.name} offers compassionate, client-centred support through Shura.`}</p>
          </PortalCard>

          <PortalCard>
            <h2 className="font-serif text-2xl font-semibold text-brown-dark">Specialisations</h2>
            {therapist.specialisations.length ? <div className="mt-5 flex flex-wrap gap-2">{therapist.specialisations.map((item) => <span key={item} className="rounded-full bg-[#F4E9DF] px-3.5 py-2 text-sm font-medium text-[#744D3C]">{item}</span>)}</div> : <p className="mt-3 text-brown-soft">Specialisation details will be available soon.</p>}
          </PortalCard>

          <PortalCard>
            <div className="grid gap-7 md:grid-cols-2">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-brown-dark">Therapeutic approach</h2>
                <p className="mt-3 text-[15px] leading-7 text-brown-soft">{therapist.approach || 'Your therapist will discuss their evidence-based approach with you before your first session.'}</p>
              </div>
              <div className="border-t border-sand pt-7 md:border-l md:border-t-0 md:pl-7 md:pt-0">
                <h2 className="font-serif text-2xl font-semibold text-brown-dark">Faith and care</h2>
                <p className="mt-3 text-[15px] leading-7 text-brown-soft">{therapist.faithIntegration || 'Faith integration is guided by your comfort, values, and preferences throughout care.'}</p>
              </div>
            </div>
          </PortalCard>
        </div>

        <aside className="space-y-6">
          <PortalCard>
            <h2 className="font-serif text-2xl font-semibold text-brown-dark">Languages</h2>
            <div className="mt-4 flex flex-wrap gap-2">{(therapist.languages.length ? therapist.languages : ['English']).map((language) => <span key={language} className="rounded-full border border-[#DDD1C5] bg-[#FCFAF7] px-3 py-2 text-sm text-brown-dark"><span className="mr-1.5" aria-hidden="true">{languageFlag(language)}</span>{language}</span>)}</div>
          </PortalCard>

          <PortalCard>
            <h2 className="font-serif text-2xl font-semibold text-brown-dark">Session options</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div><dt className="font-semibold text-brown-dark">Formats</dt><dd className="mt-1 capitalize text-brown-soft">{therapist.sessionTypes.length ? therapist.sessionTypes.map((type) => type === 'audio' ? 'Audio only' : type).join(' · ') : 'Contact Shura for availability'}</dd></div>
              <div><dt className="font-semibold text-brown-dark">Durations</dt><dd className="mt-1 text-brown-soft">{therapist.durationOptions.map((duration) => `${duration} min`).join(' · ')}</dd></div>
            </dl>
          </PortalCard>

          <PortalCard>
            <h2 className="font-serif text-2xl font-semibold text-brown-dark">General availability</h2>
            <p className="mt-2 text-sm leading-5 text-brown-soft">A weekly preview for planning. Live times are confirmed during booking.</p>
            {availabilityByDay.size ? <div className="mt-5 space-y-3">{DAY_NAMES.map((day, index) => {
              const bands = availabilityByDay.get(index);
              if (!bands?.length) return null;
              return <div key={day} className="flex items-start justify-between gap-4 border-b border-sand pb-3 last:border-0"><span className="font-medium text-brown-dark">{day}</span><span className="text-right text-sm leading-5 text-brown-soft">{bands.map((band) => `${formatTime(band.startTime)}–${formatTime(band.endTime)}`).join(', ')}</span></div>;
            })}</div> : <p className="mt-4 rounded-xl bg-[#F7F2EC] px-4 py-3 text-sm leading-6 text-brown-soft">General availability has not been published yet. Live openings will be shown when you book.</p>}
          </PortalCard>
        </aside>
      </div>

      <div className="pb-2 text-center">
        <button type="button" onClick={() => setReleaseOpen(true)} className="rounded-lg px-3 py-2 text-sm font-medium text-brown-soft underline decoration-[#CBB8A7] underline-offset-4 hover:text-[#8C4F3A] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2">Request a Different Therapist</button>
      </div>

      {releaseOpen && <ReleaseDialog therapistName={therapist.name} submitting={releasing} onCancel={closeRelease} onConfirm={() => void releaseTherapist()} />}
      {toast && <Toast kind="error" message={toast} onClose={() => setToast('')} />}
    </div>
  );
};

export default ClientTherapistPage;
