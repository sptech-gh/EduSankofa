const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss");
const validator = require("validator");

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_GENERAL, 10) || (process.env.NODE_ENV === "production" ? 100 : 1000),
  message: {
    error: "Too many requests from this IP, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
  },
  skip: (req) => {
    // Skip rate limiting for tests
    return process.env.NODE_ENV === 'test';
  }
});

// Stricter rate limiting for sensitive operations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_AUTH, 10) || (process.env.NODE_ENV === "production" ? 10 : 100),
  message: {
    error: "Too many authentication attempts, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
  },
  skip: (req) => {
    // Skip rate limiting for tests
    return process.env.NODE_ENV === 'test';
  }
});

// Rate limiting for file uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_UPLOAD, 10) || (process.env.NODE_ENV === "production" ? 10 : 100),
  message: {
    error: "Too many upload attempts, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
  },
  skip: (req) => {
    // Skip rate limiting for tests
    return process.env.NODE_ENV === 'test';
  }
});

// XSS protection middleware
const xssProtection = (req, res, next) => {
  if (req.body) {
    const sanitizeObject = (obj) => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      const sanitized = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'string') {
            sanitized[key] = xss(obj[key], {
              whiteList: {}, // Allow no HTML tags
              stripIgnoreTag: true,
              stripIgnoreTagBody: ['script']
            });
          } else if (typeof obj[key] === 'object') {
            sanitized[key] = sanitizeObject(obj[key]);
          } else {
            sanitized[key] = obj[key];
          }
        }
      }
      return sanitized;
    };
    
    req.body = sanitizeObject(req.body);
  }
  next();
};

// Input validation middleware
const validateInput = (req, res, next) => {
  const validateValue = (value, type) => {
    switch (type) {
      case 'email':
        return validator.isEmail(value) ? value : null;
      case 'phone':
        return validator.isMobilePhone(value, 'any', { strictMode: false }) ? value : null;
      case 'numeric':
        return validator.isNumeric(value) ? value : null;
      case 'alpha':
        return validator.isAlpha(value) ? value : null;
      case 'alphanumeric':
        return validator.isAlphanumeric(value) ? value : null;
      case 'url':
        return validator.isURL(value) ? value : null;
      default:
        return value;
    }
  };

  // Validate common fields
  if (req.body) {
    if (req.body.email) {
      req.body.email = validateValue(req.body.email, 'email');
    }
    if (req.body.phone) {
      req.body.phone = validateValue(req.body.phone, 'phone');
    }
    if (req.body.firstName) {
      req.body.firstName = validateValue(req.body.firstName, 'alpha');
    }
    if (req.body.lastName) {
      req.body.lastName = validateValue(req.body.lastName, 'alpha');
    }
  }

  next();
};

// Audit logging middleware
const auditLog = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the action
      console.log({
        timestamp: new Date().toISOString(),
        action: action,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user.id : null,
        userRole: req.user ? req.user.role : null,
        statusCode: res.statusCode,
        success: res.statusCode < 400
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (req.files) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    for (const file of Object.values(req.files)) {
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `Invalid file type: ${file.mimetype}. Only images, PDFs, and text files are allowed.`
        });
      }
      
      if (file.size > maxSize) {
        return res.status(400).json({
          error: `File too large: ${file.name}. Maximum size is 5MB.`
        });
      }
    }
  }
  
  next();
};

// SQL injection prevention for MongoDB
const preventInjection = (req, res, next) => {
  // Remove any potential MongoDB operators from query strings
  if (req && req.query) {
    const sanitizeQuery = (obj) => {
      const sanitized = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Remove MongoDB operators
          if (key.startsWith('$')) {
            continue;
          }
          sanitized[key] = obj[key];
        }
      }
      return sanitized;
    };
    
    req.query = sanitizeQuery(req.query);
  }
  
  next();
};

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

// Security headers configuration
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
};

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  xssProtection,
  validateInput,
  auditLog,
  validateFileUpload,
  preventInjection,
  corsOptions,
  helmetConfig
};
