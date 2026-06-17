/**
 * Enhanced Security Configuration
 * Additional security headers and policies for comprehensive protection
 */

const helmet = require('helmet');

// Enhanced Helmet Configuration
const helmetConfig = {
  // Content Security Policy
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
      childSrc: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: []
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  },

  // HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // Referrer Policy
  referrerPolicy: "no-referrer-when-downgrade",
  },

  // Permissions Policy
  permissionsPolicy: {
    allowedOrigins: ["'self'"],
    allowedHeaders: [],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: []
  }
};

// Additional Security Headers
const additionalSecurityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'X-Download-Options': 'noopen',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-Content-Security-Policy': "frame-ancestors 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Content-Security-Policy': "default-src 'self' https://http://localhost:3000; frame-ancestors 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'"
};

module.exports = {
  helmetConfig,
  additionalSecurityHeaders
};
