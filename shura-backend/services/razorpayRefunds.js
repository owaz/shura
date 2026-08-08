const Razorpay = require('razorpay');

const createRazorpayClient = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error('Razorpay credentials are not configured');
    error.code = 'RAZORPAY_NOT_CONFIGURED';
    throw error;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const refundPayment = async ({ paymentId, amountCents, bookingId }) => {
  const razorpay = createRazorpayClient();
  return razorpay.payments.refund(paymentId, {
    amount: amountCents,
    speed: 'normal',
    notes: { booking_id: String(bookingId), source: 'client_portal_cancellation' },
    receipt: `shura-cancel-${bookingId}`.slice(0, 40),
  });
};

module.exports = { createRazorpayClient, refundPayment };
