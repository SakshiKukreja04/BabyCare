const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { evaluateAllRules, evaluateBabyStatus } = require('../services/ruleEngine');
const { sendAlertSMS, getUserPhoneNumber } = require('../services/sms.service');

/**
 * POST /care-logs
 * Create a new care log entry
 * 
 * Flow:
 * 1. Verify user via auth middleware
 * 2. Store care log in Firestore
 * 3. Call rule engine for all log types
 * 4. Send notifications if alerts are created (FCM handled by rule engine)
 * 5. Return summary status for dashboard
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

    // Evaluate all applicable rules after creating care log (REAL-TIME EVALUATION)
    // FCM notifications are now sent automatically by the rule engine:
    // - HIGH alerts trigger FCM
    // - ALL care reminders trigger FCM
    // - MEDIUM/LOW alerts do NOT trigger FCM
    let ruleResult = { alerts: [], reminders: [] };
    if (type === 'feeding' || type === 'sleep' || type === 'medication') {
      ruleResult = await evaluateAllRules(babyId, parentId);

      // Send SMS notifications for NEW HIGH alerts only
      const newHighAlerts = (ruleResult.alerts || []).filter(alert => alert.isNew && alert.severity === 'HIGH');
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
    const summaryStatus = await evaluateBabyStatus(babyId, parentId);

    const alerts = ruleResult.alerts || [];
    const reminders = ruleResult.reminders || [];

    res.status(201).json({
      success: true,
      data: {
        careLog: {
          ...careLogData,
          timestamp: new Date().toISOString(),
        },
        alertsCreated: alerts.filter(a => a.isNew).length,
        alertsUpdated: alerts.filter(a => !a.isNew).length,
        remindersCreated: reminders.filter(r => r.isNew).length,
        remindersUpdated: reminders.filter(r => !r.isNew).length,
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

/**
 * GET /care-logs/analytics/monthly
 * Get monthly analytics (days with logs, missed days, consistency percentage)
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

    // Get current month/year if not provided
    const now = new Date();
    const currentMonth = parseInt(month) || now.getMonth();
    const currentYear = parseInt(year) || now.getFullYear();

    // Fetch all care logs for the baby
    const careLogsRef = db.collection('careLogs');
    const query = careLogsRef
      .where('parentId', '==', parentId)
      .limit(1000);

    const snapshot = await query.get();

    // Filter by babyId and calculate unique days with logs and earliest start date
    const daysWithLogsSet = new Set();
    let earliestDate = null;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.babyId !== babyId) return;

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

    // Get all care logs for this baby to find the start date
    const logsSnapshot = await db
      .collection('careLogs')
      .where('babyId', '==', babyId)
      .get();

    let startDate = new Date(year, month - 1, 1); // Default to first of month
    
    if (logsSnapshot.size > 0) {
      let earliestTimestamp = null;
      for (const doc of logsSnapshot.docs) {
        const log = doc.data();
        const logTimestamp = log.timestamp?.toDate?.() || new Date(log.timestamp);
        if (!earliestTimestamp || logTimestamp < earliestTimestamp) {
          earliestTimestamp = logTimestamp;
        }
      }
      if (earliestTimestamp) {
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

    // Fetch alerts for the baby (without date filter first due to Firestore index limitations)
    const alertsSnapshot = await db
      .collection('alerts')
      .where('babyId', '==', babyId)
      .get();

    console.log(`Found ${alertsSnapshot.size} total alerts for baby ${babyId}`);
    
    // Log first 3 alerts to see what fields exist
    if (alertsSnapshot.size > 0) {
      console.log('Sample alerts:');
      alertsSnapshot.docs.slice(0, 3).forEach((doc, idx) => {
        const alert = doc.data();
        console.log(`  Alert ${idx + 1}:`, {
          id: doc.id,
          name: alert.name,
          severity: alert.severity,
          babyId: alert.babyId,
          timestamp: alert.timestamp,
          createdAt: alert.createdAt,
          updatedAt: alert.updatedAt,
          allKeys: Object.keys(alert),
        });
      });
    } else {
      console.log(`⚠️ No alerts found for babyId: ${babyId}`);
    }

    // Filter alerts by date range in code
    const filteredAlerts = alertsSnapshot.docs.filter((doc) => {
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
        console.log(`  ❌ Could not parse timestamp for "${alert.name}" - fields:`, {
          timestamp: alert.timestamp,
          createdAt: alert.createdAt,
          updatedAt: alert.updatedAt,
        });
        return false;
      }
      
      const isInRange = alertTimestamp >= startDate && alertTimestamp <= endDate;
      console.log(`  ${isInRange ? '✓' : '✗'} "${alert.name}" (${alert.severity}): ${alertTimestamp.toISOString()}`);
      return isInRange;
    });

    console.log(`✓ After date filtering: ${filteredAlerts.length} alerts match the date range`);

    // Count alerts by severity (use filtered alerts)
    const alertCounts = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };

    for (const doc of filteredAlerts) {
      const alert = doc.data();
      const severity = alert.severity || 'LOW';
      console.log(`Alert: ${alert.name}, severity: ${severity}`);
      if (alertCounts.hasOwnProperty(severity)) {
        alertCounts[severity]++;
      }
    }

    console.log('Alert counts:', alertCounts);

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
