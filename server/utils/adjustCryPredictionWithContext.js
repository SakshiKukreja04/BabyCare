/**
 * Context-Aware Cry Prediction Adjustment
 * 
 * Post-processes AI cry analysis scores using recent baby activity context.
 * Applies small nudges based on deterministic rules without overriding AI predictions.
 * 
 * IMPORTANT: This does NOT retrain the model - it applies post-processing adjustments.
 */

/**
 * Adjustment constants - small nudges only
 */
const ADJUSTMENTS = {
  FEEDING_OVERDUE_BOOST: 0.05,      // +5% to hunger if feeding overdue
  FEEDING_REMINDER_BOOST: 0.05,     // +5% to hunger if feeding reminder exists
  RECENT_FEEDING_BURP_BOOST: 0.03,  // +3% to burping if fed in last 30-60 min
  SLEEP_OVERDUE_BOOST: 0.05,        // +5% to tired if sleep overdue
  SLEEP_REMINDER_BOOST: 0.05,       // +5% to tired if sleep reminder exists
  RECENT_WAKE_DISCOMFORT_BOOST: 0.03, // +3% to discomfort if woke up recently
  BELLY_PAIN_MIN_THRESHOLD: 0.4,    // Only boost belly_pain if AI confidence > 0.4
};

/**
 * Time thresholds in milliseconds
 */
const TIME_THRESHOLDS = {
  FEEDING_OVERDUE_MS: 3 * 60 * 60 * 1000,        // 3 hours - feeding considered overdue
  RECENT_FEEDING_MIN_MS: 30 * 60 * 1000,         // 30 minutes - minimum for burping context
  RECENT_FEEDING_MAX_MS: 60 * 60 * 1000,         // 60 minutes - maximum for burping context
  SLEEP_OVERDUE_MS: 3 * 60 * 60 * 1000,          // 3 hours - sleep considered overdue
  RECENT_WAKE_MS: 30 * 60 * 1000,                // 30 minutes - recently woke up
  CONTEXT_WINDOW_MS: 6 * 60 * 60 * 1000,         // 6 hours - context window
};

/**
 * Normalize score keys to standard format
 * Maps various label formats to consistent keys
 */
function normalizeScoreKey(key) {
  const keyLower = key.toLowerCase();
  if (keyLower === 'hunger' || keyLower === 'hungry') return 'hunger';
  if (keyLower === 'belly_pain' || keyLower === 'bellypain') return 'belly_pain';
  if (keyLower === 'tired' || keyLower === 'sleepy') return 'tired';
  return keyLower;
}

/**
 * Normalize AI scores to standard format
 */
function normalizeScores(aiScores) {
  const normalized = {};
  for (const [key, value] of Object.entries(aiScores)) {
    if (typeof value === 'number') {
      normalized[normalizeScoreKey(key)] = value;
    }
  }
  return normalized;
}

/**
 * Clamp value between 0 and 1
 */
function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalize scores so they sum to 1
 */
function normalizeToSum(scores) {
  const total = Object.values(scores).reduce((sum, val) => sum + val, 0);
  if (total === 0) return scores;
  
  const normalized = {};
  for (const [key, value] of Object.entries(scores)) {
    normalized[key] = value / total;
  }
  return normalized;
}

/**
 * Check if there's an active/pending reminder of a specific type
 */
function hasActiveReminder(reminders, type) {
  if (!reminders || reminders.length === 0) return false;
  
  const now = Date.now();
  return reminders.some(reminder => {
    const reminderType = (reminder.type || '').toLowerCase();
    const status = (reminder.status || '').toLowerCase();
    
    // Check if reminder is pending or recent
    if (status !== 'pending' && status !== 'sent') return false;
    
    // Check type match
    if (type === 'feeding' && (reminderType.includes('feed') || reminderType.includes('medicine'))) {
      return true;
    }
    if (type === 'sleep' && reminderType.includes('sleep')) {
      return true;
    }
    
    return false;
  });
}

/**
 * Get the most recent log timestamp of a specific type
 */
function getLastLogTime(logs) {
  if (!logs || logs.length === 0) return null;
  
  // Find the most recent log
  let latestTime = null;
  for (const log of logs) {
    let logTime = null;
    
    if (log.timestamp) {
      // Handle Firestore Timestamp or Date
      if (log.timestamp.toDate) {
        logTime = log.timestamp.toDate().getTime();
      } else if (log.timestamp instanceof Date) {
        logTime = log.timestamp.getTime();
      } else if (typeof log.timestamp === 'number') {
        logTime = log.timestamp;
      } else if (typeof log.timestamp === 'string') {
        logTime = new Date(log.timestamp).getTime();
      }
    }
    
    if (logTime && (!latestTime || logTime > latestTime)) {
      latestTime = logTime;
    }
  }
  
  return latestTime;
}

/**
 * Check if most recent sleep ended recently (baby woke up)
 */
function babyWokeUpRecently(sleepLogs) {
  if (!sleepLogs || sleepLogs.length === 0) return false;
  
  const now = Date.now();
  
  for (const log of sleepLogs) {
    // Check for end time (when baby woke up)
    let endTime = null;
    
    if (log.endTime || log.end_time || log.woke_at) {
      const endTimeValue = log.endTime || log.end_time || log.woke_at;
      if (endTimeValue.toDate) {
        endTime = endTimeValue.toDate().getTime();
      } else if (endTimeValue instanceof Date) {
        endTime = endTimeValue.getTime();
      } else if (typeof endTimeValue === 'string') {
        endTime = new Date(endTimeValue).getTime();
      }
    }
    
    // If we have duration and timestamp, calculate end time
    if (!endTime && log.duration && log.timestamp) {
      let startTime = null;
      if (log.timestamp.toDate) {
        startTime = log.timestamp.toDate().getTime();
      } else if (typeof log.timestamp === 'string') {
        startTime = new Date(log.timestamp).getTime();
      }
      
      if (startTime) {
        endTime = startTime + (log.duration * 60 * 1000); // duration in minutes
      }
    }
    
    if (endTime && (now - endTime) <= TIME_THRESHOLDS.RECENT_WAKE_MS) {
      return true;
    }
  }
  
  return false;
}

/**
 * Main function: Adjust cry prediction with context
 * 
 * @param {Object} aiScores - Raw AI prediction scores (e.g., { hunger: 0.42, belly_pain: 0.18, ... })
 * @param {Object} recentLogs - Recent activity context
 * @param {Array} recentLogs.feedingLogs - Last 2-3 feeding logs
 * @param {Array} recentLogs.sleepLogs - Last 2-3 sleep logs  
 * @param {Array} recentLogs.reminders - Last 2 reminders/alerts
 * @returns {Object} - { adjustedScores, finalLabel, confidence, explanation }
 */
function adjustCryPredictionWithContext(aiScores, recentLogs = {}) {
  const { feedingLogs = [], sleepLogs = [], reminders = [] } = recentLogs;
  
  // Normalize input scores
  const scores = normalizeScores(aiScores);
  const adjustedScores = { ...scores };
  const explanation = [];
  
  const now = Date.now();
  
  console.log('🧠 [CryContext] Starting context-aware adjustment...');
  console.log(`   - Raw scores: ${JSON.stringify(scores)}`);
  console.log(`   - Feeding logs: ${feedingLogs.length}, Sleep logs: ${sleepLogs.length}, Reminders: ${reminders.length}`);
  
  // ============================================
  // RULE 1: Hunger boost if feeding overdue or reminder exists
  // ============================================
  const lastFeedingTime = getLastLogTime(feedingLogs);
  const feedingOverdue = lastFeedingTime && (now - lastFeedingTime) > TIME_THRESHOLDS.FEEDING_OVERDUE_MS;
  const hasFeedingReminder = hasActiveReminder(reminders, 'feeding');
  
  if (feedingOverdue || hasFeedingReminder) {
    const boost = ADJUSTMENTS.FEEDING_OVERDUE_BOOST;
    if (adjustedScores.hunger !== undefined) {
      adjustedScores.hunger = clamp(adjustedScores.hunger + boost);
    }
    
    if (feedingOverdue) {
      const hoursSinceFeeding = ((now - lastFeedingTime) / (60 * 60 * 1000)).toFixed(1);
      explanation.push(`Feeding overdue (${hoursSinceFeeding}h ago) → hunger slightly increased (+${boost * 100}%)`);
      console.log(`   ✓ Feeding overdue by ${hoursSinceFeeding}h → +${boost * 100}% hunger`);
    }
    if (hasFeedingReminder) {
      explanation.push(`Feeding reminder active → hunger confidence nudged (+${boost * 100}%)`);
      console.log(`   ✓ Feeding reminder detected → +${boost * 100}% hunger`);
    }
  }
  
  // ============================================
  // RULE 2: Burping boost if fed in last 30-60 minutes
  // ============================================
  if (lastFeedingTime) {
    const timeSinceFeeding = now - lastFeedingTime;
    const recentlyFed = timeSinceFeeding >= TIME_THRESHOLDS.RECENT_FEEDING_MIN_MS && 
                        timeSinceFeeding <= TIME_THRESHOLDS.RECENT_FEEDING_MAX_MS;
    
    if (recentlyFed && adjustedScores.burping !== undefined) {
      const boost = ADJUSTMENTS.RECENT_FEEDING_BURP_BOOST;
      adjustedScores.burping = clamp(adjustedScores.burping + boost);
      
      const minsSinceFeeding = Math.round(timeSinceFeeding / (60 * 1000));
      explanation.push(`Recent feeding (${minsSinceFeeding}min ago) → burping weighted higher (+${boost * 100}%)`);
      console.log(`   ✓ Fed ${minsSinceFeeding}min ago → +${boost * 100}% burping`);
    }
  }
  
  // ============================================
  // RULE 3: Tired boost if sleep overdue or reminder exists
  // ============================================
  const lastSleepTime = getLastLogTime(sleepLogs);
  const sleepOverdue = lastSleepTime && (now - lastSleepTime) > TIME_THRESHOLDS.SLEEP_OVERDUE_MS;
  const hasSleepReminder = hasActiveReminder(reminders, 'sleep');
  
  if ((sleepOverdue || hasSleepReminder) && adjustedScores.tired !== undefined) {
    const boost = ADJUSTMENTS.SLEEP_OVERDUE_BOOST;
    adjustedScores.tired = clamp(adjustedScores.tired + boost);
    
    if (sleepOverdue) {
      const hoursSinceSleep = ((now - lastSleepTime) / (60 * 60 * 1000)).toFixed(1);
      explanation.push(`Sleep overdue (${hoursSinceSleep}h ago) → tiredness slightly increased (+${boost * 100}%)`);
      console.log(`   ✓ Sleep overdue by ${hoursSinceSleep}h → +${boost * 100}% tired`);
    }
    if (hasSleepReminder) {
      explanation.push(`Sleep reminder active → tiredness confidence nudged (+${boost * 100}%)`);
      console.log(`   ✓ Sleep reminder detected → +${boost * 100}% tired`);
    }
  }
  
  // ============================================
  // RULE 4: Discomfort boost if baby woke up recently
  // ============================================
  const wokeRecently = babyWokeUpRecently(sleepLogs);
  
  if (wokeRecently && adjustedScores.discomfort !== undefined) {
    const boost = ADJUSTMENTS.RECENT_WAKE_DISCOMFORT_BOOST;
    adjustedScores.discomfort = clamp(adjustedScores.discomfort + boost);
    
    explanation.push(`Baby woke up recently → discomfort slightly increased (+${boost * 100}%)`);
    console.log(`   ✓ Baby woke recently → +${boost * 100}% discomfort`);
  }
  
  // ============================================
  // RULE 5: Belly pain - NO boost unless AI confidence > 0.4
  // ============================================
  if (scores.belly_pain !== undefined && scores.belly_pain <= ADJUSTMENTS.BELLY_PAIN_MIN_THRESHOLD) {
    // Don't boost belly_pain - keep original score
    console.log(`   ℹ Belly pain AI score (${(scores.belly_pain * 100).toFixed(1)}%) below threshold - no boost applied`);
  }
  
  // ============================================
  // POST-PROCESSING: Clamp and normalize
  // ============================================
  
  // Clamp all scores between 0 and 1
  for (const key of Object.keys(adjustedScores)) {
    adjustedScores[key] = clamp(adjustedScores[key]);
  }
  
  // Normalize so total = 1
  const normalizedScores = normalizeToSum(adjustedScores);
  
  // Determine final label (highest adjusted score)
  let finalLabel = 'unknown';
  let highestScore = 0;
  
  for (const [label, score] of Object.entries(normalizedScores)) {
    if (score > highestScore) {
      highestScore = score;
      finalLabel = label;
    }
  }
  
  const confidence = highestScore;
  
  // Generate summary if no adjustments were made
  if (explanation.length === 0) {
    explanation.push('No contextual adjustments applied - using raw AI scores');
  }
  
  console.log('🧠 [CryContext] Adjustment complete:');
  console.log(`   - Adjusted scores: ${JSON.stringify(normalizedScores)}`);
  console.log(`   - Final label: ${finalLabel} (${(confidence * 100).toFixed(1)}%)`);
  console.log(`   - Explanations: ${explanation.length}`);
  
  return {
    adjustedScores: normalizedScores,
    finalLabel,
    confidence,
    explanation,
  };
}

module.exports = {
  adjustCryPredictionWithContext,
  ADJUSTMENTS,
  TIME_THRESHOLDS,
};
