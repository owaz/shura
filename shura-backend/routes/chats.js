const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Middleware to authenticate chat requests
const auth = authenticateToken;

/**
 * POST /api/chats/send
 * Send a message in a conversation
 * Body: { therapist_id, content, file_url?, file_type?, file_size? }
 */
router.post('/send', auth, async (req, res) => {
  try {
    const { therapist_id, content, file_url, file_type, file_size } = req.body;
    const client_id = req.user.id;

    if (!therapist_id || !content) {
      return res.status(400).json({ error: 'therapist_id and content are required' });
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find or create conversation
      let conversation = await client.query(
        'SELECT id FROM conversations WHERE client_id = $1 AND therapist_id = $2',
        [client_id, therapist_id]
      );

      let conversation_id;
      if (conversation.rows.length === 0) {
        const newConv = await client.query(
          'INSERT INTO conversations (client_id, therapist_id) VALUES ($1, $2) RETURNING id',
          [client_id, therapist_id]
        );
        conversation_id = newConv.rows[0].id;
      } else {
        conversation_id = conversation.rows[0].id;
      }

      // Insert message
      const message = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, content, file_url, file_type, file_size)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
        [conversation_id, client_id, content, file_url || null, file_type || null, file_size || null]
      );

      // Update conversation last_message_at
      await client.query(
        'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
        [conversation_id]
      );

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Message sent successfully',
        message_id: message.rows[0].id,
        created_at: message.rows[0].created_at,
        conversation_id
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
    const client_id = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Fetch conversation
    const conversation = await pool.query(
      'SELECT id FROM conversations WHERE client_id = $1 AND therapist_id = $2',
      [client_id, therapist_id]
    );

    if (conversation.rows.length === 0) {
      return res.json({ messages: [], conversation_id: null });
    }

    const conversation_id = conversation.rows[0].id;

    // Fetch messages with pagination
    const messages = await pool.query(
      `SELECT id, sender_id, content, file_url, file_type, file_size, is_read, created_at
       FROM messages WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [conversation_id, limit, offset]
    );

    // Mark messages as read if they were sent to this user
    await pool.query(
      `UPDATE messages SET is_read = true, read_at = NOW()
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false`,
      [conversation_id, client_id]
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

    const conversations = await pool.query(
      `SELECT c.id, c.client_id, c.therapist_id, t.name as therapist_name, t.image_url,
              c.last_message_at, c.is_active,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM conversations c
       JOIN therapists t ON c.therapist_id = t.id
       WHERE c.client_id = $1
       ORDER BY c.last_message_at DESC NULLS LAST`,
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

    await pool.query(
      'UPDATE messages SET is_read = true, read_at = NOW() WHERE id = $1',
      [message_id]
    );

    res.json({ message: 'Message marked as read' });
  } catch (err) {
    console.error('Error marking message as read:', err);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

module.exports = router;
