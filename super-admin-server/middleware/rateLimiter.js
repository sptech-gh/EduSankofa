const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/database');

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.'
      }
    });
  }
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts from this IP, please try again later.'
    }
  },
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts from this IP, please try again later.'
      }
    });
  }
});

// Rate limiting for license operations
const licenseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 license operations per hour
  message: {
    success: false,
    error: {
      code: 'LICENSE_RATE_LIMIT_EXCEEDED',
      message: 'Too many license operations, please try again later.'
    }
  },
  handler: (req, res) => {
    logger.warn('License rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'LICENSE_RATE_LIMIT_EXCEEDED',
        message: 'Too many license operations, please try again later.'
      }
    });
  }
});

// Rate limiting for school operations
const schoolLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 school operations per hour
  message: {
    success: false,
    error: {
      code: 'SCHOOL_RATE_LIMIT_EXCEEDED',
      message: 'Too many school operations, please try again later.'
    }
  },
  handler: (req, res) => {
    logger.warn('School rate limit exceeded', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'SCHOOL_RATE_LIMIT_EXCEEDED',
        message: 'Too many school operations, please try again later.'
      }
    });
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  licenseLimiter,
  schoolLimiter
};
