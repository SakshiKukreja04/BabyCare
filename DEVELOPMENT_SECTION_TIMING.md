# Development This Week Section - Timing & Display Logic

## 📅 When Does the Section Appear?

The "Development This Week" section appears **immediately** when:
- ✅ Baby is marked as **premature** (gestational age < 37 weeks)
- ✅ Baby profile is loaded on the Dashboard

**It does NOT wait for a week to pass.**

---

## 📊 When Does Content Show?

Content (Gemma AI response) appears when **BOTH** conditions are met:

1. ✅ Baby is premature (gestational age < 37 weeks)
2. ✅ **Corrected age > 0 weeks**

### Corrected Age Calculation:

```
Actual Age = floor((Today - Date of Birth) / 7 days)
Weeks Early = 40 - Gestational Age
Corrected Age = Actual Age - Weeks Early
```

**Important:** If corrected age is negative or 0, it's clamped to 0, and content won't show.

---

## 🧮 Examples

### Example 1: Very Recent Birth (No Content Yet)
- **DOB:** 1 week ago
- **Gestational Age:** 32 weeks
- **Calculation:**
  - Actual Age: 1 week
  - Weeks Early: 40 - 32 = 8 weeks
  - Corrected Age: 1 - 8 = **-7 weeks → clamped to 0**
- **Result:** 
  - ✅ Section appears (baby is premature)
  - ❌ No content shown (corrected age = 0)
  - Shows: "Gentle developmental highlights for this week will appear here when available."

### Example 2: After Some Time (Content Shows)
- **DOB:** 10 weeks ago
- **Gestational Age:** 32 weeks
- **Calculation:**
  - Actual Age: 10 weeks
  - Weeks Early: 40 - 32 = 8 weeks
  - Corrected Age: 10 - 8 = **2 weeks**
- **Result:**
  - ✅ Section appears
  - ✅ Content shows (corrected age = 2 weeks)
  - Shows: Gemma AI response with milestones and play tip

### Example 3: Full-Term Baby (No Section)
- **DOB:** Any date
- **Gestational Age:** 38 weeks (full-term)
- **Result:**
  - ❌ Section does NOT appear (not premature)

---

## ⏰ Timeline Example

For a baby born at **32 weeks gestation**:

| Days Since Birth | Actual Age | Corrected Age | Content Shows? |
|-----------------|------------|---------------|----------------|
| 0-6 days | 0 weeks | -8 weeks → 0 | ❌ No (section appears, but no content) |
| 7-13 days | 1 week | -7 weeks → 0 | ❌ No |
| 14-20 days | 2 weeks | -6 weeks → 0 | ❌ No |
| ... | ... | ... | ... |
| 49-55 days | 7 weeks | -1 week → 0 | ❌ No |
| **56-62 days** | **8 weeks** | **0 weeks** | ⚠️ Still 0 (clamped) |
| **63-69 days** | **9 weeks** | **1 week** | ✅ **YES! Content appears** |

**So for a 32-week baby, content will appear approximately 9 weeks after birth (when actual age exceeds weeks early).**

---

## 🔄 Does It Update Weekly?

**No, it updates in real-time based on corrected age.**

- The section calculates corrected age **every time** the Dashboard loads
- As the baby gets older, corrected age increases
- Content is generated fresh each time (not cached)
- The milestones shown are based on the **current corrected age**

---

## 💡 Key Points

1. **Section appears immediately** for premature babies (no waiting period)
2. **Content appears** when corrected age > 0 (which happens when actual age > weeks early)
3. **No weekly schedule** - it's based on corrected age calculation
4. **Real-time updates** - recalculates every time Dashboard loads
5. **Fresh AI response** - generates new content based on current corrected age

---

## 🐛 Troubleshooting

### Issue: Section appears but no content

**Possible reasons:**
- Corrected age is still 0 (baby too young)
- AI call failed (check backend logs)
- Hugging Face token missing or invalid

**Check:**
```javascript
// In browser console, check:
ageSummary.correctedAgeWeeks  // Should be > 0
```

### Issue: Section doesn't appear

**Possible reasons:**
- Baby is not marked as premature (gestational age >= 37)
- Age summary not loaded yet

**Check:**
```javascript
// In browser console, check:
ageSummary.isPremature  // Should be true
```

---

## 📝 Summary

- **Section visibility:** Immediate for premature babies
- **Content visibility:** When corrected age > 0 weeks
- **Update frequency:** Real-time (on each Dashboard load)
- **Content freshness:** New AI response generated each time

The section is designed to show developmental information as soon as the baby has a positive corrected age, providing age-appropriate milestones based on their developmental stage, not their chronological age.

