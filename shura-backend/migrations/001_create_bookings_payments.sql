-- Bookings and Payments Schema for Shura Platform

-- ==================== BOOKINGS TABLE ====================
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  
  -- Booking details
  booking_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  session_type VARCHAR(50) NOT NULL CHECK (session_type IN ('video', 'audio', 'text', 'intro')),
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no-show')),
  
  -- Pricing
  amount_inr DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_free_session BOOLEAN DEFAULT false,
  
  -- Metadata
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('client', 'therapist', 'admin')),
  cancelled_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for bookings
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_therapist ON bookings(therapist_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- ==================== PAYMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  
  -- Payment details
  amount_inr DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  
  -- Razorpay details
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  razorpay_signature VARCHAR(255),
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'initiated', 'success', 'failed', 'refunded')),
  
  -- Refund tracking
  refund_amount DECIMAL(10, 2),
  refund_reason TEXT,
  refunded_at TIMESTAMP,
  
  -- Metadata
  payment_method VARCHAR(50),
  failure_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(razorpay_payment_id)
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON payments(razorpay_order_id);

-- ==================== THERAPIST AVAILABILITY TABLE ====================
CREATE TABLE IF NOT EXISTS therapist_availability (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  
  -- Day and time
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Indexes for availability
CREATE INDEX IF NOT EXISTS idx_availability_therapist ON therapist_availability(therapist_id);
CREATE INDEX IF NOT EXISTS idx_availability_day ON therapist_availability(day_of_week);

-- ==================== THERAPIST TIME OFF TABLE ====================
CREATE TABLE IF NOT EXISTS therapist_time_off (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Index for time off
CREATE INDEX IF NOT EXISTS idx_time_off_therapist ON therapist_time_off(therapist_id);
CREATE INDEX IF NOT EXISTS idx_time_off_dates ON therapist_time_off(start_date, end_date);

-- ==================== TRIGGER FOR UPDATED_AT ====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== SAMPLE DATA ====================
-- Add some therapist availability (for testing)
INSERT INTO therapist_availability (therapist_id, day_of_week, start_time, end_time)
SELECT 
  t.id,
  day,
  '09:00:00'::TIME,
  '17:00:00'::TIME
FROM therapists t
CROSS JOIN generate_series(1, 5) AS day
WHERE t.status = 'approved'
ON CONFLICT DO NOTHING;
