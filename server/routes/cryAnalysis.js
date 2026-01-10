const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth');

/**
 * Cry Analysis Route
 * Integrates with external Flask AI microservice for baby cry analysis
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
const FLASK_CRY_ANALYSIS_URL = process.env.FLASK_CRY_ANALYSIS_URL || 'http://127.0.0.1:5000/analyze-cry';
const FLASK_TIMEOUT_MS = parseInt(process.env.FLASK_TIMEOUT_MS, 10) || 30000; // 30 seconds default

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

    const duration = Date.now() - startTime;
    console.log(`✅ [CryAnalysis] [${requestId}] Flask response received in ${duration}ms`);
    
    // Log the Flask response data
    console.log(`📊 [CryAnalysis] [${requestId}] ========== FLASK RESPONSE ==========`);
    console.log(`📊 [CryAnalysis] [${requestId}] Top Reason: ${flaskResponse.data?.top_reason || 'N/A'}`);
    
    // Log all probabilities
    const data = flaskResponse.data || {};
    const probabilities = Object.entries(data)
      .filter(([key, value]) => typeof value === 'number' && key !== 'top_reason')
      .sort(([, a], [, b]) => b - a);
    
    if (probabilities.length > 0) {
      console.log(`📊 [CryAnalysis] [${requestId}] Probabilities:`);
      probabilities.forEach(([cause, prob]) => {
        const percentage = (prob * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(prob * 20)) + '░'.repeat(20 - Math.round(prob * 20));
        console.log(`📊 [CryAnalysis] [${requestId}]   ${cause.padEnd(12)} ${bar} ${percentage}%`);
      });
    }
    console.log(`📊 [CryAnalysis] [${requestId}] =====================================`);

    // Return Flask response to frontend
    return res.status(200).json({
      success: true,
      data: flaskResponse.data,
      meta: {
        processingTimeMs: duration,
        originalFilename: req.file.originalname,
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
