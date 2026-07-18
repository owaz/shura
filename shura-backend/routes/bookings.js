const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { 
  sendBookingConfirmation, 
  sendBookingNotificationToTherapist,
  sendCancellationConfirmation,
  sendCancellationNotificationToTherapist 
} = require('../utils/emailService');
const { syncBookingToConnectedCalendars } = require('../utils/calendarIntegrations');

const dispatchBookingNotifications = (emailData) => {
  void Promise.allSettled([
    Promise.resolve().then(() => sendBookingConfirmation(emailData)),
    Promise.resolve().then(() => sendBookingNotificationToTherapist(emailData)),
  ]).then((results) => {
    results
      .filter((result) => result.status === 'rejected')
      .forEach((result) => console.error('Booking email dispatch error:', result.reason));
  });
};

const toMinutes = (time) => {
  const [hours, minutes] = String(time).slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
};

const toSlot = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const getDayOfWeek = (date) => {
  const parsed = new Date(`${date}T00:00:00+05:30`);
  return parsed.getDay();
};

const findMatchingRuleForTime = (rules, requestedTime) => {
  const requestedMinutes = toMinutes(String(requestedTime).slice(0, 5));
  return rules.find((rule) => {
    const slotMinutes = Number(rule.slot_minutes || 30);
    return requestedMinutes >= toMinutes(rule.start_time) && requestedMinutes + slotMinutes <= toMinutes(rule.end_time);
  });
};

const slotOverlapsBlock = (date, slot, slotMinutes, block) => {
  const start = new Date(`${date}T${slot}:00+05:30`);
  const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
  return start < new Date(block.ends_at) && end > new Date(block.starts_at);
};

const normalizeRules = (rules = []) => rules
  .filter((rule) => Number.isInteger(Number(rule.day_of_week)))
  .map((rule) => ({
    day_of_week: Number(rule.day_of_week),
    start_time: String(rule.start_time || '09:00').slice(0, 5),
    end_time: String(rule.end_time || '17:00').slice(0, 5),
    slot_minutes: Number(rule.slot_minutes || 30),
    timezone: rule.timezone || 'Asia/Kolkata',
    is_active: rule.is_active !== false,
  }))
  .filter((rule) => rule.day_of_week >= 0 && rule.day_of_week <= 6 && toMinutes(rule.end_time) > toMinutes(rule.start_time));

// Manage therapist weekly availability
router.get('/therapist/availability', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    const [rules, blockedTimes] = await Promise.all([
      pool.query(
        `SELECT id, day_of_week, start_time, end_time, slot_minutes, timezone, is_active
         FROM therapist_availability_rules
         WHERE therapist_id = $1
         ORDER BY day_of_week ASC`,
        [req.user.id]
      ),
      pool.query(
        `SELECT id, starts_at, ends_at, reason
         FROM therapist_blocked_times
         WHERE therapist_id = $1 AND ends_at >= NOW()
         ORDER BY starts_at ASC
         LIMIT 100`,
        [req.user.id]
      ),
    ]);

    res.json({ rules: rules.rows, blockedTimes: blockedTimes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/therapist/availability', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    const rules = normalizeRules(req.body.rules || []);
    if (!rules.length) {
      return res.status(400).json({ error: 'At least one valid availability rule is required' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM therapist_availability_rules WHERE therapist_id = $1', [req.user.id]);
    for (const rule of rules) {
      await client.query(
        `INSERT INTO therapist_availability_rules
          (therapist_id, day_of_week, start_time, end_time, slot_minutes, timezone, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.user.id, rule.day_of_week, rule.start_time, rule.end_time, rule.slot_minutes, rule.timezone, rule.is_active]
      );
    }
    await client.query('COMMIT');

    const { rows } = await pool.query(
      `SELECT id, day_of_week, start_time, end_time, slot_minutes, timezone, is_active
       FROM therapist_availability_rules
       WHERE therapist_id = $1
       ORDER BY day_of_week ASC`,
      [req.user.id]
    );
    res.json({ rules: rows });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/therapist/blocked-times', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    const { starts_at, ends_at, reason } = req.body || {};
    if (!starts_at || !ends_at) {
      return res.status(400).json({ error: 'starts_at and ends_at are required' });
    }

    const startsAt = new Date(starts_at);
    const endsAt = new Date(ends_at);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return res.status(400).json({ error: 'Invalid blocked time range' });
    }

    const { rows } = await pool.query(
      `INSERT INTO therapist_blocked_times (therapist_id, starts_at, ends_at, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, starts_at, ends_at, reason`,
      [req.user.id, startsAt.toISOString(), endsAt.toISOString(), reason || null]
    );

    res.status(201).json({ blockedTime: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/therapist/blocked-times/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    const result = await pool.query(
      `DELETE FROM therapist_blocked_times
       WHERE id = $1 AND therapist_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Blocked time not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get available time slots for a therapist
router.get('/therapist/:therapistId/slots', async (req, res) => {
  try {
    const { therapistId } = req.params;
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'Valid date query parameter is required' });
    }

    const dayOfWeek = getDayOfWeek(date);
    const rulesResult = await pool.query(
      `SELECT start_time, end_time, slot_minutes, timezone
       FROM therapist_availability_rules
       WHERE therapist_id = $1 AND day_of_week = $2 AND is_active = true`,
      [therapistId, dayOfWeek]
    );

    if (!rulesResult.rows.length) {
      return res.json({ slots: [], requiresAvailability: true });
    }

    const booked = await pool.query(
      'SELECT time FROM bookings WHERE therapist_id = $1 AND date = $2 AND status != $3',
      [therapistId, date, 'cancelled']
    );

    const blocked = await pool.query(
      `SELECT starts_at, ends_at
       FROM therapist_blocked_times
       WHERE therapist_id = $1
         AND starts_at < ($2::date + interval '1 day')
         AND ends_at > $2::date`,
      [therapistId, date]
    );

    const bookedTimes = new Set(booked.rows.map((row) => String(row.time).slice(0, 5)));
    const slots = [];
    for (const rule of rulesResult.rows) {
      const start = toMinutes(rule.start_time);
      const end = toMinutes(rule.end_time);
      const slotMinutes = Number(rule.slot_minutes || 30);
      for (let minutes = start; minutes + slotMinutes <= end; minutes += slotMinutes) {
        const slot = toSlot(minutes);
        const isBlocked = blocked.rows.some((block) => slotOverlapsBlock(date, slot, slotMinutes, block));
        if (!bookedTimes.has(slot) && !isBlocked) {
          slots.push(slot);
        }
      }
    }

    res.json({ slots: [...new Set(slots)].sort(), requiresAvailability: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create booking
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { therapist_id, date, time, session_type } = req.body;
    const user_id = req.user.id;

    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Client access required' });
    }

    const slotsResponse = await pool.query(
      `SELECT start_time, end_time, slot_minutes
       FROM therapist_availability_rules
       WHERE therapist_id = $1 AND day_of_week = $2 AND is_active = true`,
      [therapist_id, getDayOfWeek(date)]
    );
    const requestedTime = String(time).slice(0, 5);
    const matchingRule = findMatchingRuleForTime(slotsResponse.rows, requestedTime);
    const requestedSlotMinutes = Number(matchingRule?.slot_minutes || 30);
    const isWithinAvailability = Boolean(matchingRule);
    if (!isWithinAvailability) {
      return res.status(400).json({ error: 'Requested time is outside therapist availability' });
    }

    const blocked = await pool.query(
      `SELECT id
       FROM therapist_blocked_times
       WHERE therapist_id = $1
        AND starts_at < ($2::date + $3::time + ($4::text || ' minutes')::interval)
        AND ends_at > ($2::date + $3::time)
       LIMIT 1`,
      [therapist_id, date, requestedTime, requestedSlotMinutes]
    );
    if (blocked.rows.length) {
      return res.status(409).json({ error: 'Requested time is blocked by therapist' });
    }

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO bookings (user_id, therapist_id, date, time, session_type, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, therapist_id, date, requestedTime, session_type || 'video', 'pending']
    );
    await client.query('COMMIT');
    
    const booking = result.rows[0];
    
    // Fetch client and therapist details for email
    const clientResult = await pool.query('SELECT full_name, email FROM users WHERE id = $1', [user_id]);
    const therapistResult = await pool.query('SELECT full_name, email FROM therapists WHERE id = $1', [therapist_id]);
    
    if (clientResult.rows.length > 0 && therapistResult.rows.length > 0) {
      const client = clientResult.rows[0];
      const therapist = therapistResult.rows[0];
      
      const emailData = {
        bookingId: booking.id,
        clientName: client.full_name,
        clientEmail: client.email,
        therapistName: therapist.full_name,
        therapistEmail: therapist.email,
        date: booking.date,
        time: booking.time,
        sessionType: booking.session_type,
      };
      
      dispatchBookingNotifications(emailData);
    }

    syncBookingToConnectedCalendars(booking.id).catch(err => {
      console.error('Calendar sync error:', err);
    });
    
    res.json({ booking });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This time slot was just booked. Please choose another time.' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Therapist dashboard summary backed by bookings/payments
router.get('/therapist/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    const [stats, upcoming] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE b.status != 'cancelled' AND b.date >= CURRENT_DATE AND b.date < CURRENT_DATE + INTERVAL '7 days')::int AS upcoming_sessions,
          COUNT(DISTINCT b.user_id) FILTER (WHERE b.status != 'cancelled' AND b.date >= CURRENT_DATE - INTERVAL '30 days')::int AS active_clients,
          COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'completed'), 0)::int AS total_earnings_cents,
          COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'completed' AND p.completed_at >= date_trunc('month', NOW())), 0)::int AS monthly_earnings_cents
         FROM bookings b
         LEFT JOIN payments p ON p.booking_id = b.id
         WHERE b.therapist_id = $1`,
        [req.user.id]
      ),
      pool.query(
        `SELECT b.id, b.date, b.time, b.session_type, b.status, u.full_name as client_name, u.email as client_email
         FROM bookings b
         JOIN users u ON u.id = b.user_id
         WHERE b.therapist_id = $1 AND b.status != 'cancelled' AND b.date >= CURRENT_DATE
         ORDER BY b.date ASC, b.time ASC
         LIMIT 6`,
        [req.user.id]
      ),
    ]);

    res.json({
      stats: {
        ...stats.rows[0],
        profile_views: 0,
      },
      upcomingAppointments: upcoming.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get therapist bookings for calendar view
router.get('/therapist/my-bookings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapist access required' });
    }

    const result = await pool.query(
      `SELECT b.*,
              u.full_name as client_name,
              u.email as client_email,
              COALESCE(
                json_agg(
                  json_build_object(
                    'provider', bce.provider,
                    'syncStatus', bce.sync_status,
                    'providerEventUrl', bce.provider_event_url,
                    'lastError', bce.last_error
                  )
                ) FILTER (WHERE bce.id IS NOT NULL),
                '[]'
              ) as calendar_events
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN booking_calendar_events bce ON bce.booking_id = b.id
       WHERE b.therapist_id = $1
       GROUP BY b.id, u.full_name, u.email
       ORDER BY b.date ASC, b.time ASC`,
      [req.user.id]
    );

    res.json({ bookings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's bookings
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, t.full_name as therapist_name, t.specialization 
       FROM bookings b 
       JOIN therapists t ON b.therapist_id = t.id 
       WHERE b.user_id = $1 
       ORDER BY b.date DESC, b.time DESC`,
      [req.user.id]
    );
    
    res.json({ bookings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific booking details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, t.full_name as therapist_name, t.specialization 
       FROM bookings b 
       JOIN therapists t ON b.therapist_id = t.id 
       WHERE b.id = $1 AND b.user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel booking
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    // Get booking details before cancelling
    const bookingResult = await pool.query(
      `SELECT b.*, u.full_name as client_name, u.email as client_email, 
              t.full_name as therapist_name, t.email as therapist_email
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN therapists t ON b.therapist_id = t.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const booking = bookingResult.rows[0];
    
    // Update booking status
    const result = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      ['cancelled', req.params.id, req.user.id]
    );
    
    // Send cancellation emails
    const emailData = {
      bookingId: booking.id,
      clientName: booking.client_name,
      clientEmail: booking.client_email,
      therapistName: booking.therapist_name,
      therapistEmail: booking.therapist_email,
      date: booking.date,
      time: booking.time,
    };
    
    sendCancellationConfirmation(emailData).catch(err => console.error('Email error:', err));
    sendCancellationNotificationToTherapist(emailData).catch(err => console.error('Email error:', err));
    
    res.json({ booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
