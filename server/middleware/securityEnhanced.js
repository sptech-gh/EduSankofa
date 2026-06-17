const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss");
const validator = require("validator");
const { body, validationResult } = require("express-validator");

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
  });
};

// Rate limits for different endpoints
const authLimiter = createRateLimit(15 * 60 * 1000, 5, "Too many authentication attempts, please try again later");
const generalLimiter = createRateLimit(15 * 60 * 1000, 100, "Too many requests from this IP, please try again later");
const uploadLimiter = createRateLimit(60 * 60 * 1000, 10, "Too many file uploads, please try again later");
const adminLimiter = createRateLimit(15 * 60 * 1000, 200, "Too many admin requests, please try again later");

// Security headers middleware
const securityHeaders = helmet({
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
  crossOriginEmbedderPolicy: { policy: "require-corp" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true,
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    req.body = mongoSanitize(req.body);
    
    // Sanitize string fields recursively
    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === "string") {
          obj[key] = validator.escape(obj[key]);
          obj[key] = xss(obj[key]);
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };
    
    sanitizeObject(req.body);
  }

  next();
};

// Enhanced validation middleware
const validateInput = (validationRules) => {
  return [
    ...validationRules,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation failed",
          errors: errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value,
          })),
        });
      }
      next();
    },
  ];
};

// SQL injection prevention for MongoDB
const preventNoSQLInjection = (req, res, next) => {
  // Check for common NoSQL injection patterns
  const suspiciousPatterns = [
    /\$where/i,
    /\$or/i,
    /\$and/i,
    /\$ne/i,
    /\$gt/i,
    /\$lt/i,
    /\$gte/i,
    /\$lte/i,
    /\$in/i,
    /\$nin/i,
    /\{.*\}/,
    /\(/,
    /\)/,
    /javascript:/i,
    /<script/i,
    /<\/script>/i,
    /onload=/i,
    /onerror=/i,
    /eval\(/i,
    /document\./i,
    /window\./i,
  ];

  const checkValue = (value) => {
    if (typeof value === "string") {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    } else if (typeof value === "object" && value !== null) {
      for (const key in value) {
        if (checkValue(value[key])) {
          return true;
        }
      }
    }
    return false;
  };

  // Check request parameters
  const checkParams = (params) => {
    for (const key in params) {
      if (checkValue(params[key])) {
        return true;
      }
    }
    return false;
  };

  if (checkValue(req.query) || checkValue(req.body) || checkParams(req.params)) {
    return res.status(400).json({
      message: "Invalid input detected",
      error: "Potential security threat detected",
    });
  }

  next();
};

// Audit logging middleware
const auditLogger = (action, resource) => {
  return (req, res, next) => {
      const originalSend = res.send;
      const originalJson = res.json;
      
      res.send = function (data) {
        logAudit(req, action, resource, res.statusCode, data);
        originalSend.call(this, data);
      };
      
      res.json = function (data) {
        logAudit(req, action, resource, res.statusCode, data);
        originalJson.call(this, data);
      };
      
      next();
  };
};

// Audit logging function
const logAudit = async (req, action, resource, statusCode, data) => {
  try {
    const AuditLog = require("../models/AuditLog");
    
    const logEntry = {
      user: req.user ? req.user._id : null,
      action,
      resource,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
      ipAddress: req.ip,
      statusCode,
      requestBody: JSON.stringify(req.body),
      responseStatus: statusCode,
      timestamp: new Date(),
      sessionId: req.sessionID || null,
    };

    // Only log non-sensitive requests
    if (req.path !== "/api/auth/login" && req.path !== "/api/auth/register") {
      await AuditLog.create(logEntry);
    }
  } catch (error) {
    console.error("Audit logging error:", error);
  }
};

// Data validation middleware
const validateDataIntegrity = (req, res, next) => {
  // Validate email formats
  if (req.body.email && !validator.isEmail(req.body.email)) {
    return res.status(400).json({
      message: "Invalid email format",
    });
  }

  // Validate phone numbers (Ghanaian format)
  if (req.body.phone || req.body.phoneNumber) {
    const phone = req.body.phone || req.body.phoneNumber;
    const ghanaPhoneRegex = /^\+233\d{9}$/;
    if (!ghanaPhoneRegex.test(phone)) {
      return res.status(400).json({
        message: "Invalid Ghanaian phone number format. Format: +233XXXXXXXXX",
      });
    }
  }

  // Validate student ID format
  if (req.body.studentId) {
    const studentIdRegex = /^[A-Z]{2}\d{4}\/\d{4}$/;
    if (!studentIdRegex.test(req.body.studentId)) {
      return res.status(400).json({
        message: "Invalid student ID format. Format: XX0000/0000",
      });
    }
  }

  // Validate amounts
  if (req.body.amount || req.body.fee || req.body.payment) {
    const amount = req.body.amount || req.body.fee || req.body.payment;
    if (!validator.isNumeric(amount) || parseFloat(amount) < 0) {
      return res.status(400).json({
        message: "Invalid amount. Amount must be a positive number",
      });
    }
  }

  // Validate dates
  if (req.body.date || req.body.dueDate || req.body.birthDate) {
    const date = new Date(req.body.date || req.body.dueDate || req.body.birthDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        message: "Invalid date format",
      });
    }
  }

  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Don't leak error details in production
  if (process.env.NODE_ENV === "production") {
    return res.status(500).json({
      message: "Internal server error",
      error: "Something went wrong",
    });
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
    error: err,
    stack: err.stack,
  });
};

// Request size limiter
const requestSizeLimiter = (req, res, next) => {
  const contentLength = req.get("content-length");
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength && parseInt(contentLength) > maxSize) {
    return res.status(413).json({
      message: "Request entity too large",
      error: "Maximum request size is 10MB",
    });
  }

  next();
};

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:5000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Session security
const sessionSecurity = {
  name: "edusankofa-session",
  secret: process.env.SESSION_SECRET || "complex-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: "strict",
  },
};

// JWT security
const jwtSecurity = {
  secret: process.env.JWT_SECRET || "your-jwt-secret",
  expiresIn: "24h",
  algorithm: "HS256",
};

// Password strength validation
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return {
      isValid: false,
      message: `Password must be at least ${minLength} characters long`,
    };
  }

  if (!hasUpperCase) {
    return {
      isValid: false,
      message: "Password must contain at least one uppercase letter",
    };
  }

  if (!hasLowerCase) {
    return {
      isValid: false,
      message: "Password must contain at least one lowercase letter",
    };
  }

  if (!hasNumbers) {
    return {
      isValid: false,
      message: "Password must contain at least one number",
    };
  }

  if (!hasSpecialChar) {
    return {
      isValid: false,
      message: "Password must contain at least one special character",
    };
  }

  return {
    isValid: true,
    message: "Password meets security requirements",
  };
};

// File upload security
const fileUploadSecurity = {
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ],
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 5,
};

// Rate limiting for sensitive operations
const sensitiveOperationLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  3,
  "Too many sensitive operations, please try again later"
);

// IP whitelist for admin operations
const ipWhitelist = (req, res, next) => {
  const allowedIPs = process.env.ALLOWED_IPS 
    ? process.env.ALLOWED_IPS.split(",")
    : ["127.0.0.1", "::1"];

  const clientIP = req.ip || req.connection.remoteAddress;

  if (req.user && req.user.role === "admin" && !allowedIPs.includes(clientIP)) {
    return res.status(403).json({
      message: "Access denied from this IP address",
      error: "Admin access restricted to whitelisted IPs",
    });
  }

  next();
};

// Request timeout
const requestTimeout = (req, res, next) => {
  const timeout = 30 * 1000; // 30 seconds

  res.setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        message: "Request timeout",
        error: "Request took too long to process",
      });
    }
  }, timeout);

  next();
};

module.exports = {
  authLimiter,
  generalLimiter,
  uploadLimiter,
  adminLimiter,
  securityHeaders,
  sanitizeInput,
  validateInput,
  preventNoSQLInjection,
  auditLogger,
  validateDataIntegrity,
  errorHandler,
  requestSizeLimiter,
  corsOptions,
  sessionSecurity,
  jwtSecurity,
  validatePasswordStrength,
  fileUploadSecurity,
  sensitiveOperationLimiter,
  ipWhitelist,
  requestTimeout,
};
