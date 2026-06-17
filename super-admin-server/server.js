require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { connectDB, gracefulShutdown, logger } = require('./utils/database');

// Import routes
const superAdminRoutes = require('./routes/superAdmin');
const schoolRoutes = require('./routes/schools');
const licenseRoutes = require('./routes/licenses');
const monitoringRoutes = require('./routes/monitoring');
const subscriptionPlanRoutes = require('./routes/subscriptionPlans');
const billingRoutes = require('./routes/billing');
const contractRoutes = require('./routes/contracts');
const demoRoutes = require('./routes/demo');

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:6001'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'super-admin-server',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/subscription-plans', subscriptionPlanRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/demo', demoRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Super Admin Control Server API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      superAdmin: '/api/superadmin',
      schools: '/api/schools',
      licenses: '/api/licenses',
      monitoring: '/api/monitoring',
      subscriptionPlans: '/api/subscription-plans',
      billing: '/api/billing',
      contracts: '/api/contracts',
      demo: '/api/demo'
    }
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found'
    }
  });
});

// 404 handler for non-API routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message
      }
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      }
    });
  }

  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Duplicate entry detected'
      }
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message
    }
  });
});

// Start server
const PORT = process.env.PORT || 6000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Super Admin Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Database: MongoDB`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API endpoints: http://localhost:${PORT}/api`);
    });

    // Graceful shutdown
    const gracefulShutdownHandler = (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        
        // Close database connection
        const mongoose = require('mongoose');
        mongoose.connection.close(() => {
          logger.info('MongoDB connection closed');
          process.exit(0);
        });
      });
    };

    // Handle process signals
    process.on('SIGTERM', gracefulShutdownHandler);
    process.on('SIGINT', gracefulShutdownHandler);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
