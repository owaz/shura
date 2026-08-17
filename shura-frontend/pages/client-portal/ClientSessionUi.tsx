import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clientPortalApi } from './clientPortalApi';
import type { ClientSession, SessionAvailability } from './clientPortalTypes';
import { inputClass } from './PortalUi';

export const primaryButton = 'rounded-full bg-[#8C4F3A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#74402F] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';
export const secondaryButton = 'rounded-full border border-[#BCA998] bg-white px-4 py-2.5 text-sm font-semibold text-brown-dark transition hover:bg-[#F8F1EA] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';
export const textButton = 'rounded-full px-3 py-2.5 text-sm font-semibold text-[#8C4F3A] hover:bg-[#FBF2EC] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';

export const dateParts = (value: string | Date, timezone: string) => {
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

export const fullDate = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(value));

export const shortDate = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  weekday: 'short', day: 'numeric', month: 'short',
}).format(new Date(value));

export const timeText = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  hour: 'numeric', minute: '2-digit',
}).format(new Date(value));

export const timezoneName = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  timeZoneName: 'long',
}).formatToParts(new Date(value)).find((part) => part.type === 'timeZoneName')?.value || timezone;

export const sessionTypeLabel = (type: string) => type === 'audio' ? 'Audio Only' : type === 'text' ? 'Text Session' : 'Video Session';

export const Dialog: React.FC<React.PropsWithChildren<{ title: string; description?: string; onClose: () => void; size?: string }>> = ({ title, description, onClose, size = 'max-w-2xl', children }) => {
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
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-2 text-xl leading-none text-brown-soft hover:bg-sand focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]" aria-label="Close dialog">×</button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
};

export const TherapistIdentity: React.FC<{ session: ClientSession }> = ({ session }) => {
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

export const RescheduleDialog: React.FC<{ session: ClientSession; onClose: () => void; onSuccess: (session: ClientSession) => void; onError: (message: string) => void }> = ({ session, onClose, onSuccess, onError }) => {
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
      onError(err instanceof Error ? err.message : 'Your session could not be rescheduled.');
      setConfirming(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog title="Reschedule your session" description={`Times are shown in ${timezoneName(session.scheduledAt, session.clientTimezone)}.`} onClose={onClose}>
      {loading && <div className="space-y-3" role="status"><span className="sr-only">Loading available times</span><div className="h-12 animate-pulse rounded-xl bg-sand motion-reduce:animate-none" /><div className="h-32 animate-pulse rounded-xl bg-sand motion-reduce:animate-none" /></div>}
      {!loading && error && <div className="rounded-xl border border-[#D5A59C] bg-[#FFF0ED] p-4 text-sm text-[#8D352D]" role="alert">{error}</div>}
      {!loading && !error && !days.length && <div className="rounded-xl border border-sand bg-white p-6 text-center"><p className="font-semibold text-brown-dark">No available times in the next two weeks</p><p className="mt-2 text-sm text-brown-soft">Please keep your current session or try again later.</p></div>}
      {!loading && !error && days.length > 0 && !confirming && <>
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Available dates">{days.map((date) => <button key={date} type="button" onClick={() => { setDay(date); setSelected(''); }} className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] ${day === date ? 'border-[#8C4F3A] bg-[#FBF2EC] text-[#8C4F3A]' : 'border-[#DCCFC3] bg-white text-brown-soft'}`}>{shortDate(`${date}T12:00:00Z`, 'UTC')}</button>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" aria-label="Available times">{(grouped[day] || []).map((slot) => <button key={slot} type="button" onClick={() => setSelected(slot)} className={`rounded-xl border px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] ${selected === slot ? 'border-[#70866A] bg-[#EDF3E9] text-[#3F5D3A] ring-1 ring-[#70866A]' : 'border-[#DCCFC3] bg-white text-brown-dark hover:border-[#9B7B62]'}`}>{timeText(slot, session.clientTimezone)}</button>)}</div>
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

export const CancelDialog: React.FC<{ session: ClientSession; onClose: () => void; onSuccess: (session: ClientSession, refundStatus: string | null) => void; onError: (message: string) => void }> = ({ session, onClose, onSuccess, onError }) => {
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
