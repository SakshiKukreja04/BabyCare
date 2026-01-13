const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { evaluateAllRules, evaluateBabyStatus } = require('../services/ruleEngine');
const { sendAlertSMS, getUserPhoneNumber } = require('../services/sms.service');
const { 
  updateFeedingSummary, 
  updateSleepSummary, 
  updateMedicationSummary 
} = require('../services/dailySummary');
const { babyOwnershipCache } = require('../services/memoryCache');

// Query limits to prevent quota exhaustion
const QUERY_LIMITS = {
  CARE_LOGS: 50,
  MONTHLY_ANALYTICS: 200,
};

/**
 * Verify baby ownership with caching
 */
async function verifyBabyOwnershipCached(babyId, parentId) {
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
      console.warn('⚠️ [CareLogs] Quota exceeded during baby ownership check');
      return { valid: false, quotaExceeded: true };
    }
    throw error;
  }
}

/**
 * POST /care-logs
 * Create a new care log entry
 * 
 * Flow:
 * 1. Verify user via auth middleware
 * 2. Store care log in Firestore
 * 3. Update dailySummary document (event-based aggregation)
 * 4. Call rule engine for all log types
 * 5. Send notifications if alerts are created (FCM handled by rule engine)
 * 6. Return summary status for dashboard
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
    const timestamp = new Date();
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

    // EVENT-BASED: Update daily summary document
    // This aggregates data for efficient querying instead of recalculating
    try {
      if (type === 'feeding') {
        await updateFeedingSummary(babyId, quantity || 0, timestamp);
      } else if (type === 'sleep') {
        await updateSleepSummary(babyId, duration || 0, timestamp);
      } else if (type === 'medication' && medicationGiven) {
        await updateMedicationSummary(babyId, { name: medicationGiven }, timestamp);
      }
    } catch (summaryError) {
      // Don't fail the request if summary update fails
      console.warn('⚠️ [CareLogs] Failed to update daily summary:', summaryError.message);
    }

    // Evaluate all applicable rules after creating care log (REAL-TIME EVALUATION)
    // FCM notifications are now sent automatically by the rule engine:
    // - HIGH alerts trigger FCM
    // - ALL care reminders trigger FCM
    // - MEDIUM/LOW alerts do NOT trigger FCM
    let ruleResult = { alerts: [], reminders: [] };
    if (type === 'feeding' || type === 'sleep' || type === 'medication') {
      try {
        ruleResult = await evaluateAllRules(babyId, parentId);
      } catch (ruleError) {
        // Don't fail the request if rule evaluation fails
        console.warn('⚠️ [CareLogs] Failed to evaluate rules:', ruleError.message);
        ruleResult = { alerts: [], reminders: [] };
      }

      // Defensive: ensure arrays exist
      const alerts = Array.isArray(ruleResult.alerts) ? ruleResult.alerts : [];
      
      // Send SMS notifications for NEW HIGH alerts only
      const newHighAlerts = alerts.filter(alert => alert && alert.isNew && alert.severity === 'HIGH');
      for (const alert of newHighAlerts) {
        try {
          const phoneNumber = await getUserPhoneNumber(parentId);
          if (phoneNumber) {
            const smsResult = await sendAlertSMS(phoneNumber, alert);
            if (smsResult.success) {
              console.log(`✓ SMS sent for HIGH alert: ${alert.name}`);
            } else {
              console.warn(`⚠ SMS failed for HIGH alert: ${alert.name}`);
            }
          } else {
            console.warn(`⚠ No phone number found for parent ${parentId}`);
          }
        } catch (notificationError) {
          console.error('Error sending SMS notification:', notificationError);
          // Don't fail the request if notifications fail
        }
      }
    }

    // Get current baby status for summary card
    let summaryStatus = { isAllGood: true, alertCount: 0, overallSeverity: 'NONE', summary: '', reasons: [] };
    try {
      summaryStatus = await evaluateBabyStatus(babyId, parentId);
    } catch (statusError) {
      console.warn('⚠️ [CareLogs] Failed to evaluate baby status:', statusError.message);
    }

    // Defensive: ensure arrays for response
    const alerts = Array.isArray(ruleResult.alerts) ? ruleResult.alerts : [];
    const reminders = Array.isArray(ruleResult.reminders) ? ruleResult.reminders : [];

    res.status(201).json({
      success: true,
      data: {
        careLog: {
          ...careLogData,
          timestamp: new Date().toISOString(),
        },
        alertsCreated: alerts.filter(a => a && a.isNew).length,
        alertsUpdated: alerts.filter(a => a && !a.isNew).length,
        remindersCreated: reminders.filter(r => r && r.isNew).length,
        remindersUpdated: reminders.filter(r => r && !r.isNew).length,
        summaryStatus: {
          isAllGood: summaryStatus.isAllGood,
          alertCount: summaryStatus.alertCount,
          overallSeverity: summaryStatus.overallSeverity,
          summary: summaryStatus.summary,
          reasons: summaryStatus.reasons,
        },
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
 * OPTIMIZED: Uses cached baby ownership and hard query limits
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

    // Verify baby belongs to parent (with caching)
    const ownership = await verifyBabyOwnershipCached(babyId, parentId);
    
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

    // Fetch care logs with HARD LIMIT
    // Query directly by babyId for efficiency
    const requestedLimit = Math.min(parseInt(limit, 10) || 20, QUERY_LIMITS.CARE_LOGS);
    
    const query = db.collection('careLogs')
      .where('babyId', '==', babyId)
      .limit(requestedLimit);

    const snapshot = await query.get();
    
    // Defensive: handle undefined snapshot
    if (!snapshot || !snapshot.docs || !Array.isArray(snapshot.docs)) {
      return res.json({
        success: true,
        data: { careLogs: [], count: 0 },
      });
    }
    
    // Map and sort
    const careLogs = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp,
        };
      })
      .sort((a, b) => {
        const aTime = a.timestamp?.toMillis?.() || a.timestamp?.toDate?.()?.getTime() || 0;
        const bTime = b.timestamp?.toMillis?.() || b.timestamp?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      })
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
    if (error.code === 8) {
      console.warn('⚠️ [CareLogs] Quota exceeded fetching care logs');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Temporarily unable to fetch logs. Please try again.',
      });
    }
    console.error('Error fetching care logs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch care logs',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /care-logs/analytics/monthly
 * Get monthly analytics (days with logs, missed days, consistency percentage)
 * OPTIMIZED: Uses cached baby ownership and hard query limits
 */
router.get('/analytics/monthly', verifyToken, async (req, res) => {
  try {
    const { babyId, month, year } = req.query;
    const parentId = req.user.uid;

    if (!babyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId query parameter is required',
      });
    }

    // Verify baby belongs to parent (with caching)
    const ownership = await verifyBabyOwnershipCached(babyId, parentId);
    
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

    // Get current month/year if not provided
    const now = new Date();
    const currentMonth = parseInt(month) || now.getMonth();
    const currentYear = parseInt(year) || now.getFullYear();

    // Fetch care logs for the baby with HARD LIMIT
    // Query directly by babyId for efficiency
    const query = db.collection('careLogs')
      .where('babyId', '==', babyId)
      .limit(QUERY_LIMITS.MONTHLY_ANALYTICS);

    const snapshot = await query.get();
    
    // Defensive: handle undefined snapshot
    if (!snapshot || !snapshot.docs || !Array.isArray(snapshot.docs)) {
      return res.json({
        success: true,
        data: {
          month: `${new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' })} ${currentYear}`,
          monthNumber: currentMonth,
          year: currentYear,
          totalDaysInMonth: new Date(currentYear, currentMonth + 1, 0).getDate(),
          daysWithLogs: 0,
          missedDays: 0,
          consistency: 0,
          consistencyLevel: 'Poor',
          daysCountedForConsistency: 0,
          startDate: null,
        },
      });
    }

    // Calculate unique days with logs and earliest start date
    const daysWithLogsSet = new Set();
    let earliestDate = null;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();

      const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);
      if (isNaN(timestamp.getTime())) return;

      // Track earliest date across all months
      if (!earliestDate || timestamp < earliestDate) {
        earliestDate = timestamp;
      }

      const logYear = timestamp.getFullYear();
      const logMonth = timestamp.getMonth();
      const logDate = timestamp.getDate();

      if (logYear === currentYear && logMonth === currentMonth) {
        const dateISO = `${logYear}-${String(logMonth + 1)
          .padStart(2, '0')}-${String(logDate).padStart(2, '0')}`;
        daysWithLogsSet.add(dateISO);
      }
    });

    // Calculate consistency based on start date
    let daysWithLogs = daysWithLogsSet.size;
    let missedDays = 0;
    let consistency = 0;
    let daysInConsistencyPeriod = 0;

    if (earliestDate) {
      const startDate = new Date(earliestDate);
      startDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
      endOfMonth.setHours(0, 0, 0, 0);

      // Use today or end of month, whichever is earlier
      const endDate = today < endOfMonth ? today : endOfMonth;

      // Check if start date is in the current month
      const startDateInMonth =
        startDate.getFullYear() === currentYear && startDate.getMonth() === currentMonth;

      if (startDateInMonth) {
        // Count days from start date to end date (inclusive)
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        daysInConsistencyPeriod = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      } else {
        // Start date is in a previous month, count from beginning of month
        const monthStart = new Date(currentYear, currentMonth, 1);
        monthStart.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(endDate.getTime() - monthStart.getTime());
        daysInConsistencyPeriod = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }

      missedDays = daysInConsistencyPeriod - daysWithLogs;
      consistency = daysInConsistencyPeriod > 0 
        ? Math.round((daysWithLogs / daysInConsistencyPeriod) * 100) 
        : 0;
    }

    // Determine consistency level
    let consistencyLevel = 'Poor';
    if (consistency >= 90) consistencyLevel = 'Excellent';
    else if (consistency >= 70) consistencyLevel = 'Good';
    else if (consistency >= 50) consistencyLevel = 'Needs Attention';

    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthName = months[currentMonth];

    res.json({
      success: true,
      data: {
        month: `${monthName} ${currentYear}`,
        monthNumber: currentMonth,
        year: currentYear,
        totalDaysInMonth: new Date(currentYear, currentMonth + 1, 0).getDate(),
        daysWithLogs,
        missedDays,
        consistency,
        consistencyLevel,
        daysCountedForConsistency: daysInConsistencyPeriod,
        startDate: earliestDate?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error fetching monthly analytics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch monthly analytics',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /care-logs/alerts/monthly
 * Get alert history for a specific month
 * Counts alerts from when user started logging till now for that month
 * OPTIMIZED: Uses cached baby ownership and hard query limits
 */
router.get('/alerts/monthly', verifyToken, async (req, res) => {
  try {
    const { babyId, month, year } = req.query;
    const parentId = req.user.uid;

    if (!babyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId query parameter is required',
      });
    }

    if (!month || !year) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'month and year query parameters are required',
      });
    }

    // Verify baby belongs to parent (with caching)
    const ownership = await verifyBabyOwnershipCached(babyId, parentId);
    
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

    // Get care logs for this baby to find the start date (with hard limit)
    let logsSnapshot;
    try {
      logsSnapshot = await db
        .collection('careLogs')
        .where('babyId', '==', babyId)
        .orderBy('timestamp', 'asc')
        .limit(1)  // Only need earliest log for start date
        .get();
    } catch (error) {
      if (error.code === 8) {
        console.warn('⚠️ [CareLogs] Quota exceeded fetching logs for start date');
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Temporarily unable to process request. Please try again.',
        });
      }
      throw error;
    }

    let startDate = new Date(year, month - 1, 1); // Default to first of month
    
    if (logsSnapshot && logsSnapshot.size > 0) {
      const earliestLog = logsSnapshot.docs[0].data();
      const earliestTimestamp = earliestLog.timestamp?.toDate?.() || new Date(earliestLog.timestamp);
      if (!isNaN(earliestTimestamp.getTime())) {
        startDate = new Date(Math.max(startDate.getTime(), earliestTimestamp.getTime()));
      }
    }

    // Set end date to last day of month or today (whichever is earlier)
    const today = new Date();
    const lastDayOfMonth = new Date(year, month, 0);
    const endDate = new Date(Math.min(lastDayOfMonth.getTime(), today.getTime()));

    console.log('Fetching alerts for:', {
      babyId,
      month,
      year,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Fetch alerts for the baby with HARD LIMIT
    let alertsSnapshot;
    try {
      alertsSnapshot = await db
        .collection('alerts')
        .where('babyId', '==', babyId)
        .limit(QUERY_LIMITS.MONTHLY_ANALYTICS)
        .get();
    } catch (error) {
      if (error.code === 8) {
        console.warn('⚠️ [CareLogs] Quota exceeded fetching alerts');
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Temporarily unable to process request. Please try again.',
        });
      }
      throw error;
    }

    // Defensive: handle undefined snapshot
    if (!alertsSnapshot || !alertsSnapshot.docs) {
      return res.json({
        success: true,
        data: {
          babyId,
          month: month,
          year: year,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          alerts: { low: 0, medium: 0, high: 0, total: 0 },
        },
      });
    }

    // Filter alerts by date range in code
    const filteredAlerts = (alertsSnapshot.docs || []).filter((doc) => {
      const alert = doc.data();
      
      // Try multiple possible timestamp field names
      let alertTimestamp = null;
      if (alert.timestamp?.toDate) {
        alertTimestamp = alert.timestamp.toDate();
      } else if (alert.timestamp instanceof Date) {
        alertTimestamp = alert.timestamp;
      } else if (typeof alert.timestamp === 'string') {
        alertTimestamp = new Date(alert.timestamp);
      } else if (alert.createdAt?.toDate) {
        alertTimestamp = alert.createdAt.toDate();
      } else if (alert.createdAt instanceof Date) {
        alertTimestamp = alert.createdAt;
      } else if (typeof alert.createdAt === 'string') {
        alertTimestamp = new Date(alert.createdAt);
      } else if (alert.updatedAt?.toDate) {
        alertTimestamp = alert.updatedAt.toDate();
      } else if (alert.updatedAt instanceof Date) {
        alertTimestamp = alert.updatedAt;
      } else if (typeof alert.updatedAt === 'string') {
        alertTimestamp = new Date(alert.updatedAt);
      }
      
      if (!alertTimestamp || isNaN(alertTimestamp.getTime())) {
        return false;
      }
      
      return alertTimestamp >= startDate && alertTimestamp <= endDate;
    });

    // Count alerts by severity (use filtered alerts)
    const alertCounts = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };

    for (const doc of filteredAlerts) {
      const alert = doc.data();
      const severity = alert.severity || 'LOW';
      if (alertCounts.hasOwnProperty(severity)) {
        alertCounts[severity]++;
      }
    }

    res.json({
      success: true,
      data: {
        babyId,
        month: month,
        year: year,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        alerts: {
          low: alertCounts.LOW,
          medium: alertCounts.MEDIUM,
          high: alertCounts.HIGH,
          total: alertCounts.LOW + alertCounts.MEDIUM + alertCounts.HIGH,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching alert history:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch alert history',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;
