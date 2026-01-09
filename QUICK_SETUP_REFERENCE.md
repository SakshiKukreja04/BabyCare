# 🎯 Quick Reference: Reminders Setup & API Keys

## ✅ What I Fixed

### RemindersSection.tsx Error
**Problem:** `Cannot find name 'getAuthToken'`

**Solution:** 
1. ✅ Exported `apiRequest` from `api.ts`
2. ✅ Imported it in RemindersSection.tsx
3. ✅ Refactored to use `apiRequest` instead of raw `fetch()`

**Result:** ✅ **No errors** - Component ready to use!

---

## 🔑 Setting Up FCM & WhatsApp API Keys

### Quick Setup (5 minutes)

#### Step 1: Get Firebase Server Key
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select **BabyCare** project
3. Go to **Project Settings** (⚙️)
4. Click **Cloud Messaging** tab
5. Copy **Server Key**

#### Step 2: Get WhatsApp API Token
1. Go to [WhatsApp Business](https://www.whatsapp.com/business/api)
2. Sign up/Log in
3. Create Business Account
4. Verify a phone number
5. Get your **Access Token** and **Business Phone ID**

#### Step 3: Update server/.env
```bash
cd C:\BabyCare\server
# Edit .env and add:
FCM_SERVER_KEY=YOUR_SERVER_KEY_HERE
WHATSAPP_API_TOKEN=YOUR_API_TOKEN_HERE
WHATSAPP_BUSINESS_PHONE_ID=YOUR_PHONE_ID_HERE
WHATSAPP_API_VERSION=v18.0
WHATSAPP_RECIPIENT_PHONE=+1234567890
```

#### Step 4: Update client/.env.local
```bash
cd C:\BabyCare\client
# Edit .env.local and add:
VITE_FCM_VAPID_KEY=YOUR_VAPID_KEY_FROM_FIREBASE
```

#### Step 5: Restart Server
```bash
npm start
```

You should see:
```
✅ FCM Initialized - Server Key configured
✅ WhatsApp Service Initialized
```

---

## 📋 Environment Variables Needed

### Backend (server/.env)

**Required for FCM:**
```env
FCM_SERVER_KEY=AAAAqW2s6Z0:APA91bF...
```

**Required for WhatsApp:**
```env
WHATSAPP_API_TOKEN=EAABjxxxxxxxxxx
WHATSAPP_BUSINESS_PHONE_ID=123456789
WHATSAPP_API_VERSION=v18.0
WHATSAPP_RECIPIENT_PHONE=+1234567890
```

**Already configured:**
```env
FIREBASE_ADMIN_SDK_PATH=./serviceAccountKey.json
GEMINI_API_KEY=...
CLIENT_URL=http://127.0.0.1:5173
PORT=5000
```

### Frontend (client/.env.local)

**Already configured:**
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=
```

**Add for FCM:**
```env
VITE_FCM_VAPID_KEY=BF1h...
```

---

## 🧪 Testing Reminders

### 1. Verify Setup
```bash
cd C:\BabyCare\server
npm start
```

Check for:
```
✅ FCM Initialized - Server Key configured
✅ WhatsApp Service Initialized
⏰ Background reminder scheduler initialized
```

### 2. Create Test Prescription
1. Open Dashboard
2. Create prescription for your baby
3. Add medicine (e.g., Amoxicillin)
4. Set time (e.g., 8:00 AM)
5. Click **Confirm & Save**

### 3. Check Reminders
1. Scroll to **Reminders Section**
2. Should show today's reminders
3. Status: **Pending**

### 4. Verify Notifications
- **Browser**: Check for notification when time arrives
- **WhatsApp**: Check phone for message

### 5. Dismiss Reminder
1. Click **"Mark Given ✓"**
2. Status changes to **Dismissed**

---

## 📚 Full Documentation

| Document | Purpose |
|----------|---------|
| **FCM_AND_WHATSAPP_SETUP.md** | Detailed setup for both APIs |
| **REMINDERSSECTION_FIX.md** | Details about the error fix |
| **REMINDER_SYSTEM_DOCUMENTATION.md** | Complete system reference |
| **REMINDER_SYSTEM_SETUP.md** | Installation guide |
| **REMINDER_SYSTEM_TESTING.md** | Test procedures |

---

## 🚀 Quick Start (Copy-Paste)

### Get Keys
```
Firebase Server Key: [From Firebase Console → Cloud Messaging]
VAPID Key: [From Firebase Console → Cloud Messaging → Web Config]
WhatsApp Token: [From WhatsApp Business]
WhatsApp Phone ID: [From WhatsApp Business]
```

### Update Files

**server/.env:**
```env
FCM_SERVER_KEY=AAAAqW2s6Z0:APA91bF...
WHATSAPP_API_TOKEN=EAABjxxxxxxxxxx
WHATSAPP_BUSINESS_PHONE_ID=123456789
WHATSAPP_API_VERSION=v18.0
WHATSAPP_RECIPIENT_PHONE=+1234567890
```

**client/.env.local:**
```env
VITE_FCM_VAPID_KEY=BF1h...
```

### Start Services
```bash
# Terminal 1: Backend
cd C:\BabyCare\server
npm start

# Terminal 2: Frontend  
cd C:\BabyCare\client
npm run dev
```

### Test
1. Create prescription
2. Confirm it
3. Check Dashboard for reminders
4. Wait for scheduled time
5. Get browser notification + WhatsApp message

---

## ✨ Status

- ✅ RemindersSection component: **No errors**
- ✅ API integration: **Complete**
- ✅ Documentation: **Created**
- ✅ Ready to: **Add to Dashboard & Test**

---

## 🎁 Bonus: Where to Add RemindersSection

**In your Dashboard.tsx:**

```tsx
import RemindersSection from '@/components/dashboard/RemindersSection';

// Inside JSX:
<div className="space-y-6">
  {/* Your other components */}
  
  {/* Add RemindersSection */}
  <RemindersSection 
    babyId={selectedBaby.id} 
    babyName={selectedBaby.name} 
  />
</div>
```

That's it! Reminders will appear and update every 30 seconds. 🎉

---

## 📞 Need Help?

1. **Component errors** → Check `REMINDERSSECTION_FIX.md`
2. **API Key setup** → Check `FCM_AND_WHATSAPP_SETUP.md`
3. **Testing** → Check `REMINDER_SYSTEM_TESTING.md`
4. **Full details** → Check `REMINDER_SYSTEM_DOCUMENTATION.md`

All files are in the root of C:\BabyCare\
