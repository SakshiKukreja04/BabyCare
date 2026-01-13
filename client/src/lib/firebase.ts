import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const requiredEnv = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

requiredEnv.forEach((key) => {
  if (!import.meta.env[key]) {
    // Surface missing config early to ease debugging.
    // eslint-disable-next-line no-console
    console.error(`Missing Firebase env: ${key}`);
  }
});

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Log Firebase config for debugging (without sensitive data)
// eslint-disable-next-line no-console
console.log("🔥 Firebase Config:", {
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  currentURL: window.location.href,
});

// Avoid re-initializing during hot reloads.
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const auth = getAuth(app);
// Configure auth settings
auth.languageCode = 'en';
// Set the redirect URL explicitly to handle localhost properly
auth.settings.appVerificationDisabledForTesting = false;

const googleProvider = new GoogleAuthProvider();
// Add scopes if needed
googleProvider.addScope('profile');
googleProvider.addScope('email');
// Set custom parameters for Google OAuth
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

const db = getFirestore(app);

export { app, auth, googleProvider, db };

