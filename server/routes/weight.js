const express = require('express');
const router = express.Router();
const { db } = require('../firebaseAdmin');
const { verifyToken } = require('../middleware/auth');

/**
 * POST /weight
 * Create or update a weekly weight entry for a baby
 * Automatically calculates the current week (Mon-Sun)
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { babyId, weight } = req.body;
    const parentId = req.user.uid;

    if (!babyId || weight === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId and weight are required',
      });
    }

    if (isNaN(weight) || weight <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'weight must be a positive number',
      });
    }

    // Verify baby belongs to parent
    const babyRef = db.collection('babies').doc(babyId);
    const babyDoc = await babyRef.get();

    if (!babyDoc.exists) {
      return res.status(400).json({
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

    // Calculate current week (week starts on 1st of month)
    // Week 1: 1-6, Week 2: 7-12, Week 3: 13-18, Week 4: 19-24, Week 5: 25-31
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = today.getDate();

    let weekStart, weekEnd;
    if (day <= 6) {
      weekStart = `${year}-${month}-01`;
      weekEnd = `${year}-${month}-06`;
    } else if (day <= 12) {
      weekStart = `${year}-${month}-07`;
      weekEnd = `${year}-${month}-12`;
    } else if (day <= 18) {
      weekStart = `${year}-${month}-13`;
      weekEnd = `${year}-${month}-18`;
    } else if (day <= 24) {
      weekStart = `${year}-${month}-19`;
      weekEnd = `${year}-${month}-24`;
    } else {
      weekStart = `${year}-${month}-25`;
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      weekEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }

    // Create or update weight entry for this week
    const weekKey = `${babyId}_${weekStart}`;
    const weightRef = db.collection('babyWeights').doc(weekKey);

    const now = new Date();
    const weightData = {
      babyId,
      parentId,
      weight: Number(weight),
      weekStart,
      weekEnd,
      date: `${year}-${month}-${String(day).padStart(2, '0')}`,
      timestamp: now,
      updatedAt: now,
    };

    await weightRef.set(weightData, { merge: true });

    // Also update the baby's current weight
    await babyRef.update({
      currentWeight: Number(weight),
      lastWeightUpdate: now,
    });

    res.status(201).json({
      success: true,
      data: {
        id: weightRef.id,
        babyId,
        weight: weightData.weight,
        weekStart,
        weekEnd,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating/updating weight entry:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to create/update weight entry',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /weight
 * Get weight entries for a baby
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { babyId, limit = 100 } = req.query;
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

    // Fetch weight entries
    const weightRef = db.collection('babyWeights');
    const query = weightRef
      .where('babyId', '==', babyId)
      .orderBy('date', 'desc')
      .limit(parseInt(limit, 10));

    const snapshot = await query.get();

    const weightEntries = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        weight: data.weight,
        date: data.date,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp?.toISOString?.() || data.timestamp,
      };
    });

    res.json({
      success: true,
      data: {
        weightEntries,
        count: weightEntries.length,
      },
    });
  } catch (error) {
    console.error('Error fetching weight entries:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch weight entries',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * GET /weight/month
 * Get weight entries for a specific month
 */
router.get('/month', verifyToken, async (req, res) => {
  try {
    const { babyId, month, year } = req.query;
    const parentId = req.user.uid;

    if (!babyId || month === undefined || year === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'babyId, month, and year query parameters are required',
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

    // Get all weight entries for the baby and filter client-side
    const weightRef = db.collection('babyWeights');
    const query = weightRef.where('babyId', '==', babyId).limit(1000);

    const snapshot = await query.get();

    const currentMonth = parseInt(month, 10);
    const currentYear = parseInt(year, 10);

    const weightEntries = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          weight: data.weight,
          date: data.date,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp?.toISOString?.() || data.timestamp,
        };
      })
      .filter((entry) => {
        const [entryYear, entryMonth] = entry.date.split('-').map(Number);
        return entryYear === currentYear && entryMonth === currentMonth + 1;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      data: {
        weightEntries,
        count: weightEntries.length,
      },
    });
  } catch (error) {
    console.error('Error fetching monthly weight entries:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to fetch weight entries',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;
