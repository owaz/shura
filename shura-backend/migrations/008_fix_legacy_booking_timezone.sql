-- Repair records created by the original 007 backfill, which interpreted
-- legacy booking date/time fields as UTC instead of the application's existing
-- Asia/Kolkata booking timezone. Fresh installs receive the correct value from
-- 007 and do not match this predicate.
UPDATE bookings
SET scheduled_at = (date::timestamp + time::time) AT TIME ZONE 'Asia/Kolkata'
WHERE date IS NOT NULL
  AND time IS NOT NULL
  AND scheduled_at = (date::timestamp + time::time) AT TIME ZONE 'UTC';
