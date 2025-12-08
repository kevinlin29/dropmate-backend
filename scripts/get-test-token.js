/**
 * Get a Firebase test token for API testing
 *
 * This script generates a custom token for a test user using Firebase Admin SDK
 * and then exchanges it for an ID token that can be used with the API
 */

import admin from 'firebase-admin';
import fetch from 'node-fetch';

// Initialize Firebase Admin (using the same config as the API)
const serviceAccount = JSON.parse(
  require('fs').readFileSync('./dropmate-9dc10-firebase-adminsdk-fbsvc-42fe6af318.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function getTestToken(uid) {
  try {
    console.log(`🔐 Generating custom token for UID: ${uid}...`);

    // Create a custom token
    const customToken = await admin.auth().createCustomToken(uid);
    console.log('✅ Custom token created');

    // Exchange custom token for ID token
    console.log('🔄 Exchanging for ID token...');

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY'}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: customToken,
          returnSecureToken: true
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to exchange token');
    }

    const data = await response.json();
    console.log('✅ ID token obtained!\n');
    console.log('🎫 Your Firebase ID Token:');
    console.log(data.idToken);
    console.log('\n📋 Token expires in:', data.expiresIn, 'seconds');
    console.log('\n💡 Use this token to test the API:');
    console.log(`   node test-shipment-flow.js ${data.idToken}`);

    return data.idToken;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Note: This script requires FIREBASE_API_KEY environment variable');
    console.log('   You can find it in Firebase Console > Project Settings > Web API Key');
    process.exit(1);
  }
}

// Available test users
const TEST_USERS = {
  alice: 'fHesazNSXHglErKtyp37OgNDbMw2',
  bob: 'PybscNfIwyQ8irpDcBFqFYtoeiT2'
};

const userArg = process.argv[2] || 'alice';
const uid = TEST_USERS[userArg] || userArg;

console.log('🧪 Getting test token for Firebase authentication\n');
console.log('Available test users:');
console.log('  - alice (fHesazNSXHglErKtyp37OgNDbMw2)');
console.log('  - bob (PybscNfIwyQ8irpDcBFqFYtoeiT2)\n');

getTestToken(uid);
