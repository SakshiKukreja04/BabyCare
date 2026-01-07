# Firebase Setup Guide

## The Error

You're seeing errors like:
- `apiKey=your_firebase_api_key_here` in network requests
- `400 Bad Request` on sign-in attempts
- `auth/invalid-api-key` errors

This means your `.env` file either doesn't exist or has placeholder values.

## Quick Fix

### Step 1: Get Your Firebase Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Click the **gear icon** ⚙️ → **Project Settings**
4. Scroll down to **"Your apps"** section
5. If you don't have a web app, click **"Add app"** → **Web** (</> icon)
6. Copy the config values from the code snippet

You'll see something like:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

### Step 2: Update Your `.env` File

Open `client/.env` and replace the placeholder values:

```env
VITE_FIREBASE_API_KEY=AIzaSyC... (paste your actual apiKey)
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
VITE_API_URL=http://localhost:5000
```

### Step 3: Restart Your Dev Server

**IMPORTANT**: Vite only loads `.env` files when the server starts. You MUST restart:

1. Stop your current dev server (Ctrl+C in terminal)
2. Start it again:
   ```bash
   cd client
   npm run dev
   ```

### Step 4: Verify

After restarting, check the browser console. You should:
- ✅ No more "Missing Firebase env" errors
- ✅ No more `your_firebase_api_key_here` in network requests
- ✅ Firebase should initialize successfully

## Common Issues

### Issue: Still seeing placeholder values after restart
**Solution**: 
- Make sure you saved the `.env` file
- Check that values don't have quotes around them
- Verify the file is in `client/.env` (not `client/src/.env`)

### Issue: "Invalid API key" error
**Solution**:
- Double-check you copied the correct values from Firebase Console
- Make sure there are no extra spaces before/after the values
- Verify the API key is for the correct Firebase project

### Issue: Can't find Firebase config
**Solution**:
- Make sure you're in the correct Firebase project
- If you don't have a web app, create one first
- Check that you're looking at Project Settings → General (not Service Accounts)

## File Locations

- ✅ `.env.example` - Template (safe to commit)
- ✅ `.env` - Your actual config (DO NOT commit this!)
- ✅ `.gitignore` - Should already include `.env`

## Need Help?

If you're still having issues:
1. Check that all 6 Firebase variables are set
2. Verify no typos in variable names (they must start with `VITE_`)
3. Make sure you restarted the dev server after creating/updating `.env`

