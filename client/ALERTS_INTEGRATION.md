# Rule-Based Alerts & Reminders Integration

## Overview

The Dashboard now displays alerts and reminders from the rule-based monitoring engine. Alerts are automatically generated when care logs are created and rules are evaluated.

## Features

### 1. **Baby Type Badge**
- Displays "👶 Premature" or "👶 Full Term" badge on the baby summary card
- Determined from `gestationalAge` (< 37 weeks = Premature)
- Color-coded: Premature (peach), Full Term (mint)

### 2. **Alerts Section**
- Shows **HIGH** and **MEDIUM** severity alerts
- Expandable cards with detailed information
- Displays `triggerData.message` for explainability
- "Why am I seeing this?" button for AI explanation
- Empty state when no alerts

### 3. **Reminders Section**
- Shows **LOW** severity alerts (gentle reminders)
- Compact display format
- Examples: Sleep duration reminders, weight tracking reminders
- Only appears when there are active reminders

## Alert Categories

### HIGH Severity
- Feeding delay alerts (> 4 hours for full-term, > 3 hours for premature)
- Critical care pattern violations

### MEDIUM Severity
- Frequent feeding alerts
- Low feed quantity alerts
- Weight tracking reminders
- Medication adherence alerts

### LOW Severity (Reminders)
- Low sleep duration reminders
- General care reminders

## Data Flow

```
Care Log Created
  ↓
Backend Rule Engine Evaluates Rules
  ↓
Alerts Created in Firestore
  ↓
Frontend Fetches Alerts via API
  ↓
Alerts Separated by Severity
  ↓
Displayed in Dashboard
```

## API Integration

### Fetching Alerts
```typescript
const alertsData = await alertsApi.getByBaby(babyId, false);
// Returns: { alerts: [...], count: number }
```

### Alert Structure
```typescript
{
  id: string;
  babyId: string;
  parentId: string;
  ruleId: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  triggerData: {
    checked: string;      // What was checked
    value: any;          // Actual value
    threshold: number;   // Threshold value
    message: string;     // Human-readable explanation
  };
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## UI Components

### Alerts Card
- Expandable details view
- Severity badge (color-coded)
- Trigger data display
- AI explanation button

### Reminders Card
- Compact list view
- Reminder badge
- Trigger data message
- AI explanation button

## Explainability

All alerts include `triggerData` that explains:
- **What was checked**: e.g., "hoursSinceLastFeed"
- **Actual value**: e.g., 5.2 hours
- **Threshold**: e.g., 4 hours
- **Message**: Human-readable explanation

Example:
```
"Last feeding was 5.2 hours ago, exceeding threshold of 4 hours."
```

## Testing

1. **Create a feeding log** → Should trigger feeding delay alert if > threshold
2. **Wait 4+ hours** → Should see feeding delay alert
3. **Create sleep log with low duration** → Should see sleep reminder
4. **Check baby type badge** → Should show Premature/Full Term based on gestational age

## Notes

- Alerts are automatically evaluated when care logs are created
- Alerts are separated by severity (HIGH/MEDIUM = Alerts, LOW = Reminders)
- Only unresolved alerts are displayed
- Baby type is fetched from backend API endpoint

