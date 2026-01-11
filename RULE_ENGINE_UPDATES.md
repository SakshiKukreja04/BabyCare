# Rule Engine Updates Summary

## Changes Made

### 1. ✅ Fixed 24-Hour Rule Engine Logic with `getTodayTimeRange()`

**File:** `server/services/ruleEngine.js`

Added utility functions:
```javascript
function getTodayTimeRange() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

function getHoursAgoRange(hours) {
  const now = new Date();
  const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return { startTime, endTime: now };
}
```

Updated rules now use midnight-to-midnight daily windows instead of rolling 24-hour windows:
- `LOW_DAILY_FEEDING_TOTAL` - Uses `getTodayTimeRange()` for today's feeding totals
- `LOW_SLEEP_DURATION` - Uses `getTodayTimeRange()` for today's sleep totals

---

### 2. ✅ Real-Time Alerts & Immediate Evaluation

**Files:** `server/services/ruleEngine.js`, `server/routes/careLogs.js`

Alerts now trigger FCM notifications immediately when created:
- `createAlert()` function now sends FCM push notifications automatically
- New alerts are marked with `isNew: true` to distinguish from updated alerts
- WhatsApp notifications only sent for NEW alerts (not updates)

---

### 3. ✅ Fixed "All Good" Logic with `evaluateBabyStatus()`

**File:** `server/services/ruleEngine.js`

Added new function for dashboard status:
```javascript
async function evaluateBabyStatus(babyId, parentId) {
  // Returns:
  // {
  //   isAllGood: boolean,
  //   reasons: string[],
  //   activeAlerts: Array,
  //   alertCount: number,
  //   overallSeverity: 'none' | 'low' | 'medium' | 'high',
  //   summary: string
  // }
}
```

Logic:
- `isAllGood = true` when there are ZERO unresolved alerts
- Returns reasons array with messages from each active alert
- Calculates overall severity based on highest severity alert

---

### 4. ✅ FCM Notifications on Alert Creation

**File:** `server/services/ruleEngine.js`

The `createAlert()` function now:
1. Creates or updates alert in Firestore
2. Automatically sends FCM push notification via `sendAlertNotification()`
3. Logs success/failure but doesn't fail if notification fails

---

### 5. ✅ Updated API Response Format

**File:** `server/routes/careLogs.js`

POST `/care-logs` now returns:
```json
{
  "success": true,
  "data": {
    "careLog": { ... },
    "alertsCreated": 1,
    "alertsUpdated": 0,
    "summaryStatus": {
      "isAllGood": false,
      "alertCount": 2,
      "overallSeverity": "medium",
      "summary": "There are 2 active alerts requiring attention",
      "reasons": [
        "Last feeding was 4.5 hours ago...",
        "Total feeding today is 120ml..."
      ]
    }
  }
}
```

---

### 6. ✅ New Status Endpoint

**File:** `server/routes/babies.js`

Added new endpoint:
```
GET /babies/:babyId/status
```

Returns current baby status for dashboard summary card:
```json
{
  "success": true,
  "data": {
    "babyId": "...",
    "babyName": "Baby Name",
    "isAllGood": true,
    "alertCount": 0,
    "overallSeverity": "none",
    "summary": "All Good",
    "reasons": [],
    "activeAlerts": []
  }
}
```

---

## Testing Instructions

### Test 1: Daily Window (Midnight-to-Midnight)
1. Create a feeding log with low quantity (e.g., 30ml)
2. Check that `LOW_DAILY_FEEDING_TOTAL` alert only counts today's logs
3. Verify alert message says "today" instead of "last 24 hours"

### Test 2: Real-Time Alerts
1. Create a care log that triggers a rule (e.g., wait > 4 hours then log feeding)
2. Verify FCM push notification is received immediately
3. Check that alert appears in `/alerts` endpoint

### Test 3: All Good Status
1. Call `GET /babies/:babyId/status` when no alerts exist
2. Verify `isAllGood: true` and `summary: "All Good"`
3. Create an alert-triggering log
4. Verify `isAllGood: false` with proper reasons

### Test 4: API Response
1. POST a care log
2. Verify response includes `summaryStatus` object
3. Verify `alertsCreated` and `alertsUpdated` counts are correct

---

## Exported Functions

From `server/services/ruleEngine.js`:
- `evaluateAllRules(babyId, parentId)` - Evaluate all rules, return alerts
- `evaluateBabyStatus(babyId, parentId)` - Get current status for dashboard
- `getTodayTimeRange()` - Get midnight-to-midnight time range
- `getHoursAgoRange(hours)` - Get time range for X hours ago
- `createAlert(alertData)` - Create alert with FCM notification
- `getBabyProfile(babyId)` - Get baby with premature classification
- `getBabyWithType(babyId)` - Alias for getBabyProfile
