const express = require('express');
const router = express.Router();
const chatbotService = require('../services/chatbotService');
const { verifyToken } = require('../middleware/auth');
const admin = require('../config/firebase');
const db = require('../db');

// Custom middleware to verify auth token optionally
const verifyOptionalToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid } = decodedToken;
    const userResult = await db.query('SELECT * FROM users WHERE firebase_uid = $1', [uid]);
    if (userResult.rows.length > 0) {
      req.user = userResult.rows[0];
    }
  } catch (error) {
    console.warn('Optional authentication token verify failed:', error.message);
  }
  next();
};

// 1. POST /api/chat - Submit message to the AI agent
router.post('/', verifyOptionalToken, async (req, res) => {
  const { message, sessionUuid, contextProductId } = req.body;
  const userId = req.user ? req.user.id : null;

  if (!message || !sessionUuid) {
    return res.status(400).json({ error: 'Message content and sessionUuid are required.' });
  }

  try {
    const result = await chatbotService.sendMessage(sessionUuid, message, userId, contextProductId);
    res.json(result);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Failed to process chat message.' });
  }
});

// 2. GET /api/chat/sessions - Fetch all chat sessions for authenticated user
router.get('/sessions', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const sessions = await chatbotService.getSessions(userId);
    res.json(sessions);
  } catch (error) {
    console.error('Fetch sessions error:', error);
    res.status(500).json({ error: 'Failed to load chat sessions.' });
  }
});

// 3. GET /api/chat/sessions/:sessionUuid/messages - Load messages for a session
router.get('/sessions/:sessionUuid/messages', verifyOptionalToken, async (req, res) => {
  const { sessionUuid } = req.params;
  const userId = req.user ? req.user.id : null;

  try {
    const messages = await chatbotService.getMessages(sessionUuid, userId);
    res.json(messages);
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Failed to load conversation messages.' });
  }
});

// 4. DELETE /api/chat/sessions/:sessionUuid - Delete a chat session
router.delete('/sessions/:sessionUuid', verifyToken, async (req, res) => {
  const { sessionUuid } = req.params;
  const userId = req.user.id;

  try {
    const success = await chatbotService.deleteSession(sessionUuid, userId);
    if (!success) {
      return res.status(404).json({ error: 'Chat session not found.' });
    }
    res.json({ message: 'Chat session deleted successfully.' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete chat session.' });
  }
});

module.exports = router;
