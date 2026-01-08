const { db, admin } = require('../firebaseAdmin');
const {
  getRulesByCategory,
  getRulesForBabyType,
  getRuleById,
} = require('../rules/feedingRules');

/**
 * Rule Engine Service
 * 
 * Evaluates deterministic, static rules based on care logs
 * Creates alerts in Firestore when rules are violated
 * 
 * IMPORTANT CONSTRAINTS:
 * - This runs BEFORE any LLM/AI processing
 * - Rules are static, deterministic, and explainable
 * - NO medical diagnosis or predictions
 * - WHO-aligned, non-diagnostic monitoring only
 */

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
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @returns {Promise<Array>} Array of created alerts
 */
async function evaluateAllRules(babyId, parentId) {
  const alerts = [];

  try {
    // Get baby profile first (determines premature status)
    const baby = await getBabyProfile(babyId);

    // Evaluate each rule category
    const feedingAlerts = await evaluateFeedingRules(babyId, parentId, baby);
    const weightAlerts = await evaluateWeightRules(babyId, parentId, baby);
    const sleepAlerts = await evaluateSleepRules(babyId, parentId, baby);
    const medicationAlerts = await evaluateMedicationRules(babyId, parentId, baby);

    alerts.push(...feedingAlerts);
    alerts.push(...weightAlerts);
    alerts.push(...sleepAlerts);
    alerts.push(...medicationAlerts);

  } catch (error) {
    console.error('Error evaluating rules:', error);
    // Don't throw - rule evaluation failures shouldn't break the app
  }

  return alerts;
}

/**
 * Evaluate feeding rules for a baby
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @param {Object} baby - Baby profile data
 * @returns {Promise<Array>} Array of created alerts
 */
async function evaluateFeedingRules(babyId, parentId, baby) {
  const alerts = [];

  try {
    // Get rules that apply to this baby type
    const applicableRules = getRulesForBabyType(baby.isPremature);
    const feedingRules = applicableRules.filter(r => r.category === 'feeding');

    if (feedingRules.length === 0) {
      return alerts;
    }

    // Fetch feeding logs
    const careLogsRef = db.collection('careLogs');
    const feedingLogsQuery = await careLogsRef
      .where('parentId', '==', parentId)
      .where('type', '==', 'feeding')
      .limit(50)
      .get();

    if (feedingLogsQuery.empty) {
      // No feeding logs - check for FEEDING_DELAY rule
      const delayRule = baby.isPremature
        ? feedingRules.find(r => r.ruleId === 'feeding_delay_premature')
        : feedingRules.find(r => r.ruleId === 'feeding_delay');

      if (delayRule) {
        const alert = await createAlert({
          babyId,
          parentId,
          ruleId: delayRule.ruleId,
          severity: delayRule.severity,
          title: delayRule.name,
          description: delayRule.description,
          triggerData: {
            checked: 'lastFeedingTime',
            value: 'no_feeding_logs',
            thresholdHours: delayRule.thresholdHours,
            message: 'No feeding logs found. Please log feedings regularly.',
          },
        });
        alerts.push(alert);
      }
      return alerts;
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

    const lastFeeding = feedingLogs[0];
    const lastFeedingTime = lastFeeding.timestamp?.toDate?.() || new Date(lastFeeding.timestamp);
    const now = new Date();
    const hoursSinceLastFeed = (now.getTime() - lastFeedingTime.getTime()) / (1000 * 60 * 60);

    // Evaluate FEEDING_DELAY rules
    const delayRule = baby.isPremature
      ? feedingRules.find(r => r.ruleId === 'feeding_delay_premature')
      : feedingRules.find(r => r.ruleId === 'feeding_delay');

    if (delayRule && hoursSinceLastFeed > delayRule.thresholdHours) {
      const alert = await createAlert({
        babyId,
        parentId,
        ruleId: delayRule.ruleId,
        severity: delayRule.severity,
        title: delayRule.name,
        description: delayRule.description,
        triggerData: {
          checked: 'hoursSinceLastFeed',
          value: Math.round(hoursSinceLastFeed * 10) / 10,
          thresholdHours: delayRule.thresholdHours,
          lastFeedingTime: lastFeedingTime.toISOString(),
          message: `Last feeding was ${Math.round(hoursSinceLastFeed * 10) / 10} hours ago, exceeding threshold of ${delayRule.thresholdHours} hours.`,
        },
      });
      alerts.push(alert);
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
        }
      }
    }

    // Evaluate LOW_FEED_QUANTITY rule (individual feed)
    const quantityRule = feedingRules.find(r => r.ruleId === 'low_feed_quantity');
    if (quantityRule && lastFeeding.quantity && lastFeeding.quantity < quantityRule.thresholdMl) {
      const alert = await createAlert({
        babyId,
        parentId,
        ruleId: quantityRule.ruleId,
        severity: quantityRule.severity,
        title: quantityRule.name,
        description: quantityRule.description,
        triggerData: {
          checked: 'feedQuantity',
          value: lastFeeding.quantity,
          thresholdMl: quantityRule.thresholdMl,
          message: `Feed quantity of ${lastFeeding.quantity}ml is below recommended minimum of ${quantityRule.thresholdMl}ml.`,
        },
      });
      alerts.push(alert);
    }

    // Evaluate LOW_DAILY_FEEDING_TOTAL rule
    const dailyTotalRule = feedingRules.find(r => r.ruleId === 'low_daily_feeding_total');
    if (dailyTotalRule) {
      // Calculate total feeding for last 24 hours
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const todayFeedingLogs = feedingLogs.filter(log => {
        const logTime = log.timestamp?.toDate?.() || new Date(log.timestamp);
        return logTime >= twentyFourHoursAgo && log.quantity;
      });

      const dailyTotalMl = todayFeedingLogs.reduce((sum, log) => sum + (log.quantity || 0), 0);

      if (dailyTotalMl > 0 && dailyTotalMl < dailyTotalRule.thresholdMl) {
        const alert = await createAlert({
          babyId,
          parentId,
          ruleId: dailyTotalRule.ruleId,
          severity: dailyTotalRule.severity,
          title: dailyTotalRule.name,
          description: dailyTotalRule.description,
          triggerData: {
            checked: 'dailyTotalFeeding',
            value: dailyTotalMl,
            thresholdMl: dailyTotalRule.thresholdMl,
            feedCount: todayFeedingLogs.length,
            message: `Total daily feeding is ${dailyTotalMl}ml, which is below the recommended minimum of ${dailyTotalRule.thresholdMl}ml per day.`,
          },
        });
        alerts.push(alert);
      }
    }

  } catch (error) {
    console.error('Error evaluating feeding rules:', error);
  }

  return alerts;
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
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @param {Object} baby - Baby profile data
 * @returns {Promise<Array>} Array of created alerts
 */
async function evaluateSleepRules(babyId, parentId, baby) {
  const alerts = [];

  try {
    const applicableRules = getRulesForBabyType(baby.isPremature);
    const sleepRules = applicableRules.filter(r => r.category === 'sleep');

    if (sleepRules.length === 0) {
      return alerts;
    }

    // Fetch sleep logs from last 24 hours
    const careLogsRef = db.collection('careLogs');
    const sleepLogsQuery = await careLogsRef
      .where('parentId', '==', parentId)
      .where('type', '==', 'sleep')
      .limit(100)
      .get();

    if (sleepLogsQuery.empty) {
      return alerts;
    }

    // Filter by babyId and last 24 hours
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const sleepLogs = sleepLogsQuery.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(log => {
        if (log.babyId !== babyId) return false;
        const logTime = log.timestamp?.toDate?.() || new Date(log.timestamp);
        return logTime >= twentyFourHoursAgo;
      });

    // Calculate total sleep duration in hours
    const totalSleepMinutes = sleepLogs.reduce((sum, log) => {
      return sum + (log.duration || 0); // duration is in minutes
    }, 0);

    const totalSleepHours = totalSleepMinutes / 60;

    const sleepRule = sleepRules.find(r => r.ruleId === 'low_sleep_duration');
    if (sleepRule && totalSleepHours < sleepRule.thresholdHours) {
      const alert = await createAlert({
        babyId,
        parentId,
        ruleId: sleepRule.ruleId,
        severity: sleepRule.severity,
        title: sleepRule.name,
        description: sleepRule.description,
        triggerData: {
          checked: 'totalSleepHours24h',
          value: Math.round(totalSleepHours * 10) / 10,
          thresholdHours: sleepRule.thresholdHours,
          totalSleepMinutes,
          message: `Total logged sleep in last 24 hours is ${Math.round(totalSleepHours * 10) / 10} hours, below recommended minimum of ${sleepRule.thresholdHours} hours.`,
        },
      });
      alerts.push(alert);
    }

  } catch (error) {
    console.error('Error evaluating sleep rules:', error);
  }

  return alerts;
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
 * @param {Object} alertData - Alert data
 * @returns {Promise<Object>} Created alert document
 */
async function createAlert(alertData) {
  const { babyId, parentId, ruleId, severity, title, description, triggerData } = alertData;

  // Check if alert already exists (avoid duplicates)
  const existingAlertsQuery = await db.collection('alerts')
    .where('babyId', '==', babyId)
    .where('parentId', '==', parentId)
    .where('ruleId', '==', ruleId)
    .where('resolved', '==', false)
    .limit(1)
    .get();

  if (!existingAlertsQuery.empty) {
    // Alert already exists, update it instead of creating duplicate
    const existingAlert = existingAlertsQuery.docs[0];
    await existingAlert.ref.update({
      triggerData: triggerData || {},
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
      id: existingAlert.id,
      ...existingAlert.data(),
      triggerData: triggerData || {},
    };
  }

  const alertRef = db.collection('alerts').doc();
  
  const alertDoc = {
    id: alertRef.id,
    babyId,
    parentId,
    ruleId,
    severity,
    title,
    description,
    triggerData: triggerData || {},
    resolved: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await alertRef.set(alertDoc);

  return alertDoc;
}

/**
 * Get baby profile with type classification
 * Exposed for frontend dashboard use
 */
async function getBabyWithType(babyId) {
  return await getBabyProfile(babyId);
}

module.exports = {
  evaluateAllRules,
  evaluateFeedingRules,
  evaluateWeightRules,
  evaluateSleepRules,
  evaluateMedicationRules,
  getBabyProfile,
  getBabyWithType,
  createAlert,
};
