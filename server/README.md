# BabyCare Backend Server

Node.js + Express backend for BabyCare application.

## Architecture

```
Frontend (React + Firebase Auth)
  |
  | Firebase ID Token (Authorization Header)
  ↓
Backend (Node.js + Express)
  |
  | Firebase Admin SDK (trusted server identity)
  ↓
Firestore (Database)
  |
  | Alerts written
  ↓
Notifications
  ├─ Firebase Cloud Messaging (push)
  └─ WhatsApp Business API (text alerts)
```

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Firebase Admin SDK Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Save the JSON file as `server/serviceAccountKey.json`

**⚠️ IMPORTANT:** Never commit `serviceAccountKey.json` to version control!

### 3. Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Gemini API (for explanations)
GEMINI_API_KEY=your_gemini_api_key_here

# WhatsApp Business API (optional)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
```

### 4. Run Server

```bash
npm start
```

Server will run on `http://localhost:5000`

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Care Logs
- `POST /api/care-logs` - Create a new care log
- `GET /api/care-logs?babyId=<id>` - Get care logs for a baby

### Alerts
- `GET /api/alerts?babyId=<id>` - Get alerts for a baby
- `GET /api/alerts/:alertId/explanation` - Get AI explanation for an alert
- `PATCH /api/alerts/:alertId/resolve` - Mark alert as resolved

### Chatbot
- `POST /api/chatbot` - Chat with AI assistant (general guidance only)

## Authentication

All endpoints (except `/health`) require Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase_id_token>
```

The token is verified using Firebase Admin SDK.

## Rule Engine

The rule engine evaluates deterministic, static rules:

- **FEEDING_DELAY**: Alert if baby hasn't been fed for > 4 hours
- **FREQUENT_FEEDING**: Alert if feedings are < 1 hour apart
- **LOW_FEED_QUANTITY**: Alert if feed quantity < 30ml

Rules are evaluated automatically when a feeding log is created.

## Services

### Gemini Service
- **Purpose**: Explain alerts (NOT for diagnosis or medical advice)
- **Constraints**: No medical diagnosis, no predictions, no medical advice

### FCM Service
- Sends push notifications to user devices
- Requires `fcmToken` stored in user document

### WhatsApp Service
- Sends text alerts via WhatsApp Business API
- Requires phone number stored in user document
- Optional feature

## Project Structure

```
server/
├── index.js              # Main server entry point
├── firebaseAdmin.js      # Firebase Admin SDK initialization
├── middleware/
│   └── auth.js          # Firebase token verification
├── routes/
│   ├── careLogs.js      # Care log endpoints
│   ├── alerts.js        # Alert endpoints
│   └── chatbot.js       # Chatbot endpoint
├── rules/
│   └── feedingRules.js  # Deterministic feeding rules
└── services/
    ├── ruleEngine.js    # Rule evaluation engine
    ├── gemini.js        # Gemini API service
    ├── fcm.js           # Firebase Cloud Messaging
    └── whatsapp.js      # WhatsApp Business API
```

## Security Notes

- All routes are protected by Firebase authentication
- Service account key must be kept secure
- Environment variables should not be committed
- Rules are deterministic and server-side only

## Development

```bash
# Run server
npm start

# Server runs on port 5000 by default
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure proper CORS origins
3. Ensure service account key is securely stored
4. Set up environment variables on hosting platform
5. Configure Firestore indexes for queries

