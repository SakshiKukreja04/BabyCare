# Medicine Reminder & Notification System

## Overview

A complete reminder and notification system for the BabyCare app that:
- Automatically generates reminders when prescriptions are confirmed
- Sends notifications via web (FCM) and WhatsApp
- Provides a dashboard to view and manage reminders
- Runs background scheduler every minute to check for due reminders
- Tracks reminder status (pending, sent, dismissed, failed)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Parent confirms prescription with medicines                   │
├─────────────────────────────────────────────────────────────┤
│ POST /api/prescriptions/:id/confirm                           │
├─────────────────────────────────────────────────────────────┤
│ Generates reminders for next 24+ hours                        │
│ (One reminder per dose time per medicine)                     │
├─────────────────────────────────────────────────────────────┤
│ Reminders stored in Firestore                                │
│ status: "pending"                                             │
├─────────────────────────────────────────────────────────────┤
│ Background Scheduler (runs every 1 minute)                    │
│ - Fetches pending reminders where scheduledTime <= now        │
│ - Sends notifications via FCM + WhatsApp                      │
│ - Updates status to "sent" or "failed"                        │
├─────────────────────────────────────────────────────────────┤
│ Parent Dashboard                                              │
│ - Displays today's reminders                                  │
│ - Shows pending/sent/dismissed count                          │
│ - Can mark reminders as "dismissed" (medicine given)          │
└─────────────────────────────────────────────────────────────┘
```

## Firestore Schema

### reminders Collection

```javascript
{
  // Identifiers
  id: string,                                    // Document ID
  babyId: string,                                // Baby reference
  parentId: string,                              // Parent (user) reference

  // Medicine Information
  medicine_name: string,                         // E.g., "Amoxicillin"
  dosage: string,                                // E.g., "250mg"
  frequency: string,                             // E.g., "Every 6 hours"

  // Scheduling
  dose_time: string,                             // HH:mm format (e.g., "08:00")
  scheduled_for: Timestamp,                      // When reminder is due

  // Notification Configuration
  channels: string[],                            // ["web", "whatsapp"]

  // Status Tracking
  status: string,                                // "pending", "sent", "dismissed", "failed"
  attempt_count: number,                         // How many times we tried to send
  last_attempt: Timestamp,                       // When we last tried
  error_message: string,                         // Error details if failed

  // Timestamps
  created_at: Timestamp,                         // When reminder was created
  updated_at: Timestamp,                         // Last update
}
```

## Services

### 1. Reminders Service (`services/reminders.js`)

Handles reminder creation, retrieval, and status updates.

**Functions:**

```javascript
// Generate reminders for next 24 hours for a medicine
generateRemindersFor24Hours(babyId, parentId, medicine)
  → Promise<string[]>  // Array of reminder IDs

// Get all pending reminders ready to send
getPendingReminders()
  → Promise<Object[]>

// Get reminders for today
getRemindersForToday(babyId)
  → Promise<Object[]>

// Update reminder status
updateReminderStatus(reminderId, status, errorMessage)
  → Promise<void>

// Dismiss reminder
dismissReminder(reminderId)
  → Promise<void>

// Get parent's reminders
getRemindersForParent(parentId, filters)
  → Promise<Object[]>

// Delete old reminders (cleanup)
deleteOldReminders(olderThanDays)
  → Promise<number>
```

### 2. Notification Scheduler (`services/notificationScheduler.js`)

Sends notifications via FCM (web) and WhatsApp.

**Functions:**

```javascript
// Send reminder via all configured channels
sendReminderNotification(reminder)
  → Promise<Object>  // { web: {...}, whatsapp: {...} }

// Send FCM notification
sendWebReminder(reminder, fcmToken)
  → Promise<Object>

// Send WhatsApp notification
sendWhatsAppReminder(reminder, phoneNumber)
  → Promise<Object>

// Process all pending reminders (called by scheduler)
processPendingReminders()
  → Promise<{ total, sent, failed }>
```

### 3. Background Scheduler (`services/backgroundScheduler.js`)

Runs cron jobs for reminders and cleanup.

**Functions:**

```javascript
// Initialize scheduler with cron jobs
initializeScheduler()
  → void

// Stop scheduler gracefully
stopScheduler()
  → void

// Get scheduler status
getSchedulerStatus()
  → Object
```

**Scheduled Jobs:**
- `* * * * *` (Every 1 minute): Check for pending reminders
- `0 2 * * *` (Daily at 2 AM): Delete old reminders

## API Endpoints

### GET `/api/reminders/today`

Get today's reminders for a specific baby.

**Query Parameters:**
```
babyId: string (required)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reminders": [
      {
        "id": "rem_123",
        "medicine_name": "Amoxicillin",
        "dosage": "250mg",
        "frequency": "Every 6 hours",
        "dose_time": "08:00",
        "scheduled_for": "2026-01-09T08:00:00.000Z",
        "status": "pending",
        "channels": ["web", "whatsapp"],
        "attempt_count": 0
      }
    ],
    "summary": {
      "total": 4,
      "pending": 2,
      "sent": 1,
      "dismissed": 1,
      "failed": 0
    }
  }
}
```

### GET `/api/reminders/all`

Get all reminders for the parent with optional filters.

**Query Parameters:**
```
status: "pending" | "sent" | "dismissed" | "failed" (optional)
startDate: ISO string (optional)
endDate: ISO string (optional)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reminders": [...],
    "count": 10
  }
}
```

### POST `/api/reminders/:reminderId/dismiss`

Mark a reminder as dismissed (medicine already given).

**Response:**
```json
{
  "success": true,
  "message": "Reminder dismissed"
}
```

### GET `/api/reminders/:reminderId`

Get details of a specific reminder.

**Response:**
```json
{
  "success": true,
  "data": {
    "reminder": {...}
  }
}
```

## Prescription Confirmation Flow

When a parent confirms a prescription, reminders are automatically generated:

```javascript
// POST /api/prescriptions/:prescriptionId/confirm
{
  "medicines": [
    {
      "medicine_name": "Amoxicillin",
      "dosage": "250mg",
      "frequency": "Every 6 hours",
      "times_per_day": 4,
      "dose_schedule": ["08:00", "14:00", "20:00", "02:00"]
    }
  ]
}

// After confirmation:
// 1. Prescription status → "confirmed"
// 2. For each medicine:
//    - For each dose_time:
//      - Create reminder for today at that time (if future)
//      - Create reminder for tomorrow at that time
// 3. Example: 4 doses/day = 8 reminders (4 today if future, 4 tomorrow)
```

## Notification Examples

### FCM Web Notification
```
Title: 💊 Medicine Reminder
Body: Time to give Amoxicillin (250mg)
```

Display in browser notification and web dashboard.

### WhatsApp Message
```
👶 *BabyCare Reminder*

It's time to give *Amoxicillin* (250mg).

Frequency: Every 6 hours

You're doing great! ❤️

_BabyCare - Your Baby's Health, Our Priority_
```

## Frontend Integration

### 1. Import RemindersSection Component

```tsx
import RemindersSection from '@/components/dashboard/RemindersSection';

// In Dashboard:
<RemindersSection babyId={selectedBaby.id} babyName={selectedBaby.name} />
```

### 2. Display Bell Icon with Badge

```tsx
import { Bell } from 'lucide-react';

// Show number of pending reminders
const pendingCount = reminders.filter(r => r.status === 'pending').length;

<div className="relative">
  <Bell className="w-6 h-6" />
  {pendingCount > 0 && (
    <Badge className="absolute -top-2 -right-2">{pendingCount}</Badge>
  )}
</div>
```

### 3. Real-time Updates

The RemindersSection component:
- Fetches reminders on mount
- Polls every 30 seconds for updates
- Refetches after user dismisses a reminder
- Shows loading/error states

### 4. API Usage in Frontend

```typescript
// Get today's reminders
const response = await fetch('/api/reminders/today?babyId=BABY_ID', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

// Mark reminder as given
const response = await fetch('/api/reminders/REM_ID/dismiss', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

## Configuration

### Environment Variables

**Backend (.env):**
```
PORT=5000
NODE_ENV=development
CLIENT_URL=http://127.0.0.1:5173

# WhatsApp (Optional)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
```

### Firebase Configuration

**Firestore Rules (optional - currently using default auth):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write reminders they own
    match /reminders/{doc=**} {
      allow read, write: if request.auth.uid == resource.data.parentId;
    }
  }
}
```

## Error Handling

### Failed Notifications

If FCM or WhatsApp fails:
1. Error is logged with details
2. Reminder status updated to "failed"
3. Error message stored in `error_message` field
4. Scheduler continues processing other reminders
5. Parent can retry or view error in dashboard

### Duplicate Prevention

- Reminders created with unique combination of:
  - babyId + parentId + medicine_name + scheduled_for
  - Multiple reminders at same time are possible (different medicines)
- Each reminder has attempt_count to track retries
- Status prevents processing same reminder twice

## Testing

### Manual Testing

1. **Create Prescription:**
   - Go to Dashboard → Prescriptions
   - Scan prescription image
   - Enter medicine details

2. **Confirm Prescription:**
   - Click "Confirm" on prescription
   - Reminders generated automatically

3. **Check Reminders:**
   - Go to Dashboard → Medicine Reminders
   - Should see today's reminders
   - Status should be "pending"

4. **Wait for Scheduler:**
   - Scheduler runs every 1 minute
   - When scheduled_for time passes, reminder will be sent
   - Status will change to "sent"
   - Check browser notifications (FCM)
   - Check WhatsApp messages (if configured)

5. **Dismiss Reminder:**
   - Click "Mark Given ✓" button
   - Status changes to "dismissed"
   - Summary updates

### Testing Notifications

```bash
# Test FCM notification (manual test)
curl -X POST http://127.0.0.1:5000/api/reminders/test-fcm \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"parentId": "USER_ID"}'

# Test WhatsApp (if configured)
curl -X POST http://127.0.0.1:5000/api/reminders/test-whatsapp \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210"}'
```

## Monitoring

### Check Scheduler Status

The scheduler logs on startup:
```
✅ [Scheduler] Background scheduler initialized
   - Reminder checker: every 1 minute
   - Cleanup job: daily at 2:00 AM
```

### View Logs

The system logs:
- `✅ [Reminders] Created reminder...` - New reminder creation
- `📋 [Reminders] Found X pending reminders` - Pending check
- `✅ [FCM] Reminder notification sent` - FCM success
- `✅ [WhatsApp] Reminder notification sent` - WhatsApp success
- `❌ [Reminders] Error...` - Errors

Example:
```
⏰ [Scheduler] Checking for pending reminders...
📋 [Reminders] Found 2 pending reminders
✅ [FCM] Reminder notification sent: messageId123
✅ [WhatsApp] Reminder notification sent: msgId456
✅ [Scheduler] Summary - Total: 2, Sent: 2, Failed: 0
```

## Cleanup Policy

- Old reminders (older than 7 days) automatically deleted
- Only deletes reminders with status: sent, dismissed, failed
- Runs daily at 2 AM via cron job
- Prevents database bloat

## Important Notes

### Safety
- ⚠️ **No medical advice given** - Reminders are assistive only
- Messages emphasize parental responsibility
- System doesn't skip doses or modify schedules
- Parent always in control (can dismiss/ignore reminders)

### Reliability
- ✅ Graceful error handling - one channel failure doesn't block others
- ✅ Duplicate prevention - idempotent operations
- ✅ Status tracking - can see exactly what happened to each reminder
- ✅ Retry logic - multiple send attempts logged

### Privacy
- ✅ Data encrypted in transit (HTTPS in production)
- ✅ Only parents see their own reminders
- ✅ Firebase Auth secures access
- ✅ No message forwarding without consent

## Future Enhancements

1. **Smart Scheduling:**
   - Adjust reminder times based on parent's sleep schedule
   - Quiet hours (no notifications 10 PM - 7 AM)
   - Custom notification preferences

2. **Advanced Features:**
   - Snooze reminder (remind in 5/10/15 minutes)
   - Skip dose (mark as skipped instead of given)
   - Edit medicine schedule mid-course

3. **Analytics:**
   - Track adherence rate
   - View history of given doses
   - Generate compliance reports

4. **Multi-user Support:**
   - Shared care (grandparents, caregivers)
   - Role-based permissions
   - Notification routing

5. **Integrations:**
   - SMS notifications
   - Calendar sync
   - Medication history export

---

**Implementation Status:** ✅ Complete and Production Ready
**Last Updated:** January 2026
