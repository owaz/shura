# Domain model and rules

This page records business concepts enforced by current implementation. It is not clinical, legal, religious, or payment-policy approval. Research documents and UI copy may express broader aspirations than the code.

## People and roles

### Client

A person seeking support. Client application state is stored in `users`; Auth0 owns login. A client can complete onboarding/preferences, submit questionnaire/intake information, have one active therapist assignment, book/pay for sessions, message the active therapist, manage sessions, and request account deletion.

### Therapist

A practitioner stored in `therapists`. A therapist may create an Auth0 identity and complete a professional application, but is not publicly discoverable until status is `approved`. A therapist owns availability, profile data, assigned-client intake access, booking views, and optional calendar connections.

### Administrator

A non-self-registering Auth0 identity backed by `admins`. Admins review therapist applications, manage therapist/client statuses, search Auth0 users, and manage/match client assignments. Admin login requires MFA.

## Status vocabulary

- Therapist: `pending` → `approved` or `rejected`; `approved` → `suspended`; `suspended` → `approved`. Rejection requires a reason. Auth0 is blocked for rejected/suspended therapists.
- Client: normally `active`; admin can change `active` ↔ `suspended`. Suspended linked Auth0 identities are blocked.
- Therapist-client assignment: `active` represents the current relationship; `released` is client-initiated history; older admin code also uses `inactive`.
- Booking/session: legacy and portal code accept several values. Normalized active values are pending/confirmed/upcoming/live; terminal/past include completed and no-show variants; cancelled is separate.
- Payment: pending/completed/failed/refunded plus separate refund status and intent status.

Do not add a new status without defining transitions, authorization, query categories, migrations/constraints, provider synchronization, and UI behavior.

## Onboarding and preferences

Client portal onboarding is resumable. Completion requires core profile values (first/last name, valid past birth date, gender, IANA timezone) and matching preferences (therapist-gender preference, at least one language, and Islamic-approach preference). On completion, `onboarding_completed_at` is set once and the browser guard routes the client to the portal.

Profile phone numbers, when supplied, use international E.164-like format. About/emergency/onboarding notes are length-limited by backend validation. Preferences include session mode/duration, specialisation interests, days/time, reminders, and privacy options; allowed values are defined in `utils/clientPortalValidation.js` and `platform_settings`.

## Therapist discovery and assignment

Public discovery returns only approved therapists. Profile fields include specialties, credentials, experience, languages, location, faith integration, session modes/durations, rate, availability, image, and aggregated client reviews where implemented.

The database enforces no more than one active therapist assignment per client. Assignment sources include manual admin assignment, automatic intake/questionnaire matching, client selection, and E2E seed data. Releasing a relationship retains history and notifies the therapist; it does not delete prior clinical/session records.

Automatic matching is a simple deterministic score, not a clinical recommendation engine:

- infer desired specialty labels from concern keywords and symptom fields
- add 10 points per matching specialty substring
- prefer lower active-client counts (up to five points)
- add a small severe-case experience/workload bonus
- choose the highest-scored approved therapist

This logic does not encode licensed scope, geography, emergency response, capacity ceilings, client gender/language preference, or clinical triage. Do not represent it as safety/clinical validation.

## Intake

An authorized assigned therapist or admin can issue one current random intake token for a client. The token expires in seven days, is single-use after submission, and is emailed as a link. Submission stores highly sensitive personal, mental-health, trauma, relationship, medical, medication, coping, suicidality, and spiritual responses, then marks the token complete and attempts automatic assignment.

Assigned therapists may read intake forms for their active clients. Any new access path must preserve role and active-relationship checks and minimize returned fields.

The current implementation collects suicidal-thought information but does not implement a verified crisis-response service. Avoid UI/docs promises of immediate crisis intervention unless a separately reviewed operational process is added.

## Sessions, cancellation, and reviews

Sessions use therapist availability/timezone and exclude blocked/overlapping time. Supported modes are video, audio, and text. Portal durations are 30, 50, and 80 minutes.

Defaults: join 10 minutes before start; reschedule until 24 hours before; cancel until session end; refund only for a paid captured payment cancelled at least 24 hours before. Policies can be changed in `platform_settings`, so API-provided policy text/actions should drive UI behavior.

Only completed sessions can receive a review, and each booking can receive one rating of 1–5 plus at most 1,000 characters of comment.

## Pricing and money

The implemented paid flow uses INR and derives the payable smallest-unit amount from the approved therapist's configured 60-minute rate. The Word pricing document contains exploratory ranges, packages, sliding scale, after-hours, and cancellation proposals; these are not implemented business rules.

The schema uses historically inconsistent monetary names (`amount_cents`, `amount_paise`). Treat existing values as provider smallest units where current Razorpay code does so; do not infer a currency conversion solely from a column name.

## Faith-centered scope

The platform markets faith-centered/faith-aware care and lets clients express Islamic-approach preferences. Research material lists Islamic psychology concepts, practitioner types, and therapy techniques. The repository does not establish clinical credentials, theological review, medical efficacy, crisis coverage, or regulatory compliance for that content. Changes to clinical/religious claims require appropriate human review outside code inference.
