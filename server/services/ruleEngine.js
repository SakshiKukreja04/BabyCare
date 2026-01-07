const { db, admin } = require('../firebaseAdmin');
const { getAllRules } = require('../rules/feedingRules');

/**
 * Rule Engine Service
 * Evaluates deterministic rules based on care logs
 * Creates alerts in Firestore when rules are violated
 * 
 * IMPORTANT: This runs BEFORE any LLM/AI processing
 * Rules are static, deterministic, and explainable
 */

/**
 * Evaluate feeding rules for a baby
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID
 * @returns {Promise<Array>} Array of created alerts
 */
async function evaluateFeedingRules(babyId, parentId) {
  const alerts = [];

  try {
    // Fetch last feeding logs for this baby
    // Filter by parentId first, then filter and sort client-side to avoid composite index
    const careLogsRef = db.collection('careLogs');
    const feedingLogsQuery = await careLogsRef
      .where('parentId', '==', parentId)
      .where('type', '==', 'feeding')
      .limit(50) // Get more than needed, then filter client-side
      .get();

    if (feedingLogsQuery.empty) {
      // No feeding logs yet, no rules to evaluate
      return alerts;
    }

    // Filter by babyId and sort by timestamp client-side
    const feedingLogs = feedingLogsQuery.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(log => log.babyId === babyId)
      .sort((a, b) => {
        // Sort by timestamp descending (newest first)
        const aTime = a.timestamp?.toMillis?.() || a.timestamp?.toDate?.()?.getTime() || 0;
        const bTime = b.timestamp?.toMillis?.() || b.timestamp?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 10); // Limit to 10 most recent

    const lastFeeding = feedingLogs[0];
    const lastFeedingTime = lastFeeding.timestamp?.toDate() || new Date(lastFeeding.timestamp);
    const now = new Date();
    const hoursSinceLastFeed = (now - lastFeedingTime) / (1000 * 60 * 60);

    // Get all feeding rules
    const rules = getAllRules();

    // Evaluate FEEDING_DELAY rule
    const delayRule = rules.find(r => r.id === 'feeding_delay');
    if (delayRule && hoursSinceLastFeed > delayRule.thresholdHours) {
      const alert = await createAlert({
        babyId,
        parentId,
        ruleId: delayRule.id,
        severity: delayRule.severity,
        title: delayRule.name,
        description: delayRule.description,
        triggerData: {
          hoursSinceLastFeed: Math.round(hoursSinceLastFeed * 10) / 10,
          thresholdHours: delayRule.thresholdHours,
          lastFeedingTime: lastFeedingTime.toISOString(),
        },
      });
      alerts.push(alert);
    }

    // Evaluate FREQUENT_FEEDING rule (if there are at least 2 logs)
    if (feedingLogs.length >= 2) {
      const frequentRule = rules.find(r => r.id === 'frequent_feeding');
      if (frequentRule) {
        const secondLastFeeding = feedingLogs[1];
        const secondLastFeedingTime = secondLastFeeding.timestamp?.toDate() || new Date(secondLastFeeding.timestamp);
        const hoursBetweenFeeds = (lastFeedingTime - secondLastFeedingTime) / (1000 * 60 * 60);

        if (hoursBetweenFeeds < frequentRule.thresholdHours) {
          const alert = await createAlert({
            babyId,
            parentId,
            ruleId: frequentRule.id,
            severity: frequentRule.severity,
            title: frequentRule.name,
            description: frequentRule.description,
            triggerData: {
              hoursBetweenFeeds: Math.round(hoursBetweenFeeds * 10) / 10,
              thresholdHours: frequentRule.thresholdHours,
            },
          });
          alerts.push(alert);
        }
      }
    }

    // Evaluate LOW_FEED_QUANTITY rule
    const quantityRule = rules.find(r => r.id === 'low_feed_quantity');
    if (quantityRule && lastFeeding.quantity && lastFeeding.quantity < quantityRule.thresholdMl) {
      const alert = await createAlert({
        babyId,
        parentId,
        ruleId: quantityRule.id,
        severity: quantityRule.severity,
        title: quantityRule.name,
        description: quantityRule.description,
        triggerData: {
          feedQuantity: lastFeeding.quantity,
          thresholdMl: quantityRule.thresholdMl,
        },
      });
      alerts.push(alert);
    }

  } catch (error) {
    console.error('Error evaluating feeding rules:', error);
    // Don't throw - rule evaluation failures shouldn't break the app
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

module.exports = {
  evaluateFeedingRules,
  createAlert,
};

