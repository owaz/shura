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

// Get available time slots for a therapist
router.get('/therapist/:therapistId/slots', async (req, res) => {
  try {
    const { therapistId } = req.params;
    const { date } = req.query;
    
    // Simple: return 9am-5pm slots, excluding already booked ones
    const slots = [];
    for (let hour = 9; hour <= 16; hour++) {
      slots.push(`${hour}:00`, `${hour}:30`);
    }
    
    const booked = await pool.query(
      'SELECT time FROM bookings WHERE therapist_id = $1 AND date = $2 AND status != $3',
      [therapistId, date, 'cancelled']
    );
    
    const bookedTimes = booked.rows.map(r => r.time);
    const available = slots.filter(s => !bookedTimes.includes(s));
    
    res.json({ slots: available });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create booking
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { therapist_id, date, time, session_type } = req.body;
    const user_id = req.user.id;
    
    const result = await pool.query(
      `INSERT INTO bookings (user_id, therapist_id, date, time, session_type, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, therapist_id, date, time, session_type || 'video', 'pending']
    );
    
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
      
      // Send confirmation emails (non-blocking)
      sendBookingConfirmation(emailData).catch(err => console.error('Email error:', err));
      sendBookingNotificationToTherapist(emailData).catch(err => console.error('Email error:', err));
    }
    
    res.json({ booking });
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
