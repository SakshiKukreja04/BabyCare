require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const careLogsRoutes = require('./routes/careLogs');
const alertsRoutes = require('./routes/alerts');
const chatbotRoutes = require('./routes/chatbot');
const babiesRoutes = require('./routes/babies');
const prescriptionsRoutes = require('./routes/prescriptions');
const remindersRoutes = require('./routes/reminders');
const cryAnalysisRoutes = require('./routes/cryAnalysis');
const notificationsRoutes = require('./routes/notifications');
const nutritionRoutes = require('./routes/nutrition');
const weightRoutes = require('./routes/weight');
const exportRoutes = require('./routes/export');

// Import background scheduler
const { initializeScheduler } = require('./services/backgroundScheduler');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// CORS configuration - Production ready
// Allow frontend Vercel domain and localhost for development
const allowedOrigins = [
  process.env.CLIENT_URL, // Vercel frontend URL
  process.env.FRONTEND_URL, // Alternative env var name
  // Only include localhost origins in development
  ...(isProduction ? [] : [
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://localhost:5173',
    'http://localhost:5174',
  ]),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development only
    if (!origin) {
      if (isProduction) {
        callback(new Error('CORS: Origin header required in production'));
        return;
      }
      callback(null, true);
      return;
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      if (isProduction) {
        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      } else {
        console.warn(`[CORS] Development mode - allowing origin: ${origin}`);
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Google-User'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'BabyCare Backend API',
  });
});

// API Routes
app.use('/api/care-logs', careLogsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/babies', babiesRoutes);
app.use('/api/prescriptions', prescriptionsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/cry-analysis', cryAnalysisRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/weight', weightRoutes);
app.use('/api', exportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler - Production safe
app.use((err, req, res, next) => {
  // Log full error details in development, sanitized in production
  if (isProduction) {
    console.error('[Error]', {
      message: err.message,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.error('Unhandled error:', err);
  }
  
  // Don't expose internal error details in production
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: isProduction 
      ? 'An unexpected error occurred' 
      : err.message || 'An unexpected error occurred',
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

// Start server - Production ready
// In production, listen on all interfaces (0.0.0.0) to work with Render
// In development, can bind to localhost for Windows compatibility
const host = isProduction ? '0.0.0.0' : '127.0.0.1';

app.listen(PORT, host, () => {
  console.log(`🚀 BabyCare Backend Server running on ${host}:${PORT}`);
  console.log(`📡 Health check: http://${host}:${PORT}/health`);
  console.log(`🔐 Environment: ${NODE_ENV}`);
  console.log(`✅ CORS enabled for: ${allowedOrigins.join(', ') || 'none configured'}`);
  
  // Initialize background scheduler for reminders
  try {
    initializeScheduler();
    console.log(`⏰ Background reminder scheduler initialized`);
  } catch (error) {
    console.error('❌ Failed to initialize scheduler:', error.message);
    // Don't exit in production - allow server to continue
    if (!isProduction) {
      throw error;
    }
  }
});

module.exports = app;


