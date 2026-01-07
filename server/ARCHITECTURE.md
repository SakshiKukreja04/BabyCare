# Backend Architecture

## Overview

The BabyCare backend is a Node.js + Express server that provides secure API endpoints for the React frontend. It uses Firebase Admin SDK for server-side authentication and database operations.

## Key Principles

1. **Security First**: All endpoints require Firebase ID token authentication
2. **Deterministic Rules**: Rule engine uses static, explainable rules (NOT AI-driven)
3. **AI for Explanation Only**: Gemini API is used ONLY for explaining alerts, NOT for decision-making
4. **No Medical Advice**: All AI responses explicitly avoid medical diagnosis or advice

## Request Flow

```
Frontend Request
  ↓
Authorization Header (Firebase ID Token)
  ↓
Auth Middleware (verifyToken)
  ↓
Route Handler
  ↓
Service Layer (ruleEngine, gemini, notifications)
  ↓
Firestore Database
  ↓
Response
```

## Rule Engine Flow

```
Care Log Created (type: feeding)
  ↓
Rule Engine Evaluates Rules
  ├─ FEEDING_DELAY (> 4 hours)
  ├─ FREQUENT_FEEDING (< 1 hour)
  └─ LOW_FEED_QUANTITY (< 30ml)
  ↓
If Rule Violated:
  ├─ Create Alert in Firestore
  ├─ Send FCM Push Notification
  └─ Send WhatsApp Alert (if configured)
```

## Alert Explanation Flow

```
User Requests Alert Explanation
  ↓
Fetch Alert from Firestore
  ↓
Get Rule Details
  ↓
Call Gemini API (with safe prompt)
  ↓
Return Explanation (NO medical advice)
```

## Services

### Rule Engine (`services/ruleEngine.js`)
- **Purpose**: Evaluate deterministic rules
- **Input**: Baby ID, Parent ID
- **Output**: Array of created alerts
- **Rules**: Defined in `rules/feedingRules.js`

### Gemini Service (`services/gemini.js`)
- **Purpose**: Explain alerts in simple language
- **Constraints**: 
  - NO diagnosis
  - NO predictions
  - NO medical advice
- **Input**: Alert data with rule and trigger info
- **Output**: Plain text explanation

### FCM Service (`services/fcm.js`)
- **Purpose**: Send push notifications
- **Requires**: User's FCM token in Firestore
- **Method**: Firebase Admin SDK messaging

### WhatsApp Service (`services/whatsapp.js`)
- **Purpose**: Send text alerts via WhatsApp
- **Requires**: WhatsApp Business API credentials
- **Optional**: Only sends if configured

## Security

### Authentication
- All routes (except `/health`) require Firebase ID token
- Token verified using Firebase Admin SDK
- User ID extracted from token and attached to `req.user`

### Authorization
- Baby ownership verified before any operation
- Parent ID must match `baby.parentId`
- Alerts can only be accessed by the parent who owns the baby

### Data Validation
- Input validation on all endpoints
- Type checking for care log types
- Required field validation

## Database Schema

### Collections

#### `careLogs`
```javascript
{
  id: string,
  parentId: string,
  babyId: string,
  type: 'feeding' | 'sleep' | 'medication',
  quantity?: number,        // for feeding
  duration?: number,        // for sleep (minutes)
  medicationGiven?: boolean, // for medication
  notes?: string,
  timestamp: Timestamp
}
```

#### `alerts`
```javascript
{
  id: string,
  babyId: string,
  parentId: string,
  ruleId: string,
  severity: 'low' | 'medium' | 'high',
  title: string,
  description: string,
  triggerData: object,      // Data that triggered the rule
  resolved: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `babies`
```javascript
{
  id: string,
  parentId: string,
  name: string,
  dob: string,
  gestationalAge: number,
  currentWeight: number
}
```

#### `users`
```javascript
{
  id: string (uid),
  name: string,
  email: string,
  fcmToken?: string,        // for push notifications
  phoneNumber?: string,     // for WhatsApp (with country code)
  createdAt: Timestamp
}
```

## API Endpoints

### Care Logs
- `POST /api/care-logs` - Create care log, triggers rule evaluation
- `GET /api/care-logs?babyId=<id>` - Get care logs for baby

### Alerts
- `GET /api/alerts?babyId=<id>` - Get alerts for baby
- `GET /api/alerts/:alertId/explanation` - Get AI explanation
- `PATCH /api/alerts/:alertId/resolve` - Mark alert as resolved

### Chatbot
- `POST /api/chatbot` - General guidance (NOT medical advice)

## Error Handling

- All errors are caught and return appropriate HTTP status codes
- Error messages are user-friendly but don't expose internal details
- Logging for debugging (errors logged to console)

## Environment Variables

Required:
- `GEMINI_API_KEY` - For alert explanations

Optional:
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `CLIENT_URL` - CORS origin
- `WHATSAPP_API_URL` - WhatsApp API endpoint
- `WHATSAPP_PHONE_NUMBER_ID` - WhatsApp phone number ID
- `WHATSAPP_ACCESS_TOKEN` - WhatsApp access token

## Deployment Considerations

1. **Service Account Key**: Must be securely stored (not in git)
2. **Environment Variables**: Set on hosting platform
3. **Firestore Indexes**: Create composite indexes for queries
4. **CORS**: Configure allowed origins for production
5. **Rate Limiting**: Consider adding rate limiting for production
6. **Monitoring**: Add logging/monitoring service

