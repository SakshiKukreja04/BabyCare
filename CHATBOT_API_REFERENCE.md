# Chatbot API Reference

## POST /api/chatbot

Context-aware baby care chatbot endpoint powered by Gemini LLM.

---

## Request

### Headers
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

### Body

```json
{
  "message": "Why is my baby crying?",
  "babyId": "optional_baby_document_id"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | ✓ | The parent's question or comment |
| `babyId` | string | ✗ | Baby document ID for context. If provided, fetches recent activity, cry analysis, and reminders |

---

## Response

### Success (200)

```json
{
  "success": true,
  "data": {
    "response": "Based on recent activity, your baby may be crying due to hunger...",
    "timestamp": "2026-01-11T10:30:00.000Z"
  }
}
```

### Error (400, 403, 404, 500)

```json
{
  "error": "Bad Request|Forbidden|Not Found|Internal Server Error",
  "message": "Detailed error message"
}
```

---

## Examples

### Example 1: Question with Baby Context

**Request**:
```bash
curl -X POST http://localhost:5000/api/chatbot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "message": "My baby has been crying for 30 minutes. What should I do?",
    "babyId": "baby_a1b2c3d4"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "response": "Since your baby woke up about 30 minutes ago and the last feeding was 2 hours ago, it might be time for a feed. Crying can be their way of signaling hunger. Try offering a bottle or breastfeeding and see if your baby settles. If crying continues even after feeding, or if your baby seems uncomfortable, observe other signs like temperature or belly tension and consider contacting your pediatrician if concerned.",
    "timestamp": "2026-01-11T10:30:45.123Z"
  }
}
```

### Example 2: General Question (No Context)

**Request**:
```bash
curl -X POST http://localhost:5000/api/chatbot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "message": "How often should a 6-month-old eat?"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "response": "At 6 months, babies typically eat 4-6 times per day, whether breastfed or formula-fed. Most babies this age eat every 3-4 hours during the day. Many also start introducing solid foods around this time, though milk remains the primary nutrition. Feeding patterns can vary - some babies need more frequent meals while others go longer between feeds. Watch for hunger cues like rooting, hand-to-mouth movements, or fussiness. If you're unsure if your baby is getting enough nutrition, your pediatrician can provide personalized guidance.",
    "timestamp": "2026-01-11T10:31:20.456Z"
  }
}
```

### Example 3: Medical Concern (Safe Handling)

**Request**:
```bash
curl -X POST http://localhost:5000/api/chatbot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "message": "My baby has a fever of 101°F. What should I do?",
    "babyId": "baby_x9y8z7w6"
  }'
```

**Response** (Safety-First):
```json
{
  "success": true,
  "data": {
    "response": "A fever in a baby can be concerning. While I can't provide medical advice about your baby's fever, this is definitely something to address promptly. I recommend:\n\n1. Contact your pediatrician right away - they can properly evaluate your baby's condition\n2. In the meantime, ensure your baby is comfortable and hydrated\n3. If you can't reach your pediatrician, consider urgent care or an emergency room\n\nYour pediatrician is the best person to determine the cause of the fever and recommend appropriate treatment. Don't hesitate to seek professional medical help.",
    "timestamp": "2026-01-11T10:32:15.789Z"
  }
}
```

---

## Error Handling

### 400 Bad Request

**Cause**: Missing or invalid parameters

```json
{
  "error": "Bad Request",
  "message": "message is required and must be a string"
}
```

### 403 Forbidden

**Cause**: User doesn't have access to the specified baby

```json
{
  "error": "Forbidden",
  "message": "You do not have access to this baby"
}
```

### 404 Not Found

**Cause**: Baby document doesn't exist

```json
{
  "error": "Not Found",
  "message": "Baby not found"
}
```

### 500 Internal Server Error

**Cause**: Server-side error (missing API key, Firestore error, etc.)

```json
{
  "error": "Internal Server Error",
  "message": "Failed to process chatbot request"
}
```

---

## Context Data Included

When `babyId` is provided, the chatbot receives:

### Baby Profile
- Age in months
- Prematurity status
- Gestational age at birth

### Recent Activity (Last 6 hours)
- **Feeding**: Last feed time, minutes since last feed, if overdue
- **Sleep**: Last sleep ended, if recently woke up, if overdue

### Latest Cry Analysis
- Pattern classification (hunger, tired, discomfort, etc.)
- Confidence percentage
- Explanation of factors

### Active Reminders
- Feeding/medication reminders that are pending or due soon
- Overdue alerts

---

## Safety Guarantees

The chatbot **will NOT**:
- Diagnose medical conditions
- Prescribe medication
- Make health predictions
- Provide emergency advice without being asked

The chatbot **WILL**:
- Provide general parenting guidance
- Interpret baby behavior using recent context
- Recommend consulting a pediatrician when appropriate
- Keep language calm and reassuring

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding:
- 10 requests per minute per user
- 100 requests per hour per user

---

## Authentication

All requests require a valid JWT token in the Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

Tokens are validated via Firebase Authentication. Invalid or missing tokens will result in 401 Unauthorized (handled by `verifyToken` middleware).

---

## Response Time

Typical response times:
- **With context** (baby data + AI): 800ms - 2000ms
- **Without context** (AI only): 500ms - 1500ms

Factors affecting response time:
- Firestore query latency (50-200ms)
- Gemini API latency (300-1000ms)
- Network conditions

---

## Integration Examples

### Frontend (React)

```typescript
import { chatbotApi } from '@/lib/api';

// Send message with baby context
const response = await chatbotApi.sendMessage(
  "Why is my baby crying?",
  "baby_id_here"
);

// Display response
console.log(response.response);
console.log(response.timestamp);
```

### Backend (Node.js)

```javascript
const axios = require('axios');

const response = await axios.post(
  'http://localhost:5000/api/chatbot',
  {
    message: "Why is my baby crying?",
    babyId: "baby_id_here"
  },
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

console.log(response.data.data.response);
```

### cURL

```bash
curl -X POST http://localhost:5000/api/chatbot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message": "Why is my baby crying?",
    "babyId": "baby_id_here"
  }' \
  | jq '.data.response'
```

---

## Related Documentation

- [Chatbot Implementation Guide](./CHATBOT_IMPLEMENTATION.md)
- [Backend Architecture](./server/ARCHITECTURE.md)
- [Firebase Setup](./server/SETUP.md)

---

## Support

For issues with the chatbot API:
1. Check server logs for detailed error messages
2. Verify GEMINI_API_KEY is set correctly
3. Confirm Firebase service account has proper permissions
4. Test with curl examples above to isolate frontend vs backend issues
