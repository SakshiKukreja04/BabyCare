/**
 * Feedback Export Routes
 * 
 * POST /export-feedback
 * Exports user's feedback logs (feeding, sleep, alerts, medications) to CSV
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const feedbackExportService = require('../services/feedbackExport');
const { arrayToCSV } = require('../utils/csvGenerator');
const { db } = require('../firebaseAdmin');

/**
 * POST /export-feedback
 * 
 * Exports all feedback logs for authenticated user to CSV
 * 
 * Request:
 * - Authorization: Bearer <Firebase ID Token>
 * 
 * Response:
 * - Content-Type: text/csv
 * - Content-Disposition: attachment; filename="feedback_logs_<userId>.csv"
 * - CSV file stream
 */
router.post('/export-feedback', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    console.log(`[Export Feedback] Starting CSV export for user ${uid}`);

    // ============================================
    // STEP 1: Fetch and process feedback logs
    // ============================================
    const { rows, totalLogs, dateRange } =
      await feedbackExportService.processFeedbackLogsForExport(uid);

    // CSV Headers matching the data structure
    const csvHeaders = [
      'Date',
      'Day',
      'Total Feeding (ml)',
      'Total Sleep Duration (hrs)',
      'Alerts & Reminders',
      'Medications Given',
      'Medication Time',
      'Timestamp',
    ];

    // ============================================
    // STEP 2: Convert to CSV
    // ============================================
    let csvContent = '';

    if (totalLogs === 0 || rows.length === 0) {
      // Return CSV with headers only
      csvContent = arrayToCSV([], csvHeaders);
      console.log('[Export Feedback] No data found, returning headers only');
    } else {
      // Convert rows to CSV
      csvContent = arrayToCSV(rows, csvHeaders);
      console.log(`[Export Feedback] ✓ Generated CSV with ${rows.length} rows`);
    }

    // ============================================
    // STEP 3: Log export in Firestore for audit trail
    // ============================================
    try {
      await db.collection('users').doc(uid).collection('exports').add({
        type: 'feedback_logs_csv',
        totalLogs,
        dateRange,
        createdAt: new Date(),
        format: 'csv',
      });
    } catch (error) {
      console.warn('Could not log export to Firestore:', error.message);
      // Non-critical, don't fail the request
    }

    // ============================================
    // STEP 4: Set response headers and send CSV
    // ============================================
    const filename = `feedback_logs_${uid}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    console.log(`[Export Feedback] ✓ Successfully exported ${totalLogs} logs as CSV for user ${uid}`);

    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('[Export Feedback] Error during export:', error);
    console.error('Error stack:', error.stack);

    // ============================================
    // ERROR RESPONSE (JSON for errors)
    // ============================================
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to export feedback logs',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /export-feedback/history
 * 
 * Get export history for authenticated user
 * Lists all previous CSV exports
 */
router.get('/export-feedback/history', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    const exportsRef = db
      .collection('users')
      .doc(uid)
      .collection('exports');

    const snapshot = await exportsRef
      .where('format', '==', 'csv')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const exports = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      exports.push({
        id: doc.id,
        totalLogs: data.totalLogs || 0,
        dateRange: data.dateRange || null,
        format: data.format || 'csv',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      });
    });

    return res.status(200).json({
      success: true,
      data: exports,
    });
  } catch (error) {
    console.error('Error fetching export history:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch export history',
    });
  }
});

module.exports = router;
