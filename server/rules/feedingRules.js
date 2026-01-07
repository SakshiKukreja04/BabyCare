/**
 * Deterministic, static, explainable feeding rules
 * These rules are NOT user-editable and run server-side
 */

const FEEDING_RULES = {
  FEEDING_DELAY: {
    id: 'feeding_delay',
    name: 'Feeding Delay Alert',
    thresholdHours: 4,
    severity: 'high',
    messageKey: 'feeding_delay',
    description: 'Baby has not been fed for more than 4 hours',
  },
  FREQUENT_FEEDING: {
    id: 'frequent_feeding',
    name: 'Frequent Feeding Alert',
    thresholdHours: 1,
    severity: 'medium',
    messageKey: 'frequent_feeding',
    description: 'Baby is being fed more frequently than recommended (less than 1 hour apart)',
  },
  LOW_FEED_QUANTITY: {
    id: 'low_feed_quantity',
    name: 'Low Feed Quantity Alert',
    thresholdMl: 30,
    severity: 'medium',
    messageKey: 'low_feed_quantity',
    description: 'Feed quantity is below recommended minimum (less than 30ml)',
  },
};

/**
 * Get all feeding rules
 */
function getAllRules() {
  return Object.values(FEEDING_RULES);
}

/**
 * Get a specific rule by ID
 */
function getRuleById(ruleId) {
  return FEEDING_RULES[ruleId] || null;
}

module.exports = {
  FEEDING_RULES,
  getAllRules,
  getRuleById,
};

