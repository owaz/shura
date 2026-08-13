# Product workflows

## Client identity and onboarding

1. Client enters Auth0 Universal Login for login or signup.
2. Auth0 Action requires email verification for database users and emits client claims.
3. `/api/auth/session` links/creates the local `users` row and reports onboarding status.
4. Incomplete clients are routed through resumable portal onboarding.
5. Completion persists profile, matching preferences, goals/notes, and a completion timestamp.

The separate short questionnaire can attempt therapist auto-assignment and send an administrative email. It is distinct from the longer tokenized intake form.

## Therapist application and approval

1. Therapist signs up through Auth0 with intended role `therapist`; metadata begins `pending`.
2. Authenticated therapist completes the professional application in PostgreSQL.
3. Admin reviews pending applications.
4. Approval updates local status and Auth0 metadata/unblocks/assigns configured therapist role. Rejection requires a reason and blocks Auth0.
5. Only approved therapists appear in public discovery and can maintain active client relationships.

Because pending therapist logins are denied by the Auth0 post-login Action, the exact first-login/application ordering depends on tenant configuration and the application redirect. This interaction needs end-to-end verification; repository code alone does not prove every tenant setting.

## Therapist assignment

Assignments can originate from admin action, questionnaire/intake auto-match, or client chat selection. The durable invariant is one active therapist per client, even though some legacy routes were written before that invariant and may surface conflict errors rather than perform a clean reassignment.

Client release marks the current assignment `released`, creates a notification, and attempts therapist email. Selecting another therapist should be an explicit product action; merely opening a chat must not silently violate the assignment invariant.

## Intake form

1. Assigned therapist/admin issues a seven-day link for a client.
2. Anyone holding the link can view limited client identity and submit until expiry/completion; the token is the authorization secret.
3. Submission stores the form, completes the token, emails an administrative summary, and attempts auto-assignment.
4. Assigned therapist views intake data through an authenticated relationship-scoped endpoint.

Token values must not be logged or exposed beyond the recipient. Intake submission and token completion are currently separate queries rather than one explicit transaction, so partial failure behavior should be considered when changing the flow.

## Discovery, booking, and payment

1. User browses approved therapists and requests slots for a date.
2. Unauthenticated/legacy booking can create a pending booking; the preferred paid-slot flow creates a Razorpay order/intention first.
3. Successful signed payment verification or signed capture webhook rechecks the slot and atomically creates confirmed booking/payment rows.
4. Booking confirmation emails and connected-calendar creation happen after database finalization.

Payment does not reserve a slot until finalization. A competing client can take it; the paid intent becomes conflicted and requires an operational refund/recovery path. The repository does not fully define that customer-support workflow.

## Session management

Clients list sessions as upcoming, past, or cancelled. Within policy they can reschedule or cancel. Changes are transactional, audited in `client_session_events`, and followed by notifications, email, and calendar sync. Eligible Razorpay refunds are asynchronous relative to cancellation and can be pending or failed.

At join time, text sessions navigate to chat. Video/audio secure join is unavailable until a provider is implemented. Completed sessions can be reviewed once.

## Messaging and realtime

Chat is tied to an active therapist-client assignment. Messages persist in PostgreSQL, update conversation time, then emit to per-user Socket.IO rooms. Message history paginates and marks messages from the other participant read.

Legacy call signaling is not equivalent to this relationship-scoped model and must not be used as evidence of a secure production call workflow.

## Account deletion

Client requests deletion from an authenticated route. The backend blocks Auth0, deletes the local user (allowing PostgreSQL cascades), deletes Auth0, and then removes an Azure profile image if applicable. A cross-provider partial failure is reported as incomplete and needs human/operational follow-up; no reconciliation worker exists.
