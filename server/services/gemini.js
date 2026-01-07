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

  return `You are a helpful assistant explaining a baby care alert to a parent. 
Your role is ONLY to explain WHY this alert appeared, in a calm, simple, and reassuring way.

IMPORTANT RULES:
- Do NOT provide medical diagnosis
- Do NOT provide medical advice
- Do NOT make predictions about health
- Do NOT suggest treatments
- ONLY explain what triggered the alert and why it matters

Alert Details:
- Rule: ${rule.name || 'Safety monitoring rule'}
- Description: ${rule.description || 'A care pattern was detected'}
- Trigger Data: ${JSON.stringify(triggerData || {})}
${babyAge ? `- Baby Age: ${babyAge}` : ''}

Provide a brief, calm explanation (2-3 sentences) that:
1. Explains what triggered this alert
2. Why this pattern matters for baby care
3. Reassures the parent that this is guidance, not a diagnosis

Use simple language. Be supportive and calm.`;
}

/**
 * Get default explanation if Gemini is unavailable
 */
function getDefaultExplanation(alertData) {
  const { rule, triggerData } = alertData;
  
  if (rule.id === 'feeding_delay') {
    return `This alert appeared because your baby hasn't been fed in over ${triggerData?.thresholdHours || 4} hours. Regular feeding is important for healthy growth and development. This is a reminder to check if your baby needs feeding.`;
  }
  
  if (rule.id === 'frequent_feeding') {
    return `This alert appeared because feedings are happening very close together (less than ${triggerData?.thresholdHours || 1} hour apart). While every baby is different, this pattern might indicate the need to adjust feeding schedules.`;
  }
  
  if (rule.id === 'low_feed_quantity') {
    return `This alert appeared because the last feeding quantity was below the recommended minimum (${triggerData?.thresholdMl || 30}ml). Ensuring adequate feeding amounts supports healthy growth.`;
  }

  return `This alert appeared based on the care patterns we've tracked. It's a helpful reminder to ensure consistent care for your baby. Remember, you know your baby best - these alerts are guidance, not medical advice.`;
}

module.exports = {
  explainAlert,
};

