const admin = require('firebase-admin');
const path = require('path');

// 1. Path to your service account key file
// Make sure this file is in the same folder as this script!
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

// 2. Initialize the Firebase Admin SDK
try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('❌ ERROR: Could not find or read "serviceAccountKey.json".');
  console.error('Please ensure the file is downloaded from Firebase Console and placed in this folder.');
  process.exit(1);
}

// 3. List of emails to grant admin access to
const adminEmails = [
  'diane.white.artist@gmail.com',
  'ruan.coetzee2@gmail.com'
];

/**
 * Sets custom claims { admin: true } for a user by email
 */
async function setAdminClaim(email) {
  try {
    // Look up the user by email
    const user = await admin.auth().getUserByEmail(email);
    
    // Set custom user claims
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    
    console.log(`✅ SUCCESS: Admin claims set for ${email} (UID: ${user.uid})`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`⚠️  WARNING: User with email ${email} was not found in Firebase Authentication.`);
      console.error('   Make sure the user has signed up or been created first.');
    } else {
      console.error(`❌ ERROR: Failed to set claims for ${email}:`, error.message);
    }
  }
}

// 4. Run the update for all emails
async function run() {
  console.log('--- Starting Custom Claims Update ---');
  
  for (const email of adminEmails) {
    await setAdminClaim(email);
  }
  
  console.log('--- Update Complete ---');
  console.log('Note: Users may need to log out and log back in (or refresh their token) for changes to take effect.');
  process.exit(0);
}

run();
