# 🔔 FCM & WhatsApp Setup Guide

This guide shows you where and how to configure Firebase Cloud Messaging (FCM) and WhatsApp API keys for the reminder notification system.

## 📱 Part 1: Firebase Cloud Messaging (FCM) Setup

### What FCM Does
FCM sends web push notifications to browsers. When a reminder is due, users get a browser notification even if the app isn't active.

### Step 1: Enable FCM in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **BabyCare** project
3. Navigate to **Cloud Messaging** (in left menu)
4. Click **Enable** (if not already enabled)
5. You should see a **Web API Key** - copy this for later

### Step 2: Get the Server Key

1. Go to **Project Settings** (gear icon, top-left)
2. Click the **Cloud Messaging** tab
3. Find **Server Key** - this is needed for the backend
4. Copy it

### Step 3: Configure Backend (Node.js)

The server already has FCM code. You just need to set the environment variable.

**File:** `server/.env`

Add or update:
```env
FCM_SERVER_KEY=YOUR_FIREBASE_SERVER_KEY_HERE
```

**Example:**
```env
FCM_SERVER_KEY=AAAAqW2s6Z0:APA91bFxxxxxxxxxxxxx
```

### Step 4: Enable Web Push on Frontend

The frontend automatically uses Firebase to get FCM tokens. You just need to:

1. **Ensure Firestore is set up** (already done - check [Firebase credentials](firebase.json))
2. **Verify public/firebase-messaging-sw.js exists** - this handles background notifications

If it doesn't exist, create it:

```bash
# Create service worker file
cd C:\BabyCare\client\public
```

Create file: `firebase-messaging-sw.js`

```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyxxxxxx",
  authDomain: "babycare-xxx.firebaseapp.com",
  projectId: "babycare-xxx",
  storageBucket: "babycare-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxx",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || '💊 Medicine Reminder';
  const notificationOptions = {
    body: payload.notification?.body || 'It\'s time for medicine!',
    icon: '/icons/pill-icon.png',
    badge: '/icons/badge.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

Use your Firebase config from `client/.env.local`

### Step 5: Request Browser Permission

When user logs in, ask for notification permission. Add to `AuthContext.tsx` or `Dashboard.tsx`:

```typescript
// Request notification permission
Notification.requestPermission().then((permission) => {
  if (permission === 'granted') {
    console.log('✅ Notification permission granted');
    // Optionally, get FCM token and save to Firestore
    const messaging = getMessaging(app);
    getToken(messaging, {
      vapidKey: import.meta.env.VITE_FCM_VAPID_KEY,
    }).then((token) => {
      console.log('FCM Token:', token);
      // Save token to user profile in Firestore
      // db.collection('users').doc(userId).update({
      //   fcmToken: token
      // })
    });
  }
});
```

### Step 6: Get VAPID Key

1. Go back to **Firebase Console → Cloud Messaging**
2. Look for **Web configuration**
3. Find or generate **Web Push certificates**
4. Copy the **Public Key**

**File:** `client/.env.local`

Add:
```env
VITE_FCM_VAPID_KEY=YOUR_VAPID_PUBLIC_KEY_HERE
```

### ✅ FCM Verification

**Test in Console:**

```bash
cd C:\BabyCare\server
npm start
```

You should see:
```
✅ FCM Initialized - Server Key configured
```

**Test in Browser:**

1. Open Dashboard
2. Check browser console: `Notification.permission` should be `'granted'`
3. If tokens are saved to Firestore, you'll see notifications when reminders trigger

---

## 📞 Part 2: WhatsApp Setup

### What WhatsApp Does
WhatsApp sends messages to parents' phones. They receive medicine reminders via WhatsApp even when the app is closed.

### Prerequisites
- **WhatsApp Business Account** (free tier available)
- **Phone Number** verified for WhatsApp Business

### Step 1: Create WhatsApp Business Account

1. Go to [WhatsApp Business Platform](https://www.whatsapp.com/business/api)
2. Click **Sign Up**
3. Create business account
4. Verify a **Business Phone Number** (this is what people will see messages from)

### Step 2: Get API Credentials

After setup, you'll get:
- **Access Token** - Authenticates your API requests
- **Business Phone ID** - The phone number account ID
- **API Version** - Usually `v18.0` or latest

### Step 3: Configure Backend

**File:** `server/.env`

Add these variables:

```env
WHATSAPP_API_TOKEN=YOUR_WHATSAPP_API_TOKEN_HERE
WHATSAPP_BUSINESS_PHONE_ID=YOUR_BUSINESS_PHONE_ID_HERE
WHATSAPP_API_VERSION=v18.0
WHATSAPP_RECIPIENT_PHONE=YOUR_PHONE_NUMBER_FOR_TESTING
```

**Example:**
```env
WHATSAPP_API_TOKEN=EAABjxxxxxx...
WHATSAPP_BUSINESS_PHONE_ID=1234567890
WHATSAPP_API_VERSION=v18.0
WHATSAPP_RECIPIENT_PHONE=+1234567890
```

### Step 4: Get a Phone Number for Testing

1. In WhatsApp Business dashboard → **Phone numbers**
2. Click your verified number
3. Copy the **Phone ID** (Business Phone ID)
4. Note your **Display Phone Number** (what you'll send from)

### Step 5: Send Test Message

**Via cURL (test in PowerShell):**

```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_ACCESS_TOKEN"
    "Content-Type" = "application/json"
}

$body = @{
    messaging_product = "whatsapp"
    to = "+1234567890"  # Recipient phone (with country code)
    type = "text"
    text = @{
        body = "Hello! This is a test message from BabyCare"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://graph.instagram.com/v18.0/1234567890/messages" `
  -Method POST `
  -Headers $headers `
  -Body $body
```

Expected response:
```json
{
  "messages": [
    {
      "id": "wamid.xxxxx",
      "message_status": "accepted"
    }
  ]
}
```

### ✅ WhatsApp Verification

**Test in Backend:**

```bash
cd C:\BabyCare\server
npm start
```

Check logs for:
```
✅ WhatsApp Service Initialized
```

**Test Reminder Sending:**

1. Create a prescription and confirm it
2. A reminder should be generated
3. Wait until scheduled time
4. Check your phone for WhatsApp message

Example WhatsApp reminder message:
```
💊 Medicine Reminder for Baby

Medicine: Amoxicillin
Dosage: 250mg
Time: 08:00 AM

Please give the medicine and mark as done in the app.

- BabyCare
```

---

## 🔗 Part 3: Complete Setup Map

### Files to Update

```
BabyCare/
├── server/
│   ├── .env                           ← Add FCM & WhatsApp keys HERE
│   ├── services/
│   │   ├── fcm.js                     ← Already handles FCM sending
│   │   └── whatsapp.js                ← Already handles WhatsApp sending
│   └── services/notificationScheduler.js  ← Uses both services
│
├── client/
│   ├── .env.local                     ← Add VITE_FCM_VAPID_KEY
│   ├── public/
│   │   └── firebase-messaging-sw.js   ← Create if not exists
│   └── src/
│       └── components/
│           └── dashboard/
│               └── RemindersSection.tsx   ← Already integrated
```

### Environment Variables Checklist

#### Backend (`server/.env`)
```env
# FCM Configuration
FCM_SERVER_KEY=YOUR_FIREBASE_SERVER_KEY

# WhatsApp Configuration  
WHATSAPP_API_TOKEN=YOUR_WHATSAPP_API_TOKEN
WHATSAPP_BUSINESS_PHONE_ID=YOUR_BUSINESS_PHONE_ID
WHATSAPP_API_VERSION=v18.0
WHATSAPP_RECIPIENT_PHONE=+1234567890

# Existing vars (keep these)
FIREBASE_ADMIN_SDK_PATH=./serviceAccountKey.json
GEMINI_API_KEY=...
CLIENT_URL=http://127.0.0.1:5173
PORT=5000
```

#### Frontend (`client/.env.local`)
```env
# Firebase Config
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# FCM VAPID Key
VITE_FCM_VAPID_KEY=YOUR_FCM_VAPID_KEY

# API Base URL
VITE_API_BASE_URL=
```

---

## 🧪 Testing Notifications

### Test 1: Check FCM Is Configured

```bash
cd C:\BabyCare\server
npm start
```

Look for:
```
✅ FCM Initialized - Server Key configured
```

If you see:
```
⚠️ FCM not configured - Web notifications disabled
```

Then set `FCM_SERVER_KEY` in `.env`

### Test 2: Check WhatsApp Is Configured

You should see:
```
✅ WhatsApp Service Initialized
```

If you see:
```
⚠️ WhatsApp API not configured
```

Then set WhatsApp vars in `.env`

### Test 3: Full Flow Test

1. **Create Prescription**
   - Go to Dashboard
   - Add a prescription for your baby
   - Add medicines with times

2. **Confirm Prescription**
   - Click "Confirm & Save"
   - Should see success message
   - Reminders are auto-generated

3. **Check Reminders**
   - Go to **Reminders** section
   - Should show today's reminders
   - Status should be **Pending**

4. **Wait for Scheduled Time**
   - When scheduled time arrives:
     - You get a **browser notification** (FCM)
     - You get a **WhatsApp message**

5. **Mark as Given**
   - Click **"Mark Given ✓"** in RemindersSection
   - Status changes to **Dismissed**

---

## 🚨 Troubleshooting

### FCM Not Sending

**Check server logs:**
```
❌ [FCM Error] ...
```

**Solutions:**
1. Verify `FCM_SERVER_KEY` in `.env`
2. Verify Firebase project is correct
3. Restart server: `npm start`

### WhatsApp Not Sending

**Check server logs:**
```
❌ [WhatsApp Error] ...
```

**Solutions:**
1. Verify all WhatsApp env vars set
2. Verify phone number format: `+1234567890` (with +)
3. Verify API token is current (tokens expire)
4. Check WhatsApp Business account status

### Browser Notifications Not Appearing

**Check browser console:**
```
Notification.permission  // Should be 'granted'
```

**Solutions:**
1. Click allow when browser asks for permission
2. Check Notifications settings in browser
3. Verify `VITE_FCM_VAPID_KEY` in `.env.local`
4. Restart dev server: `npm run dev`

### Reminders Not Generating

**Check Firestore:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Firestore Database**
4. Look for **reminders** collection
5. Should have documents for each medicine

If empty:
1. Confirm prescription (generates reminders)
2. Check server logs for errors
3. Verify `generateRemindersFor24Hours` is called

---

## 📖 API Details

### FCM Request Example

The backend sends to FCM:

```javascript
{
  notification: {
    title: "💊 Medicine Reminder",
    body: "Amoxicillin - 250mg due at 8:00 AM"
  },
  data: {
    reminderId: "reminder-id-123",
    babyId: "baby-id-456",
    action: "open_reminders"
  },
  token: "fcm_token_here"
}
```

### WhatsApp Request Example

The backend sends to WhatsApp:

```json
{
  "messaging_product": "whatsapp",
  "to": "+1234567890",
  "type": "text",
  "text": {
    "body": "💊 Medicine Reminder for Baby\n\nMedicine: Amoxicillin\nDosage: 250mg\nTime: 08:00 AM\n\n- BabyCare"
  }
}
```

---

## 🔐 Security Notes

### Keep Keys Secret

- **Never commit** `.env` to Git
- **Never share** FCM_SERVER_KEY or WHATSAPP_API_TOKEN
- Use `.env.local` for local development only

### Limit Permissions

- **FCM**: Only use for notifications
- **WhatsApp**: Only use for medicine reminders

### Monitor API Costs

- **FCM**: Free for up to 1 million messages/month
- **WhatsApp**: Charged per message (~$0.004 per message on free tier)

---

## 📞 Getting Help

### Firebase Support
- [Firebase Docs: Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Console](https://console.firebase.google.com/)

### WhatsApp Support
- [WhatsApp Business Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [WhatsApp API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/send-messages)

### BabyCare Documentation
- See `REMINDER_SYSTEM_DOCUMENTATION.md` for system details
- See `REMINDER_SYSTEM_TESTING.md` for test procedures

---

## ✨ Quick Start (Summary)

**In 5 minutes:**

1. **Get FCM Server Key** from Firebase Console
2. **Get WhatsApp API Token** from WhatsApp Business
3. **Update `server/.env`** with all 4 keys
4. **Restart server** → `npm start`
5. **Test** by creating a prescription

That's it! 🎉 Both notifications should work automatically.
