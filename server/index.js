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

// Import background scheduler
const { initializeScheduler } = require('./services/backgroundScheduler');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Middleware - CORS configuration for Windows development
// Allow multiple origins for development (Vite may use different ports)
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow anyway in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
});

// Start server - explicitly bind to IPv4 on Windows
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 BabyCare Backend Server running on http://127.0.0.1:${PORT}`);
  console.log(`📡 Health check: http://127.0.0.1:${PORT}/health`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ CORS enabled for: http://127.0.0.1:5173`);
  
  // Initialize background scheduler for reminders
  try {
    initializeScheduler();
    console.log(`⏰ Background reminder scheduler initialized`);
  } catch (error) {
    console.error('❌ Failed to initialize scheduler:', error.message);
  }
});

module.exports = app;


