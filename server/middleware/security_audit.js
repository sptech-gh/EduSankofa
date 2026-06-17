/**
 * Security Audit Middleware
 * Comprehensive security monitoring and vulnerability detection
 */

const logger = require('../services/logger');

// Security audit middleware
const securityAudit = (req, res, next) => {
  const auditData = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    query: req.query,
    body: req.body,
    files: req.files,
    user: req.user ? {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email
    } : null
  };

  // Log security-relevant events
  const securityEvents = detectSecurityEvents(req, auditData);
  
  if (securityEvents.length > 0) {
    logger.warn('Security events detected', {
      events: securityEvents,
      audit: auditData
    });
  }

  // Store audit data for security analysis
  if (process.env.NODE_ENV === 'production') {
    storeSecurityAudit(auditData, securityEvents);
  }

  // Add security headers
  res.set({
    'X-Security-Audit': 'enabled',
    'X-Request-ID': generateRequestId(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });

  next();
};

// Detect potential security events
const detectSecurityEvents = (req, auditData) => {
  const events = [];

  // SQL Injection attempts
  if (detectSQLInjection(req)) {
    events.push({
      type: 'SQL_INJECTION_ATTEMPT',
      severity: 'HIGH',
      description: 'Potential SQL injection attempt detected'
    });
  }

  // XSS attempts
  if (detectXSSAttempt(req)) {
    events.push({
      type: 'XSS_ATTEMPT',
      severity: 'HIGH',
      description: 'Potential XSS attempt detected'
    });
  }

  // Path traversal attempts
  if (detectPathTraversal(req)) {
    events.push({
      type: 'PATH_TRAVERSAL_ATTEMPT',
      severity: 'HIGH',
      description: 'Path traversal attempt detected'
    });
  }

  // Command injection attempts
  if (detectCommandInjection(req)) {
    events.push({
      type: 'COMMAND_INJECTION_ATTEMPT',
      severity: 'HIGH',
      description: 'Command injection attempt detected'
    });
  }

  // Brute force attempts
  if (detectBruteForce(req)) {
    events.push({
      type: 'BRUTE_FORCE_ATTEMPT',
      severity: 'MEDIUM',
      description: 'Potential brute force attack detected'
    });
  }

  // Suspicious user agents
  if (detectSuspiciousUserAgent(req)) {
    events.push({
      type: 'SUSPICIOUS_USER_AGENT',
      severity: 'LOW',
      description: 'Suspicious user agent detected'
    });
  }

  return events;
};

// SQL Injection detection
const detectSQLInjection = (req) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|;|\/\*|\/\*\*|\|\*|\|)/i,
    /(\b(OR|AND|NOT|LIKE|IN|EXISTS|BETWEEN)\b)/i,
    /(\b(UNION|JOIN|INTERSECT|EXCEPT|MINUS)\b)/i
  ];

  const checkString = (str) => {
    if (!str) return false;
    return sqlPatterns.some(pattern => pattern.test(str));
  };

  return checkString(req.url) ||
         checkString(JSON.stringify(req.query)) ||
         checkString(JSON.stringify(req.body)) ||
         checkString(req.get('User-Agent'));
};

// XSS detection
const detectXSSAttempt = (req) => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]*src[^>]*javascript:/gi,
    /<\s*script\b/gi,
    /expression\s*\(/gi
  ];

  const checkString = (str) => {
    if (!str) return false;
    return xssPatterns.some(pattern => pattern.test(str));
  };

  return checkString(req.url) ||
         checkString(JSON.stringify(req.query)) ||
         checkString(JSON.stringify(req.body));
};

// Path traversal detection
const detectPathTraversal = (req) => {
  const pathTraversalPatterns = [
    /\.\.[\/\\]/g,
    /[\/\\]\.\.[\/\\]/g,
    /[\/\\]\.\.[\/\\]/g,
    /\.\.[\/\\]\./g,
    /%2e%2f|%2f%2e|%5c|%2e%5c/gi,
    /\.\.[\/\\]|\.\.[\/\\]/g
  ];

  return pathTraversalPatterns.some(pattern => pattern.test(req.url));
};

// Command injection detection
const detectCommandInjection = (req) => {
  const commandPatterns = [
    /[;&|`$(){}[\]]/g,
    /\b(cat|ls|dir|rm|del|copy|move|ping|net|whoami|id|uname|ps|kill|chmod|chown|wget|curl|nc|telnet|ssh|ftp)\b/gi,
    /[\/\\](bin|etc|var|tmp|usr|home|root)/gi,
    /\$\(|\`[^`]*`/g
  ];

  const checkString = (str) => {
    if (!str) return false;
    return commandPatterns.some(pattern => pattern.test(str));
  };

  return checkString(req.url) ||
         checkString(JSON.stringify(req.query)) ||
         checkString(JSON.stringify(req.body));
};

// Brute force detection
const detectBruteForce = (req) => {
  // This would typically be implemented with rate limiting and IP tracking
  // For now, we'll check for common brute force patterns
  const brutePatterns = [
    /\b(admin|administrator|root|test|guest|demo)\b/gi,
    /\b(123|password|pass|qwerty|letmein|admin|root)\b/gi
  ];

  return brutePatterns.some(pattern => pattern.test(req.url)) ||
         brutePatterns.some(pattern => pattern.test(JSON.stringify(req.body)));
};

// Suspicious user agent detection
const detectSuspiciousUserAgent = (req) => {
  const userAgent = req.get('User-Agent');
  if (!userAgent) return false;

  const suspiciousPatterns = [
    /sqlmap/i,
    /nmap/i,
    /nikto/i,
    /burp/i,
    /metasploit/i,
    /python-requests/i,
    /curl/i,
    /wget/i,
    /scanner/i,
    /bot/i,
    /crawler/i,
    /spider/i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(userAgent));
};

// Generate unique request ID
const generateRequestId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Store security audit data
const storeSecurityAudit = (auditData, events) => {
  // In a real implementation, this would store to a secure database
  // For now, we'll just log it
  logger.info('Security audit stored', {
    requestId: generateRequestId(),
    audit: auditData,
    events: events,
    timestamp: new Date().toISOString()
  });
};

module.exports = securityAudit;
