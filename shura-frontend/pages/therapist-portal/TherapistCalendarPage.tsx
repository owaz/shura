import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../config/api';

type AvailabilityRule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  timezone: string;
  is_active: boolean;
};

type BlockedTime = {
  id: number;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

type TherapistBooking = {
  id: number;
  date: string;
  time: string;
  session_type: string;
  status: string;
  client_name: string;
  client_email: string;
};

const formatDateOnly = (value: string) => String(value || '').slice(0, 10);

const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const defaultRuleForDay = (day: number): AvailabilityRule => ({
  day_of_week: day,
  start_time: '09:00',
  end_time: '17:00',
  slot_minutes: 30,
  timezone: 'Asia/Kolkata',
  is_active: day >= 1 && day <= 5,
});

const normalizeTime = (value: string) => String(value || '09:00').slice(0, 5);

const TherapistCalendarPage: React.FC = () => {
  const [rules, setRules] = useState<AvailabilityRule[]>(dayLabels.map((_, day) => defaultRuleForDay(day)));
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [bookings, setBookings] = useState<TherapistBooking[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sortedRules = useMemo(() => [...rules].sort((a, b) => a.day_of_week - b.day_of_week), [rules]);

  const loadCalendarData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [availabilityRes, bookingsRes] = await Promise.all([
        apiFetch('/bookings/therapist/availability'),
        apiFetch('/bookings/therapist/my-bookings'),
      ]);
      const availabilityData = await availabilityRes.json();
      const bookingsData = await bookingsRes.json();

      if (!availabilityRes.ok) throw new Error(availabilityData.error || 'Failed to load availability');
      if (!bookingsRes.ok) throw new Error(bookingsData.error || 'Failed to load bookings');

      const incomingRules: AvailabilityRule[] = Array.isArray(availabilityData.rules)
        ? availabilityData.rules.map((rule: any) => ({
            day_of_week: Number(rule.day_of_week),
            start_time: normalizeTime(rule.start_time),
            end_time: normalizeTime(rule.end_time),
            slot_minutes: Number(rule.slot_minutes || 30),
            timezone: rule.timezone || 'Asia/Kolkata',
            is_active: rule.is_active !== false,
          }))
        : [];

      const merged = dayLabels.map((_, day) => incomingRules.find((rule) => rule.day_of_week === day) || defaultRuleForDay(day));
      setRules(merged);
      setBlockedTimes(Array.isArray(availabilityData.blockedTimes) ? availabilityData.blockedTimes : []);
      setBookings(Array.isArray(bookingsData.bookings) ? bookingsData.bookings : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, []);

  const updateRule = (day: number, patch: Partial<AvailabilityRule>) => {
    setRules((prev) => prev.map((rule) => (rule.day_of_week === day ? { ...rule, ...patch } : rule)));
  };

  const saveRules = async () => {
    setIsSavingRules(true);
    setError('');
    setSuccess('');
    try {
      const response = await apiFetch('/bookings/therapist/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: rules.map((rule) => ({
            ...rule,
            start_time: normalizeTime(rule.start_time),
            end_time: normalizeTime(rule.end_time),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save availability');
      setSuccess('Availability updated successfully.');
      const updatedRules: AvailabilityRule[] = Array.isArray(data.rules)
        ? data.rules.map((rule: any) => ({
            day_of_week: Number(rule.day_of_week),
            start_time: normalizeTime(rule.start_time),
            end_time: normalizeTime(rule.end_time),
            slot_minutes: Number(rule.slot_minutes || 30),
            timezone: rule.timezone || 'Asia/Kolkata',
            is_active: rule.is_active !== false,
          }))
        : rules;
      setRules(updatedRules);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save availability');
    } finally {
      setIsSavingRules(false);
    }
  };

  const addBlockedTime = async () => {
    setError('');
    setSuccess('');
    if (!startsAt || !endsAt) {
      setError('Please set both start and end date-times.');
      return;
    }
    try {
      const response = await apiFetch('/bookings/therapist/blocked-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starts_at: startsAt,
          ends_at: endsAt,
          reason: reason || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add blocked time');
      setBlockedTimes((prev) => [...prev, data.blockedTime].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
      setStartsAt('');
      setEndsAt('');
      setReason('');
      setSuccess('Blocked time added.');
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : 'Failed to add blocked time');
    }
  };

  const deleteBlockedTime = async (id: number) => {
    setError('');
    setSuccess('');
    try {
      const response = await apiFetch(`/bookings/therapist/blocked-times/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete blocked time');
      setBlockedTimes((prev) => prev.filter((item) => item.id !== id));
      setSuccess('Blocked time removed.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete blocked time');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-brown-dark">Calendar & Availability</h1>
        <p className="text-brown-soft mt-1">Manage your weekly timings, blocked windows, and upcoming bookings.</p>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{success}</div>}

      <section className="bg-ivory p-6 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif font-semibold text-brown-dark">Weekly Availability Rules</h2>
          <button
            type="button"
            onClick={saveRules}
            disabled={isSavingRules}
            className="bg-brown-soft text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
          >
            {isSavingRules ? 'Saving...' : 'Save Rules'}
          </button>
        </div>

        <div className="space-y-3">
          {sortedRules.map((rule) => (
            <div key={rule.day_of_week} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center bg-white p-3 rounded-lg border border-sand">
              <div className="font-medium text-brown-dark">{dayLabels[rule.day_of_week]}</div>
              <label className="inline-flex items-center gap-2 text-sm text-brown-soft">
                <input
                  type="checkbox"
                  checked={rule.is_active}
                  onChange={(e) => updateRule(rule.day_of_week, { is_active: e.target.checked })}
                />
                Active
              </label>
              <input
                type="time"
                value={normalizeTime(rule.start_time)}
                onChange={(e) => updateRule(rule.day_of_week, { start_time: e.target.value })}
                className="bg-ivory border-sand rounded-md px-3 py-2"
                disabled={!rule.is_active}
              />
              <input
                type="time"
                value={normalizeTime(rule.end_time)}
                onChange={(e) => updateRule(rule.day_of_week, { end_time: e.target.value })}
                className="bg-ivory border-sand rounded-md px-3 py-2"
                disabled={!rule.is_active}
              />
              <select
                value={rule.slot_minutes}
                onChange={(e) => updateRule(rule.day_of_week, { slot_minutes: Number(e.target.value) })}
                className="bg-ivory border-sand rounded-md px-3 py-2"
                disabled={!rule.is_active}
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
              <input
                type="text"
                value={rule.timezone}
                onChange={(e) => updateRule(rule.day_of_week, { timezone: e.target.value })}
                className="bg-ivory border-sand rounded-md px-3 py-2"
                disabled={!rule.is_active}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ivory p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-serif font-semibold text-brown-dark mb-4">Blocked Times</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="bg-white border-sand rounded-md px-3 py-2" />
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="bg-white border-sand rounded-md px-3 py-2" />
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="bg-white border-sand rounded-md px-3 py-2" />
          <button type="button" onClick={addBlockedTime} className="bg-brown-soft text-white rounded-md px-3 py-2 font-semibold">Add Block</button>
        </div>

        <div className="mt-4 space-y-2">
          {blockedTimes.map((block) => (
            <div key={block.id} className="flex items-center justify-between bg-white border border-sand rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-brown-dark">
                  {new Date(block.starts_at).toLocaleString('en-IN')} - {new Date(block.ends_at).toLocaleString('en-IN')}
                </p>
                {block.reason && <p className="text-xs text-brown-soft">{block.reason}</p>}
              </div>
              <button type="button" onClick={() => deleteBlockedTime(block.id)} className="text-sm text-red-600 hover:underline">Remove</button>
            </div>
          ))}
          {!blockedTimes.length && !isLoading && <p className="text-sm text-brown-soft">No blocked times configured.</p>}
        </div>
      </section>

      <section className="bg-ivory p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-serif font-semibold text-brown-dark mb-4">Upcoming and Recent Bookings</h2>
        <div className="space-y-2">
          {bookings.slice(0, 20).map((booking) => (
            <div key={booking.id} className="bg-white border border-sand rounded-lg px-3 py-2 flex items-center justify-between">
              <div>
                <p className="font-medium text-brown-dark">{booking.client_name}</p>
                <p className="text-sm text-brown-soft">
                  {formatDateOnly(booking.date)} @ {String(booking.time).slice(0, 5)} ({booking.session_type})
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-sand text-brown-soft font-semibold">{booking.status}</span>
            </div>
          ))}
          {!bookings.length && !isLoading && <p className="text-sm text-brown-soft">No bookings available yet.</p>}
        </div>
      </section>
    </div>
  );
};

export default TherapistCalendarPage;
