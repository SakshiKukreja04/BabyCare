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
 * Extract medication context from recent logs
 */
function extractMedicationContext(careLogs) {
  const medicationLogs = careLogs.filter(log => log.type === 'medication');

  if (medicationLogs.length === 0) {
    return {
      recent_medications: [],
      last_medication_time: null,
    };
  }

  const recentMeds = medicationLogs.slice(0, 5).map(log => ({
    name: log.medicineName || log.medicine_name || log.name || 'Unknown',
    given: log.medicationGiven !== false,
    time: log.timestamp?.toISOString?.() || log.timestamp,
    minutes_ago: getMinutesSince(log.timestamp),
  }));

  return {
    recent_medications: recentMeds,
    last_medication_time: recentMeds[0]?.time || null,
  };
}

/**
 * Fetch active prescriptions for baby
 */
async function fetchActivePrescriptions(babyId) {
  try {
    const snapshot = await db
      .collection('prescriptions')
      .where('babyId', '==', babyId)
      .limit(20)
      .get();

    if (snapshot.empty) {
      return [];
    }

    const prescriptions = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        medicine_name: data.medicineName || data.medicine_name || 'Unknown',
        dosage: data.dosage || '',
        frequency: data.frequency || '',
        instructions: data.instructions || '',
        start_date: data.startDate?.toISOString?.() || data.startDate || null,
        end_date: data.endDate?.toISOString?.() || data.endDate || null,
        active: data.active !== false,
      };
    });

    // Filter to active prescriptions
    return prescriptions.filter(p => p.active);
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    return [];
  }
}

/**
 * Build a detailed summary of all care logs
 */
function buildCareLogsSummary(careLogs) {
  if (!careLogs || careLogs.length === 0) {
    return {
      total_logs: 0,
      feeding_count: 0,
      sleep_count: 0,
      medication_count: 0,
      logs_by_type: {},
      recent_logs: [],
    };
  }

  const feedingLogs = careLogs.filter(l => l.type === 'feeding');
  const sleepLogs = careLogs.filter(l => l.type === 'sleep');
  const medicationLogs = careLogs.filter(l => l.type === 'medication');

  // Calculate feeding totals
  const totalFeedingMl = feedingLogs.reduce((sum, log) => {
    return sum + (log.quantity || log.amount || 0);
  }, 0);

  // Calculate sleep totals
  const totalSleepMinutes = sleepLogs.reduce((sum, log) => {
    return sum + (log.duration || 0);
  }, 0);

  // Build recent logs summary (last 10)
  const recentLogs = careLogs.slice(0, 10).map(log => {
    const minutesAgo = getMinutesSince(log.timestamp);
    let description = '';
    
    if (log.type === 'feeding') {
      description = `Fed ${log.quantity || log.amount || '?'}ml`;
    } else if (log.type === 'sleep') {
      description = `Slept ${log.duration || '?'} minutes`;
    } else if (log.type === 'medication') {
      description = `${log.medicationGiven ? 'Gave' : 'Skipped'} ${log.medicineName || 'medication'}`;
    } else {
      description = log.notes || log.type;
    }

    return {
      type: log.type,
      description,
      minutes_ago: minutesAgo,
      time_str: formatTimeAgo(minutesAgo),
    };
  });

  return {
    total_logs: careLogs.length,
    feeding_count: feedingLogs.length,
    sleep_count: sleepLogs.length,
    medication_count: medicationLogs.length,
    total_feeding_ml: totalFeedingMl,
    total_sleep_minutes: totalSleepMinutes,
    recent_logs: recentLogs,
  };
}

/**
 * Format minutes into a readable time ago string
 */
function formatTimeAgo(minutes) {
  if (minutes === null || minutes === undefined) return 'unknown';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)}min ago`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}min ago` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
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

  // Fetch all data in parallel - expanded context window for comprehensive answers
  const [babyProfile, cryAnalysis, careLogs, reminders, prescriptions] = await Promise.all([
    fetchBabyProfile(babyId),
    fetchLatestCryAnalysis(babyId),
    fetchRecentCareLogs(babyId, 48),  // 48 hours of care logs for better context
    fetchActiveReminders(babyId),
    fetchActivePrescriptions(babyId),
  ]);

  if (!babyProfile) {
    return null;
  }

  const ageMonths = calculateAgeMonths(babyProfile.dob);
  const feedingContext = extractFeedingContext(careLogs);
  const sleepContext = extractSleepContext(careLogs);
  const medicationContext = extractMedicationContext(careLogs);
  const remindersSummary = buildRemindersSummary(reminders, careLogs);
  const careLogsSummary = buildCareLogsSummary(careLogs);

  return {
    baby_profile: {
      name: babyProfile.name || 'Baby',
      age_months: ageMonths,
      weight_kg: babyProfile.weight || null,
      is_premature: babyProfile.gestationalAge !== undefined && babyProfile.gestationalAge < 37,
      gestational_age_at_birth: babyProfile.gestationalAge || null,
      blood_type: babyProfile.bloodType || null,
      allergies: babyProfile.allergies || [],
      medical_conditions: babyProfile.medicalConditions || [],
    },

    recent_activity: {
      feeding: feedingContext,
      sleep: sleepContext,
      medication: medicationContext,
      all_logs: careLogsSummary,
    },

    prescriptions: prescriptions,

    latest_cry_analysis: formatCryAnalysisContext(cryAnalysis),

    active_reminders: remindersSummary,

    timestamp: new Date().toISOString(),
  };
}

/**
 * Format context as a detailed readable string for the prompt
 * Includes comprehensive information for accurate, personalized responses
 */
function formatContextForPrompt(context) {
  if (!context) {
    return 'No baby context available.';
  }

  let text = '';

  // =============================================
  // 👶 BABY PROFILE
  // =============================================
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👶 **BABY PROFILE**\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `• Name: ${context.baby_profile.name}\n`;
  text += `• Age: ${context.baby_profile.age_months} months old\n`;
  
  if (context.baby_profile.weight_kg) {
    text += `• Weight: ${context.baby_profile.weight_kg} kg\n`;
  }
  
  // Add age-specific context
  const ageMonths = context.baby_profile.age_months;
  if (ageMonths < 1) {
    text += `• Developmental Stage: 🌟 Newborn (0-4 weeks)\n`;
  } else if (ageMonths < 3) {
    text += `• Developmental Stage: 🌱 Young infant (1-3 months)\n`;
  } else if (ageMonths < 6) {
    text += `• Developmental Stage: 🌿 Infant (3-6 months)\n`;
  } else if (ageMonths < 12) {
    text += `• Developmental Stage: 🌳 Older infant (6-12 months)\n`;
  } else {
    text += `• Developmental Stage: 🚶 Toddler (12+ months)\n`;
  }
  
  if (context.baby_profile.is_premature) {
    text += `• ⚠️ Born Prematurely: Yes (at ${context.baby_profile.gestational_age_at_birth} weeks gestation)\n`;
    const correctedAge = context.baby_profile.age_months - Math.round((40 - context.baby_profile.gestational_age_at_birth) / 4);
    text += `• Corrected Age: ~${Math.max(0, correctedAge)} months\n`;
  }
  
  if (context.baby_profile.blood_type) {
    text += `• Blood Type: ${context.baby_profile.blood_type}\n`;
  }
  
  if (context.baby_profile.allergies && context.baby_profile.allergies.length > 0) {
    text += `• ⚠️ Known Allergies: ${context.baby_profile.allergies.join(', ')}\n`;
  }
  
  if (context.baby_profile.medical_conditions && context.baby_profile.medical_conditions.length > 0) {
    text += `• 🏥 Medical Conditions: ${context.baby_profile.medical_conditions.join(', ')}\n`;
  }
  text += '\n';

  // =============================================
  // 📊 CARE ACTIVITY SUMMARY (Last 48 hours)
  // =============================================
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📊 **CARE ACTIVITY SUMMARY** (Last 48 hours)\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  if (context.recent_activity.all_logs) {
    const logs = context.recent_activity.all_logs;
    text += `• Total Care Logs: ${logs.total_logs}\n`;
    text += `• 🍼 Feeding entries: ${logs.feeding_count} (Total: ${logs.total_feeding_ml || 0}ml)\n`;
    text += `• 😴 Sleep entries: ${logs.sleep_count} (Total: ${Math.round((logs.total_sleep_minutes || 0) / 60 * 10) / 10} hours)\n`;
    text += `• 💊 Medication entries: ${logs.medication_count}\n`;
    text += '\n';
    
    // Recent activity timeline
    if (logs.recent_logs && logs.recent_logs.length > 0) {
      text += `📋 **Recent Activity Timeline:**\n`;
      logs.recent_logs.forEach((log, i) => {
        const icon = log.type === 'feeding' ? '🍼' : log.type === 'sleep' ? '😴' : '💊';
        text += `   ${i + 1}. ${icon} ${log.description} — ${log.time_str}\n`;
      });
      text += '\n';
    }
  }

  // =============================================
  // 🍼 FEEDING STATUS
  // =============================================
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🍼 **FEEDING STATUS**\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (context.recent_activity.feeding.time_since_last_feed_minutes !== null) {
    const mins = context.recent_activity.feeding.time_since_last_feed_minutes;
    const hours = Math.floor(mins / 60);
    const remainingMins = Math.round(mins % 60);
    text += `• Last feeding: ${hours > 0 ? hours + 'h ' : ''}${remainingMins}min ago\n`;
    
    if (context.recent_activity.feeding.feeding_overdue) {
      text += `• ❌ STATUS: FEEDING OVERDUE (over 3 hours since last feed)\n`;
    } else if (mins < 60) {
      text += `• ✅ STATUS: Recently fed\n`;
    } else if (mins < 120) {
      text += `• ⏳ STATUS: May need feeding soon\n`;
    } else {
      text += `• ⚠️ STATUS: Should consider feeding\n`;
    }
  } else {
    text += `• No recent feeding data available\n`;
  }
  text += '\n';

  // =============================================
  // 😴 SLEEP STATUS
  // =============================================
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `😴 **SLEEP STATUS**\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if (context.recent_activity.sleep.last_sleep_end) {
    if (context.recent_activity.sleep.recently_woke_up) {
      text += `• 🌅 Just woke up (within last 30 minutes)\n`;
      text += `• STATUS: May be groggy or need comfort\n`;
    } else if (context.recent_activity.sleep.sleep_overdue) {
      text += `• ❌ SLEEP OVERDUE: Been awake for over 4 hours\n`;
      text += `• STATUS: Likely overtired, may need help settling\n`;
    } else {
      text += `• ✅ Normal awake time\n`;
    }
  } else {
    text += `• No recent sleep data available\n`;
  }
  text += '\n';

  // =============================================
  // 💊 MEDICATIONS & PRESCRIPTIONS
  // =============================================
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💊 **MEDICATIONS & PRESCRIPTIONS**\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  // Active prescriptions
  if (context.prescriptions && context.prescriptions.length > 0) {
    text += `**Active Prescriptions:**\n`;
    context.prescriptions.forEach((rx, i) => {
      text += `   ${i + 1}. 💉 ${rx.medicine_name}\n`;
      if (rx.dosage) text += `      • Dosage: ${rx.dosage}\n`;
      if (rx.frequency) text += `      • Frequency: ${rx.frequency}\n`;
      if (rx.instructions) text += `      • Instructions: ${rx.instructions}\n`;
    });
    text += '\n';
  } else {
    text += `• No active prescriptions\n`;
  }
  
  // Recent medication given
  if (context.recent_activity.medication && context.recent_activity.medication.recent_medications.length > 0) {
    text += `**Recent Medications Given:**\n`;
    context.recent_activity.medication.recent_medications.forEach((med, i) => {
      const status = med.given ? '✅ Given' : '❌ Skipped';
      text += `   ${i + 1}. ${med.name} — ${status} (${formatTimeAgoSimple(med.minutes_ago)})\n`;
    });
    text += '\n';
  }

  // =============================================
  // 🔊 LATEST CRY ANALYSIS
  // =============================================
  if (context.latest_cry_analysis) {
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🔊 **LATEST CRY ANALYSIS**\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    const conf = (context.latest_cry_analysis.confidence * 100).toFixed(0);
    text += `• Detected Pattern: **${context.latest_cry_analysis.final_label.toUpperCase()}** (${conf}% confidence)\n`;
    
    // Add interpretation
    const label = context.latest_cry_analysis.final_label.toLowerCase();
    if (label === 'hunger') {
      text += `• 🍼 Interpretation: Baby is likely hungry\n`;
    } else if (label === 'tired') {
      text += `• 😴 Interpretation: Baby is likely tired/sleepy\n`;
    } else if (label === 'belly_pain') {
      text += `• 😣 Interpretation: Baby may have gas or tummy discomfort\n`;
    } else if (label === 'burping') {
      text += `• 🫧 Interpretation: Baby may need to burp\n`;
    } else if (label === 'discomfort') {
      text += `• 😤 Interpretation: Baby may be uncomfortable (wet diaper, position, etc.)\n`;
    }
    
    if (context.latest_cry_analysis.explanation && context.latest_cry_analysis.explanation.length > 0) {
      text += `• Contributing factors: ${context.latest_cry_analysis.explanation.join('; ')}\n`;
    }
    text += '\n';
  }

  // =============================================
  // ⏰ ACTIVE ALERTS/REMINDERS
  // =============================================
  if (context.active_reminders && context.active_reminders.length > 0) {
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `⏰ **ACTIVE ALERTS/REMINDERS**\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context.active_reminders.forEach((reminder, i) => {
      text += `   ${i + 1}. 🔔 ${reminder}\n`;
    });
    text += '\n';
  }

  return text;
}

/**
 * Simple time ago formatter for inline use
 */
function formatTimeAgoSimple(minutes) {
  if (minutes === null || minutes === undefined) return 'unknown';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)}min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

module.exports = {
  buildChatbotContext,
  formatContextForPrompt,
  fetchBabyProfile,
  fetchLatestCryAnalysis,
  fetchRecentCareLogs,
  fetchActiveReminders,
  fetchActivePrescriptions,
};
