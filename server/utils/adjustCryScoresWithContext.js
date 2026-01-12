/**
 * Context-Aware Cry Score Adjustment Utility
 * 
 * AGGRESSIVE post-processing of Flask AI cry analysis scores using:
 * - Care logs (feeding, sleep)
 * - Reminders
 * - ALERTS (Critical feeding, sleep alerts)
 * 
 * This runs AFTER Flask response, BEFORE frontend response.
 * Goal: Reduce belly_pain bias and boost relevant causes based on context
 */

/**
 * Time thresholds in milliseconds
 */
const TIME_THRESHOLDS = {
  // Priority windows for checking logs
  RECENT_WINDOW_MS: 2 * 60 * 60 * 1000,        // 2 hours - check this first
  EXTENDED_WINDOW_MS: 6 * 60 * 60 * 1000,      // 6 hours - check if no recent logs
  
  // Feeding thresholds
  FEEDING_RECENT_MS: 60 * 60 * 1000,           // 1 hour - recent feeding
  FEEDING_OVERDUE_FULL_TERM_MS: 3 * 60 * 60 * 1000,    // 3 hours
  FEEDING_OVERDUE_PREMATURE_MS: 2.5 * 60 * 60 * 1000,  // 2.5 hours
  
  // Sleep thresholds
  SLEEP_OVERDUE_MS: 3 * 60 * 60 * 1000,        // 3 hours since last sleep
  WOKE_RECENTLY_MS: 45 * 60 * 1000,            // 45 min since waking
  LONG_AWAKE_MS: 10 * 60 * 60 * 1000,          // 10 hours awake
  
  // Burping window (after feeding)
  BURPING_WINDOW_MIN_MS: 5 * 60 * 1000,        // 5 min after feeding
  BURPING_WINDOW_MAX_MS: 45 * 60 * 1000,       // 45 min after feeding
  
  // Large feeding threshold
  LARGE_FEEDING_ML: 60,
  FREQUENT_FEEDING_WINDOW_MS: 90 * 60 * 1000,  // 90 min for frequent feeding check
};

/**
 * Extract timestamp from log object - handles multiple formats
 */
function getLogTimestamp(log) {
  if (!log) return null;
  
  // Check pre-computed _timestampMs first
  if (log._timestampMs && !isNaN(log._timestampMs)) return log._timestampMs;
  
  const timeFields = ['timestamp', 'createdAt', 'created_at', 'loggedAt', 'time', 'date'];
  
  for (const field of timeFields) {
    if (log[field]) {
      const value = log[field];
      if (value.toDate) return value.toDate().getTime();
      if (value._seconds) return value._seconds * 1000;
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = new Date(value).getTime();
        if (!isNaN(parsed)) return parsed;
      }
    }
  }
  
  return null;
}

/**
 * Get most recent feeding info with priority window logic
 * First checks last 2 hours, if none found, checks extended window
 */
function getLastFeedingInfo(feedingLogs, now) {
  if (!feedingLogs || feedingLogs.length === 0) return { info: null, inRecentWindow: false };
  
  // Sort by timestamp desc
  const sorted = [...feedingLogs].sort((a, b) => {
    const aTime = getLogTimestamp(a);
    const bTime = getLogTimestamp(b);
    return (bTime || 0) - (aTime || 0);
  });
  
  // Check for logs in recent 2-hour window first
  const recentLogs = sorted.filter(log => {
    const ts = getLogTimestamp(log);
    return ts && (now - ts) <= TIME_THRESHOLDS.RECENT_WINDOW_MS;
  });
  
  if (recentLogs.length > 0) {
    const lastLog = recentLogs[0];
    const timestamp = getLogTimestamp(lastLog);
    const amount = lastLog.amount || lastLog.feedingAmount || lastLog.quantity || 0;
    console.log(`   📋 Found ${recentLogs.length} feeding logs in last 2 hours`);
    return { info: { timestamp, amount, log: lastLog }, inRecentWindow: true };
  }
  
  // No recent logs, check extended window (2-6 hours)
  const extendedLogs = sorted.filter(log => {
    const ts = getLogTimestamp(log);
    return ts && (now - ts) > TIME_THRESHOLDS.RECENT_WINDOW_MS && (now - ts) <= TIME_THRESHOLDS.EXTENDED_WINDOW_MS;
  });
  
  if (extendedLogs.length > 0) {
    const lastLog = extendedLogs[0];
    const timestamp = getLogTimestamp(lastLog);
    const amount = lastLog.amount || lastLog.feedingAmount || lastLog.quantity || 0;
    console.log(`   📋 No feeding in last 2h, found ${extendedLogs.length} logs in 2-6h window`);
    return { info: { timestamp, amount, log: lastLog }, inRecentWindow: false };
  }
  
  // Check all available logs
  if (sorted.length > 0) {
    const lastLog = sorted[0];
    const timestamp = getLogTimestamp(lastLog);
    const amount = lastLog.amount || lastLog.feedingAmount || lastLog.quantity || 0;
    const hoursSince = timestamp ? ((now - timestamp) / (60 * 60 * 1000)).toFixed(1) : 'N/A';
    console.log(`   📋 No feeding in 6h, last feeding was ${hoursSince}h ago`);
    return { info: { timestamp, amount, log: lastLog }, inRecentWindow: false };
  }
  
  return { info: null, inRecentWindow: false };
}

/**
 * Get last sleep info with priority window logic
 */
function getLastSleepInfo(sleepLogs, now) {
  if (!sleepLogs || sleepLogs.length === 0) return { info: null, inRecentWindow: false };
  
  const sorted = [...sleepLogs].sort((a, b) => {
    const aTime = getLogTimestamp(a);
    const bTime = getLogTimestamp(b);
    return (bTime || 0) - (aTime || 0);
  });
  
  // Check for logs in recent 2-hour window first
  const recentLogs = sorted.filter(log => {
    const ts = getLogTimestamp(log);
    return ts && (now - ts) <= TIME_THRESHOLDS.RECENT_WINDOW_MS;
  });
  
  if (recentLogs.length > 0) {
    const lastLog = recentLogs[0];
    const startTime = getLogTimestamp(lastLog);
    const duration = lastLog.duration || 0;
    const endTime = startTime && duration ? startTime + (duration * 60 * 1000) : null;
    console.log(`   📋 Found ${recentLogs.length} sleep logs in last 2 hours`);
    return { info: { startTime, duration, endTime, log: lastLog }, inRecentWindow: true };
  }
  
  // No recent logs, check extended window
  const extendedLogs = sorted.filter(log => {
    const ts = getLogTimestamp(log);
    return ts && (now - ts) > TIME_THRESHOLDS.RECENT_WINDOW_MS && (now - ts) <= TIME_THRESHOLDS.EXTENDED_WINDOW_MS;
  });
  
  if (extendedLogs.length > 0) {
    const lastLog = extendedLogs[0];
    const startTime = getLogTimestamp(lastLog);
    const duration = lastLog.duration || 0;
    const endTime = startTime && duration ? startTime + (duration * 60 * 1000) : null;
    console.log(`   📋 No sleep in last 2h, found ${extendedLogs.length} logs in 2-6h window`);
    return { info: { startTime, duration, endTime, log: lastLog }, inRecentWindow: false };
  }
  
  // Check all available logs
  if (sorted.length > 0) {
    const lastLog = sorted[0];
    const startTime = getLogTimestamp(lastLog);
    const duration = lastLog.duration || 0;
    const endTime = startTime && duration ? startTime + (duration * 60 * 1000) : null;
    console.log(`   📋 No sleep in 6h, using oldest available log`);
    return { info: { startTime, duration, endTime, log: lastLog }, inRecentWindow: false };
  }
  
  return { info: null, inRecentWindow: false };
}

/**
 * Check for specific alert types
 */
function checkAlerts(alerts) {
  const result = {
    hasCriticalFeedingAlert: false,
    hasLowFeedingAlert: false,
    hasFrequentFeedingAlert: false,
    hasSleepAlert: false,
    alertTypes: [],
  };
  
  if (!alerts || alerts.length === 0) return result;
  
  for (const alert of alerts) {
    const type = (alert.type || alert.title || '').toLowerCase();
    const severity = (alert.severity || '').toLowerCase();
    
    // Check for feeding-related alerts
    if (type.includes('feeding') || type.includes('hunger') || type.includes('fed')) {
      if (type.includes('critical') || type.includes('low') || type.includes('delay') || severity === 'high') {
        result.hasCriticalFeedingAlert = true;
        result.alertTypes.push('CRITICAL_FEEDING');
      }
      if (type.includes('frequent')) {
        result.hasFrequentFeedingAlert = true;
        result.alertTypes.push('FREQUENT_FEEDING');
      }
      if (type.includes('low')) {
        result.hasLowFeedingAlert = true;
        result.alertTypes.push('LOW_FEEDING');
      }
    }
    
    // Check for sleep-related alerts
    if (type.includes('sleep') || type.includes('tired')) {
      result.hasSleepAlert = true;
      result.alertTypes.push('SLEEP');
    }
  }
  
  return result;
}

/**
 * Normalize scores to sum to 1
 */
function normalizeScores(scores) {
  const total = Object.values(scores).reduce((sum, val) => sum + Math.max(0, val), 0);
  if (total === 0) return scores;
  
  const normalized = {};
  for (const [key, value] of Object.entries(scores)) {
    normalized[key] = Math.max(0, value) / total;
  }
  return normalized;
}

/**
 * Main function: AGGRESSIVELY adjust cry scores based on context
 */
function adjustCryScoresWithContext({
  aiScores,
  feedingLogs = [],
  sleepLogs = [],
  reminders = [],
  alerts = [],
  babyType = 'full_term',
}) {
  const now = Date.now();
  
  // Copy raw scores and ensure all labels exist
  const rawScores = { ...aiScores };
  const STANDARD_LABELS = ['hunger', 'belly_pain', 'tired', 'burping', 'discomfort'];
  
  // Initialize adjusted scores with raw values
  const adjustedScores = {};
  for (const label of STANDARD_LABELS) {
    adjustedScores[label] = rawScores[label] || 0;
  }
  
  const explanation = [];
  let bellyPainReduction = 0; // Track how much to reduce belly_pain
  
  console.log('🧠 [CryScoreAdjust] ========== STARTING ADJUSTMENT ==========');
  console.log(`   - Baby type: ${babyType}`);
  console.log(`   - Raw scores: ${JSON.stringify(rawScores)}`);
  console.log(`   - Context: ${feedingLogs.length} feeding, ${sleepLogs.length} sleep, ${reminders.length} reminders, ${alerts.length} alerts`);
  console.log(`   - NOW timestamp: ${new Date(now).toISOString()}`);
  
  // Debug: Show all feeding log timestamps
  if (feedingLogs.length > 0) {
    console.log(`   📋 FEEDING LOG DETAILS:`);
    feedingLogs.forEach((log, i) => {
      const ts = getLogTimestamp(log);
      const ago = ts ? ((now - ts) / (60 * 60 * 1000)).toFixed(2) : 'N/A';
      const amt = log.amount || log.feedingAmount || log.quantity || 'N/A';
      console.log(`      ${i}: ts=${ts ? new Date(ts).toISOString() : 'NULL'}, ${ago}h ago, amount/quantity=${amt}ml`);
    });
  }
  
  // Debug: Show all sleep log timestamps
  if (sleepLogs.length > 0) {
    console.log(`   📋 SLEEP LOG DETAILS:`);
    sleepLogs.forEach((log, i) => {
      const ts = getLogTimestamp(log);
      const ago = ts ? ((now - ts) / (60 * 60 * 1000)).toFixed(2) : 'N/A';
      console.log(`      ${i}: ts=${ts ? new Date(ts).toISOString() : 'NULL'}, ${ago}h ago, duration=${log.duration || 'N/A'}min`);
    });
  }
  
  // ============================================
  // ANALYZE CONTEXT - Priority: Last 2 hours first, then extended
  // ============================================
  const feedingResult = getLastFeedingInfo(feedingLogs, now);
  const sleepResult = getLastSleepInfo(sleepLogs, now);
  const lastFeeding = feedingResult.info;
  const lastSleep = sleepResult.info;
  const alertInfo = checkAlerts(alerts);
  
  const timeSinceFeeding = lastFeeding?.timestamp ? now - lastFeeding.timestamp : null;
  const timeSinceSleep = lastSleep?.startTime ? now - lastSleep.startTime : null;
  const timeSinceWoke = lastSleep?.endTime ? now - lastSleep.endTime : null;
  
  console.log(`   - Time since last feeding: ${timeSinceFeeding ? (timeSinceFeeding / (60 * 60 * 1000)).toFixed(2) + 'h' : 'N/A'}`);
  console.log(`   - Last feeding amount: ${lastFeeding?.amount || 'N/A'}ml`);
  console.log(`   - Time since last sleep: ${timeSinceSleep ? (timeSinceSleep / (60 * 60 * 1000)).toFixed(2) + 'h' : 'N/A'}`);
  console.log(`   - Time since woke: ${timeSinceWoke ? (timeSinceWoke / (60 * 60 * 1000)).toFixed(2) + 'h' : 'N/A'}`);
  console.log(`   - Alert types: ${alertInfo.alertTypes.join(', ') || 'NONE'}`);
  console.log(`   - Feeding in recent window: ${feedingResult.inRecentWindow}`);
  console.log(`   - Sleep in recent window: ${sleepResult.inRecentWindow}`);
  
  // ============================================
  // DEBUG: Show rule evaluation conditions
  // ============================================
  console.log('🔍 [RuleEval] Checking all rule conditions:');
  console.log(`   RULE 1: hasCriticalAlert=${alertInfo.hasCriticalFeedingAlert}, hasLowAlert=${alertInfo.hasLowFeedingAlert}`);
  console.log(`   RULE 2a: !inRecentWindow=${!feedingResult.inRecentWindow} && logsExist=${feedingLogs.length > 0}`);
  const feedingOverdueThresholdCheck = babyType === 'premature' 
    ? TIME_THRESHOLDS.FEEDING_OVERDUE_PREMATURE_MS 
    : TIME_THRESHOLDS.FEEDING_OVERDUE_FULL_TERM_MS;
  console.log(`   RULE 2b: timeSinceFeeding=${timeSinceFeeding}ms > threshold=${feedingOverdueThresholdCheck}ms ? ${timeSinceFeeding > feedingOverdueThresholdCheck}`);
  console.log(`   RULE 3: inRecentWindow=${feedingResult.inRecentWindow} && timeSince=${timeSinceFeeding}ms >= min=${TIME_THRESHOLDS.BURPING_WINDOW_MIN_MS}ms && <= max=${TIME_THRESHOLDS.BURPING_WINDOW_MAX_MS}ms && amount=${lastFeeding?.amount}ml >= ${TIME_THRESHOLDS.LARGE_FEEDING_ML}ml`);
  console.log(`   RULE 5a: !sleepInRecentWindow=${!sleepResult.inRecentWindow} && sleepLogsExist=${sleepLogs.length > 0}`);
  
  // ============================================
  // RULE 1: CRITICAL FEEDING ALERT → MASSIVE HUNGER BOOST
  // If there's a critical/low feeding alert, baby is likely HUNGRY
  // ============================================
  if (alertInfo.hasCriticalFeedingAlert || alertInfo.hasLowFeedingAlert) {
    console.log('   ✓ RULE 1: Critical/Low Feeding Alert detected!');
    adjustedScores.hunger = 0.70; // SET hunger to 70%
    bellyPainReduction += 0.50;   // Reduce belly_pain by 50%
    explanation.push(`Critical feeding alert → hunger SET to 70%, belly_pain reduced 50%`);
  }
  
  // ============================================
  // RULE 2: NO FEEDING IN LAST 2 HOURS → STRONG HUNGER SIGNAL
  // If no feeding logs in last 2 hours, likely hungry
  // ============================================
  if (!feedingResult.inRecentWindow && feedingLogs.length > 0) {
    console.log('   ✓ RULE 2a: No feeding in last 2 hours!');
    // No recent feeding - boost hunger significantly
    adjustedScores.hunger = Math.max(adjustedScores.hunger, 0.55);
    bellyPainReduction += 0.35;
    explanation.push(`No feeding in last 2h → hunger boosted to ${(adjustedScores.hunger * 100).toFixed(0)}%`);
  }
  
  // ============================================
  // RULE 2b: FEEDING OVERDUE → SIGNIFICANT HUNGER BOOST
  // 3+ hours for full-term, 2.5+ hours for premature
  // ============================================
  const feedingOverdueThreshold = babyType === 'premature' 
    ? TIME_THRESHOLDS.FEEDING_OVERDUE_PREMATURE_MS 
    : TIME_THRESHOLDS.FEEDING_OVERDUE_FULL_TERM_MS;
  
  if (timeSinceFeeding && timeSinceFeeding > feedingOverdueThreshold) {
    const hoursSince = (timeSinceFeeding / (60 * 60 * 1000)).toFixed(1);
    console.log(`   ✓ RULE 2b: Feeding overdue (${hoursSince}h)!`);
    
    // More aggressive the longer since feeding
    const overdueRatio = Math.min(timeSinceFeeding / feedingOverdueThreshold, 3); // Cap at 3x
    const hungerBoost = 0.40 + (overdueRatio * 0.15); // 40% + up to 45% more
    
    adjustedScores.hunger = Math.max(adjustedScores.hunger, Math.min(hungerBoost, 0.80));
    bellyPainReduction += 0.40;
    explanation.push(`No feeding for ${hoursSince}h → hunger boosted to ${(adjustedScores.hunger * 100).toFixed(0)}%`);
  }
  
  // ============================================
  // RULE 3: RECENT LARGE FEEDING → BURPING BOOST
  // If fed >60ml within last 45 min, likely needs burping
  // Only applies if feeding was in recent window
  // ============================================
  if (feedingResult.inRecentWindow && 
      timeSinceFeeding && 
      timeSinceFeeding >= TIME_THRESHOLDS.BURPING_WINDOW_MIN_MS &&
      timeSinceFeeding <= TIME_THRESHOLDS.BURPING_WINDOW_MAX_MS &&
      lastFeeding?.amount >= TIME_THRESHOLDS.LARGE_FEEDING_ML) {
    const minsSince = Math.round(timeSinceFeeding / (60 * 1000));
    console.log(`   ✓ RULE 3: Large feeding (${lastFeeding.amount}ml) ${minsSince}min ago → burping boost!`);
    
    adjustedScores.burping = Math.max(adjustedScores.burping, 0.45);
    bellyPainReduction += 0.35;
    explanation.push(`Fed ${lastFeeding.amount}ml ${minsSince}min ago → burping boosted to ${(adjustedScores.burping * 100).toFixed(0)}%`);
  }
  
  // ============================================
  // RULE 4: FREQUENT FEEDING ALERT → DISCOMFORT/BURPING
  // Baby might have gas or discomfort from frequent feeding
  // ============================================
  if (alertInfo.hasFrequentFeedingAlert) {
    console.log('   ✓ RULE 4: Frequent feeding alert!');
    adjustedScores.burping = Math.max(adjustedScores.burping, 0.35);
    adjustedScores.discomfort = Math.max(adjustedScores.discomfort, 0.25);
    bellyPainReduction += 0.30;
    explanation.push(`Frequent feeding → burping/discomfort boosted`);
  }
  
  // ============================================
  // RULE 5: NO SLEEP IN LAST 2 HOURS → TIRED BOOST
  // ============================================
  if (!sleepResult.inRecentWindow && sleepLogs.length > 0) {
    console.log('   ✓ RULE 5a: No sleep in last 2 hours!');
    adjustedScores.tired = Math.max(adjustedScores.tired, 0.45);
    bellyPainReduction += 0.25;
    explanation.push(`No sleep in last 2h → tired boosted to ${(adjustedScores.tired * 100).toFixed(0)}%`);
  }
  
  // ============================================
  // RULE 5b: SLEEP OVERDUE → TIRED BOOST
  // If no sleep for 3+ hours, baby is likely tired
  // ============================================
  if (timeSinceSleep && timeSinceSleep > TIME_THRESHOLDS.SLEEP_OVERDUE_MS) {
    const hoursSince = (timeSinceSleep / (60 * 60 * 1000)).toFixed(1);
    console.log(`   ✓ RULE 5b: Sleep overdue (${hoursSince}h)!`);
    
    adjustedScores.tired = Math.max(adjustedScores.tired, 0.50);
    bellyPainReduction += 0.30;
    explanation.push(`No sleep for ${hoursSince}h → tired boosted to ${(adjustedScores.tired * 100).toFixed(0)}%`);
  }
  
  // ============================================
  // RULE 6: WOKE RECENTLY → DISCOMFORT
  // If woke up <45 min ago, might be uncomfortable
  // Only trigger if timeSinceWoke is POSITIVE (baby actually woke up)
  // ============================================
  if (timeSinceWoke && timeSinceWoke > 0 && timeSinceWoke <= TIME_THRESHOLDS.WOKE_RECENTLY_MS) {
    const minsSince = Math.round(timeSinceWoke / (60 * 1000));
    console.log(`   ✓ RULE 6: Woke up ${minsSince}min ago!`);
    
    adjustedScores.discomfort = Math.max(adjustedScores.discomfort, 0.30);
    bellyPainReduction += 0.20;
    explanation.push(`Woke up ${minsSince}min ago → discomfort boosted`);
  }
  
  // ============================================
  // RULE 7: AWAKE TOO LONG (>10 hours) → HIGH DISCOMFORT
  // Only trigger if timeSinceWoke is POSITIVE
  // ============================================
  if (timeSinceWoke && timeSinceWoke > 0 && timeSinceWoke > TIME_THRESHOLDS.LONG_AWAKE_MS) {
    const hoursSince = (timeSinceWoke / (60 * 60 * 1000)).toFixed(1);
    console.log(`   ✓ RULE 7: Awake for ${hoursSince}h!`);
    
    adjustedScores.tired = Math.max(adjustedScores.tired, 0.55);
    adjustedScores.discomfort = Math.max(adjustedScores.discomfort, 0.40);
    bellyPainReduction += 0.40;
    explanation.push(`Awake ${hoursSince}h → tired/discomfort boosted`);
  }
  
  // ============================================
  // APPLY BELLY PAIN REDUCTION
  // Cap reduction at 80% of original value
  // ============================================
  const maxBellyPainReduction = Math.min(bellyPainReduction, 0.80);
  if (maxBellyPainReduction > 0) {
    const originalBellyPain = adjustedScores.belly_pain;
    adjustedScores.belly_pain = originalBellyPain * (1 - maxBellyPainReduction);
    console.log(`   ✓ BELLY PAIN: Reduced from ${(originalBellyPain * 100).toFixed(1)}% by ${(maxBellyPainReduction * 100).toFixed(0)}% → ${(adjustedScores.belly_pain * 100).toFixed(1)}%`);
  }
  
  // ============================================
  // FINAL: Cap belly_pain if it's still dominant but context suggests otherwise
  // ============================================
  if (explanation.length > 0 && adjustedScores.belly_pain > 0.40) {
    const oldBp = adjustedScores.belly_pain;
    adjustedScores.belly_pain = 0.35; // Hard cap at 35% if context exists
    console.log(`   ✓ HARD CAP: belly_pain capped from ${(oldBp * 100).toFixed(1)}% to 35%`);
    explanation.push(`Context-aware cap: belly_pain limited to 35%`);
  }
  
  // ============================================
  // NORMALIZE TO SUM = 1
  // ============================================
  const normalizedScores = normalizeScores(adjustedScores);
  
  // Determine final label
  let finalLabel = 'unknown';
  let highestScore = 0;
  for (const [label, score] of Object.entries(normalizedScores)) {
    if (score > highestScore) {
      highestScore = score;
      finalLabel = label;
    }
  }
  
  // Default message if no adjustments
  if (explanation.length === 0) {
    explanation.push('No contextual adjustments applied — using raw AI scores');
  }
  
  console.log('🧠 [CryScoreAdjust] ========== ADJUSTMENT COMPLETE ==========');
  console.log(`   - Final scores: ${JSON.stringify(normalizedScores)}`);
  console.log(`   - Final label: ${finalLabel} (${(highestScore * 100).toFixed(1)}%)`);
  console.log(`   - Rules applied: ${explanation.length}`);
  explanation.forEach((exp, i) => console.log(`     ${i + 1}. ${exp}`));
  
  return {
    raw_scores: rawScores,
    adjusted_scores: normalizedScores,
    final_label: finalLabel,
    confidence: highestScore,
    explanation,
  };
}

module.exports = {
  adjustCryScoresWithContext,
  TIME_THRESHOLDS,
};
