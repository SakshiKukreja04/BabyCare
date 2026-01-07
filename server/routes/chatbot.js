const express = require('express');
const router = express.Router();
const { db } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { explainAlert } = require('../services/gemini');

/**
 * POST /chatbot
 * Chatbot endpoint for answering questions about baby care
 * 
 * IMPORTANT: This is for general guidance only, NOT medical advice
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { message, babyId, context } = req.body;
    const parentId = req.user.uid;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'message is required and must be a string',
      });
    }

    // If babyId provided, verify access
    let babyData = null;
    if (babyId) {
      const babyRef = db.collection('babies').doc(babyId);
      const babyDoc = await babyRef.get();

      if (!babyDoc.exists) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Baby not found',
        });
      }

      const data = babyDoc.data();
      if (data.parentId !== parentId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this baby',
        });
      }

      babyData = data;
    }

    // Build safe prompt for Gemini
    const prompt = buildChatbotPrompt(message, babyData, context);

    // Call Gemini API
    const response = await callGeminiChatbot(prompt);

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
 * Build a safe prompt for the chatbot
 */
function buildChatbotPrompt(userMessage, babyData, context) {
  let prompt = `You are a helpful assistant for parents caring for babies. 
Your role is to provide GENERAL GUIDANCE and INFORMATION ONLY.

CRITICAL RULES:
- Do NOT provide medical diagnosis
- Do NOT provide medical advice
- Do NOT suggest specific treatments
- Do NOT make predictions about health outcomes
- ALWAYS recommend consulting healthcare professionals for medical concerns
- Use simple, calm, and reassuring language

User Question: ${userMessage}

`;

  if (babyData) {
    prompt += `Baby Context:
- Age: ${babyData.dob ? calculateAge(babyData.dob) : 'Not specified'}
- Gestational Age at Birth: ${babyData.gestationalAge || 'Not specified'} weeks
- Current Weight: ${babyData.currentWeight || 'Not specified'} kg

`;
  }

  if (context) {
    prompt += `Additional Context: ${JSON.stringify(context)}\n\n`;
  }

  prompt += `Provide a helpful, general response that:
1. Addresses the question in a supportive way
2. Provides general information (not medical advice)
3. Reminds the parent to consult healthcare professionals for medical concerns
4. Uses simple, calm language

Response:`;

  return prompt;
}

/**
 * Call Gemini API for chatbot
 */
async function callGeminiChatbot(prompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  if (!GEMINI_API_KEY) {
    return 'I apologize, but the AI assistant is currently unavailable. Please consult with your healthcare provider for any medical questions.';
  }

  try {
    const axios = require('axios');
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

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text?.trim() || 'I apologize, but I could not generate a response. Please try again or consult with your healthcare provider.';
  } catch (error) {
    console.error('Error calling Gemini for chatbot:', error.message);
    return 'I apologize, but I encountered an error. Please consult with your healthcare provider for any medical questions.';
  }
}

/**
 * Helper function to calculate baby age
 */
function calculateAge(dob) {
  const birthDate = new Date(dob);
  const now = new Date();
  const months = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                 (now.getMonth() - birthDate.getMonth());
  if (months < 12) {
    return `${months} months`;
  }
  return `${Math.floor(months / 12)} years, ${months % 12} months`;
}

module.exports = router;

