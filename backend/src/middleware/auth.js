const admin = require('../config/firebase');
const db = require('../db');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token missing or invalid.' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // 1. Verify token via Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email, name, picture } = decodedToken;

    // 2. Find or create user in local PostgreSQL database (auto-sync)
    let userResult = await db.query('SELECT * FROM users WHERE firebase_uid = $1', [uid]);
    let user;

    if (userResult.rows.length === 0) {
      // Synchronize/Insert new user in database
      const displayName = name || email.split('@')[0];
      const newUserResult = await db.query(
        `INSERT INTO users (firebase_uid, name, email, role) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [uid, displayName, email, 'customer'] // default role customer
      );
      user = newUserResult.rows[0];

      // Auto-create an empty cart for the user
      await db.query(`INSERT INTO cart (user_id) VALUES ($1)`, [user.id]);
      console.log(`✅ User registered: ${email}`);
      console.log(`📧 Calling sendWelcomeEmail for user: ${email}, ID: ${user.id}`);

      // Send Welcome Email asynchronously
      const { sendWelcomeEmail } = require('../utils/email.util');
      sendWelcomeEmail(user).catch(err => {
        console.error(`❌ Failed to send welcome email to ${email}:`, err);
      });
    } else {
      user = userResult.rows[0];
    }

    req.user = user; // Attach DB user profile to request
    next();
  } catch (error) {
    console.error('Authentication Error:', error);
    return res.status(403).json({ 
      error: 'Unauthorized. Invalid or expired token.',
      details: error.message,
      stack: error.stack
    });
  }
};

const verifyAdmin = (req, res, next) => {
  // Only allow unmeshbhangale41@gmail.com to access admin routes
  if (!req.user || req.user.role !== 'admin' || req.user.email !== 'unmeshbhangale41@gmail.com') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
};

module.exports = {
  verifyToken,
  verifyAdmin,
};
