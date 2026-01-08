const axios = require('axios');
const Tesseract = require('tesseract.js');

/**
 * Prescription OCR Service using Tesseract.js and Hugging Face Models
 * 
 * Two-step approach:
 * 1. Extract OCR text from prescription image using Tesseract.js
 * 2. Structure the OCR text into JSON using text model with medical extraction prompt
 */

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN || '';
const TEXT_MODEL = 'google/gemma-2-2b-it'; // Text model for structuring
const HF_ROUTER_URL = 'https://router.huggingface.co';

/**
 * Calculate suggested start time based on frequency and times_per_day
 * Returns the first dose time in HH:mm format
 */
function calculateStartTime(frequency, timesPerDay) {
  const freqLower = frequency.toLowerCase();
  
  // If frequency mentions specific hours (e.g., "Every 4-6 hours" or "Every 6 hours")
  const hourMatch = freqLower.match(/(?:every|each)\s+(\d+)\s*(?:-|\s)?\s*(?:hour|hr|h)/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    // For "every 4-6 hours", use the larger interval (6 hours) for calculation
    // This means 4 times per day, starting at 06:00 for even distribution
    if (hours >= 4 && hours <= 6) {
      return '06:00'; // Early morning start for frequent dosing (every 4-6 hours)
    }
    // For longer intervals, standard morning start
    if (hours > 6) {
      return '08:00';
    }
    // For very frequent (every 1-3 hours), start early
    return '06:00';
  }

  // If "once daily" or "once a day"
  if (freqLower.includes('once') && (freqLower.includes('daily') || freqLower.includes('day'))) {
    return '08:00'; // Morning dose
  }

  // If "twice daily" or "twice a day"
  if (freqLower.includes('twice') || timesPerDay === 2) {
    return '08:00'; // Morning (evening will be 12h later: 20:00)
  }

  // If "thrice" or 3 times per day
  if (freqLower.includes('thrice') || timesPerDay === 3) {
    return '08:00'; // Morning, afternoon, evening (08:00, 16:00, 00:00)
  }

  // For 4+ doses per day, start early for even distribution
  if (timesPerDay >= 4) {
    return '06:00'; // Early start for frequent dosing (spreads evenly: 06:00, 12:00, 18:00, 00:00)
  }

  // Default to morning
  return '08:00';
}

/**
 * Calculate dose schedule based on frequency and times per day
 * Returns array of times (HH:mm format) when doses should be given
 */
function calculateDoseSchedule(frequency, timesPerDay, suggestedStartTime) {
  const freqLower = frequency.toLowerCase();
  const times = [];
  
  // Parse suggested start time or default to 08:00
  let startHour = 8;
  let startMinute = 0;
  if (suggestedStartTime && suggestedStartTime.includes(':')) {
    const [h, m] = suggestedStartTime.split(':').map(Number);
    if (!isNaN(h) && h >= 0 && h < 24) startHour = h;
    if (!isNaN(m) && m >= 0 && m < 60) startMinute = m;
  }
  
  // Handle "every X hours" frequency
  const everyHoursMatch = freqLower.match(/(?:every|each)\s+(\d+)\s*(?:-|\s+(\d+))?\s*(?:hour|hr|h)/);
  if (everyHoursMatch) {
    const firstHour = parseInt(everyHoursMatch[1], 10);
    const secondHour = everyHoursMatch[2] ? parseInt(everyHoursMatch[2], 10) : null;
    const hoursBetweenDoses = secondHour && secondHour > firstHour ? secondHour : firstHour;
    
    if (hoursBetweenDoses > 0 && hoursBetweenDoses <= 24) {
      // Calculate dose times based on interval
      for (let i = 0; i < timesPerDay; i++) {
        const doseHour = (startHour + (i * hoursBetweenDoses)) % 24;
        times.push(`${String(doseHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`);
      }
      return times.sort((a, b) => {
        const [h1, m1] = a.split(':').map(Number);
        const [h2, m2] = b.split(':').map(Number);
        return h1 * 60 + m1 - (h2 * 60 + m2);
      });
    }
  }
  
  // Handle once daily
  if (timesPerDay === 1 || freqLower.includes('once daily') || freqLower.includes('once a day')) {
    return [`${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`];
  }
  
  // Handle twice daily (morning and evening)
  if (timesPerDay === 2 || freqLower.includes('twice daily') || freqLower.includes('twice a day')) {
    return [
      `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // Morning
      `${String((startHour + 12) % 24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // Evening (12 hours later)
    ];
  }
  
  // Handle thrice daily (morning, afternoon, evening)
  if (timesPerDay === 3 || freqLower.includes('thrice') || freqLower.includes('three times')) {
    return [
      `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // Morning
      `${String((startHour + 8) % 24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // Afternoon (8 hours later)
      `${String((startHour + 16) % 24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // Evening (16 hours later)
    ];
  }
  
  // Handle 4 times per day (every 6 hours)
  if (timesPerDay === 4) {
    return [
      `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // e.g., 06:00
      `${String((startHour + 6) % 24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // e.g., 12:00
      `${String((startHour + 12) % 24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // e.g., 18:00
      `${String((startHour + 18) % 24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // e.g., 00:00
    ];
  }
  
  // Default: distribute evenly across 24 hours starting from start time
  const intervalHours = 24 / timesPerDay;
  for (let i = 0; i < timesPerDay; i++) {
    const totalMinutes = startHour * 60 + startMinute + (i * intervalHours * 60);
    const doseHour = Math.floor((totalMinutes / 60) % 24);
    const doseMin = Math.floor(totalMinutes % 60);
    times.push(`${String(doseHour).padStart(2, '0')}:${String(doseMin).padStart(2, '0')}`);
  }
  
  return times.sort((a, b) => {
    const [h1, m1] = a.split(':').map(Number);
    const [h2, m2] = b.split(':').map(Number);
    return h1 * 60 + m1 - (h2 * 60 + m2);
  });
}

/**
 * Extract times_per_day from frequency text
 * Handles OCR errors like "closes" instead of "doses"
 */
function extractTimesPerDay(frequency) {
  if (!frequency) return 2;

  const freqLower = frequency.toLowerCase();

  // Match "X doses/dose/closes/close in 24hrs" - handle OCR error "closes" = "doses"
  // Also match patterns like "4 doses in 24hrs", "4 closes in 24hrs", "4 times in 24hrs"
  const dosesMatch = freqLower.match(/(\d+)\s*(?:doses?|times?|closes?|close)\s*(?:in|per|a)\s*(?:24\s*hrs?|24\s*hours?|day|daily)/);
  if (dosesMatch) {
    const count = parseInt(dosesMatch[1], 10);
    if (count > 0 && count <= 12) {
      return count;
    }
  }

  // Match "every X hours" or "every X-Y hours" - calculate times per day
  // For "every 4-6 hours", use the larger interval (6 hours = 4 times per day)
  const everyHoursMatch = freqLower.match(/(?:every|each)\s+(\d+)\s*(?:-|\s+(\d+))?\s*(?:hour|hr|h)/);
  if (everyHoursMatch) {
    const firstHour = parseInt(everyHoursMatch[1], 10);
    const secondHour = everyHoursMatch[2] ? parseInt(everyHoursMatch[2], 10) : null;
    
    // Use the larger interval if range is specified (e.g., "every 4-6 hours" = every 6 hours)
    const hours = secondHour && secondHour > firstHour ? secondHour : firstHour;
    
    if (hours > 0 && hours <= 24) {
      const calculated = Math.floor(24 / hours);
      // Ensure reasonable bounds
      if (calculated >= 1 && calculated <= 12) {
        return calculated;
      }
    }
  }

  // Match explicit counts
  if (freqLower.includes('once') || freqLower.includes('1 time')) return 1;
  if (freqLower.includes('twice') || freqLower.includes('2 times') || freqLower.includes('two times')) return 2;
  if (freqLower.includes('thrice') || freqLower.includes('three times') || freqLower.includes('3 times')) return 3;
  if (freqLower.includes('four times') || freqLower.includes('4 times') || freqLower.includes('four')) return 4;
  if (freqLower.includes('five times') || freqLower.includes('5 times')) return 5;
  if (freqLower.includes('six times') || freqLower.includes('6 times')) return 6;

  // Default
  return 2;
}

/**
 * Step 1: Extract OCR text from prescription image using Tesseract.js
 */
async function extractOCRText(imageBase64) {
  console.log('📸 [Step 1] Starting Tesseract.js OCR extraction...');
  console.log('   - Image size: ~', Math.round(imageBase64.length * 0.75 / 1024), 'KB');
  
  try {
    // Convert base64 to buffer for Tesseract
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    console.log('   - Initializing Tesseract worker...');
    console.log('   - Language: eng (English)');
    
    // Perform OCR with detailed progress logging
    const { data: { text }, data: ocrData } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: (info) => {
        if (info.status === 'recognizing text') {
          console.log(`   - OCR Progress: ${Math.round(info.progress * 100)}%`);
        } else if (info.status === 'loading tesseract core') {
          console.log('   - Loading Tesseract core...');
        } else if (info.status === 'initializing tesseract') {
          console.log('   - Initializing Tesseract...');
        } else if (info.status === 'loading language traineddata') {
          console.log('   - Loading language data...');
        }
      },
    });

    const ocrText = text.trim();
    
    console.log('✅ [Step 1] OCR extraction completed successfully!');
    console.log('   - Extracted text length:', ocrText.length, 'characters');
    console.log('   - Confidence:', ocrData.confidence ? `${Math.round(ocrData.confidence)}%` : 'N/A');
    console.log('   - Number of words:', ocrText.split(/\s+/).filter(w => w.length > 0).length);
    console.log('');
    console.log('📄 [Step 1] FULL OCR EXTRACTED TEXT:');
    console.log('=' .repeat(80));
    console.log(ocrText);
    console.log('=' .repeat(80));
    console.log('');
    
    // Log first 500 characters for quick preview
    if (ocrText.length > 500) {
      console.log('📄 [Step 1] OCR Text Preview (first 500 chars):');
      console.log(ocrText.substring(0, 500) + '...');
      console.log('');
    }
    
    if (!ocrText || ocrText.length < 5) {
      console.warn('⚠️ [Step 1] Warning: OCR extracted very little text. Image might be unclear or empty.');
    }
    
    return ocrText;
  } catch (error) {
    console.error('❌ [Step 1] Tesseract OCR extraction failed:', error.message);
    console.error('   - Error details:', error);
    throw new Error(`Failed to extract text from prescription image: ${error.message}`);
  }
}

/**
 * Step 2: Structure OCR text into JSON using medical extraction prompt
 */
async function structureOCRText(ocrText) {
  console.log('📋 [Step 2] Structuring OCR text into JSON using Hugging Face...');
  console.log('   - OCR text length:', ocrText.length, 'characters');
  console.log('   - Model: google/gemma-2-2b-it');

  const prompt = `You are a medical text extraction assistant specializing in prescription parsing.

The input below is RAW TEXT extracted using Tesseract OCR from a PRINTED doctor's prescription.
This OCR text may contain:
- Spelling errors (e.g., "closes" instead of "doses", "2:5ml" instead of "2.5ml")
- Broken lines
- Extra spaces
- OCR noise

Your task is ONLY to STRUCTURE the information that is EXPLICITLY PRESENT in the OCR text.

CRITICAL EXTRACTION RULES:
1. Extract ALL medicines from the prescription - if you see multiple medicines, list ALL of them
2. For medicine_name: Extract the exact name as written (e.g., "Paracetamol", "Famotidine Oral suspension")
3. For dosage: Extract exact dosage including units (e.g., "2.5ml", "120mg", "0.5ml", "40mg/5ml")
4. For frequency: Extract EXACT frequency text as written (e.g., "Every 4-6hrs", "Once daily", "4 doses in 24hrs", "Twice daily")
5. For times_per_day: Calculate based on frequency:
   - "once daily" or "once a day" = 1
   - "twice daily" or "twice a day" = 2
   - "4 doses in 24hrs" or "4 doses per day" = 4 (NOT 2!)
   - "every 6 hours" = 4 (24/6 = 4 times per day)
   - "every 4-6 hours" = 4 (use the larger interval: 24/6 = 4 times per day)
   - "every 4 hours" = 6 (24/4 = 6 times per day)
   - If frequency mentions "X doses" explicitly, use that number
6. For suggested_start_time: Calculate intelligently based on frequency:
   - "once daily" or "once a day" = "08:00" (morning)
   - "twice daily" = "08:00" (morning, evening 12h later)
   - "every 4-6 hours" or "every 6 hours" with 4 times per day = "06:00" (then 12:00, 18:00, 00:00)
   - "every 4 hours" with 6 times per day = "06:00" (then 10:00, 14:00, 18:00, 22:00, 02:00)
   - "4 doses in 24hrs" = "06:00" (spread evenly: 06:00, 12:00, 18:00, 00:00)
   - For frequent dosing (4+ times), start at "06:00"
   - For standard dosing (1-3 times), start at "08:00"

IMPORTANT: 
- DO NOT give medical advice
- DO NOT guess missing values - use "As prescribed" if unclear
- DO NOT correct OCR errors - extract what is there, but understand context
- DO NOT add medicines not written in the prescription
- Be context-aware: "4 closes in 24hrs" likely means "4 doses in 24hrs"
- Be context-aware: "2:5ml" likely means "2.5ml"

OCR TEXT:
<<<${ocrText}>>>

Return ONLY valid JSON in the following format (no markdown, no code blocks, just the JSON):
{
  "medicines": [
    {
      "medicine_name": "",
      "dosage": "",
      "frequency": "",
      "times_per_day": 0,
      "suggested_start_time": ""
    }
  ]
}`;

  try {
    console.log('   - Sending request to Hugging Face Router API...');
    console.log('   - Using OpenAI-compatible endpoint: /v1/chat/completions');
    const startTime = Date.now();
    
    // Use OpenAI-compatible endpoint like developmentInsight.js does
    const apiUrl = `${HF_ROUTER_URL}/v1/chat/completions`;
    
    const response = await axios.post(
      apiUrl,
      {
        model: TEXT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a medical text extraction assistant. Extract medication information from OCR text and return ONLY valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 1024,
        temperature: 0.1, // Very low temperature for structured output
      },
      {
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('✅ [Step 2] API call completed successfully!');
    console.log('   - Response status:', response.status);
    console.log('   - Response time:', duration, 'ms');

    // Extract generated text from OpenAI-compatible response format
    // Response format: { choices: [{ message: { content: "..." } }] }
    let structuredText = null;
    
    if (response.data?.choices && Array.isArray(response.data.choices) && response.data.choices.length > 0) {
      structuredText = response.data.choices[0]?.message?.content || null;
    } else if (Array.isArray(response.data)) {
      structuredText = response.data[0]?.generated_text || response.data[0]?.text || '';
    } else if (response.data?.generated_text) {
      structuredText = response.data.generated_text;
    } else if (typeof response.data === 'string') {
      structuredText = response.data;
    }

    if (!structuredText) {
      console.error('❌ [Step 2] No text content in response');
      console.error('   - Response data:', JSON.stringify(response.data, null, 2));
      throw new Error('No text response from Hugging Face API');
    }

    console.log('✅ [Step 2] Structured text received successfully!');
    console.log('   - Structured text length:', structuredText.length, 'characters');
    console.log('');
    console.log('📋 [Step 2] FULL STRUCTURED RESPONSE:');
    console.log('=' .repeat(80));
    console.log(structuredText);
    console.log('=' .repeat(80));
    console.log('');
    
    return structuredText;
  } catch (error) {
    console.error('❌ [Step 2] Error structuring text:', error.message);
    if (error.response) {
      console.error('   - API response status:', error.response.status);
      console.error('   - API response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Extract prescription data from a base64 image using two-step process
 *
 * @param {string} imageBase64 - Base64-encoded image string (with or without data URI prefix)
 * @returns {Promise<{
 *   medicines: Array<{
 *     medicine_name: string,
 *     dosage: string,
 *     frequency: string,
 *     times_per_day: number,
 *     suggested_start_time: string
 *   }>,
 *   raw_ai_output: string
 * }>}
 */
async function extractPrescriptionData(imageBase64) {
  // Clean base64 string (remove data URI prefix if present)
  const base64Data = imageBase64.includes(',') 
    ? imageBase64.split(',')[1] 
    : imageBase64;

  if (!HF_TOKEN) {
    console.warn('[MedGemma] HUGGINGFACE_TOKEN or HF_TOKEN not set. Returning placeholder prescription data.');
    return {
      medicines: [{
        medicine_name: 'Sample Medicine',
        dosage: '5 ml',
        frequency: 'Twice a day',
        times_per_day: 2,
        suggested_start_time: '08:00',
      }],
      raw_ai_output: 'Placeholder extraction – configure HUGGINGFACE_TOKEN or HF_TOKEN for real OCR.',
    };
  }

  try {
    console.log('');
    console.log('🔍 [MedGemma] Starting prescription extraction process...');
    console.log('=' .repeat(80));
    
    // Step 1: Extract OCR text from image using Tesseract.js
    const ocrText = await extractOCRText(base64Data);
    
    if (!ocrText || ocrText.trim().length < 5) {
      throw new Error('OCR extraction returned empty or too short text. Image might be unclear.');
    }

    // Step 2: Structure OCR text into JSON
    const structuredText = await structureOCRText(ocrText);

    // Parse the JSON response
    console.log('🔧 [Parsing] Extracting JSON from structured response...');
    let jsonText = structuredText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.includes('```json')) {
      jsonText = jsonText.split('```json')[1].split('```')[0].trim();
      console.log('   - Removed markdown code block (```json)');
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.split('```')[1].split('```')[0].trim();
      console.log('   - Removed markdown code block (```)');
    }

    // Try to extract JSON object from text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
      console.log('   - Extracted JSON object from response text');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
      console.log('✅ [Parsing] JSON parsed successfully!');
      console.log('   - Medicines found:', parsedData.medicines?.length || 0);
    } catch (parseError) {
      console.error('❌ [Parsing] Failed to parse JSON:', parseError.message);
      console.error('   - Attempted to parse:', jsonText.substring(0, 500));
      throw new Error(`Failed to parse structured JSON response: ${parseError.message}`);
    }

    // Extract medicines array
    let medicines = parsedData.medicines || parsedData.medicine || [];
    if (!Array.isArray(medicines)) {
      medicines = [medicines];
    }

    console.log('');
    console.log('🔧 [Validation] Validating and normalizing medicine data...');

    // Validate and normalize medicine data
    const validatedMedicines = medicines.map((med, index) => {
      let frequency = med.frequency || med.freq || '';
      
      // Fix common OCR errors in frequency text
      frequency = frequency
        .replace(/closes/gi, 'doses') // "4 closes" -> "4 doses"
        .replace(/dose\s*in/gi, 'doses in') // Normalize
        .trim();
      
      const timesPerDay = typeof med.times_per_day === 'number' 
        ? med.times_per_day 
        : extractTimesPerDay(frequency);
      
      // Recalculate times_per_day from frequency to ensure accuracy
      const calculatedTimesPerDay = extractTimesPerDay(frequency);
      const finalTimesPerDay = calculatedTimesPerDay > 0 && calculatedTimesPerDay <= 12 
        ? calculatedTimesPerDay 
        : (timesPerDay > 0 && timesPerDay <= 12 ? timesPerDay : 2);

      // Calculate suggested start time based on frequency and times_per_day
      const startTime = med.suggested_start_time || calculateStartTime(frequency, finalTimesPerDay);
      
      // Calculate dose schedule for display
      const doseSchedule = calculateDoseSchedule(frequency, finalTimesPerDay, startTime);

      const medicine = {
        medicine_name: med.medicine_name || med.name || med.medication_name || `Medicine ${index + 1}`,
        dosage: med.dosage || med.dose || 'As prescribed',
        frequency: frequency || 'As directed',
        times_per_day: finalTimesPerDay || 2,
        suggested_start_time: startTime,
        dose_schedule: doseSchedule, // Array of all dose times for user display
      };

      console.log(`   - Medicine ${index + 1}: ${medicine.medicine_name}`);
      console.log(`     * Dosage: ${medicine.dosage}`);
      console.log(`     * Frequency: ${medicine.frequency}`);
      console.log(`     * Times per day: ${medicine.times_per_day}`);
      console.log(`     * Start time: ${medicine.suggested_start_time}`);
      console.log(`     * Dose schedule: ${medicine.dose_schedule.join(', ')}`);

      return medicine;
    }).filter(med => med.medicine_name && med.medicine_name !== 'As prescribed' && !med.medicine_name.startsWith('Medicine '));

    // Remove duplicates based on medicine name
    const uniqueMedicines = [];
    const seenNames = new Set();
    for (const med of validatedMedicines) {
      const nameLower = med.medicine_name.toLowerCase().trim();
      if (!seenNames.has(nameLower) && med.medicine_name) {
        seenNames.add(nameLower);
        uniqueMedicines.push(med);
      }
    }

    console.log('');
    console.log('✅ [MedGemma] Prescription extraction completed successfully!');
    console.log('=' .repeat(80));
    console.log(`📊 Summary: ${uniqueMedicines.length} unique medicine(s) extracted`);
    console.log('=' .repeat(80));
    console.log('');

    return {
      medicines: uniqueMedicines.length > 0 ? uniqueMedicines : validatedMedicines,
      raw_ai_output: `OCR Text:\n${ocrText}\n\nStructured:\n${structuredText}`,
    };
  } catch (error) {
    console.error('');
    console.error('❌ [MedGemma] Error in extraction process:', error.message);
    console.error('=' .repeat(80));
    if (error.response) {
      console.error('[MedGemma] API response status:', error.response.status);
      console.error('[MedGemma] API response data:', JSON.stringify(error.response.data, null, 2));
      
      // Handle model loading errors
      if (error.response.data?.error?.includes('loading') || error.response.status === 503) {
        console.warn('[MedGemma] Model is still loading, may need a few seconds...');
        return {
          medicines: [{
            medicine_name: 'Model loading...',
            dosage: 'Please try again in a few seconds',
            frequency: '',
            times_per_day: 2,
            suggested_start_time: '08:00',
          }],
          raw_ai_output: 'Model is loading. Please retry the extraction in a few moments.',
        };
      }
    }
    console.error('=' .repeat(80));
    console.error('');

    // Fall back to placeholder that allows user editing
    return {
      medicines: [{
        medicine_name: 'Medicine (please edit)',
        dosage: 'As prescribed',
        frequency: 'As directed',
        times_per_day: 2,
        suggested_start_time: '08:00',
      }],
      raw_ai_output: `Error: ${error.message}. Please manually enter medication details.`,
    };
  }
}

module.exports = {
  extractPrescriptionData,
};
