const dotenv = require('dotenv');
dotenv.config();

console.log('🔍 Checking Firebase configuration...\n');

console.log('📋 Environment Variables:');
console.log(`   FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`   FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing'}`);
console.log(`   FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);

if (process.env.FIREBASE_PRIVATE_KEY) {
  const keyLength = process.env.FIREBASE_PRIVATE_KEY.length;
  console.log(`   FIREBASE_PRIVATE_KEY length: ${keyLength} characters`);
  
  if (process.env.FIREBASE_PRIVATE_KEY.includes('PRIVATE KEY')) {
    console.log(`   FIREBASE_PRIVATE_KEY format: ✅ Valid`);
  } else {
    console.log(`   FIREBASE_PRIVATE_KEY format: ❌ Invalid (missing 'PRIVATE KEY')`);
  }
}

console.log('\n🔧 Testing Firebase Admin SDK initialization...');
try {
  const admin = require('firebase-admin');
  
  let rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
  
  // Strip surrounding quotes if present
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
    console.log('✅ Firebase Admin SDK initialized successfully');
    
    // Test auth verification
    console.log('\n🔧 Testing Firebase auth verification...');
    admin.auth().verifyIdToken('test_token')
      .then(() => {
        console.log('⚠️  Unexpected success with test token');
      })
      .catch((error) => {
        if (error.code === 'auth/argument-error' || error.code === 'auth/id-token-expired') {
          console.log('✅ Firebase auth verification is working (test token failed as expected)');
        } else {
          console.log('⚠️  Firebase auth verification error:', error.message);
        }
      });
  } else {
    console.log('❌ Firebase Admin SDK initialized WITHOUT credentials');
    console.log('❌ Auth verification will fail');
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization error:', error.message);
}

console.log('\n📋 Recommendations:');
if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_PRIVATE_KEY.includes('PRIVATE KEY')) {
  console.log('1. Add FIREBASE_PRIVATE_KEY to .env file');
  console.log('2. Get the private key from Firebase Console > Project Settings > Service Accounts');
  console.log('3. Generate new private key and paste it into .env');
  console.log('4. Make sure to replace literal \\n with actual newlines in the key');
}
