const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { explainAlert } = require('../services/gemini');
const { getRuleById } = require('../rules/feedingRules');

/**
 * GET /alerts
 * Get alerts for a baby
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { babyId, resolved } = req.query;
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

    // Build query - filter by parentId first, then filter and sort client-side
    // to avoid requiring a composite index
    let query = db.collection('alerts')
      .where('parentId', '==', parentId)
      .limit(100); // Get more than needed, then filter client-side

    const snapshot = await query.get();
    
    // Filter by babyId and resolved status, then sort client-side
    let alerts = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      })
      .filter(alert => {
        // Filter by babyId
        if (alert.babyId !== babyId) return false;
        // Filter by resolved status if specified
        if (resolved !== undefined) {
          const isResolved = resolved === 'true' || resolved === true;
          return alert.resolved === isResolved;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by createdAt descending (newest first)
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 50) // Limit to 50 most recent
      .map(alert => ({
        ...alert,
        createdAt: alert.createdAt?.toDate?.()?.toISOString() || alert.createdAt,
        updatedAt: alert.updatedAt?.toDate?.()?.toISOString() || alert.updatedAt,
      }));

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
      },
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch alerts',
    });
  }
});

/**
 * GET /alerts/:alertId/explanation
 * Get AI explanation for an alert
 */
router.get('/:alertId/explanation', verifyToken, async (req, res) => {
  try {
    const { alertId } = req.params;
    const parentId = req.user.uid;

    // Fetch alert
    const alertRef = db.collection('alerts').doc(alertId);
    const alertDoc = await alertRef.get();

    if (!alertDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Alert not found',
      });
    }

    const alertData = alertDoc.data();

    // Verify ownership
    if (alertData.parentId !== parentId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this alert',
      });
    }

    // Get rule details
    const rule = getRuleById(alertData.ruleId) || {
      name: alertData.title,
      description: alertData.description,
    };

    // Get baby data for context
    const babyRef = db.collection('babies').doc(alertData.babyId);
    const babyDoc = await babyRef.get();
    const babyData = babyDoc.data();

    // Generate explanation using Gemini
    const explanation = await explainAlert({
      rule,
      triggerData: alertData.triggerData || {},
      babyAge: babyData.dob ? calculateAge(babyData.dob) : null,
    });

    res.json({
      success: true,
      data: {
        explanation,
        alertId: alertData.id,
        ruleId: alertData.ruleId,
      },
    });
  } catch (error) {
    console.error('Error generating explanation:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate explanation',
    });
  }
});

/**
 * PATCH /alerts/:alertId/resolve
 * Mark an alert as resolved
 */
router.patch('/:alertId/resolve', verifyToken, async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolved = true } = req.body;
    const parentId = req.user.uid;

    // Fetch alert
    const alertRef = db.collection('alerts').doc(alertId);
    const alertDoc = await alertRef.get();

    if (!alertDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Alert not found',
      });
    }

    const alertData = alertDoc.data();

    // Verify ownership
    if (alertData.parentId !== parentId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this alert',
      });
    }

    // Update alert
    await alertRef.update({
      resolved: resolved === true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      data: {
        alertId,
        resolved: resolved === true,
      },
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to resolve alert',
    });
  }
});

/**
 * Helper function to calculate baby age
 */
function calculateAge(dob) {
  const birthDate = new Date(dob);
  const now = new Date();
  const months = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                 (now.getMonth() - birthDate.getMonth());
  return `${Math.floor(months / 12)} years, ${months % 12} months`;
}

module.exports = router;

