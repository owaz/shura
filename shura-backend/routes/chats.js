const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Middleware to authenticate chat requests
const auth = authenticateToken;

const canAccessConversation = async (client_id, therapist_id) => {
  const assignment = await pool.query(
    `SELECT id FROM therapist_clients
     WHERE client_id = $1 AND therapist_id = $2 AND status = 'active'
     LIMIT 1`,
    [client_id, therapist_id]
  );
  return assignment.rows.length > 0;
};

const ensureClientSelectedAssignment = async (client_id, therapist_id) => {
  const therapist = await pool.query(
    'SELECT id FROM therapists WHERE id = $1 AND status = $2',
    [therapist_id, 'approved']
  );

  if (!therapist.rows.length) return false;

  await pool.query(
    `INSERT INTO therapist_clients (therapist_id, client_id, status, assignment_source, assigned_at)
     VALUES ($1, $2, 'active', 'client_selected', NOW())
     ON CONFLICT (therapist_id, client_id)
     DO UPDATE SET status = 'active', assignment_source = 'client_selected', assigned_at = NOW()`,
    [therapist_id, client_id]
  );

  return true;
};

/**
 * POST /api/chats/send
 * Send a message in a conversation
 * Body: { therapist_id, content, file_url?, file_type?, file_size? }
 */
router.post('/send', auth, async (req, res) => {
  try {
    const { therapist_id, client_id: body_client_id, content, file_url, file_type, file_size } = req.body;
    const isTherapist = req.user.role === 'therapist';
    const client_id = isTherapist ? body_client_id : req.user.id;
    const conversationTherapistId = isTherapist ? req.user.id : therapist_id;

    if (!client_id || !conversationTherapistId || !content || !content.trim()) {
      return res.status(400).json({ error: 'client_id/therapist_id and content are required' });
    }

    let allowed = await canAccessConversation(client_id, conversationTherapistId);
    if (!allowed && !isTherapist) {
      allowed = await ensureClientSelectedAssignment(client_id, conversationTherapistId);
    }
    if (!allowed) {
      return res.status(403).json({ error: 'You are not assigned to this conversation' });
    }

    let savedMessage;
    let conversation_id;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find or create conversation
      let conversation = await client.query(
        'SELECT id FROM conversations WHERE client_id = $1 AND therapist_id = $2',
        [client_id, conversationTherapistId]
      );

      if (conversation.rows.length === 0) {
        const newConv = await client.query(
          'INSERT INTO conversations (client_id, therapist_id) VALUES ($1, $2) RETURNING id',
          [client_id, conversationTherapistId]
        );
        conversation_id = newConv.rows[0].id;
      } else {
        conversation_id = conversation.rows[0].id;
      }

      // Insert message
      const message = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, sender_role, content, file_url, file_type, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, sender_id, sender_role, content, file_url, file_type, file_size, is_read, created_at`,
        [conversation_id, req.user.id, isTherapist ? 'therapist' : 'client', content.trim(), file_url || null, file_type || null, file_size || null]
      );
      savedMessage = message.rows[0];

      // Update conversation last_message_at
      await client.query(
        'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
        [conversation_id]
      );

      await client.query('COMMIT');

      const io = req.app.get('io');
      if (io && savedMessage) {
        const eventPayload = {
          conversation_id,
          client_id,
          therapist_id: conversationTherapistId,
          message: savedMessage,
        };
        io.to(`user:client:${client_id}`).emit('chat:message', eventPayload);
        io.to(`user:therapist:${conversationTherapistId}`).emit('chat:message', eventPayload);
        io.to(`user:client:${client_id}`).emit('chat:conversation-updated', eventPayload);
        io.to(`user:therapist:${conversationTherapistId}`).emit('chat:conversation-updated', eventPayload);
      }

      res.status(201).json({
        message: 'Message sent successfully',
        message_id: savedMessage.id,
        created_at: savedMessage.created_at,
        conversation_id,
        chat_message: savedMessage
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * GET /api/chats/conversation/:therapist_id
 * Get all messages in a conversation between client and therapist
 * Query params: limit=20, offset=0
 */
router.get('/conversation/:therapist_id', auth, async (req, res) => {
  try {
    const { therapist_id } = req.params;
    const isTherapist = req.user.role === 'therapist';
    const client_id = isTherapist ? req.query.client_id : req.user.id;
    const conversationTherapistId = isTherapist ? req.user.id : therapist_id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    let allowed = await canAccessConversation(client_id, conversationTherapistId);
    if (!allowed && !isTherapist) {
      allowed = await ensureClientSelectedAssignment(client_id, conversationTherapistId);
    }
    if (!allowed) {
      return res.status(403).json({ error: 'You are not assigned to this conversation' });
    }

    // Fetch conversation
    const conversation = await pool.query(
      'SELECT id FROM conversations WHERE client_id = $1 AND therapist_id = $2',
      [client_id, conversationTherapistId]
    );

    if (conversation.rows.length === 0) {
      return res.json({ messages: [], conversation_id: null });
    }

    const conversation_id = conversation.rows[0].id;

    // Fetch messages with pagination
    const messages = await pool.query(
      `SELECT id, sender_id, sender_role, content, file_url, file_type, file_size, is_read, created_at
       FROM messages WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [conversation_id, limit, offset]
    );

    // Mark messages as read if they were sent to this user
    await pool.query(
      `UPDATE messages SET is_read = true, read_at = NOW()
       WHERE conversation_id = $1 AND (sender_id != $2 OR sender_role != $3) AND is_read = false`,
      [conversation_id, req.user.id, isTherapist ? 'therapist' : 'client']
    );

    res.json({
      conversation_id,
      messages: messages.rows.reverse(),
      total: messages.rows.length
    });
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * GET /api/chats/list
 * Get list of all conversations for the authenticated user
 */
router.get('/list', auth, async (req, res) => {
  try {
    const user_id = req.user.id;
    const isTherapist = req.user.role === 'therapist';

    const conversations = await pool.query(
      isTherapist
      ? `SELECT COALESCE(c.id, 0) as id,
              tc.client_id,
              tc.therapist_id,
              u.full_name as client_name,
              c.last_message_at,
              COALESCE(c.is_active, true) as is_active,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM therapist_clients tc
       JOIN users u ON tc.client_id = u.id
       LEFT JOIN conversations c ON c.client_id = tc.client_id AND c.therapist_id = tc.therapist_id
       WHERE tc.therapist_id = $1 AND tc.status = 'active'
       ORDER BY c.last_message_at DESC NULLS LAST, tc.assigned_at DESC`
      : `SELECT COALESCE(c.id, 0) as id,
              tc.client_id,
              tc.therapist_id,
              t.full_name as therapist_name,
              c.last_message_at,
              COALESCE(c.is_active, true) as is_active,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM therapist_clients tc
       JOIN therapists t ON tc.therapist_id = t.id
       LEFT JOIN conversations c ON c.client_id = tc.client_id AND c.therapist_id = tc.therapist_id
       WHERE tc.client_id = $1 AND tc.status = 'active'
       ORDER BY c.last_message_at DESC NULLS LAST, tc.assigned_at DESC`,
      [user_id]
    );

    res.json({ conversations: conversations.rows });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * PATCH /api/chats/:message_id/read
 * Mark a message as read
 */
router.patch('/:message_id/read', auth, async (req, res) => {
  try {
    const { message_id } = req.params;
    const isTherapist = req.user.role === 'therapist';

    await pool.query(
      `UPDATE messages m
       SET is_read = true, read_at = NOW()
       FROM conversations c
       WHERE m.id = $1
         AND m.conversation_id = c.id
         AND ((c.client_id = $2 AND $3 = false) OR (c.therapist_id = $2 AND $3 = true))`,
      [message_id, req.user.id, isTherapist]
    );

    res.json({ message: 'Message marked as read' });
  } catch (err) {
    console.error('Error marking message as read:', err);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

module.exports = router;
