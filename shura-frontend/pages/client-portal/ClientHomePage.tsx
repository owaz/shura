import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientPortalApi, PortalApiError } from './clientPortalApi';
import type { ClientDashboardSummary, ClientSession, QuoteOfTheDay } from './clientPortalTypes';
import { ErrorState, PageSkeleton, PortalCard, Toast } from './PortalUi';
import { CancelDialog, RescheduleDialog, fullDate, primaryButton, secondaryButton, sessionTypeLabel, textButton, timeText, timezoneName } from './ClientSessionUi';

type ToastState = { kind: 'success' | 'error' | 'info'; message: string } | null;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const countdownText = (session: ClientSession, clock: number) => {
  const startsAt = new Date(session.scheduledAt).getTime();
  const endsAt = startsAt + session.durationMinutes * 60_000;
  if (clock >= startsAt && clock <= endsAt) return 'Session in progress';
  const minutes = Math.max(0, Math.ceil((startsAt - clock) / 60_000));
  if (minutes < 60) return `Starts in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Starts in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.floor(hours / 24);
  return `Starts in ${days} ${days === 1 ? 'day' : 'days'}`;
};

const ClientHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<ClientDashboardSummary | null>(null);
  const [quote, setQuote] = useState<QuoteOfTheDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [reschedule, setReschedule] = useState<ClientSession | null>(null);
  const [cancel, setCancel] = useState<ClientSession | null>(null);
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [clock, setClock] = useState(() => Date.now());

  const loadQuote = useCallback(async () => {
    setQuoteError('');
    try {
      setQuote(await clientPortalApi.getQuoteOfTheDay());
    } catch (quoteLoadError) {
      setQuoteError(quoteLoadError instanceof Error ? quoteLoadError.message : 'Today’s quote could not be loaded.');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [dashboardResult, quoteResult] = await Promise.allSettled([
      clientPortalApi.getDashboard(),
      clientPortalApi.getQuoteOfTheDay(),
    ]);
    if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value);
    else setError(dashboardResult.reason instanceof Error ? dashboardResult.reason.message : 'Your dashboard could not be loaded.');
    if (quoteResult.status === 'fulfilled') {
      setQuote(quoteResult.value);
      setQuoteError('');
    } else {
      setQuoteError(quoteResult.reason instanceof Error ? quoteResult.reason.message : 'Today’s quote could not be loaded.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast || toast.kind === 'error') return;
    const timer = window.setTimeout(() => setToast(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const nextSession = dashboard?.nextSession || null;
  const joinOpen = useMemo(() => {
    if (!nextSession) return false;
    const end = new Date(nextSession.scheduledAt).getTime() + nextSession.durationMinutes * 60_000;
    return ['pending', 'confirmed', 'upcoming', 'live'].includes(nextSession.status)
      && clock >= new Date(nextSession.actions.joinAvailableAt).getTime()
      && clock <= end;
  }, [clock, nextSession]);

  const join = async () => {
    if (!nextSession) return;
    setJoining(true);
    try {
      const result = await clientPortalApi.joinSession(nextSession.id);
      const target = result.url;
      if (!target) throw new Error('The session link is not available yet.');
      window.location.assign(target);
    } catch (joinError) {
      setToast({ kind: 'error', message: joinError instanceof PortalApiError ? joinError.message : 'We could not open your session.' });
    } finally {
      setJoining(false);
    }
  };

  const refreshAfterAction = (message: string) => {
    setReschedule(null);
    setCancel(null);
    setToast({ kind: 'success', message });
    void load();
  };

  if (loading) return <PageSkeleton />;
  if (error || !dashboard) return <ErrorState message={error} onRetry={() => void load()} />;

  const memberSince = new Intl.DateTimeFormat('en-GB', {
    timeZone: dashboard.timezone,
    month: 'long',
    year: 'numeric',
  }).format(new Date(dashboard.memberSince));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9B5B43]">Where Faith Meets Healing</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-brown-dark md:text-4xl">Assalamu Alaikum, {dashboard.greetingName}.</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-7 text-brown-soft">Here is what needs your attention today. Take things one gentle step at a time.</p>
      </header>

      {nextSession ? <PortalCard className={`relative overflow-hidden p-0 md:p-0 ${joinOpen ? 'border-[#9CB394] shadow-[0_12px_38px_rgba(83,110,77,0.13)]' : ''}`}>
        <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full border-[25px] border-[#EEF2E9]" aria-hidden="true" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C624E]">Your next session</p>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${joinOpen ? 'bg-[#E4EFE0] text-[#405E3C]' : 'bg-[#F5E9DE] text-[#76513E]'}`}>
              {joinOpen && <span className="h-2 w-2 rounded-full bg-[#5F7E58] motion-safe:animate-pulse" aria-hidden="true" />}
              {countdownText(nextSession, clock)}
            </span>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              {nextSession.therapist.imageUrl
                ? <img src={nextSession.therapist.imageUrl} alt={`${nextSession.therapist.name}, your therapist`} className="h-20 w-20 shrink-0 rounded-full object-cover shadow-md" />
                : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#E8D5C4] font-serif text-xl font-bold text-[#744D3C]" aria-hidden="true">{initials(nextSession.therapist.name)}</div>}
              <div className="min-w-0"><h3 className="truncate font-serif text-2xl font-semibold text-brown-dark">{nextSession.therapist.name}</h3>{nextSession.therapist.credentials.length > 0 && <p className="mt-1 truncate text-sm text-brown-soft">{nextSession.therapist.credentials.join(', ')}</p>}<span className="mt-3 inline-flex rounded-full bg-[#EEF3EB] px-3 py-1 text-xs font-bold text-[#4C6648]">{sessionTypeLabel(nextSession.sessionType)}</span></div>
            </div>
            <dl className="grid gap-4 rounded-2xl border border-sand bg-[#FCF9F5] p-5 sm:grid-cols-2">
              <div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Date</dt><dd className="mt-1 font-semibold text-brown-dark">{fullDate(nextSession.scheduledAt, nextSession.clientTimezone)}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Time</dt><dd className="mt-1 font-semibold text-brown-dark">{timeText(nextSession.scheduledAt, nextSession.clientTimezone)}</dd><dd className="text-xs text-brown-soft">{timezoneName(nextSession.scheduledAt, nextSession.clientTimezone)}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Duration</dt><dd className="mt-1 font-semibold text-brown-dark">{nextSession.durationMinutes} minutes</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Timezone</dt><dd className="mt-1 break-words font-semibold text-brown-dark">{nextSession.clientTimezone}</dd></div>
            </dl>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-sand pt-5">
            <span id="dashboard-join-help" className="mr-auto text-sm text-brown-soft">{joinOpen ? 'Your session room is available.' : `Join opens at ${timeText(nextSession.actions.joinAvailableAt, nextSession.clientTimezone)}.`}</span>
            <button type="button" disabled={!joinOpen || joining} onClick={() => void join()} aria-describedby="dashboard-join-help" title={joinOpen ? 'Join your session' : `Available ${timeText(nextSession.actions.joinAvailableAt, nextSession.clientTimezone)}`} className={primaryButton}>{joining ? 'Opening…' : 'Join'}</button>
            <button type="button" disabled={!nextSession.actions.canReschedule} title={!nextSession.actions.canReschedule ? `Rescheduling closes ${nextSession.actions.rescheduleCutoffHours} hours before the session` : undefined} onClick={() => setReschedule(nextSession)} className={secondaryButton}>Reschedule</button>
            <button type="button" disabled={!nextSession.actions.canCancel} onClick={() => setCancel(nextSession)} className={textButton}>Cancel</button>
          </div>
        </div>
      </PortalCard> : <PortalCard className="relative overflow-hidden py-12 text-center">
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full border-[32px] border-[#F3E6DA]" aria-hidden="true" />
        <div className="absolute -bottom-16 -right-14 h-44 w-44 rotate-45 rounded-[38px] border-[24px] border-[#E8EFE6]" aria-hidden="true" />
        <div className="relative"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#F2E6DA] text-3xl text-[#8C4F3A]" aria-hidden="true">☾</div><h3 className="mt-5 font-serif text-2xl font-semibold text-brown-dark">You have no upcoming sessions.</h3><p className="mx-auto mt-2 max-w-md text-[15px] leading-6 text-brown-soft">When you feel ready, your next step is waiting here.</p><button type="button" onClick={() => navigate(dashboard.therapist ? `/portal/book?therapist=${dashboard.therapist.id}` : '/therapists')} className={`${primaryButton} mt-6`}>{dashboard.therapist ? `Book a Session with ${dashboard.therapist.name}` : 'Find a Therapist'}</button></div>
      </PortalCard>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <PortalCard>
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8C624E]">Your care team</p><h3 className="mt-2 font-serif text-2xl font-semibold text-brown-dark">Your therapist</h3></div>{dashboard.therapist && <button type="button" onClick={() => navigate('/portal/therapist')} className={textButton}>View Full Profile</button>}</div>
          {dashboard.therapist ? <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            {dashboard.therapist.imageUrl ? <img src={dashboard.therapist.imageUrl} alt={`${dashboard.therapist.name}, your therapist`} className="h-20 w-20 rounded-full object-cover" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#E8D5C4] font-serif text-xl font-bold text-[#744D3C]" aria-hidden="true">{initials(dashboard.therapist.name)}</div>}
            <div className="min-w-0 flex-1"><p className="font-serif text-xl font-semibold text-brown-dark">{dashboard.therapist.name}</p>{dashboard.therapist.credentials.length > 0 && <p className="mt-1 text-sm text-brown-soft">{dashboard.therapist.credentials.join(', ')}</p>}<div className="mt-3 flex flex-wrap gap-2">{dashboard.therapist.specialisations.slice(0, 4).map((item) => <span key={item} className="rounded-full bg-[#F4E9DF] px-3 py-1.5 text-xs font-semibold text-[#744D3C]">{item}</span>)}</div></div>
            {dashboard.features.messagingEnabled && <button type="button" onClick={() => navigate(`/chat/${dashboard.therapist?.id}`)} className={secondaryButton}>Message</button>}
          </div> : <div className="mt-5 rounded-xl bg-[#F8F3EE] p-5"><p className="font-semibold text-brown-dark">You are not assigned to a therapist yet.</p><button type="button" onClick={() => navigate('/therapists')} className={`${secondaryButton} mt-4`}>Browse Therapists</button></div>}
          {dashboard.therapist && <button type="button" onClick={() => navigate('/portal/therapist?release=1')} className="mt-5 text-sm font-semibold text-[#8C4F3A] underline decoration-[#CBB8A7] underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]">Request Different Therapist</button>}
        </PortalCard>

        <PortalCard>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8C624E]">Your journey</p><h3 className="mt-2 font-serif text-2xl font-semibold text-brown-dark">At a glance</h3>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#F7F1EA] p-4"><dt className="text-xs font-semibold text-brown-soft">Completed</dt><dd className="mt-1 font-serif text-3xl font-semibold text-brown-dark">{dashboard.stats.completed}</dd></div>
            <div className="rounded-xl bg-[#EEF3EB] p-4"><dt className="text-xs font-semibold text-brown-soft">Upcoming</dt><dd className="mt-1 font-serif text-3xl font-semibold text-brown-dark">{dashboard.stats.upcoming}</dd></div>
            <div className="col-span-2 rounded-xl border border-sand p-4"><dt className="text-xs font-semibold text-brown-soft">Member since</dt><dd className="mt-1 font-semibold text-brown-dark">{memberSince}</dd></div>
          </dl>
        </PortalCard>
      </div>

      <section aria-labelledby="quote-heading" className="relative overflow-hidden rounded-2xl border border-[#D8C9B9] bg-[#F6EEE5] p-6 shadow-[0_8px_30px_rgba(92,80,67,0.06)] md:p-8" style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, rgba(140,79,58,0.07) 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/65 via-transparent to-[#E8EFE6]/60" aria-hidden="true" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C624E]">A daily reflection</p><h3 id="quote-heading" className="mt-2 font-serif text-2xl font-semibold text-brown-dark">Islamic quote of the day</h3>
          {quoteError && <div className="mt-5 rounded-xl border border-[#D5A59C] bg-white/80 p-4" role="alert"><p className="text-sm text-[#8D352D]">{quoteError}</p><button type="button" onClick={() => void loadQuote()} className="mt-3 text-sm font-semibold text-[#8C4F3A] underline underline-offset-4">Try again</button></div>}
          {!quoteError && quote?.quote && <blockquote className="mt-6 max-w-4xl">
            <p dir="rtl" lang="ar" className="font-arabic text-right text-3xl leading-[1.9] text-brown-dark md:text-4xl">{quote.quote.arabicText}</p>
            <p className="mt-5 text-[16px] leading-8 text-brown-soft">“{quote.quote.englishTranslation}”</p>
            <footer className="mt-4 text-sm font-semibold text-[#76513E]">{quote.quote.source}{quote.quote.translationAttribution ? ` · Translation: ${quote.quote.translationAttribution}` : ''}</footer>
            {quote.quote.arabicAttribution && <p className="mt-2 text-xs text-brown-soft">Arabic text: {quote.quote.arabicAttribution}</p>}
          </blockquote>}
          {!quoteError && quote && !quote.quote && <div className="mt-5 rounded-xl border border-[#D8C9B9] bg-white/75 p-5"><p className="font-semibold text-brown-dark">Today’s reflection is being prepared.</p><p className="mt-2 text-sm leading-6 text-brown-soft">Religious text and translations appear here only after scholarly and editorial review.</p></div>}
        </div>
      </section>

      {reschedule && <RescheduleDialog session={reschedule} onClose={() => setReschedule(null)} onSuccess={() => refreshAfterAction('Your session has been rescheduled.')} onError={(message) => setToast({ kind: 'error', message })} />}
      {cancel && <CancelDialog session={cancel} onClose={() => setCancel(null)} onSuccess={(_session, refundStatus) => refreshAfterAction(refundStatus === 'completed' ? 'Your session was cancelled and refunded.' : 'Your session has been cancelled.')} onError={(message) => setToast({ kind: 'error', message })} />}
      {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ClientHomePage;
