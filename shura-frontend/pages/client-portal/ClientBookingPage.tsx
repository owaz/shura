import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clientPortalApi, PortalApiError } from './clientPortalApi';
import type {
  BookingAvailability,
  BookingOptions,
  ConfirmedBooking,
} from './clientPortalTypes';
import { ErrorState, PageSkeleton, PortalCard } from './PortalUi';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let razorpayLoader: Promise<void> | null = null;

const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayLoader) return razorpayLoader;
  razorpayLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Razorpay checkout could not be loaded.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      razorpayLoader = null;
      reject(new Error('Razorpay checkout could not be loaded.'));
    };
    document.body.appendChild(script);
  });
  return razorpayLoader;
};

const primaryButton = 'rounded-full bg-[#8C4F3A] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#74402F] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';
const secondaryButton = 'rounded-full border border-[#BCA998] bg-white px-5 py-3 text-[15px] font-semibold text-brown-dark transition hover:bg-[#F8F1EA] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45';

const typeDetails = {
  video: { label: 'Video', icon: '▣', description: 'A face-to-face session using Shura’s secure provider when configured.' },
  audio: { label: 'Audio only', icon: '◖', description: 'A voice session without camera, with the same dedicated appointment time.' },
  text: { label: 'Text', icon: '✦', description: 'A live written session in your assignment-scoped Shura conversation.' },
} as const;

const dateKey = (value: string | Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const dateLabel = (value: string, timezone: string, short = false) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  weekday: short ? 'short' : 'long',
  day: 'numeric',
  month: short ? 'short' : 'long',
  ...(short ? {} : { year: 'numeric' as const }),
}).format(new Date(value));

const timeLabel = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone, hour: 'numeric', minute: '2-digit',
}).format(new Date(value));

const timezoneLabel = (value: string, timezone: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone, timeZoneName: 'long',
}).formatToParts(new Date(value)).find((part) => part.type === 'timeZoneName')?.value || timezone;

const moneyLabel = (amountMinor: number, currency: string) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(amountMinor / 100);

function nextRadioValue<T>(event: React.KeyboardEvent<HTMLInputElement>, values: readonly T[], current: T): T | null {
  if (event.key === ' ' || event.key === 'Enter') return current;
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
    ? 1
    : ['ArrowLeft', 'ArrowUp'].includes(event.key)
      ? -1
      : 0;
  if (!direction) return null;
  const index = values.indexOf(current);
  return values[(index + direction + values.length) % values.length];
}

const StepHeader: React.FC<{ step: number }> = ({ step }) => {
  const labels = ['Session type', 'Duration', 'Date & time', 'Confirm'];
  return (
    <nav aria-label="Booking progress" className="mb-7">
      <ol className="grid grid-cols-4 gap-2">
        {labels.map((label, index) => {
          const number = index + 1;
          const active = number === step;
          const complete = number < step;
          return <li key={label} aria-current={active ? 'step' : undefined} className="min-w-0"><div className={`h-1.5 rounded-full ${complete ? 'bg-[#70866A]' : active ? 'bg-[#B76243]' : 'bg-[#E2D7CD]'}`} /><span className={`mt-2 block truncate text-xs font-semibold ${active ? 'text-[#8C4F3A]' : complete ? 'text-[#526C4E]' : 'text-brown-soft'}`}><span className="sr-only">Step {number}: </span>{label}</span></li>;
        })}
      </ol>
    </nav>
  );
};

const ClientBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [therapistId, setTherapistId] = useState<number | null>(null);
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [step, setStep] = useState(1);
  const [sessionType, setSessionType] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [availability, setAvailability] = useState<BookingAvailability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [intentOrderId, setIntentOrderId] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const requestedId = Number(searchParams.get('therapist'));
      const assigned = await clientPortalApi.getAssignedTherapist();
      if (!assigned.therapist) {
        setTherapistId(null);
        setOptions(null);
        return;
      }
      const id = Number.isInteger(requestedId) && requestedId === assigned.therapist.id
        ? requestedId
        : assigned.therapist.id;
      const bookingOptions = await clientPortalApi.getBookingOptions(id);
      const requestedType = searchParams.get('type') || '';
      const requestedDuration = Number(searchParams.get('duration'));
      setTherapistId(id);
      setOptions(bookingOptions);
      setSessionType(bookingOptions.sessionTypes.includes(requestedType as 'video' | 'audio' | 'text') ? requestedType : bookingOptions.defaults.sessionType || '');
      setDurationMinutes(bookingOptions.durations.some((item) => item.minutes === requestedDuration) ? requestedDuration : bookingOptions.defaults.durationMinutes || 0);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Booking options could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!loading) headingRef.current?.focus(); }, [loading, step]);

  const today = options ? dateKey(new Date(), options.clientTimezone) : '';
  const loadAvailability = useCallback(async () => {
    if (!therapistId || !options || !sessionType || !durationMinutes || !today) return;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    try {
      const result = await clientPortalApi.getBookingAvailability(
        therapistId,
        today,
        addDays(today, 20),
        sessionType,
        durationMinutes
      );
      setAvailability(result);
      setSelectedDay('');
      setSelectedSlot('');
    } catch (error) {
      setAvailabilityError(error instanceof Error ? error.message : 'Available times could not be loaded.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, [durationMinutes, options, sessionType, therapistId, today]);

  useEffect(() => {
    if (step === 3 && !availability && !availabilityLoading && !availabilityError) void loadAvailability();
  }, [availability, availabilityError, availabilityLoading, loadAvailability, step]);

  const groupedSlots = useMemo(() => {
    const result: Record<string, string[]> = {};
    if (!options) return result;
    availability?.slots.forEach((slot) => {
      const key = dateKey(slot.scheduledAt, options.clientTimezone);
      (result[key] ||= []).push(slot.scheduledAt);
    });
    return result;
  }, [availability, options]);
  const availableDays = Object.keys(groupedSlots).sort();
  useEffect(() => {
    if (!selectedDay && availableDays.length) setSelectedDay(availableDays[0]);
  }, [availableDays, selectedDay]);

  const duration = options?.durations.find((item) => item.minutes === durationMinutes) || null;

  const chooseType = (value: string) => {
    setSessionType(value);
    setAvailability(null);
    setAvailabilityError('');
    setSelectedSlot('');
    setActionError('');
  };
  const chooseDuration = (value: number) => {
    setDurationMinutes(value);
    setAvailability(null);
    setAvailabilityError('');
    setSelectedSlot('');
    setActionError('');
  };

  const next = () => {
    setActionError('');
    if (step === 1 && !sessionType) return setActionError('Choose a session type to continue.');
    if (step === 2 && !durationMinutes) return setActionError('Choose a session duration to continue.');
    if (step === 3 && !selectedSlot) return setActionError('Choose an available time to continue.');
    setStep((value) => Math.min(4, value + 1));
  };

  const paymentCompleted = (booking: ConfirmedBooking) => {
    setConfirmed(booking);
    setSubmitting(false);
    setActionError('');
  };

  const openCheckout = async (result: Extract<Awaited<ReturnType<typeof clientPortalApi.createBooking>>, { kind: 'payment_required' }>) => {
    setIntentOrderId(result.intent.orderId);
    await loadRazorpay();
    if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable right now.');
    const checkout = new window.Razorpay({
      key: result.checkout.keyId,
      amount: result.checkout.amountMinor,
      currency: result.checkout.currency,
      name: 'Shura',
      description: `${durationMinutes}-minute ${sessionType} session`,
      order_id: result.checkout.orderId,
      theme: { color: '#8C4F3A' },
      modal: {
        ondismiss: () => {
          setSubmitting(false);
          setActionError('Checkout was closed before confirmation. Your selections are still here, and you can check the payment status before trying again.');
        },
      },
      handler: async (response: Record<string, string>) => {
        try {
          const finalized = await clientPortalApi.verifyBookingPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          paymentCompleted(finalized.booking);
        } catch (error) {
          setSubmitting(false);
          if (error instanceof PortalApiError && error.code === 'PAID_SLOT_CONFLICT') {
            setActionError('Your payment was received, but the slot was taken during checkout. The booking status shows that a refund is required; please keep the payment reference while Shura resolves it.');
          } else {
            setActionError(error instanceof Error ? error.message : 'Payment verification could not be completed.');
          }
        }
      },
    });
    checkout.on('payment.failed', (response) => {
      setSubmitting(false);
      setActionError(response.error?.description || 'Payment failed. Your booking selections have been kept so you can try again.');
    });
    checkout.open();
  };

  const confirmBooking = async () => {
    if (!therapistId || !selectedSlot || !durationMinutes || !sessionType) return;
    setSubmitting(true);
    setActionError('');
    try {
      const result = await clientPortalApi.createBooking({ therapistId, sessionType, durationMinutes, scheduledAt: selectedSlot });
      if (result.kind === 'confirmed') paymentCompleted(result.booking);
      else await openCheckout(result);
    } catch (error) {
      setSubmitting(false);
      setActionError(error instanceof Error ? error.message : 'This booking could not be completed.');
      if (error instanceof PortalApiError && ['SLOT_CONFLICT', 'SLOT_OUTSIDE_AVAILABILITY'].includes(error.code)) {
        setAvailability(null);
      }
    }
  };

  const recoverPayment = async () => {
    if (!intentOrderId) return;
    setRecovering(true);
    setActionError('');
    try {
      const { intent } = await clientPortalApi.recoverBookingIntent(intentOrderId);
      if (intent.booking) paymentCompleted(intent.booking);
      else if (intent.status === 'conflict') setActionError(`This paid booking has a slot conflict. Refund status: ${intent.refundStatus || 'required'}.`);
      else setActionError(`Payment status: ${intent.status}. If checkout succeeded, allow a moment for secure verification and check again.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The payment status could not be recovered.');
    } finally {
      setRecovering(false);
    }
  };

  const downloadCalendar = async () => {
    if (!confirmed) return;
    setDownloading(true);
    setActionError('');
    try {
      const blob = await clientPortalApi.downloadBookingCalendar(confirmed.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shura-session-${confirmed.id}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The calendar file could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <PageSkeleton />;
  if (pageError) return <ErrorState message={pageError} onRetry={() => void load()} />;
  if (!therapistId || !options) return (
    <PortalCard className="mx-auto max-w-2xl py-12 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#F1E5D8] text-2xl" aria-hidden="true">☾</div>
      <h2 className="mt-5 font-serif text-3xl font-semibold text-brown-dark">Choose your therapist first</h2>
      <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-brown-soft">A portal booking is available once you have an active therapist assignment.</p>
      <button type="button" onClick={() => navigate('/therapists')} className={`${primaryButton} mt-7`}>Find a Therapist</button>
    </PortalCard>
  );

  if (confirmed) return (
    <PortalCard className="mx-auto max-w-3xl overflow-hidden p-0 md:p-0">
      <div className="bg-[#EAF1E6] px-6 py-8 text-center md:px-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#70866A] text-2xl font-bold text-white" aria-hidden="true">✓</div>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-[#526C4E]">Booking confirmed</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-brown-dark">Your session is in the calendar</h1>
      </div>
      <div className="p-6 md:p-10">
        <dl className="grid gap-5 rounded-2xl border border-sand bg-[#FFFCF8] p-5 sm:grid-cols-2">
          <div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Therapist</dt><dd className="mt-1 font-semibold text-brown-dark">{confirmed.therapist.name}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Session</dt><dd className="mt-1 font-semibold capitalize text-brown-dark">{confirmed.sessionType} · {confirmed.durationMinutes} minutes</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Date</dt><dd className="mt-1 font-semibold text-brown-dark">{dateLabel(confirmed.scheduledAt, confirmed.clientTimezone)}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Time</dt><dd className="mt-1 font-semibold text-brown-dark">{timeLabel(confirmed.scheduledAt, confirmed.clientTimezone)} · {timezoneLabel(confirmed.scheduledAt, confirmed.clientTimezone)}</dd></div>
        </dl>
        {actionError && <p className="mt-5 rounded-xl border border-[#D5A59C] bg-[#FFF0ED] px-4 py-3 text-sm text-[#8D352D]" role="alert">{actionError}</p>}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" disabled={downloading} onClick={() => void downloadCalendar()} className={primaryButton}>{downloading ? 'Preparing…' : 'Add to Calendar'}</button>
          <button type="button" onClick={() => navigate('/portal/sessions')} className={secondaryButton}>View My Sessions</button>
        </div>
      </div>
    </PortalCard>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <button type="button" onClick={() => navigate('/portal/therapist')} className="rounded-lg px-2 py-2 text-sm font-semibold text-[#8C4F3A] focus:outline-none focus:ring-2 focus:ring-[#8C4F3A]">← Back to My Therapist</button>
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-[#9B5B43]">Book with {options.therapist.name}</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-brown-dark">Choose a session that feels right</h1>
      </div>
      <PortalCard>
        <StepHeader step={step} />
        <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-semibold text-brown-dark outline-none">
          {step === 1 ? 'How would you like to meet?' : step === 2 ? 'How much time would you like?' : step === 3 ? 'Choose a date and time' : 'Review your booking'}
        </h2>
        {step === 1 && <fieldset className="mt-5"><legend className="sr-only">Session type</legend><div className="grid gap-3 md:grid-cols-3">{options.sessionTypes.map((type) => {
          const detail = typeDetails[type];
          return <label key={type} className={`cursor-pointer rounded-2xl border p-5 transition focus-within:ring-2 focus-within:ring-[#8C4F3A] focus-within:ring-offset-2 ${sessionType === type ? 'border-[#9B5B43] bg-[#FBF2EC] shadow-sm' : 'border-[#DDD0C4] bg-white hover:border-[#BAA391]'}`}><input type="radio" name="session-type" value={type} checked={sessionType === type} onChange={() => chooseType(type)} onKeyDown={(event) => { const nextValue = nextRadioValue(event, options.sessionTypes, type); if (!nextValue) return; event.preventDefault(); chooseType(nextValue); window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`input[name="session-type"][value="${nextValue}"]`)?.focus()); }} className="sr-only" /><span className="text-2xl text-[#8C4F3A]" aria-hidden="true">{detail.icon}</span><span className="mt-3 block font-semibold text-brown-dark">{detail.label}</span><span className="mt-2 block text-[15px] leading-6 text-brown-soft">{detail.description}</span></label>;
        })}</div>{!options.sessionTypes.length && <p className="rounded-xl bg-[#FFF0ED] p-4 text-sm text-[#8D352D]">Your therapist has not published a supported portal session type yet.</p>}</fieldset>}

        {step === 2 && <fieldset className="mt-5"><legend className="sr-only">Session duration</legend><div className="grid gap-3 sm:grid-cols-3">{options.durations.map((item) => <label key={item.minutes} className={`cursor-pointer rounded-2xl border p-5 text-center transition focus-within:ring-2 focus-within:ring-[#8C4F3A] focus-within:ring-offset-2 ${durationMinutes === item.minutes ? 'border-[#9B5B43] bg-[#FBF2EC]' : 'border-[#DDD0C4] bg-white hover:border-[#BAA391]'}`}><input type="radio" name="duration" value={item.minutes} checked={durationMinutes === item.minutes} onChange={() => chooseDuration(item.minutes)} onKeyDown={(event) => { const values = options.durations.map((durationOption) => durationOption.minutes); const nextValue = nextRadioValue(event, values, item.minutes); if (!nextValue) return; event.preventDefault(); chooseDuration(nextValue); window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`input[name="duration"][value="${nextValue}"]`)?.focus()); }} className="sr-only" /><span className="font-serif text-3xl font-semibold text-brown-dark">{item.minutes}</span><span className="block text-[15px] text-brown-soft">minutes</span><span className="mt-3 block text-[15px] font-semibold text-[#526C4E]">{item.kind === 'covered' ? 'Covered by your plan' : item.paymentRequired ? moneyLabel(item.amountMinor, item.currency) : 'No payment required'}</span></label>)}</div><p className="mt-4 text-[15px] leading-6 text-brown-soft">Prices are calculated securely by Shura from your therapist’s configured rate. Your browser does not set the amount.</p></fieldset>}

        {step === 3 && <div className="mt-5">
          <div className="rounded-xl border border-[#DCCFC3] bg-[#F8F3ED] px-4 py-3 text-sm leading-6 text-brown-soft"><strong className="text-brown-dark">Times shown in {options.clientTimezone}.</strong>{options.timezoneDiffers && <> Your therapist’s availability is maintained in {options.therapistTimezone}; Shura converts each opening for you.</>}</div>
          {availabilityLoading && <div className="mt-5 space-y-3" role="status"><span className="sr-only">Loading live availability</span><div className="h-12 animate-pulse rounded-xl bg-sand" /><div className="h-32 animate-pulse rounded-xl bg-sand" /></div>}
          {!availabilityLoading && availabilityError && <div className="mt-5 rounded-xl border border-[#D5A59C] bg-[#FFF0ED] p-4" role="alert"><p className="text-sm text-[#8D352D]">{availabilityError}</p><button type="button" onClick={() => void loadAvailability()} className="mt-3 text-sm font-semibold text-[#8C4F3A] underline">Try again</button></div>}
          {!availabilityLoading && !availabilityError && availability && !availableDays.length && <div className="mt-5 rounded-xl border border-sand bg-white p-7 text-center"><p className="font-semibold text-brown-dark">No openings in the next three weeks</p><p className="mt-2 text-sm text-brown-soft">Try a different session duration or check again later.</p><button type="button" onClick={() => setStep(2)} className={`${secondaryButton} mt-5`}>Change duration</button></div>}
          {!availabilityLoading && !availabilityError && availableDays.length > 0 && <><div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Available dates">{availableDays.map((day) => <button key={day} type="button" onClick={() => { setSelectedDay(day); setSelectedSlot(''); }} aria-pressed={selectedDay === day} className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] ${selectedDay === day ? 'border-[#8C4F3A] bg-[#FBF2EC] text-[#8C4F3A]' : 'border-[#DCCFC3] bg-white text-brown-soft'}`}>{dateLabel((groupedSlots[day] || [])[0], options.clientTimezone, true)}</button>)}</div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" aria-label={`Available times on ${selectedDay}`}>{(groupedSlots[selectedDay] || []).map((slot) => <button key={slot} type="button" onClick={() => setSelectedSlot(slot)} aria-pressed={selectedSlot === slot} className={`rounded-xl border px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#8C4F3A] ${selectedSlot === slot ? 'border-[#70866A] bg-[#EDF3E9] text-[#3F5D3A] ring-1 ring-[#70866A]' : 'border-[#DCCFC3] bg-white text-brown-dark hover:border-[#9B7B62]'}`}>{timeLabel(slot, options.clientTimezone)}</button>)}</div><button type="button" onClick={() => void loadAvailability()} className="mt-5 text-sm font-semibold text-[#8C4F3A] underline underline-offset-4">Refresh live availability</button></>}
        </div>}

        {step === 4 && selectedSlot && duration && <div className="mt-5 space-y-5"><dl className="grid gap-5 rounded-2xl border border-sand bg-[#FFFCF8] p-5 sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Therapist</dt><dd className="mt-1 font-semibold text-brown-dark">{options.therapist.name}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Session</dt><dd className="mt-1 font-semibold text-brown-dark">{typeDetails[sessionType as keyof typeof typeDetails]?.label} · {durationMinutes} minutes</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Date & time</dt><dd className="mt-1 font-semibold text-brown-dark">{dateLabel(selectedSlot, options.clientTimezone)}<span className="block text-sm font-normal text-brown-soft">{timeLabel(selectedSlot, options.clientTimezone)} · {timezoneLabel(selectedSlot, options.clientTimezone)}</span></dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-brown-soft">Payment</dt><dd className="mt-1 font-semibold text-brown-dark">{duration.kind === 'covered' ? 'Covered by your plan' : duration.paymentRequired ? moneyLabel(duration.amountMinor, duration.currency) : 'No payment required'}<span className="block text-sm font-normal text-brown-soft">{duration.paymentRequired ? 'Secure Razorpay checkout' : 'Confirmed immediately after a final availability check'}</span></dd></div></dl><div className="rounded-xl bg-[#F8F3ED] px-4 py-3 text-sm leading-6 text-brown-soft">The slot is checked again when you confirm. For paid sessions, checkout does not reserve it; Shura finalizes the booking only after verifying Razorpay’s signature.</div></div>}

        {actionError && <div className="mt-5 rounded-xl border border-[#D5A59C] bg-[#FFF0ED] px-4 py-3 text-sm leading-6 text-[#8D352D]" role="alert"><p>{actionError}</p>{intentOrderId && <button type="button" disabled={recovering} onClick={() => void recoverPayment()} className="mt-2 font-semibold underline">{recovering ? 'Checking…' : 'Check payment status'}</button>}</div>}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-sand pt-6 sm:flex-row sm:justify-between">
          <button type="button" onClick={() => step === 1 ? navigate('/portal/therapist') : setStep((value) => Math.max(1, value - 1))} className={secondaryButton}>{step === 1 ? 'Cancel' : 'Back'}</button>
          {step < 4 ? <button type="button" disabled={(step === 1 && !sessionType) || (step === 2 && !durationMinutes) || (step === 3 && !selectedSlot)} onClick={next} className={primaryButton}>Continue</button> : <button type="button" disabled={submitting} onClick={() => void confirmBooking()} className={primaryButton}>{submitting ? 'Securing your booking…' : duration?.paymentRequired ? 'Continue to Secure Payment' : 'Confirm Booking'}</button>}
        </div>
      </PortalCard>
    </div>
  );
};

export default ClientBookingPage;
