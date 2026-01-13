const express = require('express');
const router = express.Router();
const { db } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { getBabyWithType, evaluateBabyStatus, evaluateAllRules } = require('../services/ruleEngine');
const { calculateAgeSummary } = require('../utils/ageUtils');
const { getDevelopmentInsight } = require('../services/developmentInsight');

/**
 * GET /babies/:babyId
 * Get baby profile with type classification (PREMATURE | FULL_TERM)
 */
router.get('/:babyId', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.params;
    const parentId = req.user.uid;

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

    // Get baby with type classification
    const babyWithType = await getBabyWithType(babyId);

    res.json({
      success: true,
      data: {
        baby: {
          ...babyWithType,
          // Ensure timestamp fields are serialized
          createdAt: babyWithType.createdAt?.toDate?.()?.toISOString() || babyWithType.createdAt,
          updatedAt: babyWithType.updatedAt?.toDate?.()?.toISOString() || babyWithType.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching baby profile:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch baby profile',
    });
  }
});

/**
 * GET /babies/:babyId/age-summary
 * Deterministic, explainable age summary for dual-timeline tracker.
 */
router.get('/:babyId/age-summary', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.params;
    const parentId = req.user.uid;

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

    const { name, dob, gestationalAge } = babyData;

    if (!dob) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Baby date of birth (dob) is required for age summary',
      });
    }

    // Firestore Timestamp or ISO/string → Date
    let dobDate;
    if (dob.toDate && typeof dob.toDate === 'function') {
      dobDate = dob.toDate();
    } else {
      dobDate = new Date(dob);
    }

    const ageSummary = calculateAgeSummary(dobDate, gestationalAge);

    return res.json({
      name: name || '',
      gestationalAge: typeof gestationalAge === 'number' ? gestationalAge : null,
      ...ageSummary,
    });
  } catch (error) {
    console.error('Error fetching age summary:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to compute age summary',
    });
  }
});

/**
 * GET /babies/:babyId/development-this-week
 * Explainability-only developmental information based on corrected age (premature only).
 * Uses developmentInsight service which handles all business logic and AI calls.
 */
router.get('/:babyId/development-this-week', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.params;
    const parentId = req.user.uid;

    // Use developmentInsight service (handles all logic)
    console.log('🔍 [API] Fetching development insight for baby:', babyId);
    const insight = await getDevelopmentInsight(babyId, parentId);

    // If baby is not premature, return 400
    if (insight === null) {
      console.log('ℹ️ [API] Baby is not premature, skipping AI call');
      return res.status(400).json({
        error: 'Not Premature',
        message: 'Developmental milestones are only provided for premature babies',
      });
    }

    // Log response being sent to frontend
    console.log('📤 [API] Sending response to frontend:');
    console.log('   - Corrected age:', insight.correctedAgeWeeks, 'weeks');
    console.log('   - Is premature:', insight.isPremature);
    console.log('   - insightText type:', typeof insight.insightText);
    console.log('   - insightText is null:', insight.insightText === null);
    console.log('   - insightText is undefined:', insight.insightText === undefined);
    console.log('   - Content length:', insight.insightText?.length || 0, 'characters');
    console.log('   - Content preview:', insight.insightText?.substring(0, 200) || 'null');
    console.log('   - Full insightText:', insight.insightText);

    const responsePayload = {
      correctedAgeWeeks: insight.correctedAgeWeeks,
      isPremature: insight.isPremature,
      content: insight.insightText, // Frontend expects 'content' field
    };
    
    console.log('📤 [API] Response payload being sent:');
    console.log(JSON.stringify(responsePayload, null, 2));

    // Return insight (may have null insightText if AI failed - frontend handles gracefully)
    return res.json(responsePayload);
  } catch (error) {
    console.error('Error fetching development this week information:', error);

    // Handle specific error types
    if (error.message === 'Baby not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Baby not found',
      });
    }

    if (error.message.includes('Access denied')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this baby',
      });
    }

    if (error.message.includes('dob') || error.message.includes('required')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }

    // Generic error
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch development information for this week',
    });
  }
});

/**
 * GET /babies/:babyId/status
 * Get current baby status for dashboard summary card
 * Returns "All Good" status or list of active alerts/reasons
 */
router.get('/:babyId/status', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.params;
    const parentId = req.user.uid;

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

    // Get baby status using rule engine
    const status = await evaluateBabyStatus(babyId, parentId);

    return res.json({
      success: true,
      data: {
        babyId,
        babyName: babyData.name,
        isAllGood: status.isAllGood,
        alertCount: status.alertCount,
        overallSeverity: status.overallSeverity,
        summary: status.summary,
        reasons: status.reasons,
        activeAlerts: status.activeAlerts.map(alert => ({
          id: alert.id,
          ruleId: alert.ruleId,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          message: alert.triggerData?.message,
          triggerData: alert.triggerData || {},
          createdAt: alert.createdAt?.toDate?.()?.toISOString() || alert.createdAt,
          updatedAt: alert.updatedAt?.toDate?.()?.toISOString() || alert.updatedAt || alert.createdAt?.toDate?.()?.toISOString() || alert.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching baby status:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch baby status',
    });
  }
});

/**
 * POST /babies/:babyId/refresh-alerts
 * Re-evaluate all rules for a baby and update alert messages
 * Call this to refresh stale alert data with updated messages
 */
router.post('/:babyId/refresh-alerts', verifyToken, async (req, res) => {
  try {
    const { babyId } = req.params;
    const parentId = req.user.uid;

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

    // Re-evaluate all rules (this will update existing alert messages)
    const ruleResult = await evaluateAllRules(babyId, parentId);
    
    // Get updated status
    const status = await evaluateBabyStatus(babyId, parentId);

    // Ensure arrays exist (defensive programming)
    const allAlerts = Array.isArray(ruleResult.alerts) ? ruleResult.alerts : [];
    const allReminders = Array.isArray(ruleResult.reminders) ? ruleResult.reminders : [];

    return res.json({
      success: true,
      data: {
        alertsEvaluated: allAlerts.length,
        remindersEvaluated: allReminders.length,
        newAlerts: allAlerts.filter(a => a && a.isNew).length,
        updatedAlerts: allAlerts.filter(a => a && !a.isNew).length,
        newReminders: allReminders.filter(r => r && r.isNew).length,
        updatedReminders: allReminders.filter(r => r && !r.isNew).length,
        status: {
          isAllGood: status.isAllGood,
          alertCount: status.alertCount,
          overallSeverity: status.overallSeverity,
          summary: status.summary,
        },
      },
    });
  } catch (error) {
    console.error('Error refreshing alerts:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to refresh alerts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;

