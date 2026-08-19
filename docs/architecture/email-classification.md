# Email Classification: Mandatory vs. Preference-Controlled

**Phase 0 Gate 4: Define message classification**

## Executive Summary

This document classifies all application-generated emails (excluding Auth0-managed emails) as either:
- **Mandatory**: Operational necessity; should not be suppressed by user preference
- **Optional**: User engagement; should respect user preference flags

Current state: **Preferences exist in schema but are NOT consulted by send logic.**

## Current Preferences in Schema

User preferences stored in `users` table (all default to `TRUE`):
- `notification_email_reminder_24h`: Boolean, default TRUE
- `notification_email_reminder_1h`: Boolean, default TRUE  
- `notification_booking_confirmation`: Boolean, default TRUE

## Email Classification Matrix

### Therapist Workflow

#### 1. **Therapist Application Submitted** → Admin
- **Function**: `sendTherapistApplicationNotification()` (emailService.js:58)
- **Trigger**: Therapist completes registration and applies (auth.js:824)
- **Current Behavior**: Detached fire-and-forget; errors logged, not blocked
- **Recipient**: Admin email (process.env.ADMIN_EMAIL)
- **Content**: Therapist name, email, specialties, bio preview
- **Sensitivity**: Medium (contains therapist identity + preferences)
- **Idempotency Risk**: Yes (no idempotency key; retries create duplicates)
- **Preference Check**: None
- **Classification**: **MANDATORY** 
  - Rationale: Admin must approve/reject therapist; notification is operational
  - Cannot be skipped without breaking therapist onboarding workflow

#### 2. **Therapist Approved** → Therapist
- **Function**: `sendTherapistApprovalEmail()` (emailService.js:146)
- **Trigger**: Admin approves therapist via approval route (admin.js, verified via feasibility analysis)
- **Current Behavior**: Detached fire-and-forget; errors logged, not blocked
- **Recipient**: Therapist email
- **Content**: Approval notification + welcome messaging
- **Sensitivity**: Low (operational status notification)
- **Idempotency Risk**: Yes (no idempotency key; retries create duplicates)
- **Preference Check**: None
- **Classification**: **MANDATORY**
  - Rationale: Therapist must know they are approved before clients can book
  - Cannot be skipped without breaking therapist activation workflow

---

### Client Workflow

#### 3. **Client Questionnaire Submitted** → Admin
- **Function**: `sendClientSignupNotification()` (emailService.js:211)
- **Trigger**: Client completes intake questionnaire (auth.js:595)
- **Current Behavior**: Detached fire-and-forget; errors logged, not blocked
- **Recipient**: Admin email (process.env.ADMIN_EMAIL)
- **Content**: Client name, email, basic demographic; intake answers WERE included but now removed (Phase 0 fix)
- **Sensitivity**: Low-Medium (identity + basic info; sensitive answers already removed)
- **Idempotency Risk**: Yes (no idempotency key; retries create duplicates)
- **Preference Check**: None
- **Classification**: **MANDATORY**
  - Rationale: Admin workflow requires notification of new client submissions
  - No user preference exists for this flow (applies to therapists, not clients)

#### 4. **Intake Form Link Generated** → Client
- **Function**: `sendIntakeFormLink()` (emailService.js:303)
- **Trigger**: Admin creates intake link for client (intake.js:66)
- **Current Behavior**: Detached fire-and-forget; errors logged, not blocked
- **Recipient**: Client email
- **Content**: Intake link (random token), link expiry (7 days)
- **Sensitivity**: Medium (contains time-limited access token)
- **Idempotency Risk**: Yes (link regeneration creates new tokens; email replay sends old token)
- **Preference Check**: None
- **Classification**: **MANDATORY**
  - Rationale: Client cannot complete intake without this link
  - Cannot be preference-controlled; operational requirement
  - Multiple links may be issued; latest should supersede

#### 5. **Intake Form Submitted** → Admin
- **Function**: `sendIntakeFormSubmission()` (emailService.js:368)
- **Trigger**: Client submits intake form (intake.js:184)
- **Current Behavior**: Detached fire-and-forget; errors logged, not blocked; **NOW REDACTED** (Phase 0 fix)
- **Recipient**: Admin email (process.env.ADMIN_EMAIL)
- **Content**: Client name, email, submission time (sensitive details removed)
- **Sensitivity**: Low (notification only; detailed data remains in secure portal)
- **Idempotency Risk**: Yes (no idempotency key; retries create duplicate notifications)
- **Preference Check**: None
- **Classification**: **MANDATORY**
  - Rationale: Admin workflow requires notification of form submission
  - Must not be suppressed

---

### Booking & Scheduling

#### 6. **Booking Confirmation** → Client
- **Function**: `sendBookingConfirmation()` (emailService.js:459)
- **Trigger**: Client confirms booking (not yet implemented; stub exists)
- **Current Behavior**: Awaited; errors block booking confirmation response
- **Recipient**: Client email
- **Content**: Session type, date, time, therapist name
- **Sensitivity**: Low (booking details)
- **Idempotency Risk**: Yes (no idempotency key)
- **Preference Check**: **NONE** (but `notification_booking_confirmation` exists in schema)
- **Classification**: **OPTIONAL** (if enabled; currently mandatory because preference not checked)
  - **Current Gap**: Preference field exists but is never consulted
  - **Recommendation**: Consult `users.notification_booking_confirmation` before sending
  - **Default**: TRUE (send by default)
  - **Future**: Phase 1 should enforce preference check

#### 7. **Booking Confirmation** → Therapist
- **Function**: `sendBookingNotificationToTherapist()` (emailService.js:497)
- **Trigger**: Client confirms booking (not yet implemented; stub exists)
- **Current Behavior**: Awaited; errors block booking confirmation response
- **Recipient**: Therapist email
- **Content**: Client name, session type, date, time
- **Sensitivity**: Medium (contains client identity + session schedule)
- **Idempotency Risk**: Yes (no idempotency key)
- **Preference Check**: None
- **Classification**: **MANDATORY**
  - Rationale: Therapist must see all confirmed bookings
  - Cannot be skipped by therapist preference (operational requirement)

#### 8. **Session Rescheduled** → Client + Therapist
- **Function**: `sendSessionRescheduledNotifications()` (emailService.js:537)
- **Trigger**: Either party reschedules session (clientSessions.js:379)
- **Current Behavior**: Detached via Promise.allSettled; errors logged only
- **Recipient**: Client email, Therapist email
- **Content**: New date, new time, rescheduler identity
- **Sensitivity**: Low (scheduling update)
- **Idempotency Risk**: Yes (no idempotency key; reschedule replayed creates duplicate notification)
- **Preference Check**: None
- **Classification**: **MANDATORY**
  - Rationale: Both parties must know session has been rescheduled
  - Cannot be preference-controlled (operational necessity)

#### 9. **Session Cancelled** → Client + Therapist
- **Function**: `sendSessionCancellationNotifications()` (emailService.js:565)
- **Trigger**: Either party cancels session (clientSessions.js:525)
- **Current Behavior**: Detached via Promise.allSettled; errors logged only
- **Recipient**: Client email, Therapist email
- **Content**: Cancellation reason, refund status (if applicable), canceller identity
- **Sensitivity**: Low (scheduling update)
- **Idempotency Risk**: Yes (no idempotency key; cancel replayed creates duplicate notification)
- **Preference Check**: None
- **Classification**: **MANDATORY**
  - Rationale: Both parties must know session has been cancelled
  - Cannot be preference-controlled (operational necessity)

---

### Therapist Release (Inactive Assignment)

#### 10. **Therapist Released** → Therapist
- **Function**: `sendTherapistReleaseNotification()` (emailService.js:497)
- **Trigger**: Admin or system releases therapist from client (likely admin.js, verified via feasibility analysis)
- **Current Behavior**: Detached fire-and-forget; errors logged, not blocked
- **Recipient**: Therapist email
- **Content**: Client name, release reason
- **Sensitivity**: Medium (contains client name + relationship change)
- **Idempotency Risk**: Yes (no idempotency key; retries create duplicates)
- **Preference Check**: None
- **Classification**: **MANDATORY**
  - Rationale: Therapist must know they have been released from a client assignment
  - Cannot be preference-controlled (operational status change)

---

## Missing Reminder Emails

The schema contains preferences for **24-hour and 1-hour session reminders**:
- `notification_email_reminder_24h`
- `notification_email_reminder_1h`

**Current Status**: **NOT IMPLEMENTED**

No reminder-sending function exists in `emailService.js`, and no scheduled task was found in routes or services. These are schema artifacts without corresponding send logic.

### Recommendation for Reminders

**Phase 2+**: Implement scheduled reminder worker (separate from Resend migration):
1. Query `users` with `notification_email_reminder_24h = TRUE` and sessions starting in 24h
2. Query `users` with `notification_email_reminder_1h = TRUE` and sessions starting in 1h
3. Send reminder emails, tracking delivery state via outbox table
4. Reminders should be **OPTIONAL** and respect user preference

---

## Summary: Mandatory vs. Optional

### MANDATORY (10 emails)
1. Therapist application submitted → Admin
2. Therapist approved → Therapist
3. Client questionnaire submitted → Admin
4. Intake form link → Client
5. Intake form submitted (redacted) → Admin
6. Booking confirmation → Therapist
7. Session rescheduled → Client & Therapist
8. Session cancelled → Client & Therapist
9. Therapist released → Therapist
10. *(Booking confirmation → Client: currently mandatory, should become OPTIONAL)*

### OPTIONAL (preference-controlled)
- **Booking confirmation → Client** (FUTURE: currently missing preference check)
- **Session reminder 24h → Client** (NOT YET IMPLEMENTED; preference exists)
- **Session reminder 1h → Client** (NOT YET IMPLEMENTED; preference exists)

---

## Idempotency and Replay Risk

**Current Gap**: No email has an idempotency key. Resend supports 24-hour idempotency keys via the HTTP API.

All emails are at risk of duplicate sends if:
- Request is retried
- Network failure occurs before transporter confirms
- Database connection drops after send but before route returns

**Recommendation for Phase 2**: 
- Implement PostgreSQL outbox table with:
  - Unique `(recipient, email_id, idempotency_key)` constraint
  - 24-hour idempotency window
  - Delivery state tracking (pending, sent, failed, bounce)
- Use Resend idempotency API when available

---

## Implementation Checklist for Phase 1/2

### Phase 1 (Correctness Baseline)
- [ ] Enforce `notification_booking_confirmation` preference in `sendBookingConfirmation()`
- [ ] Log preference checks in send functions for audit trail
- [ ] Add integration tests that verify preferences are respected
- [ ] Document mandatory vs. optional classification in API docs

### Phase 2 (Resend HTTP API + Outbox)
- [ ] Implement outbox table with idempotency and delivery state
- [ ] Update all send functions to use outbox
- [ ] Implement retry worker for failed/pending emails
- [ ] Add Resend webhook handler for delivery events
- [ ] Update preference checks to query outbox status

### Phase 3 (Reminders)
- [ ] Implement reminder-sending scheduled task
- [ ] Query outbox for pending reminders at T-24h and T-1h
- [ ] Respect `notification_email_reminder_24h` and `notification_email_reminder_1h` preferences
- [ ] Track reminder delivery via outbox

---

## Decision Gate: Message Classification Complete

**Approved by**: [TO BE FILLED BY DECISION-MAKER]
**Date**: [TO BE FILLED]

- [ ] All mandatory emails are operationally necessary and cannot be suppressed
- [ ] Optional emails (bookings, reminders) respect user preferences
- [ ] Preference checks will be implemented in Phase 1
- [ ] Reminders will be implemented in Phase 3
- [ ] Proceed to Phase 1 implementation

