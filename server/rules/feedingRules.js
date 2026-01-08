/**
 * Deterministic, Static, Explainable Rules for Baby Care Monitoring
 * 
 * IMPORTANT CONSTRAINTS:
 * - Rules are IMMUTABLE (not user-editable)
 * - Rules are WHO-aligned (non-diagnostic)
 * - Rules are deterministic (no AI/ML)
 * - Rules support both FULL_TERM and PREMATURE babies
 * 
 * Rule Structure:
 * - ruleId: Unique identifier
 * - name: Human-readable name
 * - description: What the rule checks
 * - threshold: Numeric threshold value
 * - severity: LOW | MEDIUM | HIGH
 * - messageKey: Translation key
 * - appliesTo: ALL | PREMATURE_ONLY
 */

// ============================================
// FEEDING RULES
// ============================================
const feedingRules = {
  FEEDING_DELAY: {
    ruleId: 'feeding_delay',
    name: 'Feeding Delay Alert',
    description: 'Baby has not been fed for more than the recommended interval',
    thresholdHours: 4,
    severity: 'HIGH',
    messageKey: 'feeding_delay',
    appliesTo: 'ALL',
    category: 'feeding',
  },
  FEEDING_DELAY_PREMATURE: {
    ruleId: 'feeding_delay_premature',
    name: 'Feeding Delay Alert (Premature)',
    description: 'Premature baby has not been fed for more than 3 hours',
    thresholdHours: 3,
    severity: 'HIGH',
    messageKey: 'feeding_delay_premature',
    appliesTo: 'PREMATURE_ONLY',
    category: 'feeding',
  },
  FREQUENT_FEEDING: {
    ruleId: 'frequent_feeding',
    name: 'Frequent Feeding Alert',
    description: 'Baby is being fed more frequently than recommended (less than 1 hour apart)',
    thresholdHours: 1,
    severity: 'MEDIUM',
    messageKey: 'frequent_feeding',
    appliesTo: 'ALL',
    category: 'feeding',
  },
  LOW_FEED_QUANTITY: {
    ruleId: 'low_feed_quantity',
    name: 'Low Feed Quantity Alert',
    description: 'Feed quantity is below recommended minimum (less than 30ml)',
    thresholdMl: 30,
    severity: 'MEDIUM',
    messageKey: 'low_feed_quantity',
    appliesTo: 'ALL',
    category: 'feeding',
  },
  LOW_DAILY_FEEDING_TOTAL: {
    ruleId: 'low_daily_feeding_total',
    name: 'Low Daily Feeding Total Alert',
    description: 'Total daily feeding amount is below recommended minimum (less than 150ml per day)',
    thresholdMl: 150,
    severity: 'MEDIUM',
    messageKey: 'low_daily_feeding_total',
    appliesTo: 'ALL',
    category: 'feeding',
  },
};

// ============================================
// WEIGHT MONITORING RULES
// ============================================
const weightRules = {
  WEIGHT_NOT_UPDATED: {
    ruleId: 'weight_not_updated',
    name: 'Weight Tracking Reminder',
    description: 'Baby weight has not been updated in the last 7 days',
    thresholdDays: 7,
    severity: 'MEDIUM',
    messageKey: 'weight_not_updated',
    appliesTo: 'ALL',
    category: 'weight',
  },
};

// ============================================
// SLEEP DURATION RULES
// ============================================
const sleepRules = {
  LOW_SLEEP_DURATION: {
    ruleId: 'low_sleep_duration',
    name: 'Low Sleep Duration Alert',
    description: 'Total logged sleep duration is below recommended minimum (less than 10 hours in 24 hours)',
    thresholdHours: 10,
    severity: 'LOW',
    messageKey: 'low_sleep_duration',
    appliesTo: 'ALL',
    category: 'sleep',
  },
};

// ============================================
// MEDICATION ADHERENCE RULES
// ============================================
const medicationRules = {
  MEDICATION_MISSED: {
    ruleId: 'medication_missed',
    name: 'Medication Adherence Alert',
    description: 'Scheduled medication was not logged as administered',
    expected: true,
    severity: 'MEDIUM',
    messageKey: 'medication_missed',
    appliesTo: 'ALL',
    category: 'medication',
  },
};

// ============================================
// EXPORTS
// ============================================

/**
 * Get all rules grouped by category
 */
function getAllRulesByCategory() {
  return {
    feedingRules,
    weightRules,
    sleepRules,
    medicationRules,
  };
}

/**
 * Get all rules as a flat array
 */
function getAllRules() {
  return [
    ...Object.values(feedingRules),
    ...Object.values(weightRules),
    ...Object.values(sleepRules),
    ...Object.values(medicationRules),
  ];
}

/**
 * Get rules by category
 */
function getRulesByCategory(category) {
  const allRules = getAllRulesByCategory();
  return allRules[`${category}Rules`] || {};
}

/**
 * Get a specific rule by ID
 */
function getRuleById(ruleId) {
  const allRules = getAllRules();
  return allRules.find(rule => rule.ruleId === ruleId) || null;
}

/**
 * Get rules that apply to a specific baby type
 */
function getRulesForBabyType(isPremature) {
  const allRules = getAllRules();
  return allRules.filter(rule => {
    if (rule.appliesTo === 'ALL') return true;
    if (rule.appliesTo === 'PREMATURE_ONLY' && isPremature) return true;
    return false;
  });
}

module.exports = {
  feedingRules,
  weightRules,
  sleepRules,
  medicationRules,
  getAllRulesByCategory,
  getAllRules,
  getRulesByCategory,
  getRuleById,
  getRulesForBabyType,
};
