const axios = require('axios');

/**
 * Gemini API Service
 * 
 * IMPORTANT CONSTRAINTS:
 * - Gemini is ONLY for explanation
 * - NO diagnosis
 * - NO predictions
 * - NO medical advice
 * - Rules are evaluated BEFORE this service is called
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

/**
 * Explain an alert using Gemini AI
 * @param {Object} alertData - Alert data including rule, trigger, and context
 * @returns {Promise<string>} Explanation text
 */
async function explainAlert(alertData) {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not set, returning default explanation');
    return getDefaultExplanation(alertData);
  }

  try {
    const prompt = buildExplanationPrompt(alertData);

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt,
          }],
        }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const explanation = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!explanation) {
      return getDefaultExplanation(alertData);
    }

    return explanation.trim();
  } catch (error) {
    console.error('Error calling Gemini API:', error.message);
    return getDefaultExplanation(alertData);
  }
}

/**
 * Build a safe, explainable prompt for Gemini
 */
function buildExplanationPrompt(alertData) {
  const { rule, triggerData, babyAge } = alertData;
  const ruleId = rule.ruleId || rule.id || '';
  const category = rule.category || (ruleId.includes('feeding') ? 'feeding' : ruleId.includes('sleep') ? 'sleep' : ruleId.includes('weight') ? 'weight' : ruleId.includes('medication') ? 'medication' : 'general');

  // Build a human-readable description of trigger data
  let triggerDescription = '';
  if (triggerData) {
    if (triggerData.message) {
      triggerDescription = triggerData.message;
    } else if (category === 'sleep' && triggerData.value !== undefined) {
      triggerDescription = `Total sleep logged: ${triggerData.value} hours (recommended minimum: ${triggerData.thresholdHours || 10} hours)`;
    } else if (category === 'feeding' && triggerData.hoursSinceLastFeed !== undefined) {
      triggerDescription = `Last feeding was ${triggerData.hoursSinceLastFeed} hours ago (recommended interval: ${triggerData.thresholdHours || 4} hours)`;
    } else if (category === 'feeding' && triggerData.value !== undefined && triggerData.thresholdMl) {
      if (triggerData.checked === 'dailyTotalFeeding') {
        triggerDescription = `Daily total feeding: ${triggerData.value}ml (recommended minimum: ${triggerData.thresholdMl}ml per day)`;
      } else {
        triggerDescription = `Feed quantity: ${triggerData.value}ml (recommended minimum: ${triggerData.thresholdMl}ml)`;
      }
    } else if (category === 'weight' && triggerData.daysSinceWeightUpdate !== undefined) {
      triggerDescription = `Weight last updated: ${Math.round(triggerData.daysSinceWeightUpdate)} days ago (recommended interval: ${triggerData.thresholdDays || 7} days)`;
    } else {
      triggerDescription = JSON.stringify(triggerData);
    }
  }

  return `You are a helpful assistant explaining a baby care alert to a parent. 
Your role is ONLY to explain WHY this alert appeared, in a calm, simple, and reassuring way.

IMPORTANT RULES:
- Do NOT provide medical diagnosis
- Do NOT provide medical advice
- Do NOT make predictions about health
- Do NOT suggest treatments
- ONLY explain what triggered the alert and why it matters
- Focus on the SPECIFIC alert type (${category}) - do NOT confuse it with other alert types

Alert Details:
- Alert Type: ${category.toUpperCase()} alert
- Rule Name: ${rule.name || 'Safety monitoring rule'}
- Rule Description: ${rule.description || 'A care pattern was detected'}
- What Triggered It: ${triggerDescription || 'A care pattern was detected'}
${babyAge ? `- Baby Age: ${babyAge}` : ''}

Provide a brief, calm explanation (2-3 sentences) that:
1. Explains what triggered this ${category} alert specifically
2. Why this ${category} pattern matters for baby care
3. Reassures the parent that this is guidance, not a diagnosis

IMPORTANT: This is a ${category} alert. Do NOT mention feeding if this is a sleep alert, and do NOT mention sleep if this is a feeding alert. Focus only on ${category}.

Use simple language. Be supportive and calm.`;
}

/**
 * Get default explanation if Gemini is unavailable
 */
function getDefaultExplanation(alertData) {
  const { rule, triggerData } = alertData;
  const ruleId = rule.ruleId || rule.id;
  
  // Feeding rules
  if (ruleId === 'feeding_delay' || ruleId === 'feeding_delay_premature') {
    return `This alert appeared because your baby hasn't been fed in over ${triggerData?.thresholdHours || 4} hours. Regular feeding is important for healthy growth and development. This is a reminder to check if your baby needs feeding.`;
  }
  
  if (ruleId === 'frequent_feeding') {
    return `This alert appeared because feedings are happening very close together (less than ${triggerData?.thresholdHours || 1} hour apart). While every baby is different, this pattern might indicate the need to adjust feeding schedules.`;
  }
  
  if (ruleId === 'low_feed_quantity') {
    return `This alert appeared because the last feeding quantity was below the recommended minimum (${triggerData?.thresholdMl || 30}ml). Ensuring adequate feeding amounts supports healthy growth.`;
  }

  if (ruleId === 'low_daily_feeding_total') {
    const dailyTotal = triggerData?.value || triggerData?.dailyTotalMl || 0;
    const thresholdMl = triggerData?.thresholdMl || 150;
    return `This alert appeared because your baby's total daily feeding (${dailyTotal}ml) is below the recommended minimum of ${thresholdMl}ml per day. Adequate daily nutrition is important for healthy growth and development. Consider checking if all feedings have been logged, or consult with your healthcare provider if your baby is consistently not meeting feeding goals.`;
  }

  // Sleep rules
  if (ruleId === 'low_sleep_duration') {
    const totalHours = triggerData?.value || triggerData?.totalSleepHours24h || 0;
    const thresholdHours = triggerData?.thresholdHours || 10;
    return `This alert appeared because your baby's total logged sleep in the last 24 hours (${totalHours.toFixed(1)} hours) is below the recommended minimum of ${thresholdHours} hours. Adequate sleep is important for your baby's growth and development. Consider checking if there are sleep periods that haven't been logged yet.`;
  }

  // Weight rules
  if (ruleId === 'weight_not_updated') {
    const daysSince = triggerData?.value || triggerData?.daysSinceWeightUpdate || 0;
    const thresholdDays = triggerData?.thresholdDays || 7;
    return `This alert appeared because your baby's weight hasn't been updated in ${Math.round(daysSince)} days, which exceeds the recommended tracking interval of ${thresholdDays} days. Regular weight tracking helps monitor healthy growth patterns.`;
  }

  // Medication rules
  if (ruleId === 'medication_missed') {
    return `This alert appeared because a scheduled medication was not logged as administered. Consistent medication tracking helps ensure your baby receives proper care. Please verify if the medication was given and log it accordingly.`;
  }

  // Generic fallback
  return `This alert appeared based on the care patterns we've tracked. It's a helpful reminder to ensure consistent care for your baby. Remember, you know your baby best - these alerts are guidance, not medical advice.`;
}

module.exports = {
  explainAlert,
};

