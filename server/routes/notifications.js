const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');

/**
 * Notifications API
 * 
 * Unified endpoint for the notification bell icon
 * Returns both alerts and care reminders combined
 * 
 * Response format:
 * {
 *   notifications: [
 *     {
 *       type: "alert" | "reminder",
 *       severity: "HIGH" | "MEDIUM" | "LOW" (for alerts only),
 *       message: String,
 *       createdAt: ISO String
 *     }
 *   ],
 *   unreadCount: number
 * }
 */

/**
 * GET /api/notifications
 * Get all notifications (alerts + reminders) for the bell icon
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { babyId, limit = 50 } = req.query;
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

    // Fetch active alerts - only HIGH severity for bell icon notifications
    // MEDIUM/LOW alerts are shown in the dashboard but don't trigger bell notifications
    const alertsQuery = await db.collection('alerts')
      .where('parentId', '==', parentId)
      .where('babyId', '==', babyId)
      .where('isActive', '==', true)
      .limit(parseInt(limit))
      .get();

    // Filter to only HIGH severity alerts for bell icon
    const alerts = alertsQuery.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'alert',
          alertType: data.type || 'feeding',
          severity: data.severity || 'MEDIUM',
          title: data.title,
          message: data.message || data.triggerData?.message || data.description,
          ruleId: data.ruleId,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          isActive: data.isActive,
        };
      })
      .filter(alert => alert.severity === 'HIGH'); // Only HIGH severity for bell icon

    // Check if user has any confirmed prescriptions (for medication reminders)
    const prescriptionsQuery = await db.collection('prescriptions')
      .where('parentId', '==', parentId)
      .where('babyId', '==', babyId)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get();
    
    const hasPrescriptions = !prescriptionsQuery.empty;

    // Fetch active care reminders
    const remindersQuery = await db.collection('careReminders')
      .where('parentId', '==', parentId)
      .where('babyId', '==', babyId)
      .where('isActive', '==', true)
      .limit(parseInt(limit))
      .get();

    const reminders = remindersQuery.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'reminder',
          reminderType: data.type || 'feeding',
          message: data.message,
          ruleId: data.ruleId,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          isActive: data.isActive,
        };
      })
      // Filter out medication reminders if no prescriptions exist
      .filter(reminder => {
        if (reminder.reminderType === 'medication' && !hasPrescriptions) {
          return false; // Skip medication reminders if no prescriptions
        }
        return true;
      });

    // Combine and sort by createdAt descending (newest first)
    const notifications = [...alerts, ...reminders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, parseInt(limit));

    // Count HIGH severity alerts for highlighting
    const highAlertCount = alerts.filter(a => a.severity === 'HIGH').length;

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount: notifications.length,
        highAlertCount,
        summary: {
          totalAlerts: alerts.length,
          totalReminders: reminders.length,
          highAlerts: highAlertCount,
          mediumAlerts: alerts.filter(a => a.severity === 'MEDIUM').length,
          lowAlerts: alerts.filter(a => a.severity === 'LOW').length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch notifications',
    });
  }
});

/**
 * POST /api/notifications/:id/dismiss
 * Mark a notification as read/dismissed
 */
router.post('/:id/dismiss', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // "alert" or "reminder"
    const parentId = req.user.uid;

    const collection = type === 'reminder' ? 'careReminders' : 'alerts';
    const docRef = db.collection(collection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Notification not found',
      });
    }

    const data = doc.data();
    if (data.parentId !== parentId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this notification',
      });
    }

    // Mark as inactive/resolved
    await docRef.update({
      isActive: false,
      resolved: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: 'Notification dismissed',
    });
  } catch (error) {
    console.error('Error dismissing notification:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to dismiss notification',
    });
  }
});

/**
 * POST /api/notifications/dismiss-all
 * Dismiss all notifications for a baby
 */
router.post('/dismiss-all', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.body;
    const parentId = req.user.uid;

    if (!babyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId is required',
      });
    }

    const batch = db.batch();
    let dismissedCount = 0;

    // Dismiss all active alerts
    const alertsQuery = await db.collection('alerts')
      .where('parentId', '==', parentId)
      .where('babyId', '==', babyId)
      .where('isActive', '==', true)
      .get();

    alertsQuery.docs.forEach(doc => {
      batch.update(doc.ref, {
        isActive: false,
        resolved: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      dismissedCount++;
    });

    // Dismiss all active care reminders
    const remindersQuery = await db.collection('careReminders')
      .where('parentId', '==', parentId)
      .where('babyId', '==', babyId)
      .where('isActive', '==', true)
      .get();

    remindersQuery.docs.forEach(doc => {
      batch.update(doc.ref, {
        isActive: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      dismissedCount++;
    });

    if (dismissedCount > 0) {
      await batch.commit();
    }

    res.json({
      success: true,
      message: `Dismissed ${dismissedCount} notifications`,
      dismissedCount,
    });
  } catch (error) {
    console.error('Error dismissing all notifications:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to dismiss notifications',
    });
  }
});

module.exports = router;
