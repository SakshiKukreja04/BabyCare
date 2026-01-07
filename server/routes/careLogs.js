const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { evaluateFeedingRules } = require('../services/ruleEngine');
const { sendAlertNotification } = require('../services/fcm');
const { sendAlertViaWhatsApp, getUserPhoneNumber } = require('../services/whatsapp');

/**
 * POST /care-logs
 * Create a new care log entry
 * 
 * Flow:
 * 1. Verify user via auth middleware
 * 2. Store care log in Firestore
 * 3. If log type === 'feeding', call rule engine
 * 4. Send notifications if alerts are created
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { babyId, type, quantity, duration, medicationGiven, notes } = req.body;
    const parentId = req.user.uid;

    // Validate required fields
    if (!babyId || !type) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId and type are required',
      });
    }

    // Validate type
    const validTypes = ['feeding', 'sleep', 'medication'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `type must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Validate type-specific fields
    if (type === 'feeding' && quantity === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'quantity is required for feeding logs',
      });
    }

    if (type === 'sleep' && duration === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'duration is required for sleep logs',
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

    // Create care log document
    // Only include fields that are relevant to the log type (Firestore doesn't allow undefined)
    const careLogRef = db.collection('careLogs').doc();
    const careLogData = {
      id: careLogRef.id,
      parentId,
      babyId,
      type,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add type-specific fields only if they exist
    if (type === 'feeding' && quantity !== undefined) {
      careLogData.quantity = quantity;
    }
    if (type === 'sleep' && duration !== undefined) {
      careLogData.duration = duration;
    }
    if (type === 'medication' && medicationGiven !== undefined) {
      careLogData.medicationGiven = medicationGiven;
    }
    if (notes) {
      careLogData.notes = notes;
    }

    await careLogRef.set(careLogData);

    // If feeding log, evaluate rules
    let alerts = [];
    if (type === 'feeding') {
      alerts = await evaluateFeedingRules(babyId, parentId);

      // Send notifications for new alerts
      for (const alert of alerts) {
        try {
          // Send FCM notification
          await sendAlertNotification(parentId, alert);

          // Send WhatsApp notification if phone number available
          const phoneNumber = await getUserPhoneNumber(parentId);
          if (phoneNumber) {
            await sendAlertViaWhatsApp(phoneNumber, alert);
          }
        } catch (notificationError) {
          console.error('Error sending notifications:', notificationError);
          // Don't fail the request if notifications fail
        }
      }
    }

    res.status(201).json({
      success: true,
      data: {
        careLog: {
          ...careLogData,
          timestamp: new Date().toISOString(),
        },
        alertsCreated: alerts.length,
      },
    });
  } catch (error) {
    console.error('Error creating care log:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create care log',
    });
  }
});

/**
 * GET /care-logs
 * Get care logs for a baby
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { babyId, limit = 20 } = req.query;
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

    // Fetch care logs
    // Note: We filter by parentId first, then filter and sort client-side
    // to avoid requiring a composite index
    const careLogsRef = db.collection('careLogs');
    const query = careLogsRef
      .where('parentId', '==', parentId)
      .limit(100); // Get more than needed, then filter client-side

    const snapshot = await query.get();
    
    // Filter by babyId and sort by timestamp client-side
    const careLogs = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp,
        };
      })
      .filter(log => log.babyId === babyId)
      .sort((a, b) => {
        // Sort by timestamp descending (newest first)
        const aTime = a.timestamp?.toMillis?.() || a.timestamp?.toDate?.()?.getTime() || 0;
        const bTime = b.timestamp?.toMillis?.() || b.timestamp?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, parseInt(limit, 10))
      .map(log => ({
        ...log,
        timestamp: log.timestamp?.toDate?.()?.toISOString() || log.timestamp?.toISOString?.() || log.timestamp,
      }));

    res.json({
      success: true,
      data: {
        careLogs,
        count: careLogs.length,
      },
    });
  } catch (error) {
    console.error('Error fetching care logs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch care logs',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;

