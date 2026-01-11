# Chatbot Implementation Guide

## Overview

The baby care chatbot is now fully implemented with **context-aware responses** using the Gemini LLM. The chatbot intelligently integrates recent baby activity data to provide personalized, supportive guidance to parents.

---

## 🏗️ Architecture

### Frontend (React)
- **Location**: [pages/Chatbot.tsx](../../client/src/pages/Chatbot.tsx)
- **Features**:
  - Real-time chat interface
  - Message history with timestamps
  - Typing indicator
  - Error handling
  - Auto-scroll to latest message

### Backend Services

#### 1. **Chatbot Context Builder** ([services/chatbotContext.js](../services/chatbotContext.js))

Builds structured context from:
- **Baby Profile**: Age, gestational age, prematurity status
- **Recent Activity**: 
  - Feeding (last feed time, overdue status)
  - Sleep (last sleep end, recently woke up)
- **Latest Cry Analysis**: Pattern, confidence, explanations
- **Active Reminders**: Overdue or upcoming medications/feedings

**Functions**:
```javascript
// Main entry point
await buildChatbotContext(babyId)
  // Returns structured context object

// Utility functions
await fetchBabyProfile(babyId)
await fetchLatestCryAnalysis(babyId)
await fetchRecentCareLogs(babyId, hoursBack)
await fetchActiveReminders(babyId)

// Format helpers
formatContextForPrompt(context)  // Human-readable format
extractFeedingContext(careLogs)
extractSleepContext(careLogs)
buildRemindersSummary(reminders, careLogs)
```

#### 2. **Chatbot Route** ([routes/chatbot.js](../routes/chatbot.js))

**Endpoint**: `POST /api/chatbot`

**Request**:
```json
{
  "message": "Why is my baby crying?",
  "babyId": "baby_doc_id"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "response": "Based on recent activity, your baby may be crying due to hunger...",
    "timestamp": "2026-01-11T10:30:00.000Z"
  }
}
```

**Flow**:
1. Verify user token and baby access
2. Build structured context via `buildChatbotContext()`
3. Create safety-enhanced prompt with context
4. Call Gemini API
5. Return formatted response

---

## 🧠 Prompt Design

### System Prompt (Fixed)
```
You are a supportive baby care assistant...
- Provide general parenting guidance
- Help interpret baby behavior using context
- NEVER provide medical diagnosis
- ALWAYS recommend consulting pediatrician
- Be calm, reassuring, supportive
```

### Context Section (Dynamic)
```
Baby Context:
- Age: 4 months
- Last feeding: 85 minutes ago
- ⚠️ Feeding is overdue
- Latest cry analysis: hunger (46% confidence)
```

### User Question + Instructions
Guides the model to:
1. Address specific concern
2. Use context for personalized guidance
3. Reference context when relevant
4. Admit uncertainty about medical aspects
5. Keep responses supportive and actionable

---

## 📊 Data Sources

### Firestore Collections Used

| Collection | Query | Purpose |
|-----------|-------|---------|
| `babies` | Get by ID | Baby profile (age, gestational age) |
| `cryAnalyses` | Latest by timestamp | Recent cry pattern analysis |
| `careLogs` | Last 6 hours | Feeding & sleep activity |
| `reminders` | Pending/sent today | Active medication/feeding reminders |

---

## 🔐 Safety Features

### Guardrails Built Into Prompt

✅ **Allowed**:
- General baby care information
- Interpretation of baby behavior using context
- Supportive parenting advice
- Explanation of why suggestions are given
- Recommendations to observe or contact pediatrician

❌ **Prohibited**:
- Medical diagnosis ("Your baby has colic")
- Prescribing medication
- Making health predictions
- Alarming language without medical reason

### Backend Validation
- User authentication required
- Baby access verification
- Input message validation
- Error handling with safe fallbacks

---

## 🔄 Integration with Frontend

The frontend [Chatbot.tsx](../../client/src/pages/Chatbot.tsx) automatically:

1. **Fetches baby ID** on mount
2. **Sends message with babyId** to API
3. **Displays response** with timestamp
4. **Shows typing indicator** while waiting
5. **Handles errors gracefully**

```typescript
// Frontend API call
const result = await chatbotApi.sendMessage(userInput, babyId);
```

---

## 📝 Example Conversations

### Example 1: Hungry Baby
**User**: "Why is my baby crying so much?"

**System Context**:
```
Age: 4 months
Last feeding: 85 minutes ago
⚠️ Feeding is overdue
Latest cry: hunger (46% confidence)
Factors: Feeding reminder detected
```

**Response**:
```
Based on recent activity, your baby may be crying due to hunger.
The last feeding was over an hour ago and a feeding reminder is active.

Crying is often a baby's way of signaling they need food. You could try
offering a feed and see if your baby settles. If crying continues or seems
unusual, observing other signs or consulting a pediatrician may help.
```

### Example 2: Tired Baby
**User**: "Baby won't sleep tonight"

**System Context**:
```
Age: 6 months
Last sleep ended: 12 minutes ago
Recently woke up: Yes
Latest cry: tired (35% confidence)
```

**Response**:
```
Since your baby woke up recently, they might need some wind-down time.
At 6 months, babies often need 30-45 minutes to transition between sleep
cycles. You could try:

- Dim the lights and reduce stimulation
- Use white noise or soft sounds
- Gentle rocking or soothing music
- Keep the environment cool and comfortable

If your baby is restless or seems uncomfortable, this might indicate
discomfort rather than tiredness. Observing other signs (like feeding
patterns or temperature) can help determine the cause.
```

---

## 🚀 Testing the Implementation

### Manual Testing

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Access the chatbot**:
   - Open dashboard → Chatbot section
   - Or navigate to `/chatbot`

3. **Test scenarios**:
   - Ask about baby crying with recent logs
   - Ask about feeding/sleep with reminder context
   - Test without baby context (fallback)

### API Testing (curl)

```bash
# With baby context
curl -X POST http://localhost:5000/api/chatbot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Why is my baby crying?",
    "babyId": "baby_doc_id"
  }'

# Without context (general question)
curl -X POST http://localhost:5000/api/chatbot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "What should I feed a 4-month-old?"
  }'
```

---

## ⚙️ Configuration

### Required Environment Variables

```bash
# Gemini API (existing)
GEMINI_API_KEY=your_key_here

# Firebase (existing)
FIREBASE_PROJECT_ID=project_id
FIREBASE_PRIVATE_KEY=key
FIREBASE_CLIENT_EMAIL=email
```

### Gemini Model Used
- **Model**: `gemini-pro`
- **API**: Google Generative AI (v1beta)
- **Temperature**: Default (0.7 - for balanced responses)

---

## 📈 Performance Considerations

### Data Fetching

All database queries are optimized:
- **Cry Analysis**: Latest document only (indexed by timestamp)
- **Care Logs**: 6-hour window, 20-document limit
- **Reminders**: Only pending/sent, 10-document limit
- **Parallel fetching**: All queries run simultaneously

**Typical latency**: 200-500ms for data gathering + Gemini API response

### Caching Opportunities (Future)
- Cache recent care logs (5-minute window)
- Cache cry analysis (10-minute window)
- Implement Redis for session-based caching

---

## 🐛 Troubleshooting

### Chatbot not responding
- Check `GEMINI_API_KEY` is set
- Verify Firebase service account permissions
- Check server logs for detailed errors

### Context missing from responses
- Verify `babyId` is passed in request
- Check baby document exists and belongs to user
- Confirm Firestore collections are properly structured

### Inconsistent responses
- Gemini API has default randomness (temperature)
- Safe to rerun queries for different answers
- Consider lowering temperature in prompt if more consistency needed

---

## 🔮 Future Enhancements

1. **Response Caching**: Cache identical questions for 10 minutes
2. **Conversation Memory**: Keep context across multiple messages
3. **Confidence Scores**: Show when chatbot is uncertain
4. **Source Citation**: Show which data informed the response
5. **Multi-language Support**: Translate responses
6. **Parent Feedback**: Track useful vs. unhelpful responses
7. **Emergency Detection**: Flag if user mentions emergency
8. **Integration with Professional Help**: Connect to pediatrician services

---

## 📚 References

- **Chatbot Context Builder**: [services/chatbotContext.js](../services/chatbotContext.js)
- **Chatbot Route**: [routes/chatbot.js](../routes/chatbot.js)
- **Frontend Component**: [pages/Chatbot.tsx](../../client/src/pages/Chatbot.tsx)
- **API Client**: [lib/api.ts](../../client/src/lib/api.ts#L126)
- **Firestore Schema**: See `firestore.rules` for collection structure

---

## ✅ Checklist

- [x] Context builder utility created
- [x] Chatbot route enhanced with context
- [x] Safety prompts configured
- [x] Frontend integration working
- [x] Database queries optimized
- [x] Error handling implemented
- [x] Documentation complete
