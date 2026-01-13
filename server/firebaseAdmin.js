const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Supports both environment variables and serviceAccountKey.json file (for backward compatibility)
let serviceAccount;

// Priority 1: Use environment variables (production/deployment)
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    // Parse JSON from environment variable
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('✓ Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
  } catch (error) {
    console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', error.message);
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON format');
  }
}
// Priority 2: Use individual environment variables (alternative method)
else if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID || '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL || '',
  };
  console.log('✓ Firebase Admin initialized from individual environment variables');
}
// Priority 3: Fallback to serviceAccountKey.json file (development/backward compatibility)
else {
  try {
    const path = require('path');
    serviceAccount = require('./serviceAccountKey.json');
    console.log('✓ Firebase Admin initialized from serviceAccountKey.json file');
    console.warn('⚠️  Using serviceAccountKey.json file. For production, use environment variables.');
  } catch (error) {
    console.error('❌ Error loading Firebase service account:');
    console.error('   - FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set');
    console.error('   - Individual Firebase env vars not set');
    console.error('   - serviceAccountKey.json file not found');
    console.error('\n📝 Please set one of the following:');
    console.error('   1. FIREBASE_SERVICE_ACCOUNT_KEY (JSON string)');
    console.error('   2. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    console.error('   3. Place serviceAccountKey.json in server/ directory');
    process.exit(1);
  }
}

// Initialize admin app if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(`✓ Firebase Admin SDK initialized successfully`);
    console.log(`   Project ID: ${serviceAccount.project_id || 'N/A'}`);
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    throw error;
  }
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

