const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const {
  generateRemindersFor24Hours,
  getRemindersForToday,
  dismissReminder,
  getRemindersForParent,
} = require('../services/reminders');

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

    // Verify the baby belongs to the parent
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

    // Get today's reminders
    const reminders = await getRemindersForToday(babyId);

    // Calculate summary
    const summary = {
      total: reminders.length,
      pending: reminders.filter(r => r.status === 'pending').length,
      sent: reminders.filter(r => r.status === 'sent').length,
      dismissed: reminders.filter(r => r.status === 'dismissed').length,
      failed: reminders.filter(r => r.status === 'failed').length,
    };

    res.json({
      success: true,
      data: {
        reminders,
        summary,
      },
    });
  } catch (error) {
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

    res.json({
      success: true,
      data: {
        reminders,
        count: reminders.length,
      },
    });
  } catch (error) {
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
      scheduled_for: reminderData.scheduled_for.toDate(),
      created_at: reminderData.created_at?.toDate?.() || reminderData.created_at,
      updated_at: reminderData.updated_at?.toDate?.() || reminderData.updated_at,
    };

    res.json({
      success: true,
      data: { reminder },
    });
  } catch (error) {
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

    // Verify the baby belongs to the parent
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

    // Get reminders sent in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const query = db.collection('reminders')
      .where('babyId', '==', babyId)
      .where('status', '==', 'sent');

    const snapshot = await query.get();
    
    const reminders = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        updated_at: doc.data().updated_at?.toDate?.() || doc.data().updated_at,
      }))
      .filter(r => {
        const updatedAt = r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at);
        return updatedAt >= fiveMinutesAgo;
      })
      .sort((a, b) => {
        const aTime = a.updated_at instanceof Date ? a.updated_at : new Date(a.updated_at);
        const bTime = b.updated_at instanceof Date ? b.updated_at : new Date(b.updated_at);
        return bTime - aTime;
      });

    res.json({
      success: true,
      data: { reminders },
    });
  } catch (error) {
    console.error('❌ [Reminders API] Error fetching recently sent reminders:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch reminders',
    });
  }
});

module.exports = router;
