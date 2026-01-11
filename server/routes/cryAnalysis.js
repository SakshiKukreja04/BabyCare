const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth');
const { db, admin } = require('../firebaseAdmin');
const { adjustCryPredictionWithContext } = require('../utils/adjustCryPredictionWithContext');

/**
 * Cry Analysis Route
 * Integrates with external Flask AI microservice for baby cry analysis
 * Now includes context-aware post-processing based on recent baby activity
 */

// Configure multer for temporary file storage
const uploadDir = path.join(__dirname, '../uploads/temp');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `cry-audio-${uniqueSuffix}${ext}`);
  },
});

// File filter to accept only audio files
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'];
  const allowedExts = ['.wav', '.mp3'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  const isValidExt = allowedExts.includes(ext);
  const isValidMime = allowedMimes.includes(file.mimetype);

  if (isValidExt || isValidMime) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .wav and .mp3 audio files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Flask service configuration
const FLASK_CRY_ANALYSIS_URL = process.env.FLASK_CRY_ANALYSIS_URL || 'https://pranjal2510-baby-cry-ai.hf.space/analyze-cry';
const FLASK_TIMEOUT_MS = parseInt(process.env.FLASK_TIMEOUT_MS, 10) || 30000; // 30 seconds default

// Context window for fetching recent activity (6 hours)
const CONTEXT_WINDOW_HOURS = 6;

/**
 * Fetch recent baby activity context for cry prediction adjustment
 * NO INDEXES REQUIRED - uses simple queries and local filtering/sorting
 * 
 * @param {string} parentId - Parent user ID
 * @param {string} babyId - Baby ID (optional, will use first baby if not provided)
 * @returns {Promise<Object>} - { feedingLogs, sleepLogs, reminders, babyId }
 */
async function fetchRecentContext(parentId, babyId = null) {
  try {
    console.log(`📊 [CryContext] Fetching context for parent: ${parentId}, baby: ${babyId || 'auto-detect'}`);
    
    const now = Date.now();
    const contextWindowMs = CONTEXT_WINDOW_HOURS * 60 * 60 * 1000;
    
    // If no babyId provided, get first baby for this parent
    if (!babyId) {
      const babiesSnapshot = await db.collection('babies')
        .where('parentId', '==', parentId)
        .limit(1)
        .get();
      
      if (!babiesSnapshot.empty) {
        babyId = babiesSnapshot.docs[0].id;
        console.log(`   - Auto-detected baby: ${babyId}`);
      }
    }
    
    if (!babyId) {
      console.log('   - No baby found for context');
      return { feedingLogs: [], sleepLogs: [], reminders: [], babyId: null };
    }
    
    // Fetch care logs for baby (NO INDEX - single field query, then filter locally)
    const careLogsSnapshot = await db.collection('careLogs')
      .where('babyId', '==', babyId)
      .limit(50) // Get enough to filter from
      .get();
    
    // Process and filter locally - NO INDEX NEEDED
    const allCareLogs = careLogsSnapshot.docs.map(doc => {
      const data = doc.data();
      let timestamp = null;
      
      if (data.timestamp) {
        if (data.timestamp.toDate) {
          timestamp = data.timestamp.toDate().getTime();
        } else if (typeof data.timestamp === 'string') {
          timestamp = new Date(data.timestamp).getTime();
        }
      }
      
      return {
        id: doc.id,
        ...data,
        _timestampMs: timestamp,
      };
    });
    
    // Filter feeding logs locally and sort by timestamp desc
    const feedingLogs = allCareLogs
      .filter(log => log.type === 'feeding' && log._timestampMs && (now - log._timestampMs) <= contextWindowMs)
      .sort((a, b) => b._timestampMs - a._timestampMs)
      .slice(0, 3);
    console.log(`   - Feeding logs: ${feedingLogs.length}`);
    
    // Filter sleep logs locally and sort by timestamp desc
    const sleepLogs = allCareLogs
      .filter(log => log.type === 'sleep' && log._timestampMs && (now - log._timestampMs) <= contextWindowMs)
      .sort((a, b) => b._timestampMs - a._timestampMs)
      .slice(0, 3);
    console.log(`   - Sleep logs: ${sleepLogs.length}`);
    
    // Fetch reminders (NO INDEX - single field query, then filter locally)
    const remindersSnapshot = await db.collection('reminders')
      .where('parentId', '==', parentId)
      .limit(20) // Get enough to filter from
      .get();
    
    // Filter and sort reminders locally - NO INDEX NEEDED
    const reminders = remindersSnapshot.docs
      .map(doc => {
        const data = doc.data();
        let scheduledForMs = null;
        
        if (data.scheduled_for) {
          if (data.scheduled_for.toDate) {
            scheduledForMs = data.scheduled_for.toDate().getTime();
          } else if (typeof data.scheduled_for === 'string') {
            scheduledForMs = new Date(data.scheduled_for).getTime();
          }
        }
        
        return {
          id: doc.id,
          ...data,
          _scheduledForMs: scheduledForMs,
        };
      })
      .filter(r => ['pending', 'sent'].includes(r.status))
      .sort((a, b) => (b._scheduledForMs || 0) - (a._scheduledForMs || 0))
      .slice(0, 2);
    console.log(`   - Reminders: ${reminders.length}`);
    
    return { feedingLogs, sleepLogs, reminders, babyId };
  } catch (error) {
    console.error('⚠️ [CryContext] Error fetching context:', error.message);
    // Return empty context on error - don't fail the analysis
    return { feedingLogs: [], sleepLogs: [], reminders: [], babyId };
  }
}

/**
 * Helper function to clean up temporary file
 * @param {string} filePath - Path to the temporary file
 */
function cleanupTempFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('⚠️ [CryAnalysis] Failed to cleanup temp file:', filePath, err.message);
      } else {
        console.log('🧹 [CryAnalysis] Cleaned up temp file:', filePath);
      }
    });
  }
}

/**
 * POST /api/cry-analysis
 * Upload audio file and forward to Flask AI service for cry analysis
 * 
 * Request: multipart/form-data with 'audio' field
 * Response: JSON cry analysis result from Flask service
 * 
 * Example Response:
 * {
 *   "success": true,
 *   "data": {
 *     "prediction": "hungry",
 *     "confidence": 0.87,
 *     "probabilities": {
 *       "hungry": 0.87,
 *       "tired": 0.08,
 *       "discomfort": 0.03,
 *       "belly_pain": 0.02
 *     },
 *     "recommendations": [
 *       "Baby may be hungry. Consider feeding.",
 *       "Last feeding was over 2 hours ago."
 *     ]
 *   }
 * }
 */
router.post('/', verifyToken, upload.single('audio'), async (req, res) => {
  const requestId = `cry-${Date.now()}`;
  const startTime = Date.now();
  let tempFilePath = null;

  console.log(`📥 [CryAnalysis] [${requestId}] Request received`);

  try {
    // Check if file was uploaded
    if (!req.file) {
      console.warn(`⚠️ [CryAnalysis] [${requestId}] No audio file provided`);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No audio file provided. Please upload a .wav or .mp3 file.',
      });
    }

    tempFilePath = req.file.path;
    console.log(`📁 [CryAnalysis] [${requestId}] File received: ${req.file.originalname} (${req.file.size} bytes)`);

    // Prepare form data to forward to Flask
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(tempFilePath), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    console.log(`🚀 [CryAnalysis] [${requestId}] Forwarding to Flask service: ${FLASK_CRY_ANALYSIS_URL}`);

    // Forward request to Flask service
    const flaskResponse = await axios.post(FLASK_CRY_ANALYSIS_URL, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: FLASK_TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const flaskDuration = Date.now() - startTime;
    console.log(`✅ [CryAnalysis] [${requestId}] Flask response received in ${flaskDuration}ms`);
    
    // Log the Flask response data
    console.log(`📊 [CryAnalysis] [${requestId}] ========== RAW AI RESPONSE ==========`);
    console.log(`📊 [CryAnalysis] [${requestId}] Full Flask response:`, JSON.stringify(flaskResponse.data, null, 2));
    console.log(`📊 [CryAnalysis] [${requestId}] Top Reason: ${flaskResponse.data?.top_reason || 'N/A'}`);
    
    // Extract raw AI scores from Flask response
    // Handle multiple response formats from Flask service
    const flaskData = flaskResponse.data || {};
    let rawAiScores = {};
    const excludedKeys = ['top_reason', 'prediction', 'label', 'confidence', 'score', 'recommendations', 'cry_detected', 'success', 'message', 'error'];
    
    // Try to find scores in different possible locations:
    // 1. Nested in 'scores' object
    // 2. Nested in 'probabilities' object  
    // 3. Nested in 'predictions' object
    // 4. At the root level as numeric values
    
    if (flaskData.scores && typeof flaskData.scores === 'object') {
      // Format: { scores: { hunger: 0.5, belly_pain: 0.3, ... } }
      rawAiScores = { ...flaskData.scores };
      console.log(`📊 [CryAnalysis] [${requestId}] Found scores in 'scores' field`);
    } else if (flaskData.probabilities && typeof flaskData.probabilities === 'object') {
      // Format: { probabilities: { hunger: 0.5, belly_pain: 0.3, ... } }
      rawAiScores = { ...flaskData.probabilities };
      console.log(`📊 [CryAnalysis] [${requestId}] Found scores in 'probabilities' field`);
    } else if (flaskData.predictions && typeof flaskData.predictions === 'object') {
      // Format: { predictions: { hunger: 0.5, belly_pain: 0.3, ... } }
      rawAiScores = { ...flaskData.predictions };
      console.log(`📊 [CryAnalysis] [${requestId}] Found scores in 'predictions' field`);
    } else {
      // Try to extract numeric values from root level
      for (const [key, value] of Object.entries(flaskData)) {
        if (typeof value === 'number' && !excludedKeys.includes(key)) {
          rawAiScores[key] = value;
        }
      }
      console.log(`📊 [CryAnalysis] [${requestId}] Extracted scores from root level`);
    }
    
    // If still no scores but we have top_reason, create a default score structure
    if (Object.keys(rawAiScores).length === 0 && flaskData.top_reason) {
      console.log(`📊 [CryAnalysis] [${requestId}] No numeric scores found, creating from top_reason`);
      const topReason = flaskData.top_reason.toLowerCase();
      const defaultLabels = ['hunger', 'belly_pain', 'tired', 'discomfort', 'burping'];
      
      // Create scores with top_reason having highest confidence
      defaultLabels.forEach(label => {
        if (label === topReason) {
          rawAiScores[label] = flaskData.confidence || 0.6; // Use confidence if available, else 60%
        } else {
          rawAiScores[label] = 0.1; // Low default for others
        }
      });
      
      // Normalize to sum to 1
      const total = Object.values(rawAiScores).reduce((sum, v) => sum + v, 0);
      for (const key of Object.keys(rawAiScores)) {
        rawAiScores[key] = rawAiScores[key] / total;
      }
    }
    
    console.log(`📊 [CryAnalysis] [${requestId}] Extracted scores:`, rawAiScores);
    
    // Log raw probabilities
    const probabilities = Object.entries(rawAiScores).sort(([, a], [, b]) => b - a);
    
    if (probabilities.length > 0) {
      console.log(`📊 [CryAnalysis] [${requestId}] Raw Probabilities:`);
      probabilities.forEach(([cause, prob]) => {
        const percentage = (prob * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(prob * 20)) + '░'.repeat(20 - Math.round(prob * 20));
        console.log(`📊 [CryAnalysis] [${requestId}]   ${cause.padEnd(12)} ${bar} ${percentage}%`);
      });
    }
    console.log(`📊 [CryAnalysis] [${requestId}] =====================================`);

    // ============================================
    // CONTEXT-AWARE ADJUSTMENT
    // Fetch recent activity and adjust predictions
    // ============================================
    console.log(`🧠 [CryAnalysis] [${requestId}] Applying context-aware adjustment...`);
    
    // Get babyId from request body or query (optional)
    const babyId = req.body.babyId || req.query.babyId || null;
    const parentId = req.user.uid;
    
    // Fetch recent context (feeding, sleep logs, reminders)
    const recentContext = await fetchRecentContext(parentId, babyId);
    
    // Apply context-aware adjustment
    const adjustmentResult = adjustCryPredictionWithContext(rawAiScores, {
      feedingLogs: recentContext.feedingLogs,
      sleepLogs: recentContext.sleepLogs,
      reminders: recentContext.reminders,
    });
    
    // Log adjusted scores
    console.log(`📊 [CryAnalysis] [${requestId}] ========== ADJUSTED SCORES ==========`);
    console.log(`📊 [CryAnalysis] [${requestId}] Final Label: ${adjustmentResult.finalLabel} (${(adjustmentResult.confidence * 100).toFixed(1)}%)`);
    
    const adjustedProbabilities = Object.entries(adjustmentResult.adjustedScores).sort(([, a], [, b]) => b - a);
    if (adjustedProbabilities.length > 0) {
      console.log(`📊 [CryAnalysis] [${requestId}] Adjusted Probabilities:`);
      adjustedProbabilities.forEach(([cause, prob]) => {
        const percentage = (prob * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(prob * 20)) + '░'.repeat(20 - Math.round(prob * 20));
        console.log(`📊 [CryAnalysis] [${requestId}]   ${cause.padEnd(12)} ${bar} ${percentage}%`);
      });
    }
    
    if (adjustmentResult.explanation.length > 0) {
      console.log(`📊 [CryAnalysis] [${requestId}] Explanations:`);
      adjustmentResult.explanation.forEach((exp, i) => {
        console.log(`📊 [CryAnalysis] [${requestId}]   ${i + 1}. ${exp}`);
      });
    }
    console.log(`📊 [CryAnalysis] [${requestId}] =====================================`);

    const totalDuration = Date.now() - startTime;

    // Return enhanced response with both raw and adjusted scores
    return res.status(200).json({
      success: true,
      data: {
        // Original Flask data (for backward compatibility)
        ...flaskData,
        // Context-aware adjusted data
        raw_ai_scores: rawAiScores,
        adjusted_scores: adjustmentResult.adjustedScores,
        final_label: adjustmentResult.finalLabel,
        confidence: adjustmentResult.confidence,
        explanation: adjustmentResult.explanation,
      },
      meta: {
        processingTimeMs: totalDuration,
        flaskTimeMs: flaskDuration,
        originalFilename: req.file.originalname,
        contextUsed: {
          babyId: recentContext.babyId,
          feedingLogsCount: recentContext.feedingLogs.length,
          sleepLogsCount: recentContext.sleepLogs.length,
          remindersCount: recentContext.reminders.length,
        },
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [CryAnalysis] [${requestId}] Error after ${duration}ms:`, error.message);

    // Handle specific error types
    if (error.code === 'ECONNREFUSED') {
      console.error(`❌ [CryAnalysis] [${requestId}] Flask service unavailable at ${FLASK_CRY_ANALYSIS_URL}`);
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'Cry analysis service is currently unavailable. Please try again later.',
      });
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error(`❌ [CryAnalysis] [${requestId}] Request timed out after ${FLASK_TIMEOUT_MS}ms`);
      return res.status(504).json({
        success: false,
        error: 'Gateway Timeout',
        message: 'Cry analysis request timed out. Please try again with a shorter audio clip.',
      });
    }

    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'Payload Too Large',
          message: 'Audio file is too large. Maximum size is 10MB.',
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Upload Error',
        message: error.message,
      });
    }

    // Handle Flask error responses
    if (error.response) {
      console.error(`❌ [CryAnalysis] [${requestId}] Flask error response:`, error.response.status, error.response.data);
      return res.status(error.response.status).json({
        success: false,
        error: 'Analysis Error',
        message: error.response.data?.message || 'Failed to analyze audio',
        details: error.response.data,
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred during cry analysis.',
    });

  } finally {
    // Always cleanup temporary file
    cleanupTempFile(tempFilePath);
    console.log(`🏁 [CryAnalysis] [${requestId}] Request completed`);
  }
});

/**
 * GET /api/cry-analysis/health
 * Health check endpoint to verify Flask service connectivity
 */
router.get('/health', async (req, res) => {
  try {
    const healthUrl = FLASK_CRY_ANALYSIS_URL.replace('/analyze-cry', '/health');
    
    const response = await axios.get(healthUrl, {
      timeout: 5000,
    });

    return res.json({
      success: true,
      service: 'cry-analysis',
      flaskStatus: 'connected',
      flaskHealth: response.data,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      service: 'cry-analysis',
      flaskStatus: 'disconnected',
      error: error.message,
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'Payload Too Large',
        message: 'Audio file is too large. Maximum size is 10MB.',
      });
    }
    return res.status(400).json({
      success: false,
      error: 'Upload Error',
      message: error.message,
    });
  }

  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid File Type',
      message: error.message,
    });
  }

  next(error);
});

module.exports = router;
