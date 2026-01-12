const express = require('express');
const router = express.Router();
const axios = require('axios');
const { db } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { explainAlert } = require('../services/gemini');
const {
  buildChatbotContext,
  formatContextForPrompt,
} = require('../services/chatbotContext');

/**
 * POST /chatbot
 * Context-aware chatbot endpoint for answering questions about baby care
 * 
 * IMPORTANT: This is for general guidance only, NOT medical advice
 * 
 * Request body:
 * {
 *   message: string (required) - User's question
 *   babyId: string (optional) - Baby ID for context
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     response: string - Chatbot response
 *     timestamp: ISO string
 *   }
 * }
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { message, babyId } = req.body;
    const parentId = req.user.uid;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'message is required and must be a string',
      });
    }

    // If babyId provided, verify access and build context
    let babyContext = null;
    if (babyId) {
      const babyRef = db.collection('babies').doc(babyId);
      const babyDoc = await babyRef.get();

      if (!babyDoc.exists) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Baby not found',
        });
      }

      const babyData = babyDoc.data();
      if (babyData.parentId !== parentId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this baby',
        });
      }

      // Build structured context from baby data
      babyContext = await buildChatbotContext(babyId);
    }

    // Build safe prompt with context
    const prompt = buildChatbotPrompt(message, babyContext);

    // Call Gemma API via Hugging Face
    const response = await callGemmaChatbot(prompt);

    res.json({
      success: true,
      data: {
        response,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in chatbot:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process chatbot request',
    });
  }
});

/**
 * Build a context-aware prompt for the chatbot
 * 
 * Uses baby context (age, recent activity, cry analysis) to provide
 * personalized, relevant guidance with COMPLETE and ACCURATE answers
 */
function buildChatbotPrompt(userMessage, babyContext) {
  const systemPrompt = `You are an expert baby care assistant with comprehensive medical and parenting knowledge. Your role is to provide COMPLETE, ACCURATE, WELL-FORMATTED, and HELPFUL answers to parents' questions.

🎯 YOUR CORE MISSION:
1. **Answer EXACTLY what the user asked** - Address every part of their question completely
2. **Be comprehensive and detailed** - Provide ALL relevant information they need
3. **Use real-world knowledge** - Include medical guidelines (WHO, AAP), developmental milestones, and evidence-based practices
4. **Personalize to this specific baby** - Use the baby context data provided to tailor your response
5. **Make it visually beautiful** - Use emojis, bold, bullet points, and clear sections

═══════════════════════════════════════════════════════════
📝 **REQUIRED RESPONSE FORMAT** (MUST FOLLOW):
═══════════════════════════════════════════════════════════

Your response MUST be beautifully formatted with:

✨ **EMOJIS** - Use relevant emojis throughout:
   • 👶 for baby-related points
   • 🍼 for feeding
   • 😴 for sleep
   • 💊 for medication
   • ⚠️ for warnings/cautions
   • ✅ for recommendations
   • 📊 for statistics/data
   • 💡 for tips
   • ❤️ for reassurance
   • 🏥 for medical advice

✨ **BOLD HEADINGS** - Use **bold text** for section headers

✨ **BULLET POINTS** - Use bullet points (•) for all lists and tips

✨ **CLEAR SECTIONS** - Organize your answer into logical sections with headers

✨ **SPECIFIC NUMBERS** - Include exact quantities, times, and ranges when relevant

═══════════════════════════════════════════════════════════
📚 **YOUR KNOWLEDGE BASE**:
═══════════════════════════════════════════════════════════

🍼 **FEEDING GUIDELINES**:
• Breastfeeding: WHO recommends exclusively for 6 months
• Formula: ~2.5oz per pound of body weight daily (divided into feeds)
• Newborns: 8-12 feeds per day (every 2-3 hours)
• 3-6 months: 5-6 feeds per day (every 3-4 hours)
• Solids: Introduce at 6 months (iron-fortified cereals, pureed vegetables)

😴 **SLEEP GUIDELINES BY AGE**:
• Newborn (0-3mo): 14-17 hours total (8-9 daytime naps)
• Infant (4-11mo): 12-15 hours total (2-3 naps)
• Toddler (1-2yr): 11-14 hours total (1-2 naps)
• Safe sleep: Always on back, alone, in a crib (ABC)

📈 **DEVELOPMENTAL MILESTONES**:
• 2 months: Social smile, tracks objects, lifts head
• 4 months: Laughs, grasps toys, rolls over
• 6 months: Sits with support, babbles, responds to name
• 9 months: Crawls, waves bye-bye, understands "no"
• 12 months: Stands alone, says 1-2 words, feeds self

🏥 **WHEN TO CALL THE DOCTOR**:
• Fever >100.4°F (38°C) in babies under 3 months
• Refusing to feed for multiple sessions
• Unusual lethargy or difficulty waking
• Difficulty breathing or blue lips
• No wet diapers for 6+ hours

═══════════════════════════════════════════════════════════
⚠️ **SAFETY RULES** (NEVER VIOLATE):
═══════════════════════════════════════════════════════════
• ❌ Never diagnose specific medical conditions
• ❌ Never prescribe medication dosages
• ✅ Always recommend pediatrician for medical concerns
• ✅ Always remind about newborn fever being an emergency
• ✅ Be clear about normal vs. concerning symptoms

TONE: Warm, reassuring, knowledgeable, and thorough like a trusted family advisor.`;

  // Build context section with detailed baby information
  let contextSection = '';
  if (babyContext) {
    contextSection = `

═══════════════════════════════════════════════════════════
📊 **THIS BABY'S DATA** (Use to personalize your answer):
═══════════════════════════════════════════════════════════
`;
    contextSection += formatContextForPrompt(babyContext);
    contextSection += `
⬆️ USE THIS DATA to give personalized, specific advice for THIS baby!
`;
  }

  // User message section
  const userSection = `

═══════════════════════════════════════════════════════════
❓ **PARENT'S QUESTION**:
═══════════════════════════════════════════════════════════
"${userMessage}"`;

  // Instructions for comprehensive response
  const instructions = `

═══════════════════════════════════════════════════════════
📝 **YOUR RESPONSE REQUIREMENTS**:
═══════════════════════════════════════════════════════════
1. Answer the question COMPLETELY - address every part
2. Reference the baby's actual data (age, feeding history, etc.)
3. Use beautiful formatting with emojis, bold headings, and bullet points
4. Include specific numbers and actionable recommendations
5. End with when to consult a pediatrician if medically relevant

NOW PROVIDE YOUR BEAUTIFULLY FORMATTED, COMPREHENSIVE ANSWER:`;

  return systemPrompt + contextSection + userSection + instructions;
}

/**
 * Call Hugging Face Gemma API for chatbot
 * Uses the OpenAI-compatible endpoint on Hugging Face Router
 */
async function callGemmaChatbot(prompt) {
  const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN || '';
  const HF_ROUTER_URL = 'https://router.huggingface.co';
  const GEMMA_MODEL = 'google/gemma-2-2b-it';

  if (!HF_TOKEN) {
    console.error('Error: HUGGINGFACE_TOKEN or HF_TOKEN not set');
    return 'I apologize, but the AI assistant is currently unavailable. Please consult with your healthcare provider for any medical questions.';
  }

  try {
    const apiUrl = `${HF_ROUTER_URL}/v1/chat/completions`;
    
    const response = await axios.post(
      apiUrl,
      {
        model: GEMMA_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2048,  // Large limit for comprehensive, well-formatted responses
        temperature: 0.5,  // Lower for more accurate, focused answers
      },
      {
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,  // 60 seconds timeout for detailed responses
      }
    );

    // Extract response from OpenAI-compatible format
    let text = null;
    
    if (response.data?.choices && Array.isArray(response.data.choices) && response.data.choices.length > 0) {
      text = response.data.choices[0]?.message?.content || null;
    } else if (Array.isArray(response.data)) {
      text = response.data[0]?.generated_text || response.data[0]?.text || '';
    } else if (response.data?.generated_text) {
      text = response.data.generated_text;
    } else if (typeof response.data === 'string') {
      text = response.data;
    }

    return text?.trim() || 'I apologize, but I could not generate a response. Please try again or consult with your healthcare provider.';
  } catch (error) {
    console.error('Error calling Gemma chatbot:', error.message);
    if (error.response) {
      console.error('API response status:', error.response.status);
      console.error('API response data:', JSON.stringify(error.response.data, null, 2));
    }
    return 'I apologize, but I encountered an error. Please consult with your healthcare provider for any medical questions.';
  }
}

module.exports = router;