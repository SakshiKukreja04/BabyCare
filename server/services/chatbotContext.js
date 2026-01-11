/**
 * Chatbot Context Builder
 * 
 * Builds structured context from baby data, recent activity, and AI insights
 * for injection into the Gemma LLM prompt
 */

const { db } = require('../firebaseAdmin');

/**
 * Calculate age in months from date of birth
 */
function calculateAgeMonths(dob) {
  const birthDate = new Date(dob);
  const now = new Date();
  const months = (now.getFullYear() - birthDate.getFullYear()) * 12 +
                 (now.getMonth() - birthDate.getMonth());
  return Math.max(0, months);
}

/**
 * Calculate time difference in minutes
 */
function getMinutesSince(timestamp) {
  if (!timestamp) return null;
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60));
}

/**
 * Fetch baby profile data
 */
async function fetchBabyProfile(babyId) {
  try {
    const babyDoc = await db.collection('babies').doc(babyId).get();
    if (!babyDoc.exists) {
      return null;
    }
    return babyDoc.data();
  } catch (error) {
    console.error('Error fetching baby profile:', error);
    return null;
  }
}

/**
 * Fetch latest cry analysis
 * Note: Using simple query without orderBy to avoid index requirement
 */
async function fetchLatestCryAnalysis(babyId) {
  try {
    const snapshot = await db
      .collection('cryAnalyses')
      .where('babyId', '==', babyId)
      .limit(10)
      .get();

    if (snapshot.empty) {
      return null;
    }

    // Sort in JavaScript to avoid index requirement
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    docs.sort((a, b) => {
      const timeA = a.timestamp?.toMillis?.() || new Date(a.timestamp).getTime() || 0;
      const timeB = b.timestamp?.toMillis?.() || new Date(b.timestamp).getTime() || 0;
      return timeB - timeA; // desc
    });

    return docs[0] || null;
  } catch (error) {
    console.error('Error fetching cry analysis:', error);
    return null;
  }
}

/**
 * Fetch recent care logs (feeding, sleep)
 * Note: Using simple query and filtering in JavaScript to avoid index requirement
 */
async function fetchRecentCareLogs(babyId, hoursBack = 6) {
  try {
    const timeWindow = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Simple query without orderBy to avoid index requirement
    const snapshot = await db
      .collection('careLogs')
      .where('babyId', '==', babyId)
      .limit(50)
      .get();

    if (snapshot.empty) {
      return [];
    }

    // Filter and sort in JavaScript
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Filter by time window
    const filtered = logs.filter(log => {
      const logTime = log.timestamp?.toMillis?.() || new Date(log.timestamp).getTime() || 0;
      return logTime >= timeWindow.getTime();
    });
    
    // Sort by timestamp descending
    filtered.sort((a, b) => {
      const timeA = a.timestamp?.toMillis?.() || new Date(a.timestamp).getTime() || 0;
      const timeB = b.timestamp?.toMillis?.() || new Date(b.timestamp).getTime() || 0;
      return timeB - timeA; // desc
    });

    return filtered.slice(0, 20);
  } catch (error) {
    console.error('Error fetching care logs:', error);
    return [];
  }
}

/**
 * Extract feeding context from recent logs
 */
function extractFeedingContext(careLogs) {
  const feedingLogs = careLogs.filter(log => log.type === 'feeding');

  if (feedingLogs.length === 0) {
    return {
      last_feed_time: null,
      time_since_last_feed_minutes: null,
      feeding_overdue: false,
    };
  }

  const lastFeed = feedingLogs[0];
  const minutesSince = getMinutesSince(lastFeed.timestamp);
  const feedingOverdue = minutesSince !== null && minutesSince > 180; // 3 hours

  return {
    last_feed_time: lastFeed.timestamp?.toISOString?.() || lastFeed.timestamp,
    time_since_last_feed_minutes: minutesSince,
    feeding_overdue: feedingOverdue,
  };
}

/**
 * Extract sleep context from recent logs
 */
function extractSleepContext(careLogs) {
  const sleepLogs = careLogs.filter(log => log.type === 'sleep');

  if (sleepLogs.length === 0) {
    return {
      last_sleep_end: null,
      recently_woke_up: false,
      sleep_overdue: false,
    };
  }

  const lastSleep = sleepLogs[0];
  const minutesSince = getMinutesSince(lastSleep.timestamp);
  const recentlyWokeUp = minutesSince !== null && minutesSince < 30; // Less than 30 min
  const sleepOverdue = minutesSince !== null && minutesSince > 240; // More than 4 hours

  return {
    last_sleep_end: lastSleep.timestamp?.toISOString?.() || lastSleep.timestamp,
    recently_woke_up: recentlyWokeUp,
    sleep_overdue: sleepOverdue,
  };
}

/**
 * Fetch active reminders for baby
 * Note: Using simple query and filtering in JavaScript to avoid index requirement
 */
async function fetchActiveReminders(babyId) {
  try {
    const now = new Date();
    const futureLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Simple query without orderBy to avoid index requirement
    const snapshot = await db
      .collection('reminders')
      .where('babyId', '==', babyId)
      .limit(50)
      .get();

    if (snapshot.empty) {
      return [];
    }
    
    // Filter and sort in JavaScript
    const reminders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Filter by status and scheduled_for
    const filtered = reminders.filter(r => {
      const status = r.status || '';
      const scheduledFor = r.scheduled_for?.toMillis?.() || new Date(r.scheduled_for).getTime() || 0;
      return ['pending', 'sent'].includes(status) && scheduledFor <= futureLimit.getTime();
    });
    
    // Sort by scheduled_for ascending
    filtered.sort((a, b) => {
      const timeA = a.scheduled_for?.toMillis?.() || new Date(a.scheduled_for).getTime() || 0;
      const timeB = b.scheduled_for?.toMillis?.() || new Date(b.scheduled_for).getTime() || 0;
      return timeA - timeB; // asc
    });

    return filtered.slice(0, 10);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return [];
  }
}

/**
 * Build active reminders summary
 */
function buildRemindersSummary(reminders, careLogs) {
  if (!reminders || reminders.length === 0) {
    return [];
  }

  const summary = [];

  // Check for overdue feeding
  const feedingContext = extractFeedingContext(careLogs);
  if (feedingContext.feeding_overdue) {
    const overdueMinutes = feedingContext.time_since_last_feed_minutes - 180;
    summary.push(`Feeding overdue by ${Math.round(overdueMinutes)} minutes`);
  }

  // Check for overdue medication/reminders
  reminders.forEach(reminder => {
    const scheduledTime = reminder.scheduled_for instanceof Date
      ? reminder.scheduled_for
      : new Date(reminder.scheduled_for);

    const minutesUntil = Math.floor((scheduledTime.getTime() - Date.now()) / (1000 * 60));

    if (minutesUntil < 0 && Math.abs(minutesUntil) <= 60) {
      // Overdue within the last hour
      summary.push(
        `${reminder.medicine_name || 'Reminder'} overdue by ${Math.abs(minutesUntil)} minutes`
      );
    } else if (minutesUntil >= 0 && minutesUntil <= 30) {
      // Coming due within next 30 minutes
      summary.push(
        `${reminder.medicine_name || 'Reminder'} due in ${minutesUntil} minutes`
      );
    }
  });

  return summary;
}

/**
 * Build formatted cry analysis context
 */
function formatCryAnalysisContext(cryAnalysis) {
  if (!cryAnalysis) {
    return null;
  }

  // Extract scores, handling both nested and flat structures
  const scores = cryAnalysis.adjusted_scores || cryAnalysis.scores || {};

  return {
    final_label: cryAnalysis.final_label || cryAnalysis.label || 'unknown',
    confidence: cryAnalysis.confidence || 0,
    adjusted_scores: scores,
    explanation: cryAnalysis.explanation || [],
  };
}

/**
 * Build complete context for chatbot
 * 
 * @param {string} babyId - Baby document ID
 * @returns {Promise<Object>} Structured context object
 */
async function buildChatbotContext(babyId) {
  if (!babyId) {
    return null;
  }

  // Fetch all data in parallel
  const [babyProfile, cryAnalysis, careLogs, reminders] = await Promise.all([
    fetchBabyProfile(babyId),
    fetchLatestCryAnalysis(babyId),
    fetchRecentCareLogs(babyId, 6),
    fetchActiveReminders(babyId),
  ]);

  if (!babyProfile) {
    return null;
  }

  const ageMonths = calculateAgeMonths(babyProfile.dob);
  const feedingContext = extractFeedingContext(careLogs);
  const sleepContext = extractSleepContext(careLogs);
  const remindersSummary = buildRemindersSummary(reminders, careLogs);

  return {
    baby_profile: {
      age_months: ageMonths,
      is_premature: babyProfile.gestationalAge !== undefined && babyProfile.gestationalAge < 37,
      gestational_age_at_birth: babyProfile.gestationalAge || null,
    },

    recent_activity: {
      feeding: feedingContext,
      sleep: sleepContext,
    },

    latest_cry_analysis: formatCryAnalysisContext(cryAnalysis),

    active_reminders: remindersSummary,

    timestamp: new Date().toISOString(),
  };
}

/**
 * Format context as a readable string for the prompt
 */
function formatContextForPrompt(context) {
  if (!context) {
    return 'No baby context available.';
  }

  let text = '';

  // Baby profile
  text += `Baby Age: ${context.baby_profile.age_months} months\n`;
  if (context.baby_profile.is_premature) {
    text += `Born Prematurely: Yes (${context.baby_profile.gestational_age_at_birth} weeks)\n`;
  }
  text += '\n';

  // Feeding context
  if (context.recent_activity.feeding.time_since_last_feed_minutes !== null) {
    text += `Last feeding: ${context.recent_activity.feeding.time_since_last_feed_minutes} minutes ago\n`;
    if (context.recent_activity.feeding.feeding_overdue) {
      text += `⚠️ Feeding is overdue\n`;
    }
  }

  // Sleep context
  if (context.recent_activity.sleep.last_sleep_end) {
    text += `Last sleep ended: ${context.recent_activity.sleep.time_since_last_feed_minutes} minutes ago\n`;
    if (context.recent_activity.sleep.recently_woke_up) {
      text += `Baby woke up recently\n`;
    }
  }
  text += '\n';

  // Cry analysis
  if (context.latest_cry_analysis) {
    text += `Latest cry analysis:\n`;
    text += `- Pattern: ${context.latest_cry_analysis.final_label} (confidence: ${(context.latest_cry_analysis.confidence * 100).toFixed(0)}%)\n`;
    if (context.latest_cry_analysis.explanation && context.latest_cry_analysis.explanation.length > 0) {
      text += `- Factors: ${context.latest_cry_analysis.explanation.join(', ')}\n`;
    }
    text += '\n';
  }

  // Active reminders
  if (context.active_reminders && context.active_reminders.length > 0) {
    text += `Active reminders/alerts:\n`;
    context.active_reminders.forEach(reminder => {
      text += `- ${reminder}\n`;
    });
    text += '\n';
  }

  return text;
}

module.exports = {
  buildChatbotContext,
  formatContextForPrompt,
  fetchBabyProfile,
  fetchLatestCryAnalysis,
  fetchRecentCareLogs,
  fetchActiveReminders,
};
