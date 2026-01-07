# Frontend-Backend Integration Guide

## Overview

The frontend has been integrated with the Node.js backend API. All care logs, alerts, and chatbot interactions now go through the backend instead of direct Firestore access.

## Environment Variables

Add the following to your `client/.env` file:

```env
VITE_API_URL=http://localhost:5000
```

For production, update this to your backend server URL.

## API Client

The API client (`client/src/lib/api.ts`) handles all backend communication:

- **Authentication**: Automatically includes Firebase ID token in Authorization header
- **Error Handling**: Provides user-friendly error messages
- **Type Safety**: TypeScript interfaces for all API responses

## Updated Components

### 1. DailyLog (`client/src/pages/DailyLog.tsx`)
- Now uses `careLogsApi.create()` instead of direct Firestore
- Shows alert count when alerts are generated
- Handles backend errors gracefully

### 2. Dashboard (`client/src/pages/Dashboard.tsx`)
- Fetches alerts from backend using `getAlertsByBaby()`
- Displays real alerts from the rule engine
- Alerts are automatically filtered to show only unresolved ones

### 3. Chatbot (`client/src/pages/Chatbot.tsx`)
- Now uses `chatbotApi.sendMessage()` to communicate with backend
- Backend handles Gemini API integration
- Includes baby context when available

### 4. RuleExplanationModal (`client/src/components/dashboard/RuleExplanationModal.tsx`)
- Fetches AI explanations from backend using `alertsApi.getExplanation()`
- Shows loading state while fetching explanation
- Falls back to default explanation if API fails

## API Endpoints Used

### Care Logs
- `POST /api/care-logs` - Create care log (triggers rule evaluation)
- `GET /api/care-logs?babyId=<id>` - Get care logs

### Alerts
- `GET /api/alerts?babyId=<id>` - Get alerts for baby
- `GET /api/alerts/:alertId/explanation` - Get AI explanation

### Chatbot
- `POST /api/chatbot` - Send message to chatbot

## Backward Compatibility

The `firestore.ts` file still exports the same functions (`addCareLog`, `getCareLogsByBaby`, `getAlertsByBaby`) but they now call the backend API internally. This ensures existing code continues to work without changes.

## Testing the Integration

1. **Start the backend server:**
   ```bash
   cd server
   npm start
   ```

2. **Start the frontend:**
   ```bash
   cd client
   npm run dev
   ```

3. **Test care log creation:**
   - Go to Daily Log page
   - Create a feeding log
   - Check Dashboard for alerts (if rule violated)

4. **Test alerts:**
   - Create a feeding log with quantity < 30ml
   - Or wait > 4 hours between feeds
   - Check Dashboard for generated alerts

5. **Test chatbot:**
   - Go to Chatbot page
   - Ask a question about baby care
   - Verify response from backend/Gemini

## Error Handling

All API calls include error handling:
- Network errors show user-friendly messages
- Authentication errors redirect to login
- Backend errors display appropriate error messages

## Next Steps

1. Update `VITE_API_URL` in production environment
2. Configure CORS on backend for production domain
3. Set up monitoring for API health
4. Add retry logic for failed requests (optional)

