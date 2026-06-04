const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../db');

// Sync Firebase Authentication user with local Postgres DB
router.get('/sync', verifyToken, (req, res) => {
  res.json({
    message: 'User synchronized successfully.',
    user: req.user
  });
});

// Update Profile name
router.put('/profile', verifyToken, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  try {
    const result = await db.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
      [name, req.user.id]
    );
    res.json({
      message: 'Profile updated successfully.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Bootstrap / Make Admin route (Only for unmeshbhangale41@gmail.com)
router.post('/make-admin', verifyToken, async (req, res) => {
  // Only allow unmeshbhangale41@gmail.com to become admin
  if (req.user.email !== 'unmeshbhangale41@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Only authorized user can become admin.' });
  }

  try {
    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
      ['admin', req.user.id]
    );
    res.json({
      message: 'User promoted to Admin successfully!',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Make Admin Error:', error);
    res.status(500).json({ error: 'Failed to promote user to admin.' });
  }
});

// Switch back to Customer (Only for unmeshbhangale41@gmail.com)
router.post('/make-customer', verifyToken, async (req, res) => {
  // Only allow unmeshbhangale41@gmail.com to switch roles
  if (req.user.email !== 'unmeshbhangale41@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Only authorized user can switch roles.' });
  }

  try {
    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
      ['customer', req.user.id]
    );
    res.json({
      message: 'User switched to Customer successfully!',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Make Customer Error:', error);
    res.status(500).json({ error: 'Failed to switch to customer.' });
  }
});

module.exports = router;
