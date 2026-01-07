# Quick Setup Guide

## Step 1: Install Dependencies

```bash
cd server  
npm install
```

## Step 2: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon → Project Settings
4. Go to "Service Accounts" tab
5. Click "Generate New Private Key"
6. Save the downloaded JSON file as `server/serviceAccountKey.json`

## Step 3: Create .env File

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` and add:
- `GEMINI_API_KEY` (get from [Google AI Studio](https://makersuite.google.com/app/apikey))
- Optional: WhatsApp credentials if using WhatsApp notifications

## Step 4: Run Server

```bash
npm start
```

Server will start on `http://localhost:5000`

## Testing

Test the health endpoint:

```bash
curl http://localhost:5000/health
```

## Frontend Integration

Update your frontend to send requests with Firebase ID token:

```javascript
const token = await user.getIdToken();
fetch('http://localhost:5000/api/care-logs', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    babyId: '...',
    type: 'feeding',
    quantity: 100,
  }),
});
```

