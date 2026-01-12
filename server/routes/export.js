/**
 * Feedback Export Routes
 * 
 * POST /export-feedback
 * Exports user's feedback logs (feeding, sleep, alerts, medications) to Google Sheets
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const feedbackExportService = require('../services/feedbackExport');
const googleSheetsService = require('../services/googleSheets');
const { db } = require('../firebaseAdmin');

/**
 * POST /export-feedback
 * 
 * Exports all feedback logs for authenticated user to Google Sheets
 * 
 * Request:
 * - Authorization: Bearer <Firebase ID Token>
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Feedback logs exported successfully",
 *   data: {
 *     spreadsheetId: "...",
 *     spreadsheetUrl: "https://docs.google.com/spreadsheets/d/...",
 *     totalLogs: 42,
 *     dateRange: {
 *       from: "2024-01-01",
 *       to: "2024-01-31"
 *     }
 *   }
 * }
 */
router.post('/export-feedback', verifyToken, async (req, res) => {
  let spreadsheetId = null;

  try {
    const uid = req.user.uid;
    const userEmail = req.user.email;

    console.log(`[Export Feedback] Starting export for user ${uid}`);

    // ============================================
    // STEP 1: Fetch and process feedback logs
    // ============================================
    const { rows, totalLogs, dateRange } =
      await feedbackExportService.processFeedbackLogsForExport(uid);

    // Handle empty logs gracefully
    if (totalLogs === 0) {
      return res.status(200).json({
        success: true,
        message: 'No feedback logs found for this user',
        data: {
          spreadsheetId: null,
          spreadsheetUrl: null,
          totalLogs: 0,
          dateRange: null,
          note: 'No data to export. Start logging your baby\'s feeding, sleep, alerts, and medications to generate a report.',
        },
      });
    }

    // ============================================
    // STEP 2: Create Google Sheet
    // ============================================
    const sheetTitle = `Feedback Logs - ${uid}`;
    spreadsheetId = await googleSheetsService.createSpreadsheet(sheetTitle);

    // ============================================
    // STEP 3: Write headers and data
    // ============================================
    await googleSheetsService.writeHeaders(spreadsheetId);
    await googleSheetsService.writeData(spreadsheetId, rows);

    // ============================================
    // STEP 4: Format headers
    // ============================================
    await googleSheetsService.formatHeaders(spreadsheetId);

    // ============================================
    // STEP 5: Transfer ownership to user
    // ============================================
    // This moves the spreadsheet to the user's Google Drive
    // and makes it use their storage quota (not service account's)
    if (userEmail) {
      await googleSheetsService.transferOwnership(spreadsheetId, userEmail);
    } else {
      console.warn('[Export Feedback] No user email available, skipping ownership transfer');
    }

    // ============================================
    // STEP 6: Get spreadsheet URL
    // ============================================
    const spreadsheetUrl = googleSheetsService.getSpreadsheetUrl(spreadsheetId);

    // ============================================
    // STEP 7: Log export in Firestore for audit trail
    // ============================================
    try {
      await db.collection('users').doc(uid).collection('exports').add({
        type: 'feedback_logs',
        spreadsheetId,
        spreadsheetUrl,
        totalLogs,
        dateRange,
        createdAt: new Date(),
      });
    } catch (error) {
      console.warn('Could not log export to Firestore:', error.message);
      // Non-critical, don't fail the request
    }

    // ============================================
    // SUCCESS RESPONSE
    // ============================================
    console.log(
      `[Export Feedback] ✓ Successfully exported ${totalLogs} logs for user ${uid}`
    );

    return res.status(200).json({
      success: true,
      message: 'Feedback logs exported successfully',
      data: {
        spreadsheetId,
        spreadsheetUrl,
        totalLogs,
        dateRange,
      },
    });
  } catch (error) {
    console.error('[Export Feedback] Error during export:', error);

    // ============================================
    // ERROR RESPONSE
    // ============================================
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to export feedback logs',
      details: error.message,
    });
  }
});

/**
 * GET /export-feedback/history
 * 
 * Get export history for authenticated user
 * Lists all previous exports
 */
router.get('/export-feedback/history', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    const exportsRef = db
      .collection('users')
      .doc(uid)
      .collection('exports');

    const snapshot = await exportsRef
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const exports = [];
    snapshot.forEach((doc) => {
      exports.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null,
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
