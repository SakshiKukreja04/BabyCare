# Testing Instructions: Development This Week Feature

## 🎯 Feature Overview
The "Development This Week" section displays AI-generated developmental milestones for **premature babies only**, based on their **corrected age**. The feature uses Google Gemma-2-2b-it model via Hugging Face Router API.

---

## ✅ Prerequisites

### 1. Backend Setup
- [ ] Ensure `HUGGINGFACE_TOKEN` is set in `server/.env`
  ```env
  HUGGINGFACE_TOKEN=your_huggingface_token_here
  ```
- [ ] Get your token from: https://huggingface.co/settings/tokens
- [ ] Accept the model license: https://huggingface.co/google/gemma-2-2b-it

### 2. Dependencies Installed
```bash
cd server
npm install
```

### 3. Backend Server Running
```bash
cd server
npm start
# Should see: 🚀 BabyCare Backend Server running on port 5000
```

### 4. Frontend Running
```bash
cd client
npm run dev
# Should see: Local: http://localhost:5173
```

---

## 🧪 Testing Steps

### Step 1: Create/Verify Premature Baby Profile

1. **Navigate to Baby Profile** (if not already created)
   - Go to: http://localhost:5173/baby-profile
   - Or click "Edit Baby Profile" from Dashboard

2. **Enter Premature Baby Data:**
   - **Baby Name**: Any name (e.g., "Test Baby")
   - **Date of Birth**: Set to a recent date (e.g., 2-3 weeks ago)
   - **Gestational Age**: Enter a value **less than 37 weeks** (e.g., `32` weeks)
   - **Current Weight**: Any weight (e.g., `2.5` kg)

3. **Save the Profile**

### Step 2: Verify Age Summary is Calculated

1. **Go to Dashboard**: http://localhost:5173/dashboard

2. **Check Baby Profile Card:**
   - Should see baby name
   - Should see **🟣 PREMATURE** tag
   - Should see **Dual Timeline Display**:
     - "Actual Age: X weeks"
     - "Corrected Age: Y weeks" (highlighted in purple)
   - Should see two progress bars (Actual and Corrected)

3. **Verify Corrected Age Calculation:**
   - If baby was born 3 weeks ago at 32 weeks gestation:
     - Actual Age: 3 weeks
     - Weeks Early: 40 - 32 = 8 weeks
     - Corrected Age: 3 - 8 = -5 weeks → clamped to 0 weeks
   - If baby was born 10 weeks ago at 32 weeks gestation:
     - Actual Age: 10 weeks
     - Corrected Age: 10 - 8 = 2 weeks

### Step 3: Test "Development This Week" Section

1. **Locate the Section:**
   - Should appear **below the Baby Profile Card**
   - Title: "Development This Week"
   - Should show "Corrected age: X weeks" in top right

2. **Check Loading State:**
   - Initially should show: "Preparing gentle developmental milestones for this week..."

3. **Check Console Logs (Browser DevTools):**
   - Open Browser DevTools (F12)
   - Go to Console tab
   - Look for logs:
     ```
     🔍 [Frontend] Fetching development insight for baby: <babyId>
     📊 [Frontend] Age summary: { ... }
     ✅ [Frontend] Received response from API: { ... }
     ```

4. **Check Backend Console:**
   - Look for logs:
     ```
     🔍 [API] Fetching development insight for baby: <babyId>
     🤖 [Gemma AI] Calling Hugging Face API...
     📝 [Gemma AI] Prompt length: <number> characters
     👶 [Gemma AI] Corrected age: <number> weeks
     ✅ [Gemma AI] Full response received: { ... }
     📄 [Gemma AI] Extracted text length: <number> characters
     📄 [Gemma AI] Generated text preview: <first 200 chars>...
     📤 [API] Sending response to frontend: ...
     ```

5. **Verify Display:**
   - After loading, should see:
     - Bullet points with developmental milestones
     - Activity suggestion
     - Disclaimer: "This is general developmental information, not medical advice."

### Step 4: Test Edge Cases

#### Test Case 1: Full-Term Baby (Should NOT Show Section)
1. Edit baby profile
2. Set Gestational Age to **37 or higher** (e.g., `38` weeks)
3. Save and go to Dashboard
4. **Expected**: "Development This Week" section should **NOT appear**

#### Test Case 2: Premature Baby with Corrected Age = 0
1. Create baby born very recently (1-2 weeks ago) at 32 weeks
2. **Expected**: Section appears but may show fallback message if corrected age is 0

#### Test Case 3: AI Failure (Token Missing)
1. Temporarily remove `HUGGINGFACE_TOKEN` from `.env`
2. Restart backend server
3. **Expected**: Section appears with fallback message: "Gentle developmental highlights for this week will appear here when available."

#### Test Case 4: Network Error
1. Disconnect internet
2. Refresh Dashboard
3. **Expected**: Graceful error handling, fallback message shown

---

## 🔍 Debugging Checklist

### If "Development This Week" Section Doesn't Appear:

- [ ] Check if baby is marked as premature (gestationalAge < 37)
- [ ] Check browser console for errors
- [ ] Check backend console for errors
- [ ] Verify `ageSummary?.isPremature === true` in frontend logs
- [ ] Check Network tab in DevTools - is API call being made?
- [ ] Verify API endpoint: `GET /api/babies/:babyId/development-this-week`

### If Section Appears But No Content:

- [ ] Check backend console for Gemma AI response
- [ ] Verify `HUGGINGFACE_TOKEN` is set correctly
- [ ] Check if token has access to `google/gemma-2-2b-it` model
- [ ] Verify model license is accepted on Hugging Face
- [ ] Check Network tab - what's the API response status?
- [ ] Look for `insightText: null` in backend logs

### If Content Appears But Format is Wrong:

- [ ] Check browser console for full API response
- [ ] Verify `result.content` is a string
- [ ] Check how text is being split (by `\n`)
- [ ] Verify Gemma response format in backend logs

---

## 📊 Expected API Response Format

### Success Response:
```json
{
  "correctedAgeWeeks": 2,
  "isPremature": true,
  "content": "• Milestone 1\n• Milestone 2\n• Milestone 3\n\nActivity: ..."
}
```

### Error Response (Not Premature):
```json
{
  "error": "Not Premature",
  "message": "Developmental milestones are only provided for premature babies"
}
```

### Error Response (Missing Token):
```json
{
  "correctedAgeWeeks": 2,
  "isPremature": true,
  "content": null
}
```

---

## 🧪 Manual API Test

You can test the API directly using curl or Postman:

```bash
# Get your Firebase ID token first (from browser DevTools > Application > Local Storage)
# Then test:

curl -X GET "http://localhost:5000/api/babies/<babyId>/development-this-week" \
  -H "Authorization: Bearer <your-firebase-id-token>" \
  -H "Content-Type: application/json"
```

---

## ✅ Success Criteria

The feature is working correctly if:

1. ✅ "Development This Week" section appears **only** for premature babies
2. ✅ Section shows loading state initially
3. ✅ Gemma AI response is displayed as bullet points
4. ✅ Content is calm, reassuring, and non-medical
5. ✅ Corrected age is displayed in section header
6. ✅ Console logs show full flow (frontend → backend → AI → response)
7. ✅ Graceful fallback if AI fails
8. ✅ No errors in browser or backend console

---

## 🐛 Common Issues & Solutions

### Issue: "Section doesn't appear"
**Solution**: Verify baby's gestational age is < 37 weeks

### Issue: "Content is null"
**Solution**: 
- Check `HUGGINGFACE_TOKEN` is set
- Verify token has model access
- Check backend console for AI errors

### Issue: "API returns 401/403"
**Solution**: 
- Verify Firebase authentication token
- Check baby belongs to logged-in user

### Issue: "API returns 404"
**Solution**: 
- Verify baby ID is correct
- Check baby document exists in Firestore

### Issue: "SDK error about endpoint"
**Solution**: 
- Verify `@huggingface/inference` package is installed
- Check SDK version compatibility

---

## 📝 Notes

- The feature uses **deterministic age calculation** (no AI)
- AI is called **only** for premature babies with corrected age > 0
- All AI output is **explainability-only** (not medical advice)
- Frontend handles `null` content gracefully with fallback message

---

## 🎉 Testing Complete!

Once all tests pass, the feature is ready for production use!

