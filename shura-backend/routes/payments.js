const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const auth = authenticateToken;

/**
 * POST /api/payments/create-order
 * Create a Razorpay payment order for a booking
 * Body: { booking_id, amount }
 */
router.post('/create-order', auth, async (req, res) => {
  try {
    const { booking_id, amount } = req.body;
    const user_id = req.user.id;

    if (!booking_id || !amount) {
      return res.status(400).json({ error: 'booking_id and amount are required' });
    }

    // Verify booking belongs to user
    const bookingResult = await pool.query(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
      [booking_id, user_id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Create Razorpay order
    const orderOptions = {
      amount: amount, // amount in paise
      currency: 'INR',
      receipt: `booking_${booking_id}_${Date.now()}`,
      notes: {
        booking_id,
        user_id
      }
    };

    const razorpayOrder = await razorpay.orders.create(orderOptions);

    // Save payment record in DB
    const payment = await pool.query(
      `INSERT INTO payments (user_id, therapist_id, booking_id, amount, status, razorpay_order_id, created_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, NOW())
       RETURNING id`,
      [user_id, bookingResult.rows[0].therapist_id, booking_id, amount / 100, razorpayOrder.id]
    );

    res.status(201).json({
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      payment_id: payment.rows[0].id,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

/**
 * POST /api/payments/verify
 * Verify Razorpay payment and update booking status
 * Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature, booking_id }
 */
router.post('/verify', auth, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, booking_id } = req.body;
    const user_id = req.user.id;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Payment details are required' });
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const calculatedSignature = hmac.digest('hex');

    if (calculatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Update payment record
    const paymentResult = await pool.query(
      `UPDATE payments 
       SET status = 'completed', razorpay_payment_id = $1, completed_at = NOW() 
       WHERE razorpay_order_id = $2 AND user_id = $3
       RETURNING *`,
      [razorpay_payment_id, razorpay_order_id, user_id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Update booking status to confirmed
    if (booking_id) {
      await pool.query(
        'UPDATE bookings SET status = $1 WHERE id = $2 AND user_id = $3',
        ['confirmed', booking_id, user_id]
      );
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: paymentResult.rows[0]
    });
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

/**
 * GET /api/payments/status/:payment_id
 * Get payment status
 */
router.get('/status/:payment_id', auth, async (req, res) => {
  try {
    const { payment_id } = req.params;
    const user_id = req.user.id;

    const payment = await pool.query(
      'SELECT id, status, amount_cents, created_at, completed_at FROM payments WHERE id = $1 AND client_id = $2',
      [payment_id, user_id]
    );

    if (payment.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ payment: payment.rows[0] });
  } catch (err) {
    console.error('Error fetching payment status:', err);
    res.status(500).json({ error: 'Failed to fetch payment status' });
  }
});

/**
 * POST /api/payments/webhook
 * Razorpay webhook for payment events
 * Signature verification required
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.rawBody; // Requires middleware to preserve raw body for signature verification

    // Verify webhook signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
    hmac.update(body);
    const calculatedSignature = hmac.digest('hex');

    if (calculatedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body;

    // Handle payment.captured event
    if (event.event === 'payment.captured') {
      const paymentId = event.payload.payment.entity.id;
      const orderId = event.payload.payment.entity.order_id;

      // Update payment status
      await pool.query(
        `UPDATE payments SET status = 'completed', completed_at = NOW() 
         WHERE metadata->>'order_id' = $1`,
        [orderId]
      );

      console.log(`Payment ${paymentId} captured and updated in DB`);
    }

    // Handle payment.failed event
    if (event.event === 'payment.failed') {
      const orderId = event.payload.payment.entity.order_id;

      await pool.query(
        `UPDATE payments SET status = 'failed' WHERE metadata->>'order_id' = $1`,
        [orderId]
      );

      console.log(`Payment for order ${orderId} failed`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error handling Razorpay webhook:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * GET /api/payments/my-payments
 * Get payment history for logged-in user
 */
router.get('/my-payments', auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT 
        p.id, 
        p.booking_id, 
        p.amount, 
        p.status, 
        p.razorpay_order_id,
        p.razorpay_payment_id,
        p.created_at,
        p.completed_at
      FROM payments p
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC`,
      [user_id]
    );

    return res.json({ payments: result.rows });
  } catch (err) {
    console.error('Get payments error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
