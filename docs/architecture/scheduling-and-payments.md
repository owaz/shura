# Scheduling, sessions, and payments

## Availability model

Therapists manage weekly `therapist_availability_rules` keyed by day of week, local start/end time, slot length, and IANA timezone, plus absolute `therapist_blocked_times` ranges. Public therapist profile booking and client session rescheduling query these records while excluding non-cancelled overlaps.

The older `therapist_availability` and `therapist_time_off` tables remain in the base schema but current booking routes primarily use the newer rule/blocked-time tables.

## Booking consistency

Booking creation and paid finalization use PostgreSQL advisory transaction locks by therapist and date. They recheck availability/blocked times and rely on unique/index constraints to reject races. Client rescheduling locks the booking row, then uses the same therapist/date lock and overlap checks before updating both `scheduled_at` and legacy `date/time` fields.

Do not split these checks from the transaction or trust a slot list previously shown by the frontend. Database time and indexes are the final conflict authority.

Supported session types are `video`, `audio`, and `text`. Portal therapist duration options are constrained to 30, 50, or 80 minutes; booking records default to 50 minutes where absent.

## Client session policy

`utils/clientSessionPolicy.js` is the policy implementation. Defaults are persisted/overridable through `platform_settings.session_policies`:

- active/upcoming statuses: pending, confirmed, upcoming, live
- past statuses: completed and normalized no-show variants
- join opens 10 minutes before start and closes at session end
- reschedule cutoff: 24 hours before start
- cancellation remains possible until session end
- refund eligibility: paid and at least 24 hours before start
- completed sessions allow exactly one rating (1–5) and optional comment up to 1,000 characters

Cancellation reasons are optional and capped at 1,000 characters. Reschedule/cancel changes write `client_session_events` and notifications. Email and calendar updates occur after the database commit.

## Razorpay paid-slot flow

The preferred flow separates payment intent from booking creation:

1. Authenticated client posts therapist, date, time, session type, and optional client amount to `/api/payments/create-order`.
2. Server validates the slot inputs and derives the expected amount from the therapist rate; a browser-supplied amount cannot reduce it.
3. Server creates the Razorpay order and stores `payment_booking_intents` without reserving a booking.
4. Browser posts Razorpay payment/order/signature to `/verify-and-finalize-booking`, or the signed `payment.captured` webhook arrives.
5. Server verifies the signature, locks the intent and therapist/date, rechecks slot availability, and atomically creates booking/payment records and marks the intent complete.
6. Repeated verification returns the existing finalized records. Slot races mark the intent `conflict`.

The webhook requires `X-Razorpay-Event-Id`, verifies the raw request body with `RAZORPAY_WEBHOOK_SECRET`, and inserts the event ID before processing to deduplicate delivery. `payment.failed`, `refund.processed`, and `refund.failed` update durable status.

Legacy “booking first, then order/verify” endpoints remain. Avoid new consumers; preserve them only deliberately.

## Cancellation and refunds

Client cancellation updates booking/event/notification state first. If the policy makes a captured Razorpay payment refundable, payment refund status is set to pending in the transaction and the provider refund is attempted afterward. Provider success/failure then updates payment/refund fields; signed webhooks can reconcile final state.

Because provider calls are outside the database transaction, retries must remain idempotent and operations need visibility for failed/pending refunds. Do not equate a cancelled booking with a completed refund.

## Calendar synchronization

New bookings, reschedules, and cancellations asynchronously create/update/delete Google or Outlook events for connected therapist integrations. `booking_calendar_events` records provider IDs, status, last error, and sync time. Database success does not guarantee calendar success; user-facing and operational flows must tolerate `failed` sync status.

## Video and text joining

Text sessions resolve to the assignment-scoped chat route. Video/audio joining uses `services/video/videoProvider.js`, which is intentionally unconfigured and returns a stable 503 error. Any real provider adapter must create/end rooms, produce participant-scoped access, enforce booking ownership and join windows, and avoid reusing legacy `/api/calls` mock behavior.
