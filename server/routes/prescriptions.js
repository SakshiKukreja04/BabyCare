const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { extractPrescriptionData } = require('../services/medgemma');

/**
 * POST /scan-prescription
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

    // Extract prescription data using MedGemma
    console.log('🔍 [Prescription] Extracting medication data from image...');
    const extractedData = await extractPrescriptionData(imageBase64);
    console.log('✅ [Prescription] Extracted data:', extractedData);

    // Create prescription log in Firestore
    const prescriptionRef = db.collection('prescriptionLogs').doc();
    const prescriptionData = {
      id: prescriptionRef.id,
      babyId,
      parentId,
      status: 'scheduled', // scheduled, confirmed, completed, cancelled
      medicine_name: extractedData.medicine_name,
      dosage: extractedData.dosage,
      frequency: extractedData.frequency,
      times_per_day: extractedData.times_per_day,
      suggested_start_time: extractedData.suggested_start_time,
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
        extractedData: {
          medicine_name: extractedData.medicine_name,
          dosage: extractedData.dosage,
          frequency: extractedData.frequency,
          times_per_day: extractedData.times_per_day,
          suggested_start_time: extractedData.suggested_start_time,
        },
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
  try {
    const { prescriptionId } = req.params;
    const { medicine_name, dosage, frequency, times_per_day, suggested_start_time } = req.body;
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
    
    // Verify ownership
    if (prescriptionData.parentId !== parentId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this prescription',
      });
    }

    // Update prescription with confirmed/edited data
    const updateData = {
      status: 'confirmed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (medicine_name !== undefined) updateData.medicine_name = medicine_name;
    if (dosage !== undefined) updateData.dosage = dosage;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (times_per_day !== undefined) updateData.times_per_day = parseInt(times_per_day, 10);
    if (suggested_start_time !== undefined) updateData.suggested_start_time = suggested_start_time;

    await prescriptionRef.update(updateData);

    res.json({
      success: true,
      data: {
        prescriptionId,
        status: 'confirmed',
        message: 'Prescription confirmed and scheduled',
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

module.exports = router;
