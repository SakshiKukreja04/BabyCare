require('dotenv').config();
const axios = require('axios');

/**
 * Test script to verify Hugging Face Inference API configuration and response
 * for the "Development This Week" feature using Google Gemma-2-2b-it model
 * 
 * Usage: node test-gemini-api.js
 */

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;

// Test parameters (simulating a premature baby scenario)
const TEST_CORRECTED_AGE_WEEKS = 8;
const TEST_BABY_NAME = 'Test Baby';

async function testGeminiAPI() {
  console.log('🧪 Testing Hugging Face Inference API Configuration...\n');
  console.log('=' .repeat(60));
  
  // Step 1: Check API Token
  console.log('\n1️⃣ Checking Hugging Face Token...');
  if (!HF_TOKEN) {
    console.error('❌ ERROR: HUGGINGFACE_TOKEN or HF_TOKEN is not set in environment variables');
    console.log('\n💡 Solution: Make sure you have HUGGINGFACE_TOKEN or HF_TOKEN in your .env file');
    console.log('   Get your token from: https://huggingface.co/settings/tokens');
    process.exit(1);
  }
  console.log('✅ Hugging Face Token found (length:', HF_TOKEN.length, 'characters)');
  
  // Step 2: Test API Endpoint
  console.log('\n2️⃣ Testing API Endpoint...');
  console.log('   Using Hugging Face Router API');
  console.log('   Endpoint: https://router.huggingface.co');
  console.log('   Model: google/gemma-2-2b-it');
  
  // Step 3: Build test prompt (same as production)
  console.log('\n3️⃣ Building test prompt...');
  const prompt = `You are a gentle, reassuring guide for parents of premature babies.

Based on a corrected age of ${TEST_CORRECTED_AGE_WEEKS} weeks${TEST_BABY_NAME ? ` for a baby named ${TEST_BABY_NAME}` : ''},
list clearly:
- 3 simple motor development milestones that are typical around this corrected age
- 1 very simple, playful activity parents can try this week to gently encourage development

IMPORTANT SAFETY RULES:
- Do NOT give medical advice.
- Do NOT mention risks, problems, delays, or anything that might cause anxiety.
- Do NOT compare this baby to other babies.
- Do NOT talk about diagnoses, conditions, or treatments.

Tone and style:
- Be calm, warm, and reassuring.
- Use short, clear bullet points that are easy for tired parents to scan.
- Emphasize that every baby is unique and that parents know their baby best.

Format your answer in plain text with clear bullet points.`;
  
  console.log('   Prompt length:', prompt.length, 'characters');
  console.log('   Test corrected age:', TEST_CORRECTED_AGE_WEEKS, 'weeks');
  
  // Step 4: Make API Request
  console.log('\n4️⃣ Making API request to Hugging Face...');
  try {
    const startTime = Date.now();
    
    // Use router endpoint - set as environment variable or pass in options
    // Use Hugging Face Router API directly
    const routerUrl = 'https://router.huggingface.co';
    const modelName = 'google/gemma-2-2b-it';
    
    const response = await axios.post(
      `${routerUrl}/models/${modelName}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          top_p: 0.9,
          return_full_text: false,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Step 5: Parse Response
    console.log('\n5️⃣ Parsing response...');
    
    if (!response || !response.data) {
      console.error('❌ ERROR: No response received');
      console.log('Response:', JSON.stringify(response, null, 2));
      return;
    }
    
    // Hugging Face API returns an array, get first element
    const result = Array.isArray(response.data) ? response.data[0] : response.data;
    const text = result?.generated_text?.trim() || null;
    
    if (!text) {
      console.error('❌ ERROR: No text content in response');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      return;
    }
    
    // Step 6: Display Results
    console.log('\n✅ SUCCESS! Hugging Face Inference API is working correctly!\n');
    console.log('=' .repeat(60));
    console.log('\n📊 Response Statistics:');
    console.log('   Response time:', duration, 'ms');
    console.log('   Response length:', text.length, 'characters');
    
    if (result.details) {
      console.log('   Tokens generated:', result.details.generated_tokens || 'N/A');
    } else if (response.data?.[0]?.details) {
      console.log('   Tokens generated:', response.data[0].details.generated_tokens || 'N/A');
    }
    
    console.log('\n📝 Generated Content:');
    console.log('=' .repeat(60));
    console.log(text);
    console.log('=' .repeat(60));
    
    // Step 7: Validate Content
    console.log('\n6️⃣ Validating content quality...');
    const hasMilestones = text.toLowerCase().includes('milestone') || 
                          text.match(/\d+\./g) || 
                          text.includes('-');
    const hasActivity = text.toLowerCase().includes('activity') || 
                       text.toLowerCase().includes('play') ||
                       text.toLowerCase().includes('try');
    
    if (hasMilestones) {
      console.log('✅ Contains developmental milestones');
    } else {
      console.log('⚠️  May not contain clear milestones');
    }
    
    if (hasActivity) {
      console.log('✅ Contains play activity suggestion');
    } else {
      console.log('⚠️  May not contain activity suggestion');
    }
    
    console.log('\n🎉 Test completed successfully!');
    console.log('\n💡 This means your Hugging Face Inference API is correctly configured');
    console.log('   and ready to use in the "Development This Week" feature.\n');
    
  } catch (error) {
    console.error('\n❌ ERROR: API request failed!\n');
    console.log('=' .repeat(60));
    
    console.log('Error Message:', error.message);
    
    if (error.status) {
      console.log('Status Code:', error.status);
    }
    
    if (error.statusCode) {
      console.log('Status Code:', error.statusCode);
    }
    
    if (error.error) {
      console.log('\nError Details:');
      console.log(JSON.stringify(error.error, null, 2));
    }
    
    if (error.message) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        console.log('\n💡 Possible issues:');
        console.log('   - Model name might be incorrect');
        console.log('   - Check if google/gemma-2-2b-it is available');
        console.log('   - Make sure you have accepted the model license on Hugging Face');
        console.log('   - Visit: https://huggingface.co/google/gemma-2-2b-it');
      } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
        console.log('\n💡 Possible issues:');
        console.log('   - Invalid Hugging Face token');
        console.log('   - Malformed request');
        console.log('   - Prompt violates content policy');
      } else if (error.message.includes('401') || error.message.includes('403') || error.message.includes('token') || error.message.includes('unauthorized')) {
        console.log('\n💡 Possible issues:');
        console.log('   - Invalid or expired Hugging Face token');
        console.log('   - Token does not have required permissions');
        console.log('   - Check your Hugging Face token settings');
        console.log('   - Get a new token: https://huggingface.co/settings/tokens');
      } else {
        console.log('\n💡 Possible issues:');
        console.log('   - Network connectivity problem');
        console.log('   - API endpoint is unreachable');
        console.log('   - Check your Hugging Face token and model name');
        console.log('   - Make sure you have accepted the model license');
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    process.exit(1);
  }
}

// Run the test
console.log('\n🚀 Starting Gemini API Test...\n');
testGeminiAPI()
  .then(() => {
    console.log('\n✨ Test script completed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });

