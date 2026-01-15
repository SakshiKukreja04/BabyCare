# 👶 BabyCare

A comprehensive baby health tracking and parenting support application designed for new parents, with special focus on premature baby care.

![BabyCare](client/public/baby_home.png)

## 🌟 Features

### Core Functionality
- **Baby Profile Management** - Track baby details including gestational age, with special handling for premature babies (corrected age calculations)
- **Care Logging** - Record feeding, sleep, and medication events with timestamps
- **Prescription Management** - OCR-based prescription scanning with medication reminders
- **Cry Analysis** - AI-powered baby cry classification to help identify needs
- **Nutrition Tracking** - Both baby feeding logs and mother self-care/nutrition tracking
- **Alert System** - Rule-based alerts for feeding gaps, sleep patterns, and health concerns
- **AI Chatbot** - Gemini-powered parenting assistant with baby context awareness
- **Push Notifications** - FCM (Firebase Cloud Messaging) and WhatsApp integration for reminders

### Key Differentiators
- 🍼 Dual-timeline tracking for premature babies (actual vs corrected age)
- 🎯 Context-aware cry analysis that considers recent feeding/sleep data
- ⚡ Rule engine for proactive health alerts
- 📱 Multi-channel notifications (browser push + WhatsApp)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BabyCare                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────┐              ┌──────────────────────┐         │
│  │     React Client     │◄────────────►│    Express Server    │         │
│  │   (Vite + TypeScript)│   REST API   │     (Node.js)        │         │
│  └──────────┬───────────┘              └──────────┬───────────┘         │
│             │                                      │                     │
│             │                                      │                     │
│  ┌──────────▼───────────┐              ┌──────────▼───────────┐         │
│  │   Firebase Auth      │              │   Firebase Admin     │         │
│  │   (Client SDK)       │              │   (Server SDK)       │         │
│  └──────────┬───────────┘              └──────────┬───────────┘         │
│             │                                      │                     │
│             └──────────────────┬───────────────────┘                     │
│                                │                                         │
│                     ┌──────────▼───────────┐                            │
│                     │   Cloud Firestore    │                            │
│                     │   (Database)         │                            │
│                     └──────────────────────┘                            │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    External Services                             │    │
│  ├─────────────────┬─────────────────┬─────────────────────────────┤    │
│  │  Google Gemma  │  Firebase FCM   │  Twilio (WhatsApp/SMS)      │    │
│  │  (AI Chatbot)   │  (Push Notifs)  │  (Notifications)            │    │
│  └─────────────────┴─────────────────┴─────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
BabyCare/
├── client/                    # React Frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── auth/          # Authentication components
│   │   │   ├── dashboard/     # Dashboard widgets
│   │   │   ├── home/          # Landing page sections
│   │   │   ├── prescription/  # Prescription management
│   │   │   └── ui/            # shadcn/ui components
│   │   ├── contexts/          # React contexts (Auth, Language)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities and API clients
│   │   ├── pages/             # Page components
│   │   └── services/          # FCM and reminder services
│   └── public/                # Static assets
│
├── server/                    # Express Backend (Node.js)
│   ├── routes/                # API route handlers
│   │   ├── alerts.js          # Alert management
│   │   ├── babies.js          # Baby profile CRUD
│   │   ├── careLogs.js        # Care log management
│   │   ├── chatbot.js         # AI chatbot endpoint
│   │   ├── cryAnalysis.js     # Cry analysis API
│   │   ├── export.js          # Data export
│   │   ├── notifications.js   # Push notification management
│   │   ├── nutrition.js       # Nutrition tracking
│   │   ├── prescriptions.js   # Prescription OCR & management
│   │   ├── reminders.js       # Reminder scheduling
│   │   └── weight.js          # Weight tracking
│   ├── services/              # Business logic services
│   │   ├── backgroundScheduler.js  # Cron job scheduler
│   │   ├── chatbotContext.js       # AI context builder
│   │   ├── fcm.js                  # Firebase Cloud Messaging
│   │   ├── gemini.js               # Google Gemini AI
│   │   ├── ruleEngine.js           # Alert rule engine
│   │   └── whatsapp.js             # WhatsApp integration
│   ├── rules/                 # Rule definitions
│   │   └── feedingRules.js    # Feeding/sleep/weight rules
│   └── utils/                 # Utility functions
│
└── docs/                      # Documentation files
```

---

## 🔄 Data Flow

### Care Log Flow
```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    participant DB as Firestore
    participant RE as Rule Engine
    participant FCM as Push Notifications

    U->>C: Log feeding/sleep event
    C->>S: POST /api/care-logs
    S->>DB: Save care log
    S->>RE: Evaluate rules
    RE->>DB: Check thresholds
    alt Rule violated
        RE->>DB: Create alert
        RE->>FCM: Send notification (HIGH severity)
    end
    S->>C: Return response
    C->>U: Show confirmation
```

### AI Chatbot Flow
```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    participant DB as Firestore
    participant AI as Gemini AI

    U->>C: Ask question
    C->>S: POST /api/chatbot
    S->>DB: Fetch baby context
    Note over S,DB: Baby profile, recent logs,<br/>cry analysis, reminders
    S->>S: Build context prompt
    S->>AI: Send prompt + context
    AI->>S: Generate response
    S->>C: Return AI response
    C->>U: Display answer
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or bun
- Firebase project with Firestore enabled
- Google Cloud project with Gemini API enabled

### Environment Setup

#### Server (.env)
```env
PORT=5001
NODE_ENV=development
CLIENT_URL=http://127.0.0.1:5173

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Twilio (optional - for WhatsApp/SMS)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

#### Client (.env)
```env
VITE_API_URL=http://127.0.0.1:5001

# Firebase Client SDK
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_VAPID_KEY=your-vapid-key
```

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd BabyCare

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Running the Application

#### Development Mode
```bash
# Terminal 1 - Start server
cd server
npm run dev

# Terminal 2 - Start client
cd client
npm run dev
```

#### Windows Quick Start
```powershell
# Use the provided batch script
.\START_DEV.bat
# Or PowerShell script
.\START_DEV.ps1
```

The application will be available at:
- Client: http://127.0.0.1:5173
- Server: http://127.0.0.1:5001
- Health Check: http://127.0.0.1:5001/health

---

## 📡 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| POST | `/api/care-logs` | Create care log (feeding/sleep/medication) |
| GET | `/api/care-logs/:babyId` | Get care logs for baby |
| POST | `/api/chatbot` | Send message to AI chatbot |
| GET | `/api/alerts/:babyId` | Get active alerts |
| POST | `/api/cry-analysis` | Analyze baby cry audio |
| GET | `/api/babies/:parentId` | Get babies for parent |
| POST | `/api/prescriptions/scan` | OCR scan prescription |
| GET | `/api/reminders/:babyId` | Get active reminders |
| POST | `/api/notifications/register` | Register FCM token |

### Authentication
All API endpoints (except `/health`) require Firebase JWT authentication via the `Authorization: Bearer <token>` header.

---

## ⚙️ Rule Engine

The rule engine evaluates deterministic rules based on care logs and creates alerts when thresholds are exceeded.

### Feeding Rules
| Rule | Threshold | Severity |
|------|-----------|----------|
| Feeding Delay (Full-term) | > 4 hours | HIGH |
| Feeding Delay (Premature) | > 3 hours | HIGH |
| Low Daily Feeding | < 150ml/day | MEDIUM |
| Critical Low Feeding | < 75ml/day | HIGH |

### Sleep Rules
| Rule | Threshold | Severity |
|------|-----------|----------|
| Low Sleep Duration | < 10 hours/day | MEDIUM |

### Alert Severity & Notifications
- **HIGH** - Sends FCM push notification immediately
- **MEDIUM** - Creates alert, no push notification
- **LOW** - Informational only

---

## 🤖 AI Chatbot

The chatbot uses Google Gemini with context injection for personalized responses.

### Context Includes:
- Baby profile (age, premature status)
- Recent feeding/sleep logs (last 6 hours)
- Latest cry analysis results
- Active reminders and alerts

### Safety Rules:
- ❌ Never provides medical diagnosis
- ❌ Never prescribes medication
- ✅ Always recommends consulting pediatrician for medical concerns
- ✅ Uses context for personalized, safe guidance

---

## 🔔 Notifications

### Push Notifications (FCM)
- Browser push notifications via Firebase Cloud Messaging
- Requires user permission and FCM token registration
- Sent for HIGH severity alerts and all care reminders

### WhatsApp Integration (Optional)
- Uses Twilio WhatsApp Business API
- Configurable notification preferences per user

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **React Query** - Data fetching
- **React Router** - Navigation
- **Recharts** - Charts and analytics
- **Firebase SDK** - Auth and Firestore

### Backend
- **Node.js** - Runtime
- **Express 5** - Web framework
- **Firebase Admin SDK** - Server-side Firebase
- **Google Gemini** - AI/LLM
- **Tesseract.js** - OCR for prescriptions
- **node-cron** - Background scheduling
- **Twilio** - SMS/WhatsApp

### Infrastructure
- **Firebase** - Auth, Firestore, Cloud Messaging
- **Google Cloud** - Gemini AI API

---

## 📊 Database Schema

### Collections

#### `babies`
```javascript
{
  id: string,
  parentId: string,
  name: string,
  dateOfBirth: Timestamp,
  gestationalAge: number,  // weeks at birth
  weight: number,          // current weight in grams
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `careLogs`
```javascript
{
  id: string,
  babyId: string,
  parentId: string,
  type: "feeding" | "sleep" | "medication",
  timestamp: Timestamp,
  // Feeding specific
  quantity?: number,       // ml
  feedingType?: string,    // breast/bottle/formula
  // Sleep specific
  duration?: number,       // minutes
  // Medication specific
  medicineName?: string,
  dosage?: string
}
```

#### `alerts`
```javascript
{
  id: string,
  babyId: string,
  parentId: string,
  ruleId: string,
  type: "feeding" | "sleep",
  severity: "HIGH" | "MEDIUM" | "LOW",
  title: string,
  message: string,
  isActive: boolean,
  resolved: boolean,
  createdAt: Timestamp
}
```

---

## 🧪 Testing

```bash
# Test Gemini API connection
cd server
npm run test:gemini

# Test chatbot functionality
node test-chatbot.js

# Test nutrition service
node test-nutrition.js
```

---

## 📝 Documentation

Additional documentation is available in the repository:

- [Chatbot Architecture](./CHATBOT_ARCHITECTURE.md) - Detailed AI chatbot flow
- [Chatbot Implementation](./CHATBOT_IMPLEMENTATION.md) - Implementation details
- [Chatbot API Reference](./CHATBOT_API_REFERENCE.md) - API documentation
- [Reminder System](./REMINDER_SYSTEM_DOCUMENTATION.md) - Reminder setup guide
- [Notification Setup](./NOTIFICATION_SETUP_GUIDE.md) - FCM configuration
- [Firebase Setup](./client/FIREBASE_SETUP.md) - Firebase configuration

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License.

---

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful component library
- [Firebase](https://firebase.google.com/) for authentication and database
- [Google Gemini](https://ai.google.dev/) for AI capabilities
- [Tesseract.js](https://tesseract.projectnaptha.com/) for OCR functionality
