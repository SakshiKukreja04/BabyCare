const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
// Service account key should be at server/serviceAccountKey.json
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (error) {
  console.error('Error loading service account key:', error.message);
  console.error('Please ensure serviceAccountKey.json exists in the server/ directory');
  process.exit(1);
}

// Initialize admin app if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Export Firestore database instance
const db = admin.firestore();

// Export Auth instance
const auth = admin.auth();

module.exports = {
  admin,
  db,
  auth,
};

