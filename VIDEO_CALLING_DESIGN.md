# Phase 1 — Daily Video Calling Design

**Recommendation:** evolve the existing `videoProvider` boundary into the single calling abstraction, implement Daily behind it, use Daily Prebuilt for the first release, and remove the legacy WebRTC system completely.

No implementation, migrations, dependencies, or repository changes are included in this phase.

## 1. Key design decisions

| Area | Recommended decision |
|---|---|
| Provider | Daily.co, selected through backend configuration |
| Frontend | Embedded Daily Prebuilt, wrapped in Shura-owned session UX |
| Video state | Independent `video_sessions` lifecycle |
| Provisioning | Create the Shura video record at booking confirmation; create the Daily room lazily on the first eligible join |
| Client access | Opens 10 minutes before `scheduled_at` |
| Therapist access | Opens 20 minutes before `scheduled_at` |
| New joins | Close at scheduled end |
| Reconnection | Prior participants may reconnect for 10 minutes after scheduled end |
| Hard stop | Eject everyone 15 minutes after scheduled end |
| Audio | Daily room with room-level permission allowing audio only |
| Text | No Daily room; existing assignment-scoped chat |
| Knocking | Disabled; all access requires a Shura-issued room-specific token |
| Recording/transcription | Disabled and out of scope |
| Admin access | Metadata only if later required; no admin join capability |
| Legacy calls | Delete rather than retain as fallback |

These values extend the existing 10-minute policy instead of introducing a parallel policy.

---

## 2. Provider abstraction

The existing `shura-backend/services/video/videoProvider.js` remains the single boundary, but its stub contract is replaced with a complete provider-neutral contract.

```ts
type VideoMode = 'video' | 'audio';
type VideoParticipantRole = 'client' | 'therapist';

interface CreateRoomInput {
  idempotencyKey: string;
  startsAt: Date;
  hardEndsAt: Date;
  mode: VideoMode;
  maxParticipants: number;
}

interface VideoRoom {
  roomRef: string;       // Opaque provider identifier
  roomName: string;      // Stored only for provider/webhook correlation
  joinUrl: string;
  expiresAt: Date;
}

interface CreateTokenInput {
  roomRef: string;
  participantRef: string;
  participantName: string;
  participantRole: VideoParticipantRole;
  notBefore: Date;
  expiresAt: Date;
  mode: VideoMode;
}

interface ParticipantAccess {
  token: string;
  joinUrl: string;
  expiresAt: Date;
  startVideoOff: boolean;
}

interface ProviderParticipant {
  participantRef: string;
  providerSessionRef: string;
  joinedAt: Date;
}

interface ProviderSessionInfo {
  state: 'waiting' | 'active' | 'ended' | 'missing';
  startedAt: Date | null;
  endedAt: Date | null;
  participants: ProviderParticipant[];
}

interface VideoProvider {
  createRoom(input: CreateRoomInput): Promise<VideoRoom>;
  createToken(input: CreateTokenInput): Promise<ParticipantAccess>;
  getSessionInfo(roomRef: string): Promise<ProviderSessionInfo>;
  endSession(roomRef: string): Promise<void>;
  deleteRoom(roomRef: string): Promise<void>;
}
```

Normalized provider errors:

```ts
type VideoProviderErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTHENTICATION_FAILED'
  | 'INVALID_REQUEST'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_ALREADY_EXISTS'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'UNKNOWN';
```

Errors carry `code` and `retryable`; provider response bodies, API keys, room tokens, and authorization headers never cross this boundary or enter logs.

Implementation layout:

```text
services/video/videoProvider.js          Provider contract and factory
services/video/dailyVideoProvider.js     Daily REST adapter
services/video/videoService.js           Shura lifecycle orchestration
utils/videoJoinPolicy.js                 Canonical authorization/time predicate
utils/videoReconciliationWorker.js       Webhook and provider reconciliation
routes/videoSessions.js                  Authenticated client/therapist API
routes/dailyWebhook.js                   Daily-specific signed webhook
```

No Daily property names or SDK types appear in booking routes, policy code, or frontend API contracts.

### Configuration

```text
VIDEO_PROVIDER=daily
DAILY_API_KEY
DAILY_API_URL=https://api.daily.co/v1
DAILY_DOMAIN=<domain>.daily.co
DAILY_WEBHOOK_HMAC=<base64 secret>
DAILY_WEBHOOK_BASIC_AUTH=<random webhook probe secret>
```

When `VIDEO_PROVIDER=daily`, startup fails if required values are absent, malformed, non-HTTPS, or if the HMAC is not valid base64. The browser receives only `callingEnabled`; it never receives the provider name or credentials.

---

## 3. Daily room and token configuration

### Room

Daily adapter configuration:

```text
privacy: private
nbf: scheduled_at - 20 minutes
exp: scheduled end + 15 minutes
eject_at_room_exp: true
max_participants: 2
enable_prejoin_ui: true
enable_network_ui: true
enable_knocking: false
enable_screenshare: false
enable_chat: false
enable_people_ui: false
enforce_unique_user_ids: true
```

Recording, transcription, streaming, dial-out, and advanced chat are not enabled.

For audio sessions:

```text
permissions.canSend: ["audio"]
start_video_off: true
```

This enforces audio-only operation rather than merely hiding the camera button.

For video sessions:

```text
permissions.canSend: ["audio", "video"]
```

### Meeting token

Every token is:

- Bound to exactly one `room_name`.
- Bound to a random Shura-generated participant UUID, not an Auth0 `sub`, email, or database ID.
- Valid only for the role-specific window.
- Expired at the hard end.
- Configured with `eject_at_token_exp`.
- Owner-enabled only for the assigned therapist.
- Issued only after backend ownership, payment, refund, booking, and time checks.
- Returned only in the join response and held in browser memory.

Knocking remains disabled because authenticated room-specific tokens already provide admission control. Enabling knocking would create a second access path and require therapist moderation.

---

## 4. Data model

Use `019_video_calling_foundation.sql`, following ADR-0003.

The schema is slightly more normalized than the original starting point because a booking can require multiple provider-room generations after a reschedule. Keeping room history prevents late webhooks from an obsolete room from mutating the current appointment.

### `video_sessions`

One Shura video lifecycle per video/audio booking.

| Column | Purpose |
|---|---|
| `id BIGSERIAL PK` | Internal identifier |
| `booking_id INTEGER UNIQUE NOT NULL` | FK to `bookings(id)` |
| `status VARCHAR(24) NOT NULL` | Independent video status |
| `status_reason VARCHAR(64)` | Stable internal reason code |
| `started_at TIMESTAMPTZ` | Earliest qualifying provider start |
| `ended_at TIMESTAMPTZ` | Finalized end |
| `duration_seconds INTEGER` | Reconciled connected duration |
| `last_error_code VARCHAR(64)` | Sanitized provider/worker error |
| `last_error_at TIMESTAMPTZ` | Last failure |
| `created_at`, `updated_at` | Audit timestamps |

Statuses:

```text
scheduled
provisioning
ready
live
rejoinable
ended
cancelled
expired
failed
```

### `video_session_rooms`

Immutable room generations and provider correlation.

| Column | Purpose |
|---|---|
| `video_session_id` | Parent lifecycle |
| `provider` | `daily` initially |
| `provider_room_id` | Opaque provider identifier |
| `provider_room_name` | Webhook/API correlation |
| `join_url` | Private room URL; contains no token |
| `generation` | Monotonic generation per video session |
| `status` | `provisioning`, `ready`, `retiring`, `deleted`, `delete_failed`, `orphaned` |
| `provider_expires_at` | Provider hard expiry |
| `provision_attempts` | Retry accounting |
| `next_retry_at` | Reconciliation scheduling |
| `last_error_code` | Sanitized failure |
| `created_at`, `retired_at`, `deleted_at` | Lifecycle timestamps |

Constraints:

- Unique `(video_session_id, generation)`.
- Unique `(provider, provider_room_id)`.
- At most one active room generation per video session through a partial unique index.

### `video_participants`

One identity per authorized Shura participant.

| Column | Purpose |
|---|---|
| `video_session_id` | Parent session |
| `principal_role` | `client` or `therapist` |
| `principal_id` | Local role-specific ID |
| `provider_user_id UUID` | Non-identifying token/webhook identity |
| `first_joined_at`, `last_joined_at`, `last_left_at` | Presence summary |
| `connection_count` | Rejoin count |
| `total_connected_seconds` | Reconciled participation |
| `created_at`, `updated_at` | Audit timestamps |

Unique `(video_session_id, principal_role, principal_id)` and unique `provider_user_id`.

The polymorphic local ID is validated against the booking by application code; provider events never supply it.

### `video_participant_connections`

One row per Daily `session_id`, preserving reconnect history:

```text
video_participant_id
video_session_room_id
provider_session_id UNIQUE
joined_at
left_at
duration_seconds
created_at
updated_at
```

### `video_webhook_events`

Durable sanitized webhook inbox:

```text
provider
provider_event_id
event_type
provider_room_name
provider_meeting_id
provider_participant_session_id
provider_user_id
event_occurred_at
joined_at
duration_seconds
processing_status
attempt_count
next_attempt_at
error_code
received_at
processed_at
```

Constraints:

- Unique `(provider, provider_event_id)`.
- Participant events additionally deduplicated on `(provider, event_type, provider_participant_session_id)`, as Daily recommends.
- No raw webhook body, token, participant display name, email, or Auth0 identity is persisted.

### Existing schema handling

- `bookings.scheduled_at` remains authoritative; it is not copied into `video_sessions`.
- `bookings.session_type` remains authoritative; video mode is not duplicated.
- `bookings.video_room_id` becomes unused and deprecated.
- Existing non-null values are not assumed to be Daily rooms and are not migrated automatically.
- The column remains temporarily because ordered migrations are additive. It can be removed only through a separately approved schema-cleanup decision.
- Migration 019 must also normalize the booking-status constraint so `no_show_client` and `no_show_therapist` are writable while legacy `no-show` remains read-compatible.

Before migration implementation, the unresolved live counts for null `scheduled_at` and non-null `video_room_id` remain mandatory deployment preflight checks.

---

## 5. API surface

All authenticated endpoints use Auth0 access tokens and derive role and identity server-side.

| Method and path | Authorization | Purpose |
|---|---|---|
| `GET /api/video/sessions/:bookingId` | Assigned client or assigned approved therapist | State and authoritative join availability |
| `POST /api/video/sessions/:bookingId/join` | Assigned client or assigned approved therapist | Provision room if necessary and issue participant access |
| `POST /api/video/sessions/:bookingId/leave` | Participant who was authorized for the booking | Best-effort leave signal; webhook remains authoritative |
| `POST /api/webhooks/video/daily` | Daily Basic authentication plus HMAC | Provider lifecycle events |

The existing `POST /api/client/sessions/:id/join` is replaced, not retained as a second implementation.

### State response

```json
{
  "bookingId": 123,
  "mode": "video",
  "videoStatus": "ready",
  "join": {
    "allowed": true,
    "reason": null,
    "opensAt": "2026-06-01T09:50:00.000Z",
    "closesAt": "2026-06-01T11:00:00.000Z",
    "reconnectUntil": "2026-06-01T11:10:00.000Z",
    "hardEndsAt": "2026-06-01T11:15:00.000Z"
  },
  "presence": {
    "selfJoined": false,
    "otherParticipantJoined": true
  }
}
```

No room URL or token appears in this response.

### Join response

```json
{
  "mode": "video",
  "roomUrl": "https://example.daily.co/opaque-room",
  "accessToken": "<short-lived token>",
  "accessExpiresAt": "2026-06-01T11:15:00.000Z",
  "hardEndsAt": "2026-06-01T11:15:00.000Z",
  "startVideoOff": false
}
```

### Error behavior

| Status | Code |
|---|---|
| `401` | `AUTHENTICATION_REQUIRED` |
| `403` | `SESSION_ACCESS_DENIED` |
| `409` | `SESSION_NOT_CONFIRMED`, `SESSION_CANCELLED`, `SESSION_PAYMENT_NOT_ELIGIBLE`, `SESSION_REFUND_BLOCKED`, `SESSION_NOT_OPEN`, `SESSION_ENDED`, `SESSION_TYPE_UNSUPPORTED` |
| `422` | `SESSION_TIME_MISSING` |
| `429` | `VIDEO_JOIN_RATE_LIMITED` |
| `503` | `VIDEO_PROVIDER_NOT_CONFIGURED`, `VIDEO_PROVIDER_UNAVAILABLE`, `VIDEO_PROVISIONING` |

A missing booking, another user's booking, and a role mismatch all return the same `403 SESSION_ACCESS_DENIED`. Admins also receive this response; there is no admin join override.

---

## 6. Canonical join predicate

Let:

```text
start          = bookings.scheduled_at
end            = start + bookings.duration_minutes
open           = start - 10 minutes for client
open           = start - 20 minutes for therapist
reconnectUntil = end + 10 minutes
hardEnd        = end + 15 minutes
```

`now` comes from PostgreSQL `NOW()` or an explicitly supplied test clock. PostgreSQL compares `TIMESTAMPTZ` instants; no `date`/`time` reconstruction occurs.

Payment eligibility:

```text
paymentEligible =
  bookings.payment_kind IN ('free', 'covered')
  OR EXISTS (
    payments row for the booking
    WHERE payments.status IN ('completed', 'success', 'paid')
  )
```

Refund blocking:

```text
refundBlocked =
  EXISTS (
    payments row for the booking
    WHERE payments.status = 'refunded'
       OR payments.refund_status IN ('pending', 'processed', 'failed')
  )
```

A failed refund remains blocked, matching the accepted Phase 0.8 decision.

The complete predicate is:

```text
ownsBooking
AND role IN ('client', 'therapist')
AND bookings.session_type IN ('video', 'audio')
AND bookings.scheduled_at IS NOT NULL
AND bookings.status IN ('confirmed', 'upcoming', 'live')
AND paymentEligible
AND NOT refundBlocked
AND videoStatus NOT IN ('ended', 'cancelled', 'expired')
AND (
  (now >= roleOpenAt AND now <= scheduledEnd)
  OR (
    participantPreviouslyJoined
    AND now > scheduledEnd
    AND now <= reconnectUntil
  )
)
```

`pending`, `completed`, all no-show statuses, and `cancelled` are not joinable.

The current `sessionActions()` logic must delegate to or be replaced by this one policy. The list page, detail page, state endpoint, and join endpoint must never calculate independent windows.

---

## 7. Lifecycle and transitions

### Provisioning

1. Paid verification or free/covered confirmation creates the booking.
2. The same database transaction inserts `video_sessions(status='scheduled')` for video/audio bookings.
3. Text bookings create no video row.
4. The first eligible join atomically claims provisioning.
5. Daily room creation uses a deterministic, unguessable idempotency key.
6. Concurrent join attempts either observe the resulting room or receive a short retriable `VIDEO_PROVISIONING` response.
7. External Daily calls never occur inside the booking/payment transaction.

### Video status transitions

```text
scheduled -> provisioning -> ready
provisioning -> failed
failed -> provisioning
ready -> live
live -> rejoinable
rejoinable -> live
ready/rejoinable/live -> ended
scheduled/ready/rejoinable -> expired
scheduled/provisioning/ready/live/rejoinable/failed -> cancelled
ready -> scheduled  (reschedule after retiring the old room generation)
```

`ended`, `cancelled`, and `expired` are terminal. Late webhooks may update historical room/connection metadata but cannot reopen them.

Daily `meeting.ended` does not immediately make the appointment terminal if reconnection remains possible. It moves `live` to `rejoinable`. This accounts for Daily emitting `meeting.ended` after the last participant leaves and starting a new meeting instance if they reconnect.

### Booking/video mapping

| Booking state | Video behavior |
|---|---|
| `pending` | No joining or room creation |
| `confirmed`, `upcoming` | `scheduled`, `ready`, `live`, or `rejoinable` |
| `live` | Read-compatible only; video code does not write it |
| `completed` | Valid video session finalized |
| `cancelled` | Video cancelled; room ended/deleted |
| `no_show_client` | Therapist had qualifying presence; client did not |
| `no_show_therapist` | Client had qualifying presence; therapist did not |
| legacy `no-show` | Read compatibility only |

New video code does **not** set booking status to `live`.

A qualifying presence is a connection overlapping `[scheduled_at, hardEnd]`; pre-session device testing alone does not count.

At scheduled end/reconciliation:

- Both participants had qualifying presence: finalize booking `completed`.
- Therapist only: `no_show_client`.
- Client only: `no_show_therapist`.
- Neither: video becomes `expired`, booking remains unchanged, and an operational alert is created. The system does not assign blame without evidence.

No earlier automated no-show cutoff is introduced in the first release.

### Reschedule

- Lock booking and video rows.
- Update only `bookings.scheduled_at`.
- Mark the current room generation `retiring`.
- Reset the appointment video lifecycle to `scheduled`.
- Immediately attempt `endSession()` and `deleteRoom()` after commit.
- Retry failed deletion through reconciliation.
- Ignore lifecycle mutations from the retired room.
- Provision the new generation lazily during its new join window.

### Cancellation/refund

Cancellation immediately makes the backend predicate false, then ends and deletes any provider room. Provider cleanup failure does not roll back the cancellation; it enters durable retry state.

Starting any refund state blocks new tokens even if the booking status has not yet changed.

### Calendar links

Calendar events and ICS files contain authenticated Shura links only:

```text
/portal/sessions/:bookingId
/therapist-portal/sessions/:bookingId
```

Daily room URLs and tokens never appear in email, calendar descriptions, notifications, SMS, or browser history.

### Reconciliation

A small worker following the existing email-worker pattern will:

- Recover provisioning rows older than two minutes.
- Check Daily room presence for stale `live` sessions.
- Finalize sessions after reconnect/hard-end cutoffs.
- Retry room ejection/deletion.
- Clean up orphaned room generations.
- Process durable webhook inbox rows with `FOR UPDATE SKIP LOCKED`.
- Never regress terminal states.

---

## 8. Webhook design

Subscribe only to:

```text
meeting.started
meeting.ended
participant.joined
participant.left
```

Daily webhooks require a paid account or credit card.

### Verification

Daily documents:

```text
base64(
  HMAC-SHA256(
    base64Decode(hmacSecret),
    X-Webhook-Timestamp + "." + JSON.stringify(event)
  )
)
```

The implementation must:

1. Capture the body before JSON middleware changes it.
2. Retain the exact received JSON bytes for signature computation.
3. Decode the configured HMAC secret from base64.
4. Compare signatures in constant time.
5. Reject malformed or stale timestamps using a five-minute application replay window.
6. Parse JSON only after successful verification.
7. Insert a sanitized inbox record before returning `200`.
8. Return `200` for already-processed duplicates.
9. Never support a permissive “try multiple signature algorithms” fallback.

Daily's webhook-creation probe sends `{"test":"test"}` before normal event delivery. Configure Daily `basicAuth`; the endpoint accepts the exact probe only with valid Basic authentication. Real events require both Basic authentication and HMAC.

A signed Daily fixture must pin the timestamp unit and exact serialization behavior before production deployment because the current documentation gives the signature construction but does not define an explicit replay tolerance.

---

## 9. Reminders

No reminder scheduler currently exists. Reuse existing infrastructure rather than add a scheduler dependency:

- Add a small `sessionReminderWorker` using the existing one-minute worker pattern.
- Use the existing client preferences:
  - `notification_email_reminder_24h`
  - `notification_email_reminder_1h`
- Create existing `notifications` rows with deterministic `dedupe_key` values.
- Enqueue through the existing email outbox with deterministic event keys.
- Record generation in `client_session_events`.
- Ignore `notification_sms_reminder_1h` until an authenticated SMS provider exists.
- Reminder links point to the authenticated Shura session page.

Dedupe keys:

```text
session-reminder:<bookingId>:24h:<scheduledAt>
session-reminder:<bookingId>:1h:<scheduledAt>
```

Including `scheduledAt` allows correct reminders after a reschedule without duplicating the old occurrence.

---

## 10. Frontend design

### Recommendation: Daily Prebuilt

Prebuilt is preferable for the first release because it already supplies:

- Device selection and permission recovery.
- Prejoin preview.
- Network quality handling.
- Accessible media controls.
- Mobile browser behavior.
- Participant layout.
- Automatic bandwidth reduction.

The trade-off is reduced visual control and Daily-owned iframe UI. A custom call object can be considered later only after operational reliability is established.

### Routes

```text
/portal/sessions/:bookingId
/therapist-portal/sessions/:bookingId
```

Both are protected by existing frontend guards, with backend authorization remaining authoritative.

### Component structure

```text
VideoSessionPage
├── SessionHeader
├── SessionAccessGate
│   ├── BeforeWindowPanel
│   ├── JoinPanel
│   ├── ProvisioningPanel
│   └── SessionEndedPanel
├── DailyPrebuiltFrame
├── ParticipantPresence
├── SessionTimer
├── NetworkStatus
├── CallErrorPanel
└── LeaveSessionButton
```

Frontend state machine:

```text
loading
not_joinable
eligible
requesting_access
provisioning
prejoin
joining
joined
reconnecting
leaving
ended
error
```

The token is requested only after a deliberate Join action. It remains in component memory and is never placed in storage, query parameters, analytics, logs, or Redux-style global state.

### Teardown

On leave, route change, logout, or component unmount:

1. Remove all Daily event listeners.
2. Call Daily `leave()`.
3. Signal Shura's leave endpoint best-effort.
4. Call `destroy()`.
5. Clear token and room URL from memory.

Webhook/provider presence remains authoritative if browser teardown is interrupted.

### Accessibility and mobile

- Iframe has a descriptive title.
- Status changes use `aria-live`.
- Blocking errors use an alert and receive focus.
- Join timing and network state are conveyed through text, not color alone.
- Controls meet touch-target sizing.
- Mobile stays embedded rather than opening an unauthenticated room tab.
- Hard-end warnings appear at five minutes and one minute.
- Permission-denied and missing-device errors provide browser/device-specific guidance.

---

## 11. Legacy removal

Delete:

```text
shura-backend/routes/calls.js
shura-frontend/components/CallWidget.tsx
shura-frontend/pages/CallPage.tsx
shura-frontend/pages/therapist-portal/TherapistCallPage.tsx
```

Remove:

- `/api/calls` import and mount from `shura-backend/server.js`.
- `/call` and `/therapist-portal/calls` routes/imports from `shura-frontend/App.tsx`.
- Audio/video call buttons navigating to `/call` from `ClientChatPage.tsx`.
- Every `join_call`, `webrtc_offer`, `webrtc_answer`, and `webrtc_ice_candidate` emit/listener.
- The obsolete `/api/calls/join` E2E expectation.

Chat pages may link to the applicable authenticated booked-session page, but may not create ad hoc calls.

---

## 12. Security, CSP, and compliance

### CSP and Permissions Policy

For bundled Daily Prebuilt:

- Add `https://*.daily.co` to `frame-src`.
- Keep `script-src 'self'`; no Unpkg or `unsafe-eval`.
- Existing broad `connect-src https: wss:` already permits required traffic; no additional relaxation is needed.
- Update Permissions Policy so the Daily iframe can use camera and microphone.
- Ensure the iframe receives `allow="camera; microphone"`.

No general wildcard is added to `script-src`, `frame-src`, or `worker-src`.

### Privacy controls

- Daily API key remains backend-only.
- Private rooms and room-bound tokens are mandatory.
- Participant token IDs are random UUIDs.
- Use minimal display names, never email or Auth0 identity.
- Tokens and raw webhooks are never persisted or logged.
- Provider HTTP logs contain method, operation, status, latency, and correlation ID only.
- No recording, transcription, summaries, or Daily chat.
- Room deletion is the revocation mechanism after cancellation/reschedule because Daily meeting tokens cannot be individually revoked.

### Production compliance gate

Production activation requires an operator decision confirming:

- Daily Healthcare/HIPAA offering is enabled.
- A BAA is executed where required.
- Data residency and subprocessor posture are acceptable.
- Daily account billing supports webhooks and required room properties.
- Recording/transcription are disabled at domain level.
- Retention and incident-response requirements are documented.

Without this approval, Daily may be used only in non-production environments with synthetic data.

---

## 13. Documentation and validation plan

ADR-0007 now records the accepted architecture decisions for this rollout:

- Daily provider selection.
- Provider boundary.
- Prebuilt selection.
- Private token-only rooms.
- Lazy room provisioning.
- Independent video lifecycle.
- Join/reconnect/hard-end policy.
- Webhook authentication.
- Recording prohibition.

Add `docs/VIDEO_CALLING.md` for configuration, lifecycle, operational recovery, webhook registration, CSP, and compliance. Update the canonical scheduling, authentication/security, data-model, deployment, and workflow documents.

Required validation includes:

- Join-policy boundary tests at every exact timestamp.
- Paid, free, covered, legacy paid, refunded, pending refund, and failed refund cases.
- Client/therapist ownership and cross-account denial.
- Null `scheduled_at`.
- Concurrent first joins.
- Reschedule after room creation.
- Cancellation with provider cleanup failure.
- Duplicate and out-of-order webhook delivery.
- Invalid signatures, replay attempts, and timestamp skew.
- Reconnection and hard ejection.
- Audio camera enforcement.
- No tokens or room links in logs, calendars, reminders, or URLs.
- Two-user desktop and mobile E2E.
- Legacy route removal.
- CSP and camera/microphone permission behavior.

**Phase 1 concluded with design approval. Subsequent implementation phases proceed only within approved phase scope.**

---

## 14. Phase 2 implementation summary (data layer)

Phase 2 scope was completed for the approved data-layer work only (no provider, route, or frontend implementation in this phase).

Delivered:

- Added `shura-backend/migrations/019_video_calling_foundation.sql`.
- Created `video_sessions` with status/error/duration lifecycle fields and indexes.
- Created `video_participants` with role-scoped principal identity, provider UUID identity, and presence summary counters.
- Created durable `video_webhook_events` inbox with dedupe and retry-processing indexes.
- Normalized `bookings` status constraint so `no_show_client` and `no_show_therapist` are writable while keeping legacy `no-show` read-compatible.
- Added `shura-backend/db/videoSessions.js` in the existing db/ pattern with query helpers for:
  - session create/read/status/error updates
  - participant upsert/join/leave updates
  - webhook enqueue/claim/processed/failed transitions

Validation executed during Phase 2:

- `npm run migrate` applied cleanly on a fresh bootstrap database.
- `npm run migrate` applied cleanly on a pre-migrated database containing existing booking rows.
- Post-migration checks confirmed:
  - legacy existing booking statuses remained valid
  - writes to `no_show_client` and `no_show_therapist` succeeded
  - `video_sessions`, `video_participants`, and `video_webhook_events` exist after migration.

---

## 15. Pending implementation decisions

- **Session-policy configuration alignment:** decide in a later phase whether `platform_settings.session_policies.joinWindowMinutes` should remain a configurable client-portal policy surface, or be explicitly retired in favor of the fixed canonical secure-video windows (client -10 minutes, therapist -20 minutes) across all session availability/join surfaces. Until resolved, secure-video join authorization follows the canonical fixed windows from Section 6.
- **Immutable room-generation model:** defer the decision to move operational room identity from `bookings.video_room_id` to immutable generation records (for example, `video_session_rooms`) to a later schema/workstream phase; this phase keeps additive compatibility with the current schema.
- **Legacy join endpoint cutover sequencing:** defer full replacement of `/api/client/sessions/:id/join` with the secure `/api/video/sessions/:bookingId/join` flow until the explicit consumer cutover phase, while preserving canonical server-side authorization at the secure video boundary.
