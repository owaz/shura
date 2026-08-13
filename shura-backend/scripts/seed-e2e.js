const { Pool } = require('pg');
const {
  backendEnvPath,
  databaseConfig,
  isConfigured,
  loadEnvFile,
  mutationSafetyErrors,
} = require('./e2eConfig');

const AUTH0_MANAGED_PASSWORD = 'auth0-managed-e2e-account';

function atUtcDayOffset(days, hour = 10) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hour, 0, 0, 0);
  return value;
}

function datePart(value) {
  return value.toISOString().slice(0, 10);
}

function timePart(value) {
  return value.toISOString().slice(11, 16);
}

async function tableColumns(client, tableName) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function ensureSchema(client) {
  const result = await client.query(
    `SELECT to_regclass('public.users') AS users,
            to_regclass('public.client_session_events') AS session_events,
            to_regclass('public.schema_migrations') AS migrations`
  );
  const row = result.rows[0];
  if (!row.users || !row.session_events || !row.migrations) {
    throw Object.assign(new Error('schema_incomplete'), { code: 'E2E_SCHEMA_INCOMPLETE' });
  }
  const migration = await client.query(
    `SELECT 1 FROM schema_migrations WHERE id = '012_client_session_management.sql'`
  );
  if (!migration.rowCount) {
    throw Object.assign(new Error('migration_012_missing'), { code: 'E2E_MIGRATIONS_PENDING' });
  }
}

async function upsertIdentity(client, { table, auth0Sub, email, insertValues, updateValues }) {
  const existing = await client.query(
    `SELECT id FROM ${table}
     WHERE auth0_sub = $1 OR LOWER(email) = LOWER($2)
     ORDER BY CASE WHEN auth0_sub = $1 THEN 0 ELSE 1 END, id
     LIMIT 1`,
    [auth0Sub, email]
  );

  const values = { email, auth0_sub: auth0Sub, ...updateValues };
  if (existing.rowCount) {
    const keys = Object.keys(values);
    const params = keys.map((key) => values[key]);
    const assignments = keys.map((key, index) => `${key} = $${index + 1}`);
    params.push(existing.rows[0].id);
    const result = await client.query(
      `UPDATE ${table} SET ${assignments.join(', ')} WHERE id = $${params.length} RETURNING id`,
      params
    );
    return result.rows[0].id;
  }

  const newValues = { password_hash: AUTH0_MANAGED_PASSWORD, ...insertValues, ...values };
  const keys = Object.keys(newValues);
  const params = keys.map((key) => newValues[key]);
  const placeholders = params.map((_, index) => `$${index + 1}`);
  const result = await client.query(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    params
  );
  return result.rows[0].id;
}

async function upsertBooking(client, columns, clientId, therapistId, fixture) {
  const scheduledAt = fixture.scheduledAt;
  const values = {
    user_id: clientId,
    client_id: clientId,
    therapist_id: therapistId,
    date: datePart(scheduledAt),
    time: timePart(scheduledAt),
    scheduled_at: scheduledAt,
    booking_date: scheduledAt,
    duration_minutes: 50,
    session_type: 'video',
    status: fixture.status,
    payment_status: 'paid',
    amount_cents: 750000,
    amount_paise: 750000,
    amount_inr: 7500,
    is_free_session: false,
    notes: `[E2E:${fixture.key}] Synthetic development fixture`,
    cancelled_at: fixture.cancelledAt || null,
    cancellation_reason: fixture.cancelledAt ? 'Synthetic E2E cancellation' : null,
    cancelled_by: fixture.cancelledAt ? 'client' : null,
    rescheduled_at: fixture.rescheduledAt || null,
    rescheduled_from: fixture.rescheduledFrom || null,
    video_room_id: null,
    updated_at: new Date(),
  };
  const record = Object.fromEntries(Object.entries(values).filter(([key]) => columns.has(key)));
  const existing = await client.query(
    `SELECT id FROM bookings WHERE user_id = $1 AND notes = $2 ORDER BY id LIMIT 1`,
    [clientId, values.notes]
  );
  const keys = Object.keys(record);
  const params = keys.map((key) => record[key]);

  if (existing.rowCount) {
    const assignments = keys.map((key, index) => `${key} = $${index + 1}`);
    params.push(existing.rows[0].id);
    await client.query(
      `UPDATE bookings SET ${assignments.join(', ')} WHERE id = $${params.length}`,
      params
    );
    return existing.rows[0].id;
  }

  const placeholders = params.map((_, index) => `$${index + 1}`);
  const result = await client.query(
    `INSERT INTO bookings (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    params
  );
  return result.rows[0].id;
}

async function upsertPayment(client, columns, clientId, therapistId, bookingId, fixtureKey) {
  const orderId = `e2e_order_${fixtureKey}`;
  const values = {
    client_id: clientId,
    therapist_id: therapistId,
    booking_id: bookingId,
    amount_cents: 750000,
    amount_inr: 7500,
    currency: 'INR',
    description: 'Synthetic E2E session payment',
    status: 'success',
    razorpay_order_id: orderId,
    razorpay_payment_id: null,
    payment_method: 'e2e_fixture',
    metadata: JSON.stringify({ e2eSeed: true, fixtureKey }),
    completed_at: new Date(),
    refund_amount_cents: null,
    refund_status: null,
    razorpay_refund_id: null,
    refund_failure_reason: null,
    updated_at: new Date(),
  };
  const record = Object.fromEntries(Object.entries(values).filter(([key]) => columns.has(key)));
  const existing = await client.query(
    'SELECT id FROM payments WHERE razorpay_order_id = $1 ORDER BY id LIMIT 1',
    [orderId]
  );
  const keys = Object.keys(record);
  const params = keys.map((key) => record[key]);

  if (existing.rowCount) {
    const assignments = keys.map((key, index) => `${key} = $${index + 1}`);
    params.push(existing.rows[0].id);
    await client.query(
      `UPDATE payments SET ${assignments.join(', ')} WHERE id = $${params.length}`,
      params
    );
    return existing.rows[0].id;
  }

  const placeholders = params.map((_, index) => `$${index + 1}`);
  const result = await client.query(
    `INSERT INTO payments (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    params
  );
  return result.rows[0].id;
}

async function run() {
  const env = loadEnvFile(backendEnvPath);
  const errors = mutationSafetyErrors(env);
  for (const key of [
    'E2E_CLIENT_AUTH0_SUB',
    'E2E_CLIENT_EMAIL',
    'E2E_THERAPIST_AUTH0_SUB',
    'E2E_THERAPIST_EMAIL',
    'E2E_ADMIN_AUTH0_SUB',
    'E2E_ADMIN_EMAIL',
  ]) {
    if (!env || !isConfigured(env[key])) errors.push(`${key} is required.`);
  }
  if (errors.length) {
    errors.forEach((message) => console.error(`[error] ${message}`));
    process.exitCode = 1;
    return;
  }

  const pool = new Pool(databaseConfig(env));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureSchema(client);

    const clientId = await upsertIdentity(client, {
      table: 'users',
      auth0Sub: env.E2E_CLIENT_AUTH0_SUB,
      email: env.E2E_CLIENT_EMAIL,
      insertValues: {},
      updateValues: {
        full_name: 'Amina E2E Client',
        first_name: 'Amina',
        last_name: 'E2E Client',
        display_name: 'Amina',
        status: 'active',
        timezone: 'Asia/Dubai',
        country: 'United Arab Emirates',
        city: 'Dubai',
        onboarding_current_step: 4,
        onboarding_goals: ['manage_anxiety', 'strengthen_faith'],
        onboarding_completed_at: new Date(),
        updated_at: new Date(),
      },
    });

    const therapistId = await upsertIdentity(client, {
      table: 'therapists',
      auth0Sub: env.E2E_THERAPIST_AUTH0_SUB,
      email: env.E2E_THERAPIST_EMAIL,
      insertValues: {},
      updateValues: {
        full_name: 'Dr. Maryam E2E Therapist',
        status: 'approved',
        bio: 'Synthetic therapist profile used for local end-to-end testing.',
        gender: 'female',
        location: 'Dubai',
        experience_years: 8,
        rate_60min: 7500,
        credentials: ['Licensed Clinical Psychologist'],
        session_types: ['video', 'audio'],
        session_duration_options: [50, 80],
        is_verified: true,
        updated_at: new Date(),
      },
    });

    await upsertIdentity(client, {
      table: 'admins',
      auth0Sub: env.E2E_ADMIN_AUTH0_SUB,
      email: env.E2E_ADMIN_EMAIL,
      insertValues: {},
      updateValues: {
        full_name: 'Shura E2E Admin',
        role: 'admin',
        updated_at: new Date(),
      },
    });

    await client.query(
      `INSERT INTO client_preferences
        (client_id, therapist_gender_preference, languages, islamic_approach,
         specialisation_interests, session_type_preference, session_duration_preference,
         preferred_days, preferred_time_of_day)
       VALUES ($1, 'female_only', ARRAY['English'], 'faith_integrated',
               ARRAY['Anxiety', 'Faith and spirituality'], 'video', '50',
               ARRAY['monday', 'wednesday'], 'evening')
       ON CONFLICT (client_id) DO UPDATE SET
         therapist_gender_preference = EXCLUDED.therapist_gender_preference,
         languages = EXCLUDED.languages,
         islamic_approach = EXCLUDED.islamic_approach,
         specialisation_interests = EXCLUDED.specialisation_interests,
         session_type_preference = EXCLUDED.session_type_preference,
         session_duration_preference = EXCLUDED.session_duration_preference,
         preferred_days = EXCLUDED.preferred_days,
         preferred_time_of_day = EXCLUDED.preferred_time_of_day,
         updated_at = NOW()`,
      [clientId]
    );

    await client.query(
      `UPDATE therapist_clients SET status = 'released', updated_at = NOW()
       WHERE client_id = $1 AND therapist_id <> $2 AND status = 'active'`,
      [clientId, therapistId]
    );
    await client.query(
      `INSERT INTO therapist_clients (therapist_id, client_id, status, assignment_source, notes)
       VALUES ($1, $2, 'active', 'e2e_seed', 'Synthetic development assignment')
       ON CONFLICT (therapist_id, client_id) DO UPDATE SET
         status = 'active', assignment_source = 'e2e_seed',
         notes = 'Synthetic development assignment', assigned_at = NOW(), updated_at = NOW()`,
      [therapistId, clientId]
    );

    await client.query(
      `INSERT INTO therapist_availability_rules
        (therapist_id, day_of_week, start_time, end_time, slot_minutes, timezone, is_active)
       SELECT $1, day, '08:00'::time, '20:00'::time, 30, 'UTC', TRUE
       FROM generate_series(0, 6) AS day
       ON CONFLICT (therapist_id, day_of_week) DO UPDATE SET
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         slot_minutes = EXCLUDED.slot_minutes,
         timezone = EXCLUDED.timezone,
         is_active = TRUE,
         updated_at = NOW()`,
      [therapistId]
    );

    const bookingColumns = await tableColumns(client, 'bookings');
    const paymentColumns = await tableColumns(client, 'payments');
    const fixtures = [
      { key: 'upcoming', status: 'confirmed', scheduledAt: atUtcDayOffset(3, 14) },
      {
        key: 'rescheduled',
        status: 'confirmed',
        scheduledAt: atUtcDayOffset(8, 15),
        rescheduledAt: new Date(),
        rescheduledFrom: atUtcDayOffset(7, 15),
      },
      { key: 'past-reviewable', status: 'completed', scheduledAt: atUtcDayOffset(-7, 12) },
      { key: 'past-reviewed', status: 'completed', scheduledAt: atUtcDayOffset(-21, 11) },
      {
        key: 'cancelled',
        status: 'cancelled',
        scheduledAt: atUtcDayOffset(5, 16),
        cancelledAt: new Date(),
      },
    ];

    const bookingIds = new Map();
    for (const fixture of fixtures) {
      const bookingId = await upsertBooking(client, bookingColumns, clientId, therapistId, fixture);
      bookingIds.set(fixture.key, bookingId);
      await upsertPayment(client, paymentColumns, clientId, therapistId, bookingId, fixture.key);
    }

    await client.query(
      'DELETE FROM client_session_reviews WHERE booking_id = ANY($1::integer[])',
      [[...bookingIds.values()].filter((id) => id !== bookingIds.get('past-reviewed'))]
    );
    await client.query(
      `INSERT INTO client_session_reviews (booking_id, client_id, therapist_id, rating, comment)
       VALUES ($1, $2, $3, 5, 'Synthetic E2E review fixture')
       ON CONFLICT (booking_id) DO UPDATE SET
         rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()`,
      [bookingIds.get('past-reviewed'), clientId, therapistId]
    );

    await client.query(
      `DELETE FROM client_session_events
       WHERE client_id = $1 AND booking_id = ANY($2::integer[])`,
      [clientId, [...bookingIds.values()]]
    );
    await client.query(
      `INSERT INTO client_session_events
        (booking_id, client_id, event_type, actor, previous_scheduled_at, next_scheduled_at, metadata)
       VALUES
        ($1, $3, 'rescheduled', 'client', $4, $5, '{"e2eSeed":true}'::jsonb),
        ($2, $3, 'cancelled', 'client', NULL, NULL, '{"e2eSeed":true}'::jsonb)`,
      [
        bookingIds.get('rescheduled'),
        bookingIds.get('cancelled'),
        clientId,
        fixtures[1].rescheduledFrom,
        fixtures[1].scheduledAt,
      ]
    );

    await client.query(
      `DELETE FROM notifications
       WHERE client_id = $1 AND metadata @> '{"e2eSeed":true}'::jsonb`,
      [clientId]
    );
    await client.query(
      `INSERT INTO notifications (client_id, type, title, body, metadata)
       VALUES
        ($1, 'session_reminder', 'Upcoming E2E session',
         'Synthetic reminder generated by the local E2E seed.', $2::jsonb),
        ($1, 'platform_update', 'Local E2E environment ready',
         'This notification contains synthetic development data only.', $3::jsonb)`,
      [
        clientId,
        JSON.stringify({ e2eSeed: true, bookingId: bookingIds.get('upcoming') }),
        JSON.stringify({ e2eSeed: true }),
      ]
    );

    await client.query('COMMIT');
    console.log(`[ok] Seeded 3 synthetic identities and ${fixtures.length} stable session fixtures.`);
    console.log('[ok] No passwords, Auth0 credentials, database coordinates, or provider secrets were printed.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === 'E2E_SCHEMA_INCOMPLETE' || error.code === 'E2E_MIGRATIONS_PENDING') {
      console.error('[error] E2E schema is incomplete. Run npm run e2e:bootstrap and npm run migrate first.');
    } else {
      const code = error && error.code ? ` (${error.code})` : '';
      console.error(`[error] Synthetic E2E seed failed${code}.`);
    }
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => {
  console.error('[error] Synthetic E2E seed failed.');
  process.exit(1);
});
