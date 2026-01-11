# Chatbot System Architecture & Flow

## System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BABYCARE CHATBOT                         │
│                    Context-Aware Gemini LLM                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Chatbot.tsx (Page)                      │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ • Chat message interface                                   │ │
│  │ • User input textarea                                      │ │
│  │ • Message history with timestamps                          │ │
│  │ • Typing indicator                                         │ │
│  │ • Error handling                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│         │                                  │                     │
│         │ useAuth() - Get JWT token        │                     │
│         │ getBabiesByParent() - Get baby   │                     │
│         └────────────────────────────────────────┐               │
│                                                  │               │
│                                         ┌───────▼──────┐        │
│                                         │ chatbotApi   │        │
│                                         │.sendMessage()│        │
│                                         └───────┬──────┘        │
│                                                │                 │
└────────────────────────────────────────────────┼─────────────────┘
                                                 │
                        POST /api/chatbot        │
                                                 │
┌────────────────────────────────────────────────▼─────────────────┐
│                         BACKEND (Node.js)                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              routes/chatbot.js (Express)                   │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                                                            │ │
│  │  POST /chatbot                                             │ │
│  │  ├─ verifyToken() - Check JWT                             │ │
│  │  ├─ Validate babyId & user access                         │ │
│  │  │                                                         │ │
│  │  └──────────────────────────────────────┐                 │ │
│  │                                          │                 │ │
│  └──────────────────────────────────────────┼─────────────────┘ │
│                                             │                    │
│         ┌───────────────────────────────────▼────────────┐       │
│         │ buildChatbotContext(babyId)                    │       │
│         │  [services/chatbotContext.js]                 │       │
│         └───┬───────────────┬───────┬──────────────┬────┘       │
│             │               │       │              │             │
│      ┌──────▼────┐    ┌────▼──┐   │        ┌─────▼──┐          │
│      │ fetchBaby  │    │fetch  │   │        │ fetch  │          │
│      │ Profile    │    │ Cry   │   │        │Active  │          │
│      │            │    │ Analysis  │        │Reminders          │
│      └──────┬─────┘    └────┬──┘   │        └─────┬──┘          │
│             │               │      │              │              │
│             │          ┌────▼──────▼──┐           │              │
│             │          │ fetchRecentCareLogs      │              │
│             │          │ (feeding/sleep)          │              │
│             │          └────┬──────────┘           │              │
│             │               │                      │              │
│             └───────────────┼──────────────────────┘              │
│                             │                                    │
│                    ┌────────▼────────┐                          │
│                    │ formatContext   │                          │
│                    │ForPrompt()      │                          │
│                    │                 │                          │
│                    │ Returns:        │                          │
│                    │ "Baby Age: 4mo" │                          │
│                    │ "Last feed:..."  │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│         ┌───────────────────▼──────────────────┐                │
│         │  buildChatbotPrompt()                │                │
│         │                                      │                │
│         │  System Prompt (Safety Rules)        │                │
│         │  +                                   │                │
│         │  Context Section (Baby Data)         │                │
│         │  +                                   │                │
│         │  User Question + Instructions        │                │
│         └────────────────┬─────────────────────┘                │
│                          │                                      │
│         ┌────────────────▼──────────────────┐                  │
│         │ callGeminiChatbot(prompt)         │                  │
│         │                                   │                  │
│         │ axios.post() to:                  │                  │
│         │ generativelanguage.googleapis.com │                  │
│         └────────────────┬──────────────────┘                  │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ GEMINI LLM  │
                    │ (Google API)│
                    └──────┬──────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
    ┌──────▼────────┐           ┌─────────▼──────┐
    │ Process Prompt│           │ Generate Text  │
    │ + Context     │           │ Response       │
    │               │           │                │
    │ - Safety check│           │ "Based on...   │
    │ - Extract key │           │ your baby may..│
    │   patterns    │           │ Try feeding"   │
    └────────┬──────┘           └─────────┬──────┘
             │                           │
             └───────────────┬───────────┘
                             │
                    ┌────────▼─────────┐
                    │ Return Response  │
                    │ + Timestamp      │
                    └────────┬─────────┘
                             │
┌────────────────────────────▼──────────────────────────────────┐
│                     Response to Frontend                      │
├────────────────────────────────────────────────────────────────┤
│ {                                                             │
│   "success": true,                                            │
│   "data": {                                                   │
│     "response": "Based on recent activity...",               │
│     "timestamp": "2026-01-11T10:30:00Z"                      │
│   }                                                           │
│ }                                                             │
└────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────┐
│                     Frontend Display                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Assistant: Based on recent activity, your baby...        │ │
│  │ Time: 10:30 AM                                           │ │
│  │                                                          │ │
│  │ Parent: Why is my baby crying?                          │ │
│  │ Time: 10:30 AM                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [Message input field]  [Send button]                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Flow with Context Injection

```
┌──────────────────────────────────────────────────────────────┐
│                  STEP 1: USER SENDS MESSAGE                  │
└──────────────────────────────────────────────────────────────┘

User Input:
┌─────────────────────────┐
│ "Why is my baby crying?"│
│ Baby ID: abc123         │
└─────────────────────────┘
       │
       ▼
   HTTP POST
   /api/chatbot
   {message, babyId}


┌──────────────────────────────────────────────────────────────┐
│           STEP 2: FETCH CONTEXT (PARALLEL)                   │
└──────────────────────────────────────────────────────────────┘

buildChatbotContext(babyId) executes 4 queries in parallel:

Query 1                Query 2              Query 3            Query 4
─────────              ──────────           ──────             ──────
Babies Collection      CryAnalyses Coll     CareLogs Coll      Reminders Coll
   │                      │                    │                  │
   ├─ Get 1 doc          ├─ Latest 1         ├─ Last 6 hrs      ├─ Pending only
   │  (baby profile)      │  (cry pattern)     │  (feeding/sleep)  │  (10 limit)
   │                      │                    │                  │
   ▼                      ▼                    ▼                  ▼

Baby Data:             Cry Analysis:        Care Logs:          Reminders:
{                      {                    [{                  [{
  age_months: 4,         final_label:         type: 'feeding',  medicine_name:
  dob: ...,               'hunger',            timestamp: ...,   'vitamins',
  is_premature:           confidence: 0.46,    quantity: 150   status: 'pending'
  false                   adjusted_scores:   }]              }]
}                        {...}
                       }


┌──────────────────────────────────────────────────────────────┐
│          STEP 3: BUILD STRUCTURED CONTEXT OBJECT             │
└──────────────────────────────────────────────────────────────┘

Combine all data into:

{
  baby_profile: {
    age_months: 4,
    is_premature: false,
    gestational_age_at_birth: 40
  },
  
  recent_activity: {
    feeding: {
      last_feed_time: "2026-01-11T09:05Z",
      time_since_last_feed_minutes: 85,
      feeding_overdue: true  ← KEY INSIGHT
    },
    sleep: {
      last_sleep_end: "2026-01-11T08:50Z",
      recently_woke_up: false,
      sleep_overdue: false
    }
  },
  
  latest_cry_analysis: {
    final_label: "hunger",      ← KEY INSIGHT
    confidence: 0.46,
    adjusted_scores: {...},
    explanation: ["Feeding overdue detected"]
  },
  
  active_reminders: [           ← KEY INSIGHT
    "Feeding overdue by 20 mins"
  ]
}


┌──────────────────────────────────────────────────────────────┐
│           STEP 4: FORMAT CONTEXT FOR PROMPT                  │
└──────────────────────────────────────────────────────────────┘

formatContextForPrompt(context) returns:

"Baby Age: 4 months
Last feeding: 85 minutes ago
⚠️ Feeding is overdue
Baby woke up recently
Latest cry analysis:
- Pattern: hunger (confidence: 46%)
- Factors: Feeding reminder detected
Active reminders/alerts:
- Feeding overdue by 20 minutes"


┌──────────────────────────────────────────────────────────────┐
│         STEP 5: BUILD COMPLETE PROMPT FOR GEMINI             │
└──────────────────────────────────────────────────────────────┘

buildChatbotPrompt() combines:

┌─ System Prompt (Safety Rules) ────────────────────────────────┐
│                                                               │
│ You are a supportive baby care assistant...                  │
│                                                               │
│ CRITICAL RULES:                                              │
│ - NEVER provide medical diagnosis                            │
│ - NEVER prescribe medication                                 │
│ - ALWAYS recommend consulting pediatrician                   │
│                                                               │
└───────────────────────────────────────────────────────────────┘

     +

┌─ Baby Context ────────────────────────────────────────────────┐
│                                                               │
│ Baby Age: 4 months                                           │
│ Last feeding: 85 minutes ago                                 │
│ ⚠️ Feeding is overdue                                         │
│ Latest cry analysis: hunger (46% confidence)                 │
│ Factors: Feeding reminder detected                           │
│                                                               │
└───────────────────────────────────────────────────────────────┘

     +

┌─ User Question ───────────────────────────────────────────────┐
│                                                               │
│ Parent's Question:                                           │
│ Why is my baby crying?                                       │
│                                                               │
│ RESPONSE GUIDELINES:                                          │
│ 1. Address parent's concern                                  │
│ 2. Use context for personalized guidance                     │
│ 3. Reference context when relevant                           │
│ 4. Never assume beyond context                               │
│ 5. Recommend pediatrician if unsure                          │
│ 6. Be supportive and actionable                              │
│                                                               │
└───────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────┐
│         STEP 6: GEMINI LLM GENERATES RESPONSE                │
└──────────────────────────────────────────────────────────────┘

LLM receives full prompt → Understands:
  • Baby is 4 months old
  • Last fed 85 minutes ago (OVERDUE)
  • Cry pattern shows hunger (46% confidence)
  • Multiple signals point to hunger

LLM generates:

"Based on recent activity, your baby may be crying due to hunger.
The last feeding was over an hour ago and a feeding reminder is active.
Crying is often a baby's way of signaling they need food.

You could try offering a feed and see if your baby settles.
If crying continues or seems unusual, observing other signs or
consulting a pediatrician may help."


┌──────────────────────────────────────────────────────────────┐
│               STEP 7: RESPONSE SENT TO FRONTEND              │
└──────────────────────────────────────────────────────────────┘

{
  success: true,
  data: {
    response: "[Full response from LLM]",
    timestamp: "2026-01-11T10:30:45.123Z"
  }
}


┌──────────────────────────────────────────────────────────────┐
│             STEP 8: DISPLAY IN CHATBOT UI                    │
└──────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  Assistant                          10:30 AM    │
│  ┌──────────────────────────────────────────┐  │
│  │ Based on recent activity, your baby     │  │
│  │ may be crying due to hunger. The last   │  │
│  │ feeding was over an hour ago and a      │  │
│  │ feeding reminder is active...           │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  You                                 10:30 AM  │
│  ┌──────────────────────────────────────────┐  │
│  │ Why is my baby crying?                 │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [Input field: Type a message...]              │
│                                       [Send]   │
└────────────────────────────────────────────────┘
```

---

## Safety & Context Interaction

```
When LLM Sees Context:                  LLM Behavior:
─────────────────────────────────────────────────────

feeding_overdue: true                   → Boost hunger score explanation
+ cry_label: "hunger"                   → Say "Last feeding was..."
+ active_reminder: "Feeding overdue"    → Reference feeding in response
                                        → Suggest offering feed

crying_detected                         → Ask "When does parent notice?"
+ NO feeding context                    → Give general guidance
+ NO recent activity logs               → Say "It depends on..."
                                        → Recommend observation

medical_term_mentioned                  → REFUSE diagnosis
(fever, rash, vomiting, etc.)          → Recommend pediatrician
                                        → Do NOT use context to guess
                                        → Stay safe even with data

[✅ WITH CONTEXT = personalized guidance]
[✅ WITHOUT CONTEXT = general information]
[✅ MEDICAL CONCERN = always redirect to doctor]
```

---

## Performance Metrics

```
Typical Request Timeline:

Client sends request
    │
    ▼ (1-2ms) Network
API receives
    │
    ▼ (1ms) Middleware: Verify JWT
    ▼ (50ms) Database: Check baby access
    │
    ▼ (10ms) Start parallel queries
    ├─ Query 1: Fetch baby (20ms)
    ├─ Query 2: Fetch cry analysis (40ms)
    ├─ Query 3: Fetch care logs (60ms) ← Usually slowest
    └─ Query 4: Fetch reminders (30ms)
    │
    ▼ (5ms) Process data + build context
    ▼ (2ms) Format for prompt
    ▼ (1ms) Build prompt
    │
    ▼ (~800ms) Call Gemini API
    ▼ (500ms) LLM processing
    ▼ (300ms) LLM token generation
    │
    ▼ (5ms) Return response to client
    │
    ▼ (1-2ms) Network
Client receives response

Total: ~1,000-1,500ms (1-1.5 seconds)
```

---

## Context Window Example

```
Real World Scenario:

Parent Question: "My baby just woke up crying and won't settle"

Context Provided to LLM:
──────────────────────

Baby Profile:
• Age: 6 months
• Gestational age at birth: 38 weeks (not premature)

Recent Activity (Last 6 hours):
Feeding Log:
  └─ Last fed at 9:45 AM (fed 45 minutes ago)
  └─ Quantity: 200ml
  └─ Duration: 15 minutes
  └─ Status: Normal, baby fed well

Sleep Log:
  └─ Last sleep: 10:00 AM - 10:20 AM (20 min power nap)
  └─ Woke up at: 10:20 AM (10 minutes ago)
  └─ Recently woke up: YES ← Key signal

Cry Analysis:
  └─ Pattern: "burping" (55% confidence)
  └─ Secondary: "discomfort" (25%)
  └─ Factors applied:
    • Recent wake detected → discomfort boost
    • Recent feeding detected → burping boost

Active Reminders:
  └─ None (no pending medications/feedings)

LLM Receives Full Context:
──────────────────────────

"6-month-old baby just woke from short nap,
fed 45 minutes ago (normal intake), cry pattern
suggests burping or mild discomfort. No immediate
feeding/medication due."

LLM Response:
─────────────

"Your baby might be waking up groggy after a short nap
and could need burping or a moment to fully wake up.
The recent feed was successful, so hunger is unlikely.

You could try:
• Gentle burping/patting on the back
• Soothing rocking or walking
• Giving baby a few minutes to settle
• Checking for any signs of discomfort

If crying persists more than 10-15 minutes or baby
seems to be in pain, consulting your pediatrician
would be a good idea."

What the LLM Did NOT Do:
────────────────────────
✗ Didn't suggest feeding (baby was just fed)
✗ Didn't diagnose "colic" or medical condition
✗ Didn't prescribe any remedy
✗ Didn't ignore the recent activity
✓ Used context to personalize guidance
✓ Explained reasoning with context
✓ Suggested safe, supportive actions
```

---

## Error Handling Flow

```
Request comes in
    │
    ├─ No message? → Return 400 Bad Request
    │
    ├─ Invalid JWT? → Return 401 Unauthorized
    │
    ├─ Has babyId?
    │  ├─ Baby not found? → Return 404 Not Found
    │  ├─ Not user's baby? → Return 403 Forbidden
    │  │
    │  └─ Build context...
    │     ├─ Firestore error? → Log error, continue with null context
    │     ├─ Gemini API down? → Return safe fallback message
    │     │
    │     └─ All good? → Generate response
    │
    └─ Any uncaught error? → Return 500 Server Error
                            + Log error details
                            + Send safe message to user

Safe Fallback Messages:
──────────────────────
• API unavailable: "I apologize, but the AI assistant is 
  currently unavailable. Please consult with your 
  healthcare provider for any medical questions."

• Generation failed: "I apologize, but I could not generate 
  a response. Please try again or consult with your 
  healthcare provider."

• Processing error: "I apologize, but I encountered an error. 
  Please consult with your healthcare provider for any 
  medical questions."

All fallbacks prioritize:
✓ User safety
✓ Not leaving user without guidance
✓ Recommending professional help
```

---

## Document Navigation

- **Overview**: This file (you are here)
- **Implementation Details**: [CHATBOT_IMPLEMENTATION.md](./CHATBOT_IMPLEMENTATION.md)
- **API Reference**: [CHATBOT_API_REFERENCE.md](./CHATBOT_API_REFERENCE.md)
- **Completion Status**: [CHATBOT_COMPLETE.md](./CHATBOT_COMPLETE.md)
