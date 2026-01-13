const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { extractPrescriptionData } = require('../services/medgemma');
const { generateRemindersFor24Hours } = require('../services/reminders');
const { babyOwnershipCache } = require('../services/memoryCache');

// Query limits to prevent quota exhaustion
const QUERY_LIMITS = {
  PRESCRIPTION_LOGS: 50,
  MEDICINES_PER_PRESCRIPTION: 10,
};

/**
 * Verify baby ownership with caching
 */
async function verifyBabyOwnership(babyId, parentId) {
  const cacheKey = `baby_${babyId}`;
  const cached = babyOwnershipCache.get(cacheKey);
  if (cached) {
    return { valid: cached.parentId === parentId, babyData: cached };
  }
  
  try {
    const babyDoc = await db.collection('babies').doc(babyId).get();
    if (!babyDoc.exists) return { valid: false, babyData: null };
    const babyData = babyDoc.data();
    babyOwnershipCache.set(cacheKey, babyData);
    return { valid: babyData.parentId === parentId, babyData };
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Prescriptions] Quota exceeded during baby ownership check');
      return { valid: false, quotaExceeded: true };
    }
    throw error;
  }
}

/**
 * GET /prescriptions/logs
 * Fetch all prescription logs for the authenticated user (parentId)
 * OPTIMIZED: Added hard limit to prevent quota exhaustion
 */
router.get('/logs', verifyToken, async (req, res) => {
  try {
    const parentId = req.user.uid;
    const { babyId } = req.query;
    console.log('📋 [Prescription Logs] GET /logs - parentId:', parentId, 'babyId:', babyId || 'all');
    
    // Query with HARD LIMIT
    const query = db.collection('prescriptionLogs')
      .where('parentId', '==', parentId)
      .limit(QUERY_LIMITS.PRESCRIPTION_LOGS);
    
    const snapshot = await query.get();
    
    // Defensive: handle undefined snapshot
    if (!snapshot || !snapshot.docs || !Array.isArray(snapshot.docs)) {
      return res.json({ success: true, logs: [] });
    }
    
    console.log('📋 [Prescription Logs] Query returned', snapshot.size, 'documents');
    
    let logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        confirmedAt: data.confirmedAt?.toDate?.() || data.confirmedAt,
      };
    });

    // Filter by babyId if provided
    if (babyId) {
      logs = logs.filter(log => log.babyId === babyId);
    }

    // Sort by createdAt descending (newest first)
    logs.sort((a, b) => {
      const timeA = a.createdAt?.getTime?.() || new Date(a.createdAt).getTime() || 0;
      const timeB = b.createdAt?.getTime?.() || new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    console.log('✅ [Prescription Logs] Returning', logs.length, 'logs');
    res.json({ success: true, logs });
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Prescription Logs] Quota exceeded');
      return res.status(503).json({ 
        error: 'Service Unavailable', 
        message: 'Temporarily unable to fetch logs. Please try again.' 
      });
    }
    console.error('❌ [Prescription Logs] Error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: error.message || 'Failed to fetch logs' });
  }
});

// Log all prescription routes for debugging
router.use((req, res, next) => {
  console.log(`📋 [Prescription Router] ${req.method} ${req.path}`);
  next();
});

/**
 * POST /prescriptions/scan-prescription
 * Scan a prescription image and extract medication information
 * 
 * Request body:
 * {
 *   babyId: string,
 *   imageBase64: string (base64 encoded image)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     prescriptionId: string,
 *     extractedData: {
 *       medicine_name: string,
 *       dosage: string,
 *       frequency: string,
 *       times_per_day: number,
 *       suggested_start_time: string (HH:mm)
 *     },
 *     raw_ai_output: string
 *   }
 * }
 */
router.post('/scan-prescription', verifyToken, async (req, res) => {
  try {
    const { babyId, imageBase64 } = req.body;
    const parentId = req.user.uid;

    // Validate required fields
    if (!babyId || !imageBase64) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId and imageBase64 are required',
      });
    }

    // Verify baby belongs to parent
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

    // Extract prescription data using Gemini Vision API
    console.log('🔍 [Prescription] Extracting medication data from image...');
    const extractedData = await extractPrescriptionData(imageBase64);
    console.log('✅ [Prescription] Extracted data:', JSON.stringify(extractedData, null, 2));

    // Validate that medicines array exists
    if (!extractedData.medicines || !Array.isArray(extractedData.medicines) || extractedData.medicines.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Failed to extract medication information from image. Please try again or enter manually.',
      });
    }

    // Create prescription log in Firestore with medicines array
    const prescriptionRef = db.collection('prescriptionLogs').doc();
    const prescriptionData = {
      id: prescriptionRef.id,
      babyId,
      parentId,
      status: 'scheduled', // scheduled, confirmed, completed, cancelled
      medicines: extractedData.medicines, // Array of medicines
      raw_ai_output: extractedData.raw_ai_output,
      imageBase64: imageBase64.substring(0, 100) + '...', // Store truncated version for reference
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await prescriptionRef.set(prescriptionData);

    console.log('✅ [Prescription] Saved to Firestore:', prescriptionRef.id);

    // Return extracted data for frontend review
    res.json({
      success: true,
      data: {
        prescriptionId: prescriptionRef.id,
        medicines: extractedData.medicines,
        raw_ai_output: extractedData.raw_ai_output,
      },
    });
  } catch (error) {
    console.error('Error scanning prescription:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to scan prescription',
    });
  }
});

/**
 * POST /prescriptions/:prescriptionId/confirm
 * Confirm and activate a prescription schedule
 * 
 * Request body:
 * {
 *   medicine_name?: string (edited),
 *   dosage?: string (edited),
 *   frequency?: string (edited),
 *   times_per_day?: number (edited),
 *   suggested_start_time?: string (edited)
 * }
 */
router.post('/:prescriptionId/confirm', verifyToken, async (req, res) => {
  console.log('✅ [Prescription Confirm] Received confirmation request');
  console.log('   - Prescription ID:', req.params.prescriptionId);
  console.log('   - Request body:', JSON.stringify(req.body, null, 2));
  try {
    const { prescriptionId } = req.params;
    const { medicines } = req.body; // Expect array of medicines
    const parentId = req.user.uid;

    // Fetch prescription
    const prescriptionRef = db.collection('prescriptionLogs').doc(prescriptionId);
    const prescriptionDoc = await prescriptionRef.get();

    if (!prescriptionDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Prescription not found',
      });
    }

    const prescriptionData = prescriptionDoc.data();
    const babyId = prescriptionData.babyId;
    
    // Verify ownership
    if (prescriptionData.parentId !== parentId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this prescription',
      });
    }

    // Validate medicines array
    if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'medicines array is required and must contain at least one medicine',
      });
    }

    // Process medicines: calculate proper start times and dose schedules
    const processedMedicines = medicines.map((med, index) => {
      const frequency = med.frequency || 'As directed';
      const timesPerDay = typeof med.times_per_day === 'number' ? med.times_per_day : 2;
      const startTime = med.suggested_start_time || '08:00';
      
      // Calculate dose times based on frequency and times_per_day
      // Use dose_schedule from frontend if provided, otherwise calculate
      const doseTimes = med.dose_schedule && Array.isArray(med.dose_schedule) && med.dose_schedule.length > 0
        ? med.dose_schedule
        : calculateDoseSchedule(frequency, timesPerDay, startTime);
      
      return {
        medicine_name: med.medicine_name || `Medicine ${index + 1}`,
        dosage: med.dosage || 'As prescribed',
        frequency: frequency,
        times_per_day: timesPerDay,
        suggested_start_time: doseTimes[0] || startTime, // First dose time
        dose_schedule: doseTimes, // Array of all dose times for reminders (e.g., ["06:00", "12:00", "18:00", "00:00"])
        last_given: null, // Track last administered dose timestamp
        last_given_index: null, // Track which dose schedule index was last given
        next_dose_index: 0, // Track which dose is next in the schedule
        created_at: Date.now(), // When this medicine schedule was created
      };
    });

    console.log('✅ [Prescription Confirm] Processed medicines:', JSON.stringify(processedMedicines, null, 2));

    // Update prescription with confirmed/edited medicines array and schedule
    await prescriptionRef.update({
      medicines: processedMedicines,
      status: 'confirmed',
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ [Prescription Confirm] Prescription confirmed and scheduled in Firestore');

    // Generate reminders for each medicine
    console.log('🔔 [Prescription Confirm] Generating reminders for medicines...');
    console.log('   - Baby ID:', babyId);
    console.log('   - Parent ID:', parentId);
    
    try {
      if (!babyId) {
        throw new Error('Baby ID is undefined - cannot generate reminders');
      }
      if (!parentId) {
        throw new Error('Parent ID is undefined - cannot generate reminders');
      }
      
      for (const medicine of processedMedicines) {
        const reminderIds = await generateRemindersFor24Hours(babyId, parentId, medicine);
        console.log(`✅ [Prescription Confirm] Generated ${reminderIds.length} reminders for ${medicine.medicine_name}`);
      }
    } catch (reminderError) {
      console.error('⚠️  [Prescription Confirm] Error generating reminders:', reminderError.message);
      // Don't fail the prescription confirmation if reminders fail
      // Log the error but continue
    }

    res.json({
      success: true,
      data: {
        prescriptionId,
        status: 'confirmed',
        message: 'Prescription confirmed and scheduled with reminders',
      },
    });
  } catch (error) {
    console.error('Error confirming prescription:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to confirm prescription',
    });
  }
});

/**
 * Removed duplicate code from original - reminders already created above
 */
async function createRemindersForMedicines(babyId, parentId, medicines) {
  try {
    for (const medicine of medicines) {
      await generateRemindersFor24Hours(babyId, parentId, medicine);
    }
  } catch (error) {
    console.error('❌ [Prescription] Error creating reminders:', error.message);
    throw error;
  }
}

/**
 * OLD DUPLICATE POST CONFIRM ROUTE - REMOVED
 * (This was likely causing issues before)
 */

/**
 * GET /prescriptions?babyId=<id>
 * Get prescriptions for a baby
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.query;
    const parentId = req.user.uid;

    if (!babyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId query parameter is required',
      });
    }

    // Verify baby belongs to parent
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

    // Fetch prescriptions
    const prescriptionsQuery = await db.collection('prescriptionLogs')
      .where('parentId', '==', parentId)
      .where('babyId', '==', babyId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const prescriptions = prescriptionsQuery.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      };
    });

    res.json({
      success: true,
      data: {
        prescriptions,
        count: prescriptions.length,
      },
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch prescriptions',
    });
  }
});

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
  const everyHoursMatch = freqLower.match(/(?:every|each)\s+(\d+)\s*(?:-|\s)?\s*(?:hour|hr|h)/);
  if (everyHoursMatch) {
    const hoursBetweenDoses = parseInt(everyHoursMatch[1], 10);
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
      `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // 06:00
      `${String((startHour + 6) % 24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // 12:00
      `${String((startHour + 12) % 24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // 18:00
      `${String((startHour + 18) % 24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`, // 00:00
    ];
  }
  
  // Handle 5-6 times per day (every 4-5 hours)
  if (timesPerDay === 5) {
    const interval = 4.8; // Approximately every 4.8 hours
    for (let i = 0; i < 5; i++) {
      const totalMinutes = startHour * 60 + startMinute + (i * interval * 60);
      const doseHour = Math.floor((totalMinutes / 60) % 24);
      const doseMin = Math.floor(totalMinutes % 60);
      times.push(`${String(doseHour).padStart(2, '0')}:${String(doseMin).padStart(2, '0')}`);
    }
    return times;
  }
  
  if (timesPerDay === 6) {
    const interval = 4; // Every 4 hours
    for (let i = 0; i < 6; i++) {
      const totalMinutes = startHour * 60 + startMinute + (i * interval * 60);
      const doseHour = Math.floor((totalMinutes / 60) % 24);
      const doseMin = Math.floor(totalMinutes % 60);
      times.push(`${String(doseHour).padStart(2, '0')}:${String(doseMin).padStart(2, '0')}`);
    }
    return times;
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

module.exports = router;
