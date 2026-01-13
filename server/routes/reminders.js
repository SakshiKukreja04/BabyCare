const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { babyOwnershipCache } = require('../services/memoryCache');
const {
  generateRemindersFor24Hours,
  getRemindersForToday,
  dismissReminder,
  getRemindersForParent,
} = require('../services/reminders');

// Query limits to prevent quota exhaustion
const QUERY_LIMITS = {
  RECENTLY_SENT: 10,
  TODAY_SUMMARY: 50,
};

/**
 * Verify baby ownership with caching
 * Caches babyId → parentId mapping for 5 minutes
 * @param {string} babyId - Baby ID
 * @param {string} parentId - Parent ID to verify
 * @returns {Promise<{valid: boolean, babyData?: Object}>}
 */
async function verifyBabyOwnership(babyId, parentId) {
  const cacheKey = `baby_${babyId}`;
  
  // Check cache first
  const cached = babyOwnershipCache.get(cacheKey);
  if (cached) {
    return {
      valid: cached.parentId === parentId,
      babyData: cached,
    };
  }
  
  try {
    const babyRef = db.collection('babies').doc(babyId);
    const babyDoc = await babyRef.get();
    
    if (!babyDoc.exists) {
      return { valid: false, babyData: null };
    }
    
    const babyData = babyDoc.data();
    
    // Cache the baby data
    babyOwnershipCache.set(cacheKey, babyData);
    
    return {
      valid: babyData.parentId === parentId,
      babyData,
    };
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders API] Quota exceeded during baby ownership check');
      return { valid: false, babyData: null, quotaExceeded: true };
    }
    throw error;
  }
}

/**
 * GET /api/reminders/today
 * Get today's reminders for a specific baby
 * 
 * Query params:
 *   babyId: string (required)
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     reminders: [
 *       {
 *         id: string,
 *         babyId: string,
 *         medicine_name: string,
 *         dosage: string,
 *         frequency: string,
 *         dose_time: string (HH:mm),
 *         scheduled_for: ISO string (timestamp),
 *         status: "pending" | "sent" | "dismissed" | "failed",
 *         channels: ["web", "whatsapp"],
 *         attempt_count: number,
 *         created_at: ISO string,
 *         updated_at: ISO string,
 *       }
 *     ],
 *     summary: {
 *       total: number,
 *       pending: number,
 *       sent: number,
 *       dismissed: number,
 *     }
 *   }
 * }
 */
router.get('/today', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.query;
    const parentId = req.user.uid;

    if (!babyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId query parameter is required',
      });
    }

    // Verify the baby belongs to the parent (with caching)
    const ownership = await verifyBabyOwnership(babyId, parentId);
    
    if (ownership.quotaExceeded) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Temporarily unable to process request. Please try again.',
      });
    }
    
    if (!ownership.babyData) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Baby not found',
      });
    }

    if (!ownership.valid) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this baby',
      });
    }

    // Get today's reminders
    const reminders = await getRemindersForToday(babyId);
    
    // Defensive: ensure reminders is an array
    const safeReminders = Array.isArray(reminders) ? reminders : [];

    // Calculate summary
    const summary = {
      total: safeReminders.length,
      pending: safeReminders.filter(r => r && r.status === 'pending').length,
      sent: safeReminders.filter(r => r && r.status === 'sent').length,
      dismissed: safeReminders.filter(r => r && r.status === 'dismissed').length,
      failed: safeReminders.filter(r => r && r.status === 'failed').length,
    };

    res.json({
      success: true,
      data: {
        reminders: safeReminders,
        summary,
      },
    });
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders API] Quota exceeded fetching today\'s reminders');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Temporarily unable to process request. Please try again.',
      });
    }
    console.error('❌ [Reminders API] Error fetching today\'s reminders:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch reminders',
    });
  }
});

/**
 * GET /api/reminders/all
 * Get all reminders for the parent (with optional filters)
 * 
 * Query params (optional):
 *   status: "pending" | "sent" | "dismissed" | "failed"
 *   startDate: ISO string (filter reminders from this date)
 *   endDate: ISO string (filter reminders until this date)
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     reminders: [...],
 *     count: number
 *   }
 * }
 */
router.get('/all', verifyToken, async (req, res) => {
  try {
    const parentId = req.user.uid;
    const { status, startDate, endDate } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const reminders = await getRemindersForParent(parentId, filters);
    
    // Defensive: ensure reminders is an array
    const safeReminders = Array.isArray(reminders) ? reminders : [];

    res.json({
      success: true,
      data: {
        reminders: safeReminders,
        count: safeReminders.length,
      },
    });
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders API] Quota exceeded fetching all reminders');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Temporarily unable to process request. Please try again.',
      });
    }
    console.error('❌ [Reminders API] Error fetching all reminders:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch reminders',
    });
  }
});

/**
 * POST /api/reminders/:reminderId/dismiss
 * Dismiss a reminder (mark as given by parent)
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Reminder dismissed"
 * }
 */
router.post('/:reminderId/dismiss', verifyToken, async (req, res) => {
  try {
    const { reminderId } = req.params;
    const parentId = req.user.uid;

    if (!reminderId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'reminderId is required',
      });
    }

    // Verify reminder belongs to parent
    const reminderRef = db.collection('reminders').doc(reminderId);
    const reminderDoc = await reminderRef.get();

    if (!reminderDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reminder not found',
      });
    }

    const reminderData = reminderDoc.data();
    if (reminderData.parentId !== parentId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this reminder',
      });
    }

    // Dismiss the reminder
    await dismissReminder(reminderId);

    res.json({
      success: true,
      message: 'Reminder dismissed',
    });
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders API] Quota exceeded dismissing reminder');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Temporarily unable to process request. Please try again.',
      });
    }
    console.error('❌ [Reminders API] Error dismissing reminder:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to dismiss reminder',
    });
  }
});

/**
 * GET /api/reminders/:reminderId
 * Get a specific reminder details
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     reminder: {...}
 *   }
 * }
 */
router.get('/:reminderId', verifyToken, async (req, res) => {
  try {
    const { reminderId } = req.params;
    const parentId = req.user.uid;

    if (!reminderId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'reminderId is required',
      });
    }

    const reminderRef = db.collection('reminders').doc(reminderId);
    const reminderDoc = await reminderRef.get();

    if (!reminderDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reminder not found',
      });
    }

    const reminderData = reminderDoc.data();
    if (reminderData.parentId !== parentId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this reminder',
      });
    }

    const reminder = {
      id: reminderDoc.id,
      ...reminderData,
      scheduled_for: reminderData.scheduled_for?.toDate?.() || reminderData.scheduled_for,
      nextTriggerAt: reminderData.nextTriggerAt?.toDate?.() || reminderData.nextTriggerAt,
      created_at: reminderData.created_at?.toDate?.() || reminderData.created_at,
      updated_at: reminderData.updated_at?.toDate?.() || reminderData.updated_at,
    };

    res.json({
      success: true,
      data: { reminder },
    });
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders API] Quota exceeded fetching reminder');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Temporarily unable to process request. Please try again.',
      });
    }
    console.error('❌ [Reminders API] Error fetching reminder:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch reminder',
    });
  }
});

/**
 * GET /api/reminders/recently-sent/:babyId
 * Get recently sent reminders (last 5 minutes) for real-time UI updates
 * OPTIMIZED: Uses Firestore index query with limit, NO in-memory filtering
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     reminders: [ reminder objects ]
 *   }
 * }
 */
router.get('/recently-sent/:babyId', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.params;
    const parentId = req.user.uid;

    // Verify the baby belongs to the parent (with caching)
    const ownership = await verifyBabyOwnership(babyId, parentId);
    
    if (ownership.quotaExceeded) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Temporarily unable to process request. Please try again.',
      });
    }
    
    if (!ownership.babyData) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Baby not found',
      });
    }

    if (!ownership.valid) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this baby',
      });
    }

    // Get reminders sent in the last 5 minutes
    // OPTIMIZED: Query with all filters at Firestore level
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const fiveMinutesAgoTimestamp = admin.firestore.Timestamp.fromDate(fiveMinutesAgo);

    const query = db.collection('reminders')
      .where('babyId', '==', babyId)
      .where('status', '==', 'sent')
      .where('updated_at', '>=', fiveMinutesAgoTimestamp)
      .orderBy('updated_at', 'desc')
      .limit(QUERY_LIMITS.RECENTLY_SENT);

    const snapshot = await query.get();
    
    // Defensive: handle undefined snapshot
    if (!snapshot || !snapshot.docs || !Array.isArray(snapshot.docs)) {
      return res.json({
        success: true,
        data: { reminders: [] },
      });
    }
    
    const reminders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        scheduled_for: data.scheduled_for?.toDate?.() || data.scheduled_for,
        updated_at: data.updated_at?.toDate?.() || data.updated_at,
        created_at: data.created_at?.toDate?.() || data.created_at,
      };
    });

    res.json({
      success: true,
      data: { reminders },
    });
  } catch (error) {
    if (error.code === 8) {
      console.warn('⚠️ [Reminders API] Quota exceeded fetching recently sent reminders');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Temporarily unable to process request. Please try again.',
      });
    }
    // Handle missing index error gracefully
    if (error.code === 9 || error.message?.includes('index')) {
      console.warn('⚠️ [Reminders API] Missing Firestore index for recently-sent query');
      // Fallback: return empty array rather than error
      return res.json({
        success: true,
        data: { reminders: [] },
        meta: { indexRequired: true },
      });
    }
    console.error('❌ [Reminders API] Error fetching recently sent reminders:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch reminders',
    });
  }
});

module.exports = router;
