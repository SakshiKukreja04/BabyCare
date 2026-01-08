require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const careLogsRoutes = require('./routes/careLogs');
const alertsRoutes = require('./routes/alerts');
const chatbotRoutes = require('./routes/chatbot');
const babiesRoutes = require('./routes/babies');
const prescriptionsRoutes = require('./routes/prescriptions');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 BabyCare Backend Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

