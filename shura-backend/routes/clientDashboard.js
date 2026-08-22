const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { errorResponse, parsePagination, paginatedResponse } = require('../utils/apiResponse');
const { getImageReadUrl } = require('../services/azureBlobStorage');
const { normalizePolicies, normalizeSessionStatus, sessionActions } = require('../utils/clientSessionPolicy');
const { notificationAction, safeMetadata } = require('../utils/clientDashboard');
const { uniqueStrings } = require('../utils/clientTherapist');

const router = express.Router();

const notificationMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const activeSessionStatusesSql = "('pending', 'confirmed', 'upcoming', 'live')";
const paidStatuses = new Set(['completed', 'success', 'paid', 'refunded']);

const safeImageUrl = async ({ provider, blobName, legacyUrl }) => {
  if (provider !== 'azure_blob' || !blobName) return legacyUrl || '';
  try {
    return await getImageReadUrl(blobName);
  } catch (error) {
    console.error('Dashboard image URL generation failed', { code: error?.code || 'IMAGE_URL_FAILED' });
    return '';
  }
};

const mapDashboardSession = async (row, policies) => {
  if (!row) return null;
  const status = normalizeSessionStatus(row.status);
  const paid = paidStatuses.has(String(row.payment_status || '').toLowerCase());
  return {
    id: row.id,
    therapist: {
      id: row.therapist_id,
      name: row.therapist_name,
      credentials: uniqueStrings(row.therapist_credentials),
      imageUrl: await safeImageUrl({
        provider: row.therapist_image_storage_provider,
        blobName: row.therapist_image_blob_name,
        legacyUrl: row.therapist_image_url,
      }),
    },
    scheduledAt: row.scheduled_at,
    clientTimezone: row.client_timezone || 'UTC',
    durationMinutes: Number(row.duration_minutes || 50),
    sessionType: String(row.session_type || 'video').toLowerCase(),
    status,
    cancelledAt: row.cancelled_at || null,
    cancellationReason: row.cancellation_reason || null,
    cancelledBy: row.cancelled_by || null,
    rescheduledAt: row.rescheduled_at || null,
    rescheduledFrom: row.rescheduled_from || null,
    reviewed: false,
    reviewRating: null,
    reviewEligible: false,
    receipt: null,
    actions: sessionActions({
      scheduledAt: row.scheduled_at,
      durationMinutes: row.duration_minutes,
      sessionType: row.session_type,
      status,
      paid,
    }, policies),
  };
};

const mapDashboardTherapist = async (row) => {
  if (!row) return null;
  const specialisations = uniqueStrings(row.specialties);
  if (!specialisations.length && row.specialization) specialisations.push(String(row.specialization));
  return {
    id: row.id,
    name: row.full_name,
    credentials: uniqueStrings(row.credentials),
    specialisations,
    imageUrl: await safeImageUrl({
      provider: row.profile_image_storage_provider,
      blobName: row.profile_image_blob_name,
      legacyUrl: row.profile_image_url,
    }),
  };
};

router.get('/dashboard', async (req, res) => {
  try {
    const [clientResult, statsResult, sessionResult, therapistResult, settingsResult] = await Promise.all([
      pool.query(
        `SELECT first_name, full_name, timezone, created_at
         FROM users WHERE id = $1`,
        [req.clientId]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) IN ('completed', 'success'))::integer AS completed,
           COUNT(*) FILTER (
             WHERE LOWER(COALESCE(status, 'pending')) IN ${activeSessionStatusesSql}
               AND scheduled_at IS NOT NULL
               AND scheduled_at + make_interval(mins => COALESCE(duration_minutes, 50)) >= NOW()
           )::integer AS upcoming
         FROM bookings
         WHERE user_id = $1`,
        [req.clientId]
      ),
      pool.query(
        `SELECT b.id, b.therapist_id, b.scheduled_at, b.duration_minutes,
                b.session_type, b.status, b.cancelled_at, b.cancellation_reason,
                b.cancelled_by, b.rescheduled_at, b.rescheduled_from,
                t.full_name AS therapist_name, t.credentials AS therapist_credentials,
                t.profile_image_url AS therapist_image_url,
                t.profile_image_blob_name AS therapist_image_blob_name,
                t.profile_image_storage_provider AS therapist_image_storage_provider,
                u.timezone AS client_timezone,
                payment.status AS payment_status
         FROM bookings b
         JOIN therapists t ON t.id = b.therapist_id
         JOIN users u ON u.id = b.user_id
         LEFT JOIN LATERAL (
           SELECT p.status
           FROM payments p
           WHERE p.booking_id = b.id AND p.client_id = b.user_id
           ORDER BY p.created_at DESC, p.id DESC
           LIMIT 1
         ) payment ON TRUE
         WHERE b.user_id = $1
           AND b.scheduled_at IS NOT NULL
           AND LOWER(COALESCE(b.status, 'pending')) IN ${activeSessionStatusesSql}
           AND b.scheduled_at + make_interval(mins => COALESCE(b.duration_minutes, 50)) >= NOW()
         ORDER BY b.scheduled_at ASC, b.id ASC
         LIMIT 1`,
        [req.clientId]
      ),
      pool.query(
        `SELECT t.id, t.full_name, t.credentials, t.specialization, t.specialties,
                t.profile_image_url, t.profile_image_blob_name, t.profile_image_storage_provider
         FROM therapist_clients tc
         JOIN therapists t ON t.id = tc.therapist_id
         WHERE tc.client_id = $1
           AND tc.status = 'active'
           AND LOWER(COALESCE(t.status, '')) = 'approved'
         ORDER BY tc.assigned_at DESC NULLS LAST, tc.id DESC
         LIMIT 1`,
        [req.clientId]
      ),
      pool.query(
        `SELECT setting_key, setting_value
         FROM platform_settings
         WHERE setting_key IN ('client_portal_features', 'session_policies')`
      ),
    ]);

    const client = clientResult.rows[0];
    if (!client) return errorResponse(res, 404, 'CLIENT_NOT_FOUND', 'Your client profile could not be found.');
    const settings = Object.fromEntries(settingsResult.rows.map((row) => [row.setting_key, row.setting_value]));
    const policies = normalizePolicies(settings.session_policies || {});
    const [nextSession, therapist] = await Promise.all([
      mapDashboardSession(sessionResult.rows[0] || null, policies),
      mapDashboardTherapist(therapistResult.rows[0] || null),
    ]);
    const stats = statsResult.rows[0] || {};

    return res.json({
      data: {
        greetingName: client.first_name || String(client.full_name || '').trim().split(/\s+/)[0] || 'friend',
        timezone: client.timezone || 'UTC',
        memberSince: client.created_at,
        nextSession,
        therapist,
        stats: {
          completed: Number(stats.completed || 0),
          upcoming: Number(stats.upcoming || 0),
        },
        features: {
          messagingEnabled: settings.client_portal_features?.messagingEnabled === true,
        },
      },
    });
  } catch (error) {
    console.error('GET client dashboard error', { code: error?.code || 'DASHBOARD_FAILED' });
    return errorResponse(res, 500, 'DASHBOARD_LOAD_FAILED', 'We could not load your home dashboard right now.');
  }
});

router.get('/notifications/count', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::integer AS unread_count
       FROM notifications
       WHERE client_id = $1 AND read_at IS NULL`,
      [req.clientId]
    );
    return res.json({ data: { unreadCount: Number(rows[0]?.unread_count || 0) } });
  } catch (error) {
    console.error('GET notification count error', { code: error?.code || 'NOTIFICATION_COUNT_FAILED' });
    return errorResponse(res, 500, 'NOTIFICATION_COUNT_FAILED', 'We could not load your notification count.');
  }
});

router.get('/notifications', async (req, res) => {
  const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
  try {
    const [result, count] = await Promise.all([
      pool.query(
        `SELECT id, type, title, body, metadata, read_at, created_at
         FROM notifications
         WHERE client_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2 OFFSET $3`,
        [req.clientId, pagination.limit, pagination.offset]
      ),
      pool.query(
        `SELECT COUNT(*)::integer AS total
         FROM notifications
         WHERE client_id = $1`,
        [req.clientId]
      ),
    ]);
    const notifications = result.rows.map((row) => ({
      id: String(row.id),
      type: row.type,
      title: row.title,
      body: row.body || '',
      readAt: row.read_at,
      createdAt: row.created_at,
      action: notificationAction(row.type, safeMetadata(row.metadata)),
    }));
    return paginatedResponse(res, notifications, {
      ...pagination,
      total: Number(count.rows[0]?.total || 0),
    });
  } catch (error) {
    console.error('GET notifications error', { code: error?.code || 'NOTIFICATIONS_FAILED' });
    return errorResponse(res, 500, 'NOTIFICATIONS_LOAD_FAILED', 'We could not load your notifications.');
  }
});

router.patch('/notifications/read-all', notificationMutationLimiter, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE client_id = $1 AND read_at IS NULL`,
      [req.clientId]
    );
    return res.json({ data: { updated: Number(rowCount || 0), unreadCount: 0 } });
  } catch (error) {
    console.error('Mark all notifications read error', { code: error?.code || 'NOTIFICATIONS_READ_FAILED' });
    return errorResponse(res, 500, 'NOTIFICATIONS_UPDATE_FAILED', 'We could not mark your notifications as read.');
  }
});

router.patch('/notifications/:id/read', notificationMutationLimiter, async (req, res) => {
  if (!/^[1-9]\d*$/.test(String(req.params.id || ''))) {
    return errorResponse(res, 400, 'INVALID_NOTIFICATION_ID', 'The notification ID is invalid.');
  }
  try {
    const { rows } = await pool.query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1::bigint AND client_id = $2
       RETURNING id, read_at`,
      [req.params.id, req.clientId]
    );
    if (!rows.length) return errorResponse(res, 404, 'NOTIFICATION_NOT_FOUND', 'This notification could not be found.');
    return res.json({ data: { id: String(rows[0].id), readAt: rows[0].read_at } });
  } catch (error) {
    console.error('Mark notification read error', { code: error?.code || 'NOTIFICATION_READ_FAILED' });
    return errorResponse(res, 500, 'NOTIFICATION_UPDATE_FAILED', 'We could not update this notification.');
  }
});

module.exports = router;
module.exports.mapDashboardSession = mapDashboardSession;
