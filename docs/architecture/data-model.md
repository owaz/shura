# Data model and schema lifecycle

## Database ownership

PostgreSQL is the durable application store. The backend uses a shared `pg.Pool` and parameterized SQL; there is no ORM-generated schema. Application code contains compatibility handling for legacy column names/types, so schema changes require checking both migrations and route queries.

## Principal relationships

```text
Auth0 subject
  ├─ users (client)
  ├─ therapists
  └─ admins

users ─< therapist_clients >─ therapists
  ├─ intake_tokens ── intake_forms
  ├─ client_preferences
  ├─ notifications
  ├─ reflections
  ├─ conversations ─< messages
  └─ bookings ── payments
                    └─ payment_booking_intents / webhook events

therapists
  ├─ therapist_availability_rules
  ├─ therapist_blocked_times
  └─ therapist_calendar_integrations
        └─ booking_calendar_events

bookings
  ├─ client_session_reviews
  └─ client_session_events

application email events
  └─ email_outbox
       └─ email_webhook_events (correlated by provider message ID)
```

This is a relationship map, not a complete column diagram. Read the current SQL migration and the consuming route before altering a table.

## Important invariants

- `auth0_sub` is unique within each identity table.
- `therapist_clients` preserves relationship history. Migration 011 enforces at most one `active` assignment per client with a partial unique index.
- A therapist/date/time can have at most one non-cancelled legacy booking. Newer session code also checks timestamp overlaps against duration and blocked times.
- Migration 013 adds a database trigger that takes the shared per-therapist advisory transaction lock and rejects overlapping active timestamp ranges with SQLSTATE `23P01`. This makes overlapping non-cancelled bookings a database error even when their start times differ; transaction locks and live overlap checks still provide actionable application errors.
- One review is allowed per booking.
- Razorpay webhook `event_id` and payment-booking-intent `order_id` are unique.
- Portal payment intents store the UTC scheduled time, duration, client/therapist timezones, source, provider payment reference, and explicit refund-required conflict state. Legacy intents retain `intent_source = 'legacy'` so existing consumers continue through the legacy compatibility finalizer.
- One client-preferences row exists per client; one configured calendar integration exists per therapist/provider; one calendar-event mapping exists per booking/integration.
- Intake tokens are unique and one active/current token record is retained per user.
- Notifications can carry a per-client `dedupe_key`; migration 014 enforces uniqueness only when a key is present so provider retries can avoid duplicate client events without constraining ordinary notifications.
- Daily faith-content rows have a stable reference key, content kind, source/translation attribution, and explicit human editorial state. Client delivery requires both `editorial_status = 'approved'` and `is_active = TRUE`; insertion alone never publishes a quote.
- Client billing history combines durable `payments` rows with `payment_booking_intents` that do not have a matching payment by ID or Razorpay order. Completed intents are not shown twice; captured conflict intents remain visible through their refund lifecycle even when no booking/payment row was created.
- Email outbox event keys are unique and must contain only opaque durable identifiers. Migration 017 preserves the legacy `sent` status while adding distinct accepted, delivered, and terminal dead states, provider-event timestamps, early-webhook reconciliation fields, and nullable payload columns. Terminal payload/error fields and old webhook dedupe rows are purged after 30 days while delivery metadata remains.

## Schema sources

The schema has two layers:

1. `production_schema.sql` creates the legacy-compatible base tables. Current local E2E bootstrap executes it only after an explicit safety check.
2. Numbered files in `migrations/` apply additive/compatibility changes in lexical order. `scripts/migrate.js` wraps each file in a transaction and records its filename in `schema_migrations`.

`setup.sql`, `intake_schema.sql`, `local_compat_schema.sql`, `database_schema_old.sql`, and one-off `migrate_*.sql` files are legacy/bootstrap references, not the forward migration path.

A truly empty database cannot currently be built by `npm run migrate` alone because migration 001 expects base identity tables. Follow `docs/LOCAL_E2E_SETUP.md` for disposable development setup. Production provisioning must deliberately run the base schema once, then all ordered migrations; the CI workflow does not currently show this step.

## Runtime DDL

`server.js` runs a large set of `ALTER TABLE`, `CREATE TABLE`, and index statements at every startup. It overlaps migrations 002 and 005 and can conceal incomplete migration state. Production startup fails if this compatibility block fails; development logs the error and continues.

Treat this as legacy compatibility debt. Do not add new schema changes there. New changes belong in numbered migrations, and a future migration should remove the need for runtime DDL only after deployed databases are verified.

## Adding a schema change

1. Add the next zero-padded SQL file in `shura-backend/migrations/`. Never modify a migration that may have run.
2. Prefer additive, backward-compatible changes; write explicit constraints/indexes and data backfills.
3. Ensure destructive or type-changing operations account for real legacy data and can run transactionally.
4. Update queries, API mapping, fixtures, and focused tests together.
5. Verify a base-schema-plus-all-migrations install and an upgrade from the preceding migration state. Run the migrator twice to confirm idempotent skip behavior. Migration 017 is the required schema for the Resend-only email runtime.
6. Update this document and any product/API documentation if the durable model or rule changed.

Do not run E2E bootstrap/seed unless `E2E_DATABASE_SAFE_TO_MUTATE=true` points to an isolated, disposable non-production database.

## Naming and time/money compatibility

The database retains legacy pairs such as `booking_date/date`, `booking_time/time`, `client_id/user_id`, and both `amount_cents`/`amount_paise` semantics. Current payment code often uses an `amount_cents` name for Razorpay's smallest INR unit (paise). Do not rename or convert monetary fields without tracing every query and provider request.

New portal scheduling uses `scheduled_at TIMESTAMPTZ` and IANA timezones. Migrations 007/008 explicitly preserve the historical `Asia/Kolkata` interpretation of legacy date/time fields. Avoid server-local timezone conversions.

Portal bookings classify payment as `paid`, `free`, or `covered`. Client coverage is the server-side `users.sessions_covered` flag; it is never accepted from a booking request. Migration 013 uses only built-in PostgreSQL range and advisory-lock features. It preserves historical rows while enforcing overlap rejection on every future insert or relevant update; an overlapping legacy row must be reconciled before it can be rescheduled or otherwise rewritten.

The daily quote date boundary is UTC and selection is deterministic over the approved active set ordered by row ID. Changing that set can change which quote maps to a date; it is editorial content state, not a user preference or timezone calculation.
