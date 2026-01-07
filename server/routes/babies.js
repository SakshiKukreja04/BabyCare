const express = require('express');
const router = express.Router();
const { db } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');
const { getBabyWithType } = require('../services/ruleEngine');

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

module.exports = router;

