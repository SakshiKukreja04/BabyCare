# 🗺️ Where to Find & Set API Keys - Complete Map

## 📍 API Keys Locations (Where to Get Them)

### 🔥 Firebase Cloud Messaging (FCM) Server Key

**Step 1: Open Firebase Console**
- URL: https://console.firebase.google.com/

**Step 2: Select BabyCare Project**
- Look in top-left dropdown
- Click on your project

**Step 3: Find Cloud Messaging Section**
- Left menu → **Cloud Messaging**
- (You may need to enable it if not already enabled)

**Step 4: Get Server Key**
- Look for section labeled **"Server Key"**
- Click **Copy** button
- Store it safely

**What it looks like:**
```
Server Key: AAAAqW2s6Z0:APA91bFZKxxxxxxxxxxxxxxxxxxx
```

### 🌐 Firebase VAPID Key (For Web Push)

**Step 1: In Firebase Console (same as above)**
- Go to **Cloud Messaging** tab

**Step 2: Look for Web Configuration**
- Section: **"Web Push certificates"**
- Click **"Generate key pair"** if not present

**Step 3: Get Public Key**
- Copy the **Public key** value
- This is your VAPID key

**What it looks like:**
```
BF1h4Kkjxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 💬 WhatsApp API Credentials

**Step 1: Create WhatsApp Business Account**
- URL: https://www.whatsapp.com/business/
- Click **Get started**
- Sign up with business email

**Step 2: Create Business Phone Number**
- Verify a phone number (your business phone)
- This is the number people will see messages from

**Step 3: Get API Credentials**
- Go to **Developers** section
- Find **API Access Token**
- You'll get:
  - **Access Token** - Long string starting with `EAAB`
  - **Business Phone ID** - Your phone number ID
  - **API Version** - Currently `v18.0`

**What they look like:**
```
Access Token: EAABjZAVa0JsBAxxxxxxxxxxxxxxxxxx
Business Phone ID: 1234567890123
```

---

## 💾 Where to Put API Keys (Configuration Files)

### 🖥️ Backend Configuration

**File:** `C:\BabyCare\server\.env`

**How to edit:**
1. Open in VS Code
2. Ctrl+Shift+P → "Open File"
3. Search: `.env`
4. Select: `server\.env`
5. Find these sections and update:

```env
# ==================== FCM CONFIGURATION ====================
# Get this from Firebase Console → Cloud Messaging
FCM_SERVER_KEY=AAAAqW2s6Z0:APA91bF...

# ==================== WHATSAPP CONFIGURATION ====================
# Get these from WhatsApp Business Platform
WHATSAPP_API_TOKEN=EAABjxxxxxxxxxx
WHATSAPP_BUSINESS_PHONE_ID=123456789
WHATSAPP_API_VERSION=v18.0
WHATSAPP_RECIPIENT_PHONE=+1234567890
```

**Notes:**
- Replace `YOUR_KEY_HERE` with actual values
- Keep the `=` sign
- No quotes needed
- One variable per line
- Don't commit this file to Git!

### 🌐 Frontend Configuration

**File:** `C:\BabyCare\client\.env.local`

**How to edit:**
1. Open in VS Code
2. Ctrl+Shift+P → "Open File"
3. Search: `.env.local`
4. Select: `client\.env.local`
5. Add or update:

```env
# ==================== FCM VAPID KEY ====================
# Get from Firebase Console → Cloud Messaging → Web Config
VITE_FCM_VAPID_KEY=BF1h4Kkjxxxx...
```

**Notes:**
- Must start with `VITE_` prefix
- This is the VAPID key (different from Server Key!)
- The rest of the file should stay unchanged

---

## 🔄 Step-by-Step Process

### Complete Setup Flow

**1. Get Firebase Server Key** (5 min)
```
Firebase Console
  ↓
Select BabyCare Project
  ↓
Go to Cloud Messaging
  ↓
Find "Server Key"
  ↓
Copy it
```

**2. Get Firebase VAPID Key** (2 min)
```
Firebase Console (same window)
  ↓
Still in Cloud Messaging tab
  ↓
Look for "Web Push certificates"
  ↓
Find "Public key"
  ↓
Copy it
```

**3. Get WhatsApp Credentials** (10 min)
```
WhatsApp Business
  ↓
Create account
  ↓
Verify phone number
  ↓
Get Access Token
  ↓
Get Business Phone ID
```

**4. Update Backend** (2 min)
```
C:\BabyCare\server\.env
  ↓
Add FCM_SERVER_KEY
  ↓
Add WHATSAPP_API_TOKEN
  ↓
Add WHATSAPP_BUSINESS_PHONE_ID
  ↓
Add WHATSAPP_API_VERSION=v18.0
  ↓
Add WHATSAPP_RECIPIENT_PHONE
  ↓
Save file (Ctrl+S)
```

**5. Update Frontend** (1 min)
```
C:\BabyCare\client\.env.local
  ↓
Add VITE_FCM_VAPID_KEY
  ↓
Save file (Ctrl+S)
```

**6. Restart Services** (1 min)
```
Backend:
  cd C:\BabyCare\server
  npm start

Frontend:
  cd C:\BabyCare\client
  npm run dev
```

**7. Verify Setup** (1 min)
```
Check Backend Logs for:
  ✅ FCM Initialized
  ✅ WhatsApp Service Initialized
```

**Total Time: ~25 minutes** ⏱️

---

## 📋 Configuration Checklist

### Before You Start
- [ ] Have Firebase Console open
- [ ] Have WhatsApp Business account created
- [ ] Have VS Code open with BabyCare project

### Firebase Setup
- [ ] Copied Firebase Server Key
- [ ] Copied Firebase VAPID Key
- [ ] Added FCM_SERVER_KEY to `server/.env`
- [ ] Added VITE_FCM_VAPID_KEY to `client/.env.local`

### WhatsApp Setup
- [ ] Have WhatsApp Business account
- [ ] Phone number verified
- [ ] Got Access Token
- [ ] Got Business Phone ID
- [ ] Added WHATSAPP_API_TOKEN to `server/.env`
- [ ] Added WHATSAPP_BUSINESS_PHONE_ID to `server/.env`
- [ ] Added WHATSAPP_API_VERSION=v18.0 to `server/.env`
- [ ] Added WHATSAPP_RECIPIENT_PHONE to `server/.env`

### Verification
- [ ] Server started without errors
- [ ] Frontend started without errors
- [ ] Can see in logs: "✅ FCM Initialized"
- [ ] Can see in logs: "✅ WhatsApp Service Initialized"

---

## 🔍 Verifying Configuration

### Check Backend
```bash
cd C:\BabyCare\server
npm start
```

Expected output:
```
✅ FCM Initialized - Server Key configured
✅ WhatsApp Service Initialized
⏰ Background reminder scheduler initialized
```

### Check Frontend
```bash
cd C:\BabyCare\client  
npm run dev
```

No errors in terminal.

### Check Browser Console
Open DevTools (F12) → Console tab
- Should NOT see errors about FCM or WhatsApp
- Should see: `Notification.permission` = `"granted"` (if permissions enabled)

---

## 🆘 Troubleshooting

### FCM Not Working

**Error in logs:**
```
⚠️ FCM not configured
```

**Fix:**
1. Check `server/.env` has `FCM_SERVER_KEY`
2. Restart server: `npm start`

**Still not working?**
1. Go to Firebase Console
2. Verify project is correct
3. Copy key again (might have expired)
4. Update `server/.env`
5. Restart

### WhatsApp Not Working

**Error in logs:**
```
❌ WhatsApp API not configured
```

**Fix:**
1. Check all 4 variables in `server/.env`:
   - `WHATSAPP_API_TOKEN`
   - `WHATSAPP_BUSINESS_PHONE_ID`
   - `WHATSAPP_API_VERSION`
   - `WHATSAPP_RECIPIENT_PHONE`
2. Restart server

**Messages not sending?**
1. Check phone number format: `+1234567890` (with +)
2. Verify token is current (doesn't expire immediately)
3. Check WhatsApp Business account status

### Can't Find Keys

**Firebase Server Key:**
- Firebase Console → Project Settings ⚙️ → Cloud Messaging tab
- Look for "Server Key" section

**Firebase VAPID Key:**
- Same location
- Look for "Web Push certificates"
- Click "Generate" if needed

**WhatsApp Credentials:**
- WhatsApp Business Platform dashboard
- Look in "API Settings" or "Developers" section

---

## 📞 Support Resources

### Firebase Documentation
- Docs: https://firebase.google.com/docs/cloud-messaging
- Console: https://console.firebase.google.com/

### WhatsApp Documentation
- Getting Started: https://www.whatsapp.com/business/getting-started
- API Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

### BabyCare Documentation
- See: **FCM_AND_WHATSAPP_SETUP.md** (detailed guide)
- See: **QUICK_SETUP_REFERENCE.md** (quick reference)

---

## ✅ Final Checklist

Before testing reminders:

- [ ] **server/.env** has all FCM variables
- [ ] **server/.env** has all WhatsApp variables  
- [ ] **client/.env.local** has FCM_VAPID_KEY
- [ ] Backend started: `npm start` (no errors)
- [ ] Frontend started: `npm run dev` (no errors)
- [ ] Created a prescription
- [ ] Confirmed the prescription
- [ ] Reminders appear in RemindersSection
- [ ] Can see "Mark Given ✓" button

If all checked: **You're ready to test!** 🎉

---

## 🚀 You're All Set!

All the configuration is now in place. Next step:

1. **Create a test prescription** in the Dashboard
2. **Confirm it** (this generates reminders)
3. **Wait for the scheduled time**
4. **Receive notifications** on web + WhatsApp
5. **Mark as given** in the app

Happy reminder tracking! 💊📱
