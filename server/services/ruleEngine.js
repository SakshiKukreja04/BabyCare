const { db, admin } = require('../firebaseAdmin');
const {
  getRulesByCategory,
  getRulesForBabyType,
  getRuleById,
} = require('../rules/feedingRules');
const { sendAlertNotification, sendReminderNotification } = require('./fcm');

/**
 * Rule Engine Service
 * 
 * Evaluates deterministic, static rules based on care logs
 * Creates alerts and reminders in Firestore when rules are violated
 * 
 * IMPORTANT CONSTRAINTS:
 * - This runs BEFORE any LLM/AI processing
 * - Rules are static, deterministic, and explainable
 * - NO medical diagnosis or predictions
 * - WHO-aligned, non-diagnostic monitoring only
 * 
 * ALERT SCHEMA:
 * {
 *   type: "feeding" | "sleep",
 *   severity: "HIGH" | "MEDIUM" | "LOW",
 *   message: String,
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp,
 *   isActive: Boolean,
 *   resolved: Boolean
 * }
 * 
 * CARE REMINDER SCHEMA:
 * {
 *   type: "feeding" | "sleep",
 *   message: String,
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp,
 *   isActive: Boolean
 * }
 * 
 * FCM RULES:
 * - Send FCM for HIGH severity alerts ONLY
 * - Send FCM for ALL care reminders
 * - Do NOT send FCM for MEDIUM/LOW alerts
 */

/**
 * Get today's time range (midnight-to-midnight) in local timezone
 * @returns {Object} { startOfDay: Date, endOfDay: Date }
 */
function getTodayTimeRange() {
  const now = new Date();
  
  // Start of today (midnight 00:00:00.000)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  
  // End of today (23:59:59.999)
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  return { startOfDay, endOfDay };
}

/**
 * Get time range for a specific number of hours ago
 * @param {number} hours - Number of hours to look back
 * @returns {Object} { startTime: Date, endTime: Date }
 */
function getHoursAgoRange(hours) {
  const now = new Date();
  const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return { startTime, endTime: now };
}

/**
 * Get baby profile and determine if premature
 * @param {string} babyId - Baby document ID
 * @returns {Promise<Object>} Baby data with isPremature flag
 */
async function getBabyProfile(babyId) {
  const babyRef = db.collection('babies').doc(babyId);
  const babyDoc = await babyRef.get();

  if (!babyDoc.exists) {
    throw new Error(`Baby ${babyId} not found`);
  }

  const babyData = babyDoc.data();
  const gestationalAge = babyData.gestationalAge || 40; // Default to full-term if not specified
  const isPremature = gestationalAge < 37;
  const babyType = isPremature ? 'PREMATURE' : 'FULL_TERM';

  return {
    ...babyData,
    id: babyDoc.id,
    isPremature,
    babyType,
    gestationalAge,
  };
}

/**
 * Evaluate all rules for a baby
 * Runs after any care log is created for real-time evaluation
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @returns {Promise<Object>} { alerts: Array, reminders: Array }
 */
async function evaluateAllRules(babyId, parentId) {
  const allAlerts = [];
  const allReminders = [];

  try {
    // Get baby profile first (determines premature status)
    const baby = await getBabyProfile(babyId);

    console.log(`🔄 Evaluating rules for ${baby.isPremature ? 'PREMATURE' : 'FULL-TERM'} baby ${babyId}`);

    // Evaluate each rule category
    const feedingResult = await evaluateFeedingRules(babyId, parentId, baby);
    const weightAlerts = await evaluateWeightRules(babyId, parentId, baby);
    const sleepResult = await evaluateSleepRules(babyId, parentId, baby);
    const medicationAlerts = await evaluateMedicationRules(babyId, parentId, baby);

    // Collect all alerts
    allAlerts.push(...(feedingResult.alerts || []));
    allAlerts.push(...weightAlerts);
    allAlerts.push(...(sleepResult.alerts || []));
    allAlerts.push(...medicationAlerts);

    // Collect all reminders
    allReminders.push(...(feedingResult.reminders || []));
    allReminders.push(...(sleepResult.reminders || []));

    console.log(`✅ Rule evaluation complete: ${allAlerts.length} alerts, ${allReminders.length} reminders`);

  } catch (error) {
    console.error('Error evaluating rules:', error);
    // Don't throw - rule evaluation failures shouldn't break the app
  }

  return { alerts: allAlerts, reminders: allReminders };
}

/**
 * Evaluate feeding rules for a baby
 * Creates alerts for feeding gaps and also care reminders
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @param {Object} baby - Baby profile data
 * @returns {Promise<Object>} { alerts: Array, reminders: Array }
 */
async function evaluateFeedingRules(babyId, parentId, baby) {
  const alerts = [];
  const reminders = [];

  try {
    // Get rules that apply to this baby type
    const applicableRules = getRulesForBabyType(baby.isPremature);
    const feedingRules = applicableRules.filter(r => r.category === 'feeding');

    if (feedingRules.length === 0) {
      return { alerts, reminders };
    }

    // Fetch feeding logs
    const careLogsRef = db.collection('careLogs');
    const feedingLogsQuery = await careLogsRef
      .where('parentId', '==', parentId)
      .where('type', '==', 'feeding')
      .limit(50)
      .get();

    // Get the delay threshold based on baby type
    const delayRule = baby.isPremature
      ? feedingRules.find(r => r.ruleId === 'feeding_delay_premature')
      : feedingRules.find(r => r.ruleId === 'feeding_delay');

    const thresholdHours = delayRule?.thresholdHours || (baby.isPremature ? 3 : 4);

    if (feedingLogsQuery.empty) {
      // No feeding logs at all - DON'T create alerts/reminders until user adds first log
      // User needs to add care logs before we can start monitoring
      console.log(`📋 [RuleEngine] No feeding logs for baby ${babyId} - skipping alerts until first log is added`);
      return { alerts, reminders };
    }

    // Filter by babyId and sort by timestamp
    const feedingLogs = feedingLogsQuery.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(log => log.babyId === babyId)
      .sort((a, b) => {
        const aTime = a.timestamp?.toMillis?.() || a.timestamp?.toDate?.()?.getTime() || 0;
        const bTime = b.timestamp?.toMillis?.() || b.timestamp?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 10);

    if (feedingLogs.length === 0) {
      // No feeding logs for this specific baby
      return { alerts, reminders };
    }

    const lastFeeding = feedingLogs[0];
    const lastFeedingTime = lastFeeding.timestamp?.toDate?.() || new Date(lastFeeding.timestamp);
    const now = new Date();
    const hoursSinceLastFeed = (now.getTime() - lastFeedingTime.getTime()) / (1000 * 60 * 60);

    // Evaluate FEEDING_DELAY rules (4 hours for full-term, 3 hours for premature)
    const babyTypeLabel = baby.isPremature ? 'premature' : 'full-term';

    if (delayRule && hoursSinceLastFeed > delayRule.thresholdHours) {
      // Create HIGH feeding alert with FCM
      const alert = await createAlert({
        babyId,
        parentId,
        ruleId: delayRule.ruleId,
        severity: 'HIGH', // Always HIGH for feeding delay
        alertType: 'feeding',
        title: delayRule.name,
        description: delayRule.description,
        triggerData: {
          checked: 'hoursSinceLastFeed',
          value: Math.round(hoursSinceLastFeed * 10) / 10,
          thresholdHours: delayRule.thresholdHours,
          lastFeedingTime: lastFeedingTime.toISOString(),
          hoursSinceLast: Math.round(hoursSinceLastFeed * 10) / 10,
          message: `⚠️ Feeding delayed for ${babyTypeLabel} baby. Last feeding was ${Math.round(hoursSinceLastFeed * 10) / 10} hours ago (threshold: ${delayRule.thresholdHours}h).`,
        },
      });
      alerts.push(alert);

      // Also create care reminder with triggerData for notifications
      const reminder = await createCareReminder({
        babyId,
        parentId,
        type: 'feeding',
        ruleId: `${delayRule.ruleId}_reminder`,
        message: `Time to feed your ${babyTypeLabel} baby. Last feeding was ${Math.round(hoursSinceLastFeed * 10) / 10} hours ago.`,
        triggerData: {
          hoursSinceLast: Math.round(hoursSinceLastFeed * 10) / 10,
          lastFeedTime: lastFeedingTime.toISOString(),
          thresholdHours: delayRule.thresholdHours,
        },
      });
      reminders.push(reminder);
    } else if (delayRule) {
      // Feeding is within threshold - resolve any existing alerts/reminders
      await resolveAlert(babyId, parentId, delayRule.ruleId);
      await resolveCareReminder(babyId, parentId, `${delayRule.ruleId}_reminder`);
    }

    // Evaluate FREQUENT_FEEDING rule
    if (feedingLogs.length >= 2) {
      const frequentRule = feedingRules.find(r => r.ruleId === 'frequent_feeding');
      if (frequentRule) {
        const secondLastFeeding = feedingLogs[1];
        const secondLastFeedingTime = secondLastFeeding.timestamp?.toDate?.() || new Date(secondLastFeeding.timestamp);
        const hoursBetweenFeeds = (lastFeedingTime.getTime() - secondLastFeedingTime.getTime()) / (1000 * 60 * 60);

        if (hoursBetweenFeeds < frequentRule.thresholdHours) {
          const alert = await createAlert({
            babyId,
            parentId,
            ruleId: frequentRule.ruleId,
            severity: frequentRule.severity,
            alertType: 'feeding',
            title: frequentRule.name,
            description: frequentRule.description,
            triggerData: {
              checked: 'hoursBetweenFeeds',
              value: Math.round(hoursBetweenFeeds * 10) / 10,
              thresholdHours: frequentRule.thresholdHours,
              message: `Feeds are ${Math.round(hoursBetweenFeeds * 10) / 10} hours apart, less than recommended ${frequentRule.thresholdHours} hour minimum.`,
            },
          });
          alerts.push(alert);
        } else {
          // Resolve if feeding is back to normal
          await resolveAlert(babyId, parentId, frequentRule.ruleId);
        }
      }
    }

    // SKIP LOW_FEED_QUANTITY rule for individual feeds
    // Small frequent feeds are okay - we focus on TOTAL daily feeding instead
    // Parents may give multiple small feeds which is acceptable
    const quantityRule = feedingRules.find(r => r.ruleId === 'low_feed_quantity');
    if (quantityRule) {
      // Just resolve any existing alert - we no longer track individual feed quantity
      await resolveAlert(babyId, parentId, quantityRule.ruleId);
    }

    // Evaluate LOW_DAILY_FEEDING_TOTAL rule
    // Severity based purely on amount:
    // < 75ml (50% of threshold) = HIGH (critical)
    // >= 75ml but < 150ml = MEDIUM
    const dailyTotalRule = feedingRules.find(r => r.ruleId === 'low_daily_feeding_total');
    if (dailyTotalRule) {
      // Calculate total feeding for TODAY (midnight-to-midnight)
      const { startOfDay, endOfDay } = getTodayTimeRange();
      
      console.log(`📅 [RuleEngine] Today's range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
      console.log(`📋 [RuleEngine] Total feeding logs available: ${feedingLogs.length}`);
      
      const todayFeedingLogs = feedingLogs.filter(log => {
        const logTime = log.timestamp?.toDate?.() || new Date(log.timestamp);
        const isToday = logTime >= startOfDay && logTime <= endOfDay && log.quantity;
        console.log(`   Log: ${logTime.toISOString()} - ${log.quantity}ml - isToday: ${isToday}`);
        return isToday;
      });

      const dailyTotalMl = todayFeedingLogs.reduce((sum, log) => sum + (log.quantity || 0), 0);
      const criticalThreshold = dailyTotalRule.criticalThresholdMl || 75; // Fixed at 75ml

      // DEBUG: Log the calculation
      console.log(`📊 [RuleEngine] Today's feeding logs: ${todayFeedingLogs.length}, Total: ${dailyTotalMl}ml`);
      console.log(`📊 [RuleEngine] Critical threshold: ${criticalThreshold}ml, Is critical: ${dailyTotalMl < criticalThreshold}`);

      if (dailyTotalMl > 0 && dailyTotalMl < dailyTotalRule.thresholdMl) {
        // Simple severity logic:
        // < 75ml = HIGH (critical)
        // >= 75ml but < 150ml = MEDIUM
        const isCritical = dailyTotalMl < criticalThreshold;
        const severity = isCritical ? 'HIGH' : 'MEDIUM';
        const alertTitle = isCritical ? 'Critical: Very Low Daily Feeding' : dailyTotalRule.name;
        
        console.log(`🚨 [RuleEngine] Creating alert with severity: ${severity} (isCritical: ${isCritical}, total: ${dailyTotalMl}ml < ${criticalThreshold}ml)`);
        
        const message = isCritical 
          ? `⚠️ CRITICAL: Total feeding today is only ${dailyTotalMl}ml (${Math.round(dailyTotalMl/dailyTotalRule.thresholdMl*100)}% of minimum). Baby needs to be fed immediately.`
          : `Total feeding today is ${dailyTotalMl}ml (${Math.round(dailyTotalMl/dailyTotalRule.thresholdMl*100)}% of ${dailyTotalRule.thresholdMl}ml minimum).`;
        
        const alert = await createAlert({
          babyId,
          parentId,
          ruleId: dailyTotalRule.ruleId,
          severity: severity,
          alertType: 'feeding',
          title: alertTitle,
          description: dailyTotalRule.description,
          triggerData: {
            checked: 'dailyTotalFeeding',
            value: dailyTotalMl,
            thresholdMl: dailyTotalRule.thresholdMl,
            criticalThresholdMl: criticalThreshold,
            isCritical: isCritical,
            feedCount: todayFeedingLogs.length,
            message: message,
          },
        });
        alerts.push(alert);
      } else if (dailyTotalMl >= dailyTotalRule.thresholdMl) {
        await resolveAlert(babyId, parentId, dailyTotalRule.ruleId);
      }
    }

  } catch (error) {
    console.error('Error evaluating feeding rules:', error);
  }

  return { alerts, reminders };
}

/**
 * Evaluate weight monitoring rules
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @param {Object} baby - Baby profile data
 * @returns {Promise<Array>} Array of created alerts
 */
async function evaluateWeightRules(babyId, parentId, baby) {
  const alerts = [];

  try {
    const applicableRules = getRulesForBabyType(baby.isPremature);
    const weightRules = applicableRules.filter(r => r.category === 'weight');

    if (weightRules.length === 0) {
      return alerts;
    }

    // Check when weight was last updated in baby profile
    const babyRef = db.collection('babies').doc(babyId);
    const babyDoc = await babyRef.get();
    const babyData = babyDoc.data();

    // Check if there's a weightUpdateTimestamp field, or use updatedAt
    const lastWeightUpdate = babyData.weightUpdateTimestamp?.toDate?.() ||
                            babyData.updatedAt?.toDate?.() ||
                            babyData.createdAt?.toDate?.() ||
                            null;

    if (!lastWeightUpdate) {
      // No weight tracking data
      const weightRule = weightRules.find(r => r.ruleId === 'weight_not_updated');
      if (weightRule) {
        const alert = await createAlert({
          babyId,
          parentId,
          ruleId: weightRule.ruleId,
          severity: weightRule.severity,
          title: weightRule.name,
          description: weightRule.description,
          triggerData: {
            checked: 'lastWeightUpdate',
            value: 'never_updated',
            thresholdDays: weightRule.thresholdDays,
            message: 'Weight has not been tracked. Please update weight regularly for growth monitoring.',
          },
        });
        alerts.push(alert);
      }
      return alerts;
    }

    const now = new Date();
    const daysSinceUpdate = (now.getTime() - lastWeightUpdate.getTime()) / (1000 * 60 * 60 * 24);

    const weightRule = weightRules.find(r => r.ruleId === 'weight_not_updated');
    if (weightRule && daysSinceUpdate > weightRule.thresholdDays) {
      const alert = await createAlert({
        babyId,
        parentId,
        ruleId: weightRule.ruleId,
        severity: weightRule.severity,
        title: weightRule.name,
        description: weightRule.description,
        triggerData: {
          checked: 'daysSinceWeightUpdate',
          value: Math.round(daysSinceUpdate * 10) / 10,
          thresholdDays: weightRule.thresholdDays,
          lastWeightUpdate: lastWeightUpdate.toISOString(),
          message: `Weight was last updated ${Math.round(daysSinceUpdate)} days ago, exceeding recommended interval of ${weightRule.thresholdDays} days.`,
        },
      });
      alerts.push(alert);
    }

  } catch (error) {
    console.error('Error evaluating weight rules:', error);
  }

  return alerts;
}

/**
 * Evaluate sleep duration rules
 * Creates alerts and reminders for sleep tracking
 * Uses daily time window (12:00 AM - 11:59 PM, same day only)
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @param {Object} baby - Baby profile data
 * @returns {Promise<Object>} { alerts: Array, reminders: Array }
 */
async function evaluateSleepRules(babyId, parentId, baby) {
  const alerts = [];
  const reminders = [];

  try {
    const applicableRules = getRulesForBabyType(baby.isPremature);
    const sleepRules = applicableRules.filter(r => r.category === 'sleep');

    const sleepRule = sleepRules.find(r => r.ruleId === 'low_sleep_duration');
    const thresholdHours = sleepRule?.thresholdHours || 10;

    // Fetch sleep logs from today
    const careLogsRef = db.collection('careLogs');
    const sleepLogsQuery = await careLogsRef
      .where('parentId', '==', parentId)
      .where('type', '==', 'sleep')
      .limit(100)
      .get();

    // Filter by babyId and today's date (midnight-to-midnight)
    const { startOfDay, endOfDay } = getTodayTimeRange();

    const allSleepLogs = sleepLogsQuery.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(log => log.babyId === babyId);

    const todaySleepLogs = allSleepLogs.filter(log => {
      const logTime = log.timestamp?.toDate?.() || new Date(log.timestamp);
      return logTime >= startOfDay && logTime <= endOfDay;
    });

    // CASE 1: No sleep logs today at all
    if (todaySleepLogs.length === 0) {
      // If there are no sleep logs at all (baby was just registered), skip alerts
      if (allSleepLogs.length === 0) {
        console.log(`📋 [RuleEngine] No sleep logs for baby ${babyId} - skipping alerts until first log is added`);
        return { alerts, reminders };
      }
      
      // User has logged sleep before but not today - create reminder only
      const reminder = await createCareReminder({
        babyId,
        parentId,
        type: 'sleep',
        ruleId: 'no_sleep_log_today',
        message: 'No sleep log added today. Please track your baby\'s sleep.',
        triggerData: {
          totalSleepHours: 0,
          recommendedHours: thresholdHours,
        },
      });
      reminders.push(reminder);

      return { alerts, reminders };
    }

    // CASE 2: Sleep logs exist - calculate total
    const totalSleepMinutes = todaySleepLogs.reduce((sum, log) => {
      return sum + (log.duration || 0); // duration is in minutes
    }, 0);

    const totalSleepHours = totalSleepMinutes / 60;

    // Check if sleep is below recommended minimum
    if (sleepRule && totalSleepHours < thresholdHours) {
      // Create alert for low sleep
      const alert = await createAlert({
        babyId,
        parentId,
        ruleId: sleepRule.ruleId,
        severity: sleepRule.severity,
        alertType: 'sleep',
        title: sleepRule.name,
        description: sleepRule.description,
        triggerData: {
          checked: 'totalSleepHoursToday',
          value: Math.round(totalSleepHours * 10) / 10,
          thresholdHours,
          totalSleepMinutes,
          sleepCount: todaySleepLogs.length,
          message: `Baby slept less than recommended duration today. Total: ${Math.round(totalSleepHours * 10) / 10} hours (minimum: ${thresholdHours} hours).`,
        },
      });
      alerts.push(alert);

      // Also create a reminder with triggerData for notifications
      const reminder = await createCareReminder({
        babyId,
        parentId,
        type: 'sleep',
        ruleId: 'low_sleep_reminder',
        message: `Baby sleep is below recommended. Total today: ${Math.round(totalSleepHours * 10) / 10} hours (needs ${thresholdHours} hours).`,
        triggerData: {
          totalSleepHours: Math.round(totalSleepHours * 10) / 10,
          recommendedHours: thresholdHours,
          sleepCount: todaySleepLogs.length,
        },
      });
      reminders.push(reminder);
    } else if (sleepRule) {
      // Sleep is sufficient - resolve any existing alerts/reminders
      await resolveAlert(babyId, parentId, sleepRule.ruleId);
      await resolveCareReminder(babyId, parentId, 'no_sleep_log_today');
      await resolveCareReminder(babyId, parentId, 'low_sleep_reminder');
    }

  } catch (error) {
    console.error('Error evaluating sleep rules:', error);
  }

  return { alerts, reminders };
}

/**
 * Evaluate medication adherence rules
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @param {Object} baby - Baby profile data
 * @returns {Promise<Array>} Array of created alerts
 */
async function evaluateMedicationRules(babyId, parentId, baby) {
  const alerts = [];

  try {
    const applicableRules = getRulesForBabyType(baby.isPremature);
    const medicationRules = applicableRules.filter(r => r.category === 'medication');

    if (medicationRules.length === 0) {
      return alerts;
    }

    // CRITICAL: Check if user has any confirmed prescriptions first
    // If no prescriptions exist, skip medication alerts/reminders entirely
    const prescriptionsQuery = await db.collection('prescriptions')
      .where('parentId', '==', parentId)
      .where('babyId', '==', babyId)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get();

    if (prescriptionsQuery.empty) {
      // No prescriptions - skip all medication rules
      // User will add medicines first, then reminders will work
      console.log(`[RuleEngine] No confirmed prescriptions for baby ${babyId}, skipping medication rules`);
      return alerts;
    }

    // Note: This is a simplified implementation
    // In a full system, you would check against a medication schedule
    // For now, we check if medication logs exist and if they're being tracked

    const careLogsRef = db.collection('careLogs');
    const medicationLogsQuery = await careLogsRef
      .where('parentId', '==', parentId)
      .where('type', '==', 'medication')
      .limit(50)
      .get();

    // Filter by babyId and check last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 60 * 60 * 24 * 1000);

    const medicationLogs = medicationLogsQuery.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(log => {
        if (log.babyId !== babyId) return false;
        const logTime = log.timestamp?.toDate?.() || new Date(log.timestamp);
        return logTime >= sevenDaysAgo;
      })
      .sort((a, b) => {
        const aTime = a.timestamp?.toMillis?.() || a.timestamp?.toDate?.()?.getTime() || 0;
        const bTime = b.timestamp?.toMillis?.() || b.timestamp?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });

    // For now, we check if there are any medication logs marked as not given
    // In a full implementation, this would check against a medication schedule
    const medicationRule = medicationRules.find(r => r.ruleId === 'medication_missed');
    
    // This is a placeholder - in production, you'd check against actual medication schedules
    // For now, we'll skip this rule as it requires medication scheduling data
    
  } catch (error) {
    console.error('Error evaluating medication rules:', error);
  }

  return alerts;
}

/**
 * Create an alert document in Firestore
 * Sends FCM push notification ONLY for HIGH severity alerts
 * @param {Object} alertData - Alert data
 * @returns {Promise<Object>} Created alert document
 */
async function createAlert(alertData) {
  const { babyId, parentId, ruleId, severity, title, description, triggerData, alertType = 'feeding' } = alertData;

  // Normalize severity to uppercase for consistency
  const normalizedSeverity = (severity || 'MEDIUM').toUpperCase();
  
  console.log(`📝 [createAlert] Called with ruleId: ${ruleId}, severity: ${severity} → normalized: ${normalizedSeverity}`);

  // Check if alert already exists (avoid duplicates)
  const existingAlertsQuery = await db.collection('alerts')
    .where('babyId', '==', babyId)
    .where('parentId', '==', parentId)
    .where('ruleId', '==', ruleId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existingAlertsQuery.empty) {
    // Alert already exists, update it including severity and title
    const existingAlert = existingAlertsQuery.docs[0];
    const existingData = existingAlert.data();
    const previousSeverity = existingData.severity;
    
    console.log(`🔄 [createAlert] Updating existing alert ${existingAlert.id}: ${previousSeverity} → ${normalizedSeverity}`);
    
    // Update the alert with new severity, title, and triggerData
    await existingAlert.ref.update({
      severity: normalizedSeverity,
      title: title,
      description: description,
      triggerData: triggerData || {},
      message: triggerData?.message || description,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // If severity changed to HIGH, send FCM notification
    if (normalizedSeverity === 'HIGH' && previousSeverity !== 'HIGH') {
      console.log(`⬆️ [createAlert] Severity upgraded to HIGH! Sending FCM...`);
      try {
        const updatedAlertDoc = {
          id: existingAlert.id,
          ...existingData,
          severity: normalizedSeverity,
          title: title,
          triggerData: triggerData || {},
        };
        await sendAlertNotification(parentId, updatedAlertDoc);
        console.log(`🔔 FCM notification sent - Alert upgraded to HIGH: ${existingAlert.id}`);
      } catch (fcmError) {
        console.error('Failed to send FCM notification for upgraded alert:', fcmError.message);
      }
    }
    
    return {
      id: existingAlert.id,
      ...existingData,
      severity: normalizedSeverity,
      title: title,
      triggerData: triggerData || {},
      isNew: false, // Indicates this was an existing alert that was updated
    };
  }

  const alertRef = db.collection('alerts').doc();
  
  const alertDoc = {
    id: alertRef.id,
    babyId,
    parentId,
    ruleId,
    type: alertType, // "feeding" | "sleep"
    severity: normalizedSeverity, // "HIGH" | "MEDIUM" | "LOW"
    title,
    description,
    message: triggerData?.message || description,
    triggerData: triggerData || {},
    isActive: true,
    resolved: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await alertRef.set(alertDoc);

  // Send FCM notification ONLY for HIGH severity alerts
  if (normalizedSeverity === 'HIGH') {
    try {
      await sendAlertNotification(parentId, alertDoc);
      console.log(`🔔 FCM notification sent for HIGH alert ${alertDoc.id}`);
    } catch (fcmError) {
      // Log but don't fail - notifications are not critical to alert creation
      console.error('Failed to send FCM notification:', fcmError.message);
    }
  } else {
    console.log(`📝 Alert created (${normalizedSeverity}) - No FCM sent (only HIGH alerts trigger FCM)`);
  }

  return {
    ...alertDoc,
    isNew: true, // Indicates this is a new alert
  };
}

/**
 * Create a care reminder document in Firestore
 * Sends FCM push notification for ALL reminders
 * @param {Object} reminderData - Reminder data
 * @returns {Promise<Object>} Created reminder document
 */
async function createCareReminder(reminderData) {
  const { babyId, parentId, type, message, ruleId, triggerData = {} } = reminderData;

  // Check if reminder already exists (avoid duplicates)
  const existingRemindersQuery = await db.collection('careReminders')
    .where('babyId', '==', babyId)
    .where('parentId', '==', parentId)
    .where('ruleId', '==', ruleId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (!existingRemindersQuery.empty) {
    // Reminder already exists, update it instead of creating duplicate
    const existingReminder = existingRemindersQuery.docs[0];
    await existingReminder.ref.update({
      message,
      triggerData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
      id: existingReminder.id,
      ...existingReminder.data(),
      message,
      triggerData,
      isNew: false,
    };
  }

  const reminderRef = db.collection('careReminders').doc();
  
  const reminderDoc = {
    id: reminderRef.id,
    babyId,
    parentId,
    ruleId,
    type, // "feeding" | "sleep"
    message,
    triggerData, // Metadata for notifications
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await reminderRef.set(reminderDoc);

  // Send FCM notification for ALL reminders
  try {
    await sendReminderNotification(parentId, reminderDoc);
    console.log(`🔔 FCM notification sent for reminder ${reminderDoc.id}`);
  } catch (fcmError) {
    console.error('Failed to send FCM reminder notification:', fcmError.message);
  }

  return {
    ...reminderDoc,
    isNew: true,
  };
}

/**
 * Resolve/deactivate an alert when condition is met
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @param {string} ruleId - Rule ID to resolve
 */
async function resolveAlert(babyId, parentId, ruleId) {
  try {
    const alertsQuery = await db.collection('alerts')
      .where('babyId', '==', babyId)
      .where('parentId', '==', parentId)
      .where('ruleId', '==', ruleId)
      .where('isActive', '==', true)
      .get();

    const batch = db.batch();
    alertsQuery.docs.forEach(doc => {
      batch.update(doc.ref, {
        isActive: false,
        resolved: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    if (!alertsQuery.empty) {
      await batch.commit();
      console.log(`✅ Resolved ${alertsQuery.size} alert(s) for rule ${ruleId}`);
    }
  } catch (error) {
    console.error('Error resolving alert:', error);
  }
}

/**
 * Resolve/deactivate a care reminder when condition is met
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @param {string} ruleId - Rule ID to resolve
 */
async function resolveCareReminder(babyId, parentId, ruleId) {
  try {
    const remindersQuery = await db.collection('careReminders')
      .where('babyId', '==', babyId)
      .where('parentId', '==', parentId)
      .where('ruleId', '==', ruleId)
      .where('isActive', '==', true)
      .get();

    const batch = db.batch();
    remindersQuery.docs.forEach(doc => {
      batch.update(doc.ref, {
        isActive: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    if (!remindersQuery.empty) {
      await batch.commit();
      console.log(`✅ Resolved ${remindersQuery.size} care reminder(s) for rule ${ruleId}`);
    }
  } catch (error) {
    console.error('Error resolving care reminder:', error);
  }
}

/**
 * Get baby profile with type classification
 * Exposed for frontend dashboard use
 */
async function getBabyWithType(babyId) {
  return await getBabyProfile(babyId);
}

/**
 * Evaluate baby status for dashboard display
 * Returns whether baby status is "All Good" or has active alerts
 * 
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @returns {Promise<Object>} { isAllGood: boolean, reasons: string[], activeAlerts: Array, summary: string }
 */
async function evaluateBabyStatus(babyId, parentId) {
  try {
    // Fetch all unresolved alerts for this baby
    const alertsQuery = await db.collection('alerts')
      .where('babyId', '==', babyId)
      .where('parentId', '==', parentId)
      .where('resolved', '==', false)
      .get();

    const activeAlerts = alertsQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Build reasons list from active alerts
    const reasons = activeAlerts.map(alert => {
      const message = alert.triggerData?.message || alert.title || alert.description;
      return message;
    });

    // Determine severity level (alerts are stored with uppercase severity)
    const hasHighSeverity = activeAlerts.some(alert => {
      const severity = (alert.severity || '').toUpperCase();
      return severity === 'HIGH';
    });
    const hasMediumSeverity = activeAlerts.some(alert => {
      const severity = (alert.severity || '').toUpperCase();
      return severity === 'MEDIUM';
    });
    
    let overallSeverity = 'none';
    if (hasHighSeverity) {
      overallSeverity = 'high';
    } else if (hasMediumSeverity) {
      overallSeverity = 'medium';
    } else if (activeAlerts.length > 0) {
      overallSeverity = 'low';
    }

    // Build summary message
    let summary = 'All Good';
    if (activeAlerts.length === 1) {
      summary = reasons[0] || 'There is 1 active alert';
    } else if (activeAlerts.length > 1) {
      summary = `There are ${activeAlerts.length} active alerts requiring attention`;
    }

    return {
      isAllGood: activeAlerts.length === 0,
      reasons,
      activeAlerts,
      alertCount: activeAlerts.length,
      overallSeverity,
      summary,
    };
  } catch (error) {
    console.error('Error evaluating baby status:', error);
    return {
      isAllGood: true,
      reasons: [],
      activeAlerts: [],
      alertCount: 0,
      overallSeverity: 'none',
      summary: 'Unable to evaluate status',
    };
  }
}

module.exports = {
  evaluateAllRules,
  evaluateFeedingRules,
  evaluateWeightRules,
  evaluateSleepRules,
  evaluateMedicationRules,
  evaluateBabyStatus,
  getBabyProfile,
  getBabyWithType,
  getTodayTimeRange,
  getHoursAgoRange,
  createAlert,
  createCareReminder,
  resolveAlert,
  resolveCareReminder,
};
