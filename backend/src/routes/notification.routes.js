const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// 1. GET /api/notifications - Fetch user's notifications
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// 2. PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `UPDATE notifications SET is_read = true 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

// 3. PUT /api/notifications/read-all - Mark all user's notifications as read
router.put('/read-all', verifyToken, async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications SET is_read = true 
       WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read.' });
  }
});

module.exports = router;
