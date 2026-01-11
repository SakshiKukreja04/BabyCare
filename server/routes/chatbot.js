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
 * personalized, relevant guidance
 */
function buildChatbotPrompt(userMessage, babyContext) {
  const systemPrompt = `You are a concise baby care assistant. Help parents understand their baby's needs.

RESPONSE FORMAT (STRICT):
- Keep responses SHORT (3-5 bullet points max)
- Use bullet points (•) for all suggestions
- Start with a brief 1-sentence summary
- End with "Consult your pediatrician if concerned"
- NO long paragraphs, NO headers, NO bold text

SAFETY RULES:
- Never diagnose or prescribe medication
- Always recommend pediatrician for medical concerns

TONE: Calm, supportive, concise`;

  // Build context section
  let contextSection = '';
  if (babyContext) {
    contextSection = '\n\nBaby Context:\n';
    contextSection += formatContextForPrompt(babyContext);
  }

  // User message section
  const userSection = `\n\nParent's Question:\n${userMessage}`;

  // Instructions for response
  const instructions = `\n\nRespond with:
1. One sentence summary of likely cause
2. 3-4 bullet points with actionable tips
3. Brief reassurance or when to see doctor

Keep it under 100 words total. Be direct and helpful.`;

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
        max_tokens: 512,
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
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