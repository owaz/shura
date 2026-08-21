# Product workflows

## Client identity and onboarding

1. Client enters Auth0 Universal Login for login or signup.
2. Auth0 Action requires email verification for database users and emits client claims.
3. `/api/auth/session` links/creates the local `users` row and reports onboarding status.
4. For same-browser client signup, the verified session reconciles the pending signup full name through `/api/auth/signup-profile`; the backend replaces only an empty or known Auth0 fallback name.
5. Incomplete clients are routed through resumable portal onboarding.
6. Completion persists profile, matching preferences, goals/notes, and a completion timestamp.

The separate short questionnaire can attempt therapist auto-assignment and queue a minimal administrative email that directs staff to the portal. It is distinct from the longer tokenized intake form.

## Client home and notifications

1. The authenticated home loads one dashboard summary containing the client's next active session, assigned approved therapist, session counts, and feature flags.
2. Session actions use the same server policy calculations and mutation contracts as session management. The browser countdown is presentational; the join endpoint re-enforces the opening time.
3. The shared portal header loads an unread count and a client-owned paginated notification list. Clients may mark one or all notifications read.
4. Booking, reschedule, cancellation, payment/refund, assignment, and release paths create typed notification metadata. The API converts only recognized types into internal portal actions and does not accept a stored arbitrary navigation URL.
5. The quote endpoint chooses one approved active entry for the server's UTC date. If editorial review has not activated any entry, the home shows a preparation state rather than unreviewed religious text.

## Therapist application and approval

1. Therapist signs up through Auth0 with intended role `therapist`; metadata begins `pending`.
2. Authenticated therapist completes the professional application in PostgreSQL.
3. Admin reviews pending applications.
4. Approval updates local status and Auth0 metadata/unblocks/assigns configured therapist role. Rejection requires a reason and blocks Auth0.
5. Only approved therapists appear in public discovery and can maintain active client relationships.

Because pending therapist logins are denied by the Auth0 post-login Action, the exact first-login/application ordering depends on tenant configuration and the application redirect. This interaction needs end-to-end verification; repository code alone does not prove every tenant setting.

## Therapist assignment

Assignments can originate from admin action, questionnaire/intake auto-match, or client chat selection. The durable invariant is one active therapist per client, even though some legacy routes were written before that invariant and may surface conflict errors rather than perform a clean reassignment.

Client release marks the current assignment `released`, creates a notification, and queues therapist email in the same transaction. Selecting another therapist should be an explicit product action; merely opening a chat must not silently violate the assignment invariant.

## Intake form

1. Assigned therapist/admin issues a seven-day link for a client.
2. Anyone holding the link can view limited client identity and submit until expiry/completion; the token is the authorization secret.
3. Submission stores the form, completes the token, queues a minimal portal-directed administrative alert, and attempts auto-assignment.
4. Assigned therapist views intake data through an authenticated relationship-scoped endpoint.

Token values must not be logged or used in email event keys. Intake form insertion, token completion, and its administrative email intent share one database transaction.

## Discovery, booking, and payment

1. A portal client opens the four-step flow for their active approved therapist, with supported saved preferences used as defaults.
2. Shura derives duration pricing and live slots on the server, rendering times in the client's saved IANA timezone.
3. Covered/free sessions recheck and create a confirmed booking inside one locked transaction without Razorpay.
4. Paid sessions create a Razorpay order and durable portal intent without reserving the slot.
5. Successful signed browser verification or signed capture webhook locks the intent, rechecks assignment/offering/availability/overlap, and atomically creates confirmed booking/payment rows.
6. Booking confirmation email intent is inserted in the booking transaction. Resend delivery and connected-calendar creation occur asynchronously after database finalization. The client can separately download an owned `.ics` file.

Unauthenticated/legacy booking and payment routes remain for compatibility. New portal consumers use the structured `/api/client` contracts.

Payment does not reserve a slot until finalization. A competing booking or eligibility change can prevent finalization; the paid intent becomes conflicted and visibly requires a refund. The intent-recovery API preserves that state, while provider refund execution/reconciliation still requires an operational workflow.

## Client billing and receipts

1. The authenticated client loads a server-derived paid, covered, free, or disabled billing mode and the current cancellation/refund policy.
2. Upcoming sessions show whether payment was completed at booking, covered, or free; the UI does not imply an automatic future charge.
3. Paginated history combines durable payment records with unmatched booking intents, preserving failed/pending checkout and captured conflict-refund states without duplicating completed intents.
4. A receipt download uses the typed billing record ID returned by history. The backend rechecks ownership and capture state before generating a private PDF containing payment and appointment metadata only.
5. Saved payment-method controls are absent because the current Razorpay integration does not implement a secure customer/token lifecycle.

## Session management

Clients list sessions as upcoming, past, or cancelled. Within policy they can reschedule or cancel. Changes, audit events, and email intent are transactional; Resend delivery and calendar sync happen afterward. Eligible Razorpay refunds are asynchronous relative to cancellation and can be pending or failed.

Booking-confirmation preferences are enforced before queueing. Reminder scheduling, SMS reminders, newsletters/campaigns, and platform-update email delivery are not implemented merely because related preference or content columns exist.

At join time, text sessions navigate to chat. Video/audio secure join is unavailable until a provider is implemented. Completed sessions can be reviewed once.

## Messaging and realtime

Chat is tied to an active therapist-client assignment. Messages persist in PostgreSQL, update conversation time, then emit to per-user Socket.IO rooms. Message history paginates and marks messages from the other participant read.

Legacy call signaling is not equivalent to this relationship-scoped model and must not be used as evidence of a secure production call workflow.

## Account deletion

Client requests deletion from an authenticated route. The backend blocks Auth0, deletes the local user (allowing PostgreSQL cascades), deletes Auth0, and then removes an Azure profile image if applicable. A cross-provider partial failure is reported as incomplete and needs human/operational follow-up; no reconciliation worker exists.
