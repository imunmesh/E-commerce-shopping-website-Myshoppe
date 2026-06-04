const admin = require('firebase-admin');
require('dotenv').config();

let firebaseInitialized = false;

try {
  let rawKey = process.env.FIREBASE_PRIVATE_KEY || '';

  // Strip surrounding quotes if present (dotenv on Windows can include them)
  if ((rawKey.startsWith('"') && rawKey.endsWith('"')) ||
      (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
    rawKey = rawKey.slice(1, -1);
  }

  // Replace literal \\n sequences with real newlines
  const privateKey = rawKey.replace(/\\n/g, '\n');

  if (privateKey && privateKey.includes('PRIVATE KEY')) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully.');
  } else {
    // Initialize without credentials — admin.auth() calls will fail,
    // but the server won't crash on startup.
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    console.warn('Firebase Admin SDK initialized WITHOUT credentials (auth verification will fail). Check FIREBASE_PRIVATE_KEY in .env.');
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error.message || error);
  // Prevent crash — initialize a bare app so require() doesn't fail downstream
  try { admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID }); } catch (e) { /* already initialized */ }
}

module.exports = admin;
