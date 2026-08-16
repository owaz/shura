import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientPortalApi, PortalApiError } from './clientPortalApi';
import type { ClientSession, ClientSessionReceipt, Pagination, SessionAvailability } from './clientPortalTypes';
import { ErrorState, PageSkeleton, PortalCard, Toast, inputClass } from './PortalUi';

type SessionTab = 'upcoming' | 'past' | 'cancelled';
type ToastState = { kind: 'success' | 'error' | 'info'; message: string } | null;

const primaryButton = 'rounded-full bg-[#8C4F3A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#74402F] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';
const secondaryButton = 'rounded-full border border-[#BCA998] bg-white px-4 py-2.5 text-sm font-semibold text-brown-dark transition hover:bg-[#F8F1EA] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';
const textButton = 'rounded-full px-3 py-2.5 text-sm font-semibold text-[#8C4F3A] hover:bg-[#FBF2EC] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';

const dateParts = (value: string | Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const read = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${read('year')}-${read('month')}-${read('day')}`;
};

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const fullDate = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(value));

const shortDate = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  weekday: 'short', day: 'numeric', month: 'short',
}).format(new Date(value));

const timeText = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  hour: 'numeric', minute: '2-digit',
}).format(new Date(value));

const timezoneName = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  timeZoneName: 'long',
}).formatToParts(new Date(value)).find((part) => part.type === 'timeZoneName')?.value || timezone;

const statusDetails: Record<string, { label: string; classes: string }> = {
  confirmed: { label: 'Confirmed', classes: 'bg-[#E8F0E4] text-[#466044]' },
  upcoming: { label: 'Confirmed', classes: 'bg-[#E8F0E4] text-[#466044]' },
  live: { label: 'Ready to join', classes: 'bg-[#E8F0E4] text-[#466044]' },
  pending: { label: 'Pending Confirmation', classes: 'bg-[#FFF2D8] text-[#805C1A]' },
  completed: { label: 'Completed', classes: 'bg-[#EDF2E9] text-[#52644D]' },
  cancelled: { label: 'Cancelled', classes: 'bg-[#F2ECE7] text-[#705F52]' },
  no_show_client: { label: 'No-Show – Client', classes: 'bg-[#FFF0ED] text-[#8D352D]' },
  no_show_therapist: { label: 'No-Show – Therapist', classes: 'bg-[#FFF0ED] text-[#8D352D]' },
};

const sessionTypeLabel = (type: string) => type === 'audio' ? 'Audio Only' : type === 'text' ? 'Text Session' : 'Video Session';

const Dialog: React.FC<React.PropsWithChildren<{ title: string; description?: string; onClose: () => void; size?: string }>> = ({ title, description, onClose, size = 'max-w-2xl', children }) => {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button, [href], input, textarea, select')?.focus();
    return () => previous?.focus();
  }, []);
  const handleKeys = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    if (event.key !== 'Tab' || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-brown-dark/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="session-dialog-title" aria-describedby={description ? 'session-dialog-description' : undefined} onKeyDown={handleKeys} className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-[#E4D6C9] bg-[#FAF7F2] p-5 shadow-2xl md:p-7 ${size}`}>
        <div className="flex items-start gap-4">
          <div><h2 id="session-dialog-title" className="font-serif text-2xl font-semibold text-brown-dark">{title}</h2>{description && <p id="session-dialog-description" className="mt-2 text-sm leading-6 text-brown-soft">{description}</p>}</div>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-2 text-xl leading-none text-brown-soft hover:bg-sand" aria-label="Close dialog">×</button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
};

const TherapistIdentity: React.FC<{ session: ClientSession }> = ({ session }) => {
  const initials = session.therapist.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      {session.therapist.imageUrl
        ? <img src={session.therapist.imageUrl} alt={`${session.therapist.name}, your therapist`} className="h-12 w-12 shrink-0 rounded-full object-cover" />
        : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E9D7C7] text-sm font-bold text-brown-dark" aria-hidden="true">{initials}</div>}
      <div className="min-w-0"><p className="truncate font-semibold text-brown-dark">{session.therapist.name}</p>{session.therapist.credentials.length > 0 && <p className="truncate text-sm text-brown-soft">{session.therapist.credentials.join(', ')}</p>}</div>
    </div>
  );
};

const RescheduleDialog: React.FC<{ session: ClientSession; onClose: () => void; onSuccess: (session: ClientSession) => void; onError: (message: string) => void }> = ({ session, onClose, onSuccess, onError }) => {
  const today = dateParts(new Date(), session.clientTimezone);
  const [availability, setAvailability] = useState<SessionAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [day, setDay] = useState('');
  const [selected, setSelected] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    clientPortalApi.getSessionAvailability(session.id, today, addDays(today, 14))
      .then((value) => { if (active) setAvailability(value); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Available times could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.id, today]);

  const grouped = useMemo(() => {
    const result: Record<string, string[]> = {};
    availability?.slots.forEach(({ scheduledAt }) => {
      const key = dateParts(scheduledAt, session.clientTimezone);
      (result[key] ||= []).push(scheduledAt);
    });
    return result;
  }, [availability, session.clientTimezone]);
  const days = Object.keys(grouped).sort();
  useEffect(() => { if (!day && days.length) setDay(days[0]); }, [day, days]);

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await clientPortalApi.rescheduleSession(session.id, selected);
      onSuccess(result.session);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Your session could not be rescheduled.';
      onError(message);
      setConfirming(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog title="Reschedule your session" description={`Times are shown in ${timezoneName(session.scheduledAt, session.clientTimezone)}.`} onClose={onClose}>
      {loading && <div className="space-y-3" role="status"><span className="sr-only">Loading available times</span><div className="h-12 animate-pulse rounded-xl bg-sand" /><div className="h-32 animate-pulse rounded-xl bg-sand" /></div>}
      {!loading && error && <div className="rounded-xl border border-[#D5A59C] bg-[#FFF0ED] p-4 text-sm text-[#8D352D]" role="alert">{error}</div>}
      {!loading && !error && !days.length && <div className="rounded-xl border border-sand bg-white p-6 text-center"><p className="font-semibold text-brown-dark">No available times in the next two weeks</p><p className="mt-2 text-sm text-brown-soft">Please keep your current session or try again later.</p></div>}
      {!loading && !error && days.length > 0 && !confirming && <>
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Available dates">{days.map((date) => <button key={date} type="button" onClick={() => { setDay(date); setSelected(''); }} className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold ${day === date ? 'border-[#8C4F3A] bg-[#FBF2EC] text-[#8C4F3A]' : 'border-[#DCCFC3] bg-white text-brown-soft'}`}>{shortDate(`${date}T12:00:00Z`, 'UTC')}</button>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" aria-label="Available times">{(grouped[day] || []).map((slot) => <button key={slot} type="button" onClick={() => setSelected(slot)} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${selected === slot ? 'border-[#70866A] bg-[#EDF3E9] text-[#3F5D3A] ring-1 ring-[#70866A]' : 'border-[#DCCFC3] bg-white text-brown-dark hover:border-[#9B7B62]'}`}>{timeText(slot, session.clientTimezone)}</button>)}</div>
        <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className={secondaryButton}>Keep current time</button><button type="button" disabled={!selected} onClick={() => setConfirming(true)} className={primaryButton}>Continue</button></div>
      </>}
      {confirming && selected && <>
        <div className="rounded-2xl border border-sand bg-white p-5">
          <div className="grid gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center"><div><p className="text-xs font-bold uppercase tracking-wider text-brown-soft">Current</p><p className="mt-2 font-semibold text-brown-dark">{fullDate(session.scheduledAt, session.clientTimezone)}</p><p className="text-sm text-brown-soft">{timeText(session.scheduledAt, session.clientTimezone)}</p></div><span className="text-2xl text-taupe" aria-hidden="true">→</span><div><p className="text-xs font-bold uppercase tracking-wider text-[#557052]">New</p><p className="mt-2 font-semibold text-brown-dark">{fullDate(selected, session.clientTimezone)}</p><p className="text-sm text-brown-soft">{timeText(selected, session.clientTimezone)}</p></div></div>
        </div>
        <p className="mt-4 text-sm leading-6 text-brown-soft">Your therapist will be notified and connected calendar events will be updated.</p>
        <div className="mt-7 flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setConfirming(false)} className={secondaryButton}>Back</button><button type="button" disabled={saving} onClick={submit} className={primaryButton}>{saving ? 'Rescheduling…' : 'Confirm new time'}</button></div>
      </>}
    </Dialog>
  );
};

const CancelDialog: React.FC<{ session: ClientSession; onClose: () => void; onSuccess: (session: ClientSession, refundStatus: string | null) => void; onError: (message: string) => void }> = ({ session, onClose, onSuccess, onError }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const result = await clientPortalApi.cancelSession(session.id, reason);
      onSuccess(result.session, result.refundStatus);
    } catch (err) { onError(err instanceof Error ? err.message : 'Your session could not be cancelled.'); }
    finally { setSaving(false); }
  };
  return (
    <Dialog title="Cancel this session?" description="Please review the session and cancellation policy before continuing." onClose={onClose}>
      <div className="rounded-xl border border-sand bg-white p-4"><TherapistIdentity session={session} /><div className="mt-4 border-t border-sand pt-4 text-sm text-brown-soft"><p className="font-semibold text-brown-dark">{fullDate(session.scheduledAt, session.clientTimezone)}</p><p>{timeText(session.scheduledAt, session.clientTimezone)} · {session.durationMinutes} minutes · {sessionTypeLabel(session.sessionType)}</p></div></div>
      <div className="mt-4 rounded-xl border border-[#E4C996] bg-[#FFF8E7] p-4 text-sm leading-6 text-[#76561C]"><strong>Cancellation policy:</strong> {session.actions.cancellationPolicyText}{session.actions.refundEligible && <span className="mt-1 block">This cancellation is currently eligible for a full refund.</span>}</div>
      <label htmlFor="cancellation-reason" className="mt-5 block text-sm font-semibold text-brown-dark">Reason for cancellation <span className="font-normal text-brown-soft">(optional)</span></label>
      <textarea id="cancellation-reason" value={reason} maxLength={1000} rows={4} onChange={(event) => setReason(event.target.value)} className={inputClass} placeholder="You can share a brief reason if you wish." />
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={onClose} className={secondaryButton}>Keep My Session</button><button type="button" disabled={saving} onClick={submit} className="rounded-full bg-[#A44838] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#85392E] focus:outline-none focus:ring-2 focus:ring-[#A44838] focus:ring-offset-2 disabled:opacity-50">{saving ? 'Cancelling…' : 'Cancel Session'}</button></div>
    </Dialog>
  );
};

const ReviewDialog: React.FC<{ session: ClientSession; onClose: () => void; onSuccess: () => void; onError: (message: string) => void }> = ({ session, onClose, onSuccess, onError }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try { await clientPortalApi.reviewSession(session.id, rating, comment); onSuccess(); }
    catch (err) { onError(err instanceof Error ? err.message : 'Your review could not be saved.'); }
    finally { setSaving(false); }
  };
  return (
    <Dialog title="Leave a review" description={`How was your session with ${session.therapist.name}?`} onClose={onClose} size="max-w-lg">
      <fieldset><legend className="text-sm font-semibold text-brown-dark">Your rating</legend><div className="mt-3 flex gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} className="rounded-lg p-1 text-3xl text-[#B78432] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]" aria-label={`${value} star${value === 1 ? '' : 's'}`} aria-pressed={rating === value}>{value <= rating ? '★' : '☆'}</button>)}</div></fieldset>
      <label htmlFor="review-comment" className="mt-5 block text-sm font-semibold text-brown-dark">Comments <span className="font-normal text-brown-soft">(optional)</span></label><textarea id="review-comment" value={comment} maxLength={1000} rows={5} onChange={(event) => setComment(event.target.value)} className={inputClass} placeholder="Share what felt helpful about your experience." /><p className="mt-1 text-right text-xs text-brown-soft">{comment.length}/1000</p>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="button" disabled={!rating || saving} onClick={submit} className={primaryButton}>{saving ? 'Submitting…' : 'Submit review'}</button></div>
    </Dialog>
  );
};

const ReceiptDialog: React.FC<{ session: ClientSession; receipt: ClientSessionReceipt; onClose: () => void }> = ({ session, receipt, onClose }) => {
  const amount = new Intl.NumberFormat('en', { style: 'currency', currency: receipt.currency || 'INR' }).format(receipt.amountCents / 100);
  return <Dialog title="Payment receipt" description="A concise record of the payment associated with this session." onClose={onClose} size="max-w-lg"><div className="rounded-2xl border border-sand bg-white p-5"><div className="flex justify-between gap-4 border-b border-sand pb-4"><span className="text-brown-soft">Amount</span><strong className="text-brown-dark">{amount}</strong></div><dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm"><dt className="text-brown-soft">Session</dt><dd className="text-right text-brown-dark">{fullDate(session.scheduledAt, session.clientTimezone)}</dd><dt className="text-brown-soft">Therapist</dt><dd className="text-right text-brown-dark">{session.therapist.name}</dd><dt className="text-brown-soft">Status</dt><dd className="text-right capitalize text-brown-dark">{receipt.status}</dd>{receipt.paymentReference && <><dt className="text-brown-soft">Payment reference</dt><dd className="break-all text-right font-mono text-xs text-brown-dark">{receipt.paymentReference}</dd></>}{receipt.refundReference && <><dt className="text-brown-soft">Refund reference</dt><dd className="break-all text-right font-mono text-xs text-brown-dark">{receipt.refundReference}</dd></>}</dl></div><p className="mt-4 text-xs leading-5 text-brown-soft">PDF downloads and the complete transaction history will be available from Billing.</p><div className="mt-6 flex justify-end"><button type="button" onClick={onClose} className={primaryButton}>Done</button></div></Dialog>;
};

const ClientSessionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<SessionTab>('upcoming');
  const [page, setPage] = useState(1);
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const [reschedule, setReschedule] = useState<ClientSession | null>(null);
  const [cancel, setCancel] = useState<ClientSession | null>(null);
  const [review, setReview] = useState<ClientSession | null>(null);
  const [receipt, setReceipt] = useState<ClientSession | null>(null);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await clientPortalApi.getSessions(tab, page); setSessions(result.data); setPagination(result.pagination); }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong — please try again.'); }
    finally { setLoading(false); }
  }, [page, tab]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (!toast || toast.kind === 'error') return; const timer = window.setTimeout(() => setToast(null), toast.kind === 'success' ? 4000 : 3000); return () => window.clearTimeout(timer); }, [toast]);

  const changeTab = (value: SessionTab) => { setTab(value); setPage(1); };
  const completed = (message: string) => { setReschedule(null); setCancel(null); setReview(null); setToast({ kind: 'success', message }); void load(); };
  const failed = (message: string) => setToast({ kind: 'error', message });
  const join = async (session: ClientSession) => {
    setJoiningId(session.id);
    try {
      const result = await clientPortalApi.joinSession(session.id);
      const target = result.joinUrl || result.url;
      if (!target) throw new Error('The session link is not available yet.');
      if (target.startsWith('/')) window.location.assign(target); else window.open(target, '_blank', 'noopener,noreferrer');
    } catch (err) { failed(err instanceof PortalApiError ? err.message : 'We could not open your session.'); }
    finally { setJoiningId(null); }
  };

  const emptyCopy = {
    upcoming: { title: 'No upcoming sessions', body: 'Book a session with your therapist when you feel ready.', action: 'Book a session' },
    past: { title: 'No completed sessions yet', body: 'Your completed sessions will appear here.', action: '' },
    cancelled: { title: 'No cancelled sessions', body: 'Any cancelled sessions will appear here for your records.', action: '' },
  }[tab];

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9B5B43]">Your care</p><h2 className="mt-2 font-serif text-3xl font-semibold text-brown-dark">My Sessions</h2><p className="mt-2 max-w-2xl text-[15px] leading-6 text-brown-soft">Review what’s ahead, revisit completed sessions, or make a change to an upcoming appointment.</p></div>
      <div className="border-b border-[#DDD0C4]" role="tablist" aria-label="Session status">{(['upcoming', 'past', 'cancelled'] as SessionTab[]).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => changeTab(value)} className={`mr-6 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold capitalize focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 ${tab === value ? 'border-[#B76243] text-brown-dark' : 'border-transparent text-brown-soft hover:text-brown-dark'}`}>{value}</button>)}</div>
      {loading && <PageSkeleton />}
      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && !error && sessions.length === 0 && <PortalCard className="py-12 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F1E5D8] text-3xl" aria-hidden="true">☾</div><h3 className="mt-5 font-serif text-2xl font-semibold text-brown-dark">{emptyCopy.title}</h3><p className="mx-auto mt-2 max-w-md text-brown-soft">{emptyCopy.body}</p>{emptyCopy.action && <button type="button" onClick={() => navigate('/portal/book')} className={`${primaryButton} mt-6`}>{emptyCopy.action}</button>}</PortalCard>}
      {!loading && !error && sessions.length > 0 && <div className="space-y-4">{sessions.map((session) => {
        const status = statusDetails[session.status] || statusDetails.pending;
        const sessionEnd = new Date(session.scheduledAt).getTime() + session.durationMinutes * 60_000;
        const joinOpen = ['pending', 'confirmed', 'upcoming', 'live'].includes(session.status)
          && clock >= new Date(session.actions.joinAvailableAt).getTime()
          && clock <= sessionEnd;
        return <PortalCard key={session.id} className="p-5 md:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center"><div className="min-w-0 lg:w-[31%]"><TherapistIdentity session={session} /></div><div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"><div><p className="text-xs font-bold uppercase tracking-wider text-brown-soft">Date & time</p><p className="mt-1 font-semibold text-brown-dark">{fullDate(session.scheduledAt, session.clientTimezone)}</p><p className="text-sm text-brown-soft">{timeText(session.scheduledAt, session.clientTimezone)} · {timezoneName(session.scheduledAt, session.clientTimezone)}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-brown-soft">Session</p><p className="mt-1 font-semibold text-brown-dark">{sessionTypeLabel(session.sessionType)}</p><p className="text-sm text-brown-soft">{session.durationMinutes} minutes</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-brown-soft">Status</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status.classes}`}>{status.label}</span></div></div></div>
          {tab === 'cancelled' && <div className="mt-4 rounded-xl bg-[#F8F3EE] px-4 py-3 text-sm text-brown-soft"><p>Cancelled {session.cancelledAt ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: session.clientTimezone }).format(new Date(session.cancelledAt)) : ''}{session.cancelledBy ? ` by ${session.cancelledBy}` : ''}.</p>{session.cancellationReason && <p className="mt-1"><strong className="text-brown-dark">Reason:</strong> {session.cancellationReason}</p>}</div>}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-sand pt-4">
            {tab === 'upcoming' && <><button type="button" title={joinOpen ? 'Join your session' : `Available ${session.actions.joinAvailableAt ? timeText(session.actions.joinAvailableAt, session.clientTimezone) : '10 minutes before your session'}`} disabled={!joinOpen || joiningId === session.id} onClick={() => void join(session)} className={primaryButton}>{joiningId === session.id ? 'Opening…' : 'Join'}</button><button type="button" disabled={!session.actions.canReschedule} title={!session.actions.canReschedule ? `Rescheduling closes ${session.actions.rescheduleCutoffHours} hours before the session` : undefined} onClick={() => setReschedule(session)} className={secondaryButton}>Reschedule</button><button type="button" disabled={!session.actions.canCancel} onClick={() => setCancel(session)} className={textButton}>Cancel</button></>}
            {tab === 'past' && <>{session.reviewEligible && <button type="button" onClick={() => setReview(session)} className={secondaryButton}>Leave a Review</button>}{session.reviewed && <span className="mr-auto text-sm text-brown-soft">Review submitted{session.reviewRating ? ` · ${'★'.repeat(session.reviewRating)}` : ''}</span>}{session.receipt && <button type="button" onClick={() => setReceipt(session)} className={textButton}>View Receipt</button>}</>}
            {tab === 'cancelled' && <button type="button" onClick={() => navigate(`/portal/book?therapist=${session.therapist.id}&type=${session.sessionType}&duration=${session.durationMinutes}`)} className={secondaryButton}>Rebook</button>}
          </div>
        </PortalCard>;
      })}</div>}
      {!loading && !error && pagination.totalPages > 1 && <nav className="flex items-center justify-between rounded-xl border border-sand bg-white px-4 py-3" aria-label="Session pages"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className={secondaryButton}>Previous</button><span className="text-sm text-brown-soft">Page {pagination.page} of {pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className={secondaryButton}>Next</button></nav>}
      {reschedule && <RescheduleDialog session={reschedule} onClose={() => setReschedule(null)} onSuccess={() => completed('Your session has been rescheduled.')} onError={failed} />}
      {cancel && <CancelDialog session={cancel} onClose={() => setCancel(null)} onSuccess={(_session, refundStatus) => completed(refundStatus === 'completed' ? 'Your session was cancelled and the refund was initiated.' : 'Your session has been cancelled.')} onError={failed} />}
      {review && <ReviewDialog session={review} onClose={() => setReview(null)} onSuccess={() => completed('Thank you. Your review has been submitted.')} onError={failed} />}
      {receipt?.receipt && <ReceiptDialog session={receipt} receipt={receipt.receipt} onClose={() => setReceipt(null)} />}
      {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ClientSessionsPage;
