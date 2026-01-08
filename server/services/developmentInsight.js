/**
 * Development Insight Service
 * 
 * Explainability-only AI feature for premature baby support.
 * 
 * IMPORTANT CONSTRAINTS:
 * - NOT diagnostic
 * - NOT predictive
 * - NOT medical advice
 * - AI is informational/explainability only
 * - Deterministic logic runs FIRST, AI runs SECOND (only if needed)
 */

const { db } = require('../firebaseAdmin');
const { calculateAgeSummary } = require('../utils/ageUtils');
const axios = require('axios');

/**
 * Get development insight for a premature baby based on corrected age.
 * 
 * @param {string} babyId - Baby document ID
 * @param {string} parentId - Parent user ID (for authorization)
 * @returns {Promise<{
 *   correctedAgeWeeks: number,
 *   isPremature: boolean,
 *   insightText: string | null
 * } | null>}
 * 
 * Returns null if baby is not premature.
 * Returns insightText as null if AI call fails (graceful fallback).
 */
async function getDevelopmentInsight(babyId, parentId) {
  try {
    // Step 1: Fetch baby from Firestore
    const babyRef = db.collection('babies').doc(babyId);
    const babyDoc = await babyRef.get();

    if (!babyDoc.exists) {
      throw new Error('Baby not found');
    }

    const babyData = babyDoc.data();

    // Verify baby belongs to parent
    if (babyData.parentId !== parentId) {
      throw new Error('Access denied: Baby does not belong to this parent');
    }

    const { dob, gestationalAge } = babyData;

    if (!dob) {
      throw new Error('Baby date of birth (dob) is required');
    }

    // Step 2: Convert dob to Date (handle Firestore Timestamp)
    let dobDate;
    if (dob.toDate && typeof dob.toDate === 'function') {
      dobDate = dob.toDate();
    } else {
      dobDate = new Date(dob);
    }

    // Step 3: Calculate age deterministically (NO AI)
    const ageSummary = calculateAgeSummary(dobDate, gestationalAge);

    // Step 4: Determine if premature
    const isPremature = ageSummary.isPremature;

    // Step 5: If NOT premature, return null (do NOT call AI)
    if (!isPremature) {
      return null;
    }

    // Step 6: Only call AI if premature AND corrected age > 0
    console.log('📊 [Service] Age Summary Check:');
    console.log('   - Actual Age:', ageSummary.actualAgeWeeks, 'weeks');
    console.log('   - Weeks Early:', ageSummary.weeksEarly, 'weeks');
    console.log('   - Corrected Age:', ageSummary.correctedAgeWeeks, 'weeks');
    console.log('   - Is Premature:', ageSummary.isPremature);
    
    if (ageSummary.correctedAgeWeeks <= 0) {
      console.log('⚠️ [Service] Corrected age is 0 or negative, skipping AI call');
      return {
        correctedAgeWeeks: ageSummary.correctedAgeWeeks,
        isPremature: true,
        insightText: null,
      };
    }
    
    console.log('✅ [Service] Corrected age is valid, proceeding with AI call');

    // Step 7: Call Hugging Face AI (explainability only)
    const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;

    console.log('🔑 [Service] Checking Hugging Face token...');
    console.log('   - HUGGINGFACE_TOKEN exists:', !!process.env.HUGGINGFACE_TOKEN);
    console.log('   - HF_TOKEN exists:', !!process.env.HF_TOKEN);
    console.log('   - Token length:', HF_TOKEN?.length || 0, 'characters');
    console.log('   - Token preview:', HF_TOKEN ? HF_TOKEN.substring(0, 10) + '...' : 'null');

    if (!HF_TOKEN) {
      console.error('❌ [Service] Hugging Face token is missing!');
      console.error('   - Set HUGGINGFACE_TOKEN or HF_TOKEN in .env file');
      // Graceful fallback: return structure without AI text
      return {
        correctedAgeWeeks: ageSummary.correctedAgeWeeks,
        isPremature: true,
        insightText: null,
      };
    }

    try {
      // Build prompt as specified by user
      const correctedAge = ageSummary.correctedAgeWeeks;
      const prompt = `Act as a pediatric specialist. A baby has a corrected age of ${correctedAge} weeks. Provide 3 specific motor milestones they should be reaching and one 'Play Tip' to encourage development. Keep it encouraging for the parent.`;
      
      console.log('📋 [Gemma AI] Prompt being sent:');
      console.log(prompt);

      // Use Hugging Face Router API with OpenAI-compatible endpoint
      const modelName = 'google/gemma-2-2b-it';
      const apiUrl = 'https://router.huggingface.co/v1/chat/completions';
      
      console.log('🤖 [Gemma AI] Calling Hugging Face Router API (OpenAI-compatible)...');
      console.log('📝 [Gemma AI] Prompt length:', prompt.length, 'characters');
      console.log('👶 [Gemma AI] Corrected age being sent to model:', correctedAge, 'weeks');
      console.log('🔗 [Gemma AI] Model: google/gemma-2-2b-it');
      console.log('🔗 [Gemma AI] Token length:', HF_TOKEN.length, 'characters');
      console.log('🔗 [Gemma AI] Full URL:', apiUrl);
      
      const response = await axios.post(
        apiUrl,
        {
          model: modelName,
          messages: [
            {
              role: 'system',
              content: 'You are a pediatric specialist providing developmental guidance for parents of premature babies. Keep responses encouraging, clear, and non-medical.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 300,
          temperature: 0.6,
        },
        {
          headers: {
            'Authorization': `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 second timeout
        }
      );
      
      console.log('✅ [Gemma AI] API call completed successfully');
      console.log('📥 [Gemma AI] Response status:', response.status);
      console.log('📥 [Gemma AI] Response headers:', response.headers);
      console.log('📥 [Gemma AI] Raw response data type:', typeof response.data);
      console.log('📥 [Gemma AI] Response data keys:', Object.keys(response.data || {}));

      // Log full response from Gemma
      console.log('✅ [Gemma AI] Full response received:');
      console.log(JSON.stringify(response.data, null, 2));

      // Extract generated text from OpenAI-compatible response format
      // Response format: { choices: [{ message: { content: "..." } }] }
      let insightText = null;
      
      console.log('🔍 [Gemma AI] Extracting text from response...');
      console.log('   - Response has choices:', !!response.data?.choices);
      console.log('   - Choices array length:', response.data?.choices?.length || 0);
      
      if (response.data?.choices && Array.isArray(response.data.choices) && response.data.choices.length > 0) {
        const firstChoice = response.data.choices[0];
        console.log('   - First choice keys:', Object.keys(firstChoice || {}));
        console.log('   - First choice has message:', !!firstChoice?.message);
        console.log('   - Message keys:', Object.keys(firstChoice?.message || {}));
        
        if (firstChoice?.message?.content) {
          console.log('✅ [Gemma AI] Found content in choices[0].message.content');
          insightText = firstChoice.message.content.trim();
        } else if (firstChoice?.text) {
          console.log('✅ [Gemma AI] Found text in choices[0]');
          insightText = firstChoice.text.trim();
        }
      } else if (response.data?.content) {
        console.log('✅ [Gemma AI] Found content in response.data');
        insightText = response.data.content.trim();
      } else if (typeof response.data === 'string') {
        console.log('✅ [Gemma AI] response.data is direct string');
        insightText = response.data.trim();
      } else {
        console.warn('⚠️ [Gemma AI] Could not extract text, trying alternative methods...');
        console.warn('   - Response structure:', JSON.stringify(response.data, null, 2));
        // Try to find any text-like property
        if (response.data) {
          for (const key in response.data) {
            if (typeof response.data[key] === 'string' && response.data[key].length > 10) {
              console.log(`✅ [Gemma AI] Found text in property: ${key}`);
              insightText = response.data[key].trim();
              break;
            }
          }
        }
      }
      
      console.log('📄 [Gemma AI] Extracted text length:', insightText?.length || 0, 'characters');
      if (insightText) {
        console.log('📄 [Gemma AI] Generated text preview:', insightText.substring(0, 200) + '...');
        console.log('📄 [Gemma AI] Full generated text:');
        console.log('='.repeat(60));
        console.log(insightText);
        console.log('='.repeat(60));
      } else {
        console.error('❌ [Gemma AI] No text extracted from response!');
        console.error('❌ [Gemma AI] Full response object:');
        console.error(JSON.stringify(response, null, 2));
      }

      // Return formatted response
      console.log('✅ [Service] Returning development insight:');
      console.log('   - Corrected Age:', ageSummary.correctedAgeWeeks, 'weeks');
      console.log('   - Insight Text Length:', insightText?.length || 0, 'characters');
      console.log('   - Insight Text Preview:', insightText?.substring(0, 150) || 'null');
      
      return {
        correctedAgeWeeks: ageSummary.correctedAgeWeeks,
        isPremature: true,
        insightText,
      };
    } catch (aiError) {
      console.error('❌ [Gemma AI] Error calling Hugging Face API:');
      console.error('   - Error type:', aiError.constructor.name);
      console.error('   - Error message:', aiError.message);
      console.error('   - Error stack:', aiError.stack);
      
      if (aiError.response) {
        console.error('   - Response status:', aiError.response.status);
        console.error('   - Response data:', JSON.stringify(aiError.response.data, null, 2));
      }
      
      if (aiError.status) {
        console.error('   - Status code:', aiError.status);
      }
      
      // Re-throw to be caught by outer catch
      throw new Error(`AI call failed: ${aiError.message}`);
    }
  } catch (error) {
    console.error('❌ [Service] Error in getDevelopmentInsight:');
    console.error('   - Error type:', error.constructor.name);
    console.error('   - Error message:', error.message);
    console.error('   - Error stack:', error.stack);

    // If we have age data but AI failed, return structure with null text
    // This allows frontend to show graceful fallback
    if (error.message === 'Baby not found' || error.message === 'Access denied') {
      throw error; // Re-throw authorization errors
    }
    
    if (error.message.includes('AI call failed')) {
      console.error('❌ [Service] AI call failed, returning null content');
      // Try to get age data for graceful fallback
      try {
        const babyRef = db.collection('babies').doc(babyId);
        const babyDoc = await babyRef.get();
        if (babyDoc.exists) {
          const babyData = babyDoc.data();
          const { dob, gestationalAge } = babyData;
          if (dob) {
            let dobDate;
            if (dob.toDate && typeof dob.toDate === 'function') {
              dobDate = dob.toDate();
            } else {
              dobDate = new Date(dob);
            }
            const ageSummary = calculateAgeSummary(dobDate, gestationalAge);
            if (ageSummary.isPremature) {
              return {
                correctedAgeWeeks: ageSummary.correctedAgeWeeks,
                isPremature: true,
                insightText: null,
              };
            }
          }
        }
      } catch (fallbackError) {
        console.error('❌ [Service] Fallback also failed:', fallbackError);
      }
    }

    // For AI failures, return structure with null text (graceful fallback)
    // Try to get age data if possible
    try {
      const babyRef = db.collection('babies').doc(babyId);
      const babyDoc = await babyRef.get();
      if (babyDoc.exists) {
        const babyData = babyDoc.data();
        const { dob, gestationalAge } = babyData;
        if (dob) {
          let dobDate;
          if (dob.toDate && typeof dob.toDate === 'function') {
            dobDate = dob.toDate();
          } else {
            dobDate = new Date(dob);
          }
          const ageSummary = calculateAgeSummary(dobDate, gestationalAge);
          if (ageSummary.isPremature) {
            return {
              correctedAgeWeeks: ageSummary.correctedAgeWeeks,
              isPremature: true,
              insightText: null, // Graceful fallback
            };
          }
        }
      }
    } catch (fallbackError) {
      // If we can't even get age data, re-throw original error
      throw error;
    }

    // Re-throw if we can't handle gracefully
    throw error;
  }
}

module.exports = {
  getDevelopmentInsight,
};

