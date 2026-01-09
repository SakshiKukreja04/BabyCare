# Reminder System - Testing & Validation Guide

## 🧪 Testing Checklist

### Phase 1: Setup Verification ✅

- [ ] `npm install` completed without errors
- [ ] `npm start` shows scheduler initialized message
- [ ] Backend running on http://127.0.0.1:5000
- [ ] Frontend running on http://127.0.0.1:5173

### Phase 2: Database Verification ✅

- [ ] Firebase project is accessible
- [ ] Firestore database is created
- [ ] Can create documents in Firestore
- [ ] Users collection has test user
- [ ] Babies collection has test baby

### Phase 3: Prescription Flow ✅

- [ ] Create prescription with medicines
- [ ] Click "Confirm" on prescription
- [ ] No errors in server logs
- [ ] Prescription status changes to "confirmed"

### Phase 4: Reminder Generation ✅

- [ ] Open Firestore console
- [ ] Navigate to `reminders` collection
- [ ] Should see new reminder documents
- [ ] Check fields:
  - [ ] babyId is correct
  - [ ] medicine_name is populated
  - [ ] dosage is populated
  - [ ] scheduled_for is a Timestamp
  - [ ] status is "pending"
  - [ ] channels includes "web" and "whatsapp"

### Phase 5: Scheduler Verification ✅

- [ ] Watch server logs
- [ ] Every 1 minute should see:
  ```
  ⏰ [Scheduler] Checking for pending reminders...
  ```
- [ ] When reminder is due:
  ```
  ✅ [FCM] Reminder notification sent
  ```

### Phase 6: API Testing ✅

```bash
# Test in browser console or Postman

# 1. Get today's reminders
GET http://127.0.0.1:5000/api/reminders/today?babyId=BABY_ID
Authorization: Bearer YOUR_AUTH_TOKEN

# Expected: Array of reminders with today's date

# 2. Get all reminders
GET http://127.0.0.1:5000/api/reminders/all
Authorization: Bearer YOUR_AUTH_TOKEN

# Expected: Array of all reminders

# 3. Get specific reminder
GET http://127.0.0.1:5000/api/reminders/REM_ID
Authorization: Bearer YOUR_AUTH_TOKEN

# Expected: Single reminder object

# 4. Dismiss reminder
POST http://127.0.0.1:5000/api/reminders/REM_ID/dismiss
Authorization: Bearer YOUR_AUTH_TOKEN

# Expected: Success message
```

### Phase 7: Frontend Component ✅

- [ ] Added RemindersSection to Dashboard
- [ ] Component imports without errors
- [ ] Component renders without errors
- [ ] Shows "Loading..." initially
- [ ] Shows reminders list after loading
- [ ] Shows summary stats
- [ ] "Refresh" button works
- [ ] "Mark Given ✓" button works

### Phase 8: Notifications ✅

- [ ] Browser notification appears (if FCM configured)
- [ ] WhatsApp message sent (if WhatsApp configured)
- [ ] Reminder status updated to "sent"
- [ ] Errors logged if notification fails

## 🧬 Test Cases

### Test Case 1: Basic Reminder Generation

**Objective:** Verify reminders are created when prescription is confirmed

**Steps:**
1. Login to app
2. Go to Prescriptions
3. Scan or upload prescription
4. Enter medicine details:
   - Name: "Test Medicine"
   - Dosage: "100mg"
   - Frequency: "Twice daily"
   - Times: 2
   - Schedule: ["08:00", "20:00"]
5. Click "Confirm"

**Expected:**
- Prescription status → "confirmed"
- No errors in logs
- Firestore shows 4 reminders:
  - 2 for today (if times in future)
  - 2 for tomorrow

**Actual:** _______________________

### Test Case 2: Reminder Fetch API

**Objective:** Verify API returns reminders correctly

**Steps:**
1. Open browser DevTools Console
2. Run:
```javascript
const response = await fetch(
  '/api/reminders/today?babyId=YOUR_BABY_ID',
  {
    headers: {
      'Authorization': `Bearer ${YOUR_TOKEN}`
    }
  }
);
const data = await response.json();
console.log(data);
```
3. Check response

**Expected:**
- Status: 200 OK
- data.data.reminders is array
- data.data.summary has counts
- summary.total > 0

**Actual:** _______________________

### Test Case 3: Dismiss Reminder

**Objective:** Verify reminder dismissal works

**Steps:**
1. Get reminder from API response
2. Run:
```javascript
const reminderId = 'YOUR_REMINDER_ID';
const response = await fetch(
  `/api/reminders/${reminderId}/dismiss`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${YOUR_TOKEN}`
    }
  }
);
const data = await response.json();
console.log(data);
```

**Expected:**
- Status: 200 OK
- Message: "Reminder dismissed"
- Firestore shows status: "dismissed"

**Actual:** _______________________

### Test Case 4: Scheduler Processing

**Objective:** Verify scheduler processes pending reminders

**Steps:**
1. Create reminder with scheduled_for = now
2. Watch server logs
3. Wait up to 1 minute
4. Check server logs for:
```
⏰ [Scheduler] Checking for pending reminders...
📋 [Reminders] Found X pending reminders
✅ [FCM] Reminder notification sent
```

**Expected:**
- Scheduler log appears
- FCM log appears
- Firestore shows status: "sent"

**Actual:** _______________________

### Test Case 5: Dashboard Display

**Objective:** Verify RemindersSection renders correctly

**Steps:**
1. Open Dashboard
2. Check RemindersSection component
3. Verify:
   - [ ] Title displays
   - [ ] Summary stats show
   - [ ] Reminders list shows
   - [ ] Status badges display
   - [ ] "Mark Given ✓" button shows for pending
   - [ ] Can click button without errors

**Expected:**
- Component fully rendered
- All information visible
- All buttons functional
- No console errors

**Actual:** _______________________

### Test Case 6: Real-time Updates

**Objective:** Verify reminders update in real-time

**Steps:**
1. Open RemindersSection on two browser tabs
2. In first tab: Click "Mark Given ✓"
3. Check second tab
4. Wait 30 seconds

**Expected:**
- First tab shows status updated immediately
- Second tab shows status update within 30 seconds (next poll)
- Summary stats update

**Actual:** _______________________

### Test Case 7: Error Handling - No FCM Token

**Objective:** Verify system handles missing FCM token

**Steps:**
1. Create user without FCM token
2. Create and confirm prescription
3. Wait for scheduler
4. Check Firestore reminder

**Expected:**
- Reminder status: "failed"
- error_message: contains "FCM token"
- System continues processing
- No crash

**Actual:** _______________________

### Test Case 8: Multiple Medicines

**Objective:** Verify multiple medicines handled correctly

**Steps:**
1. Create prescription with 2 medicines:
   - Medicine A: 3x daily
   - Medicine B: 2x daily
2. Click "Confirm"
3. Check Firestore

**Expected:**
- Reminders created for both medicines
- Total reminders ≥ 10 (5+ for each)
- Separate reminder documents
- Correct medicine_name in each

**Actual:** _______________________

## 📊 Performance Testing

### Load Test: 100 Reminders

**Objective:** Verify scheduler handles many reminders

**Steps:**
1. Manually create 100 reminder documents
2. Set all to status: "pending", scheduled_for: now
3. Watch scheduler logs
4. Monitor response time

**Expected:**
- Scheduler completes in < 30 seconds
- All reminders processed
- No timeout errors
- Server doesn't crash

**Actual:** _______________________
**Duration:** _______________________

### Memory Test: Long Running

**Objective:** Verify no memory leaks

**Steps:**
1. Start server
2. Create/confirm 10 prescriptions over 1 hour
3. Watch memory usage
4. Check server still responsive

**Expected:**
- Memory stable
- Server responsive
- No errors
- Logs clean

**Actual:** _______________________

## 🔍 Debugging Guide

### Enable Debug Logging

Add to server code:
```javascript
// Add at top of service files
const DEBUG = process.env.DEBUG_REMINDERS === 'true';

// Use in functions:
if (DEBUG) console.log('Debug info:', data);
```

Run with:
```bash
DEBUG_REMINDERS=true npm start
```

### Check Firestore Rules

View current rules:
```javascript
// In Firebase Console → Firestore → Rules
match /reminders/{doc=**} {
  allow read, write: if request.auth.uid == resource.data.parentId;
}
```

### Test Notification Services

**Test FCM:**
```bash
# In browser console
import { getMessaging, getToken } from 'firebase/messaging';
const msg = getMessaging();
const token = await getToken(msg);
console.log('FCM Token:', token);
```

**Test WhatsApp:**
```bash
# Manual API call (requires credentials)
curl -X POST https://graph.facebook.com/v18.0/YOUR_PHONE_ID/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+919876543210",
    "type": "text",
    "text": { "body": "Test message" }
  }'
```

## 📝 Test Report Template

```
TEST EXECUTION REPORT
====================

Date: ____________
Tester: __________
Build: ___________

Test Cases Passed: __/8
Success Rate: ____%

Issues Found:
1. _______________
2. _______________
3. _______________

Blockers:
1. _______________
2. _______________

Recommendations:
1. _______________
2. _______________

Sign-off: ________________
```

## ✅ Sign-Off Checklist

When all tests pass, verify:

- [ ] Reminder generation works
- [ ] API endpoints respond correctly
- [ ] Dashboard component renders
- [ ] Scheduler processes reminders
- [ ] Notifications send successfully
- [ ] Errors handled gracefully
- [ ] Database queries efficient
- [ ] Logs are clear and helpful
- [ ] No security issues found
- [ ] Documentation is accurate

## 🎉 System Ready!

Once all tests pass, the reminder system is:
- ✅ Functional
- ✅ Reliable
- ✅ Performant
- ✅ Secure
- ✅ Production-ready

Ready for deployment! 🚀
