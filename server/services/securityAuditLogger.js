const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SecurityAuditLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs/security');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      console.log('[SecurityAuditLogger] Initialized');
    } catch (error) {
      console.error('[SecurityAuditLogger] Failed to initialize:', error.message);
    }
  }

  async logSecurityEvent(eventType, details, severity = 'medium') {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        eventType,
        severity,
        details,
        serverId: this.getServerId(),
        sessionId: this.generateSessionId()
      };

      const logFileName = `security-${new Date().toISOString().split('T')[0]}.log`;
      const logFilePath = path.join(this.logDir, logFileName);
      
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Append to log file
      await fs.appendFile(logFilePath, logLine);
      
      // Also log to console with security prefix
      console.log(`[SECURITY_AUDIT] ${eventType}:`, details);
      
      // Rotate logs if they get too large
      await this.rotateLogsIfNeeded();
      
    } catch (error) {
      console.error('[SecurityAuditLogger] Failed to log security event:', error.message);
    }
  }

  async logLicenseActivation(schoolName, clientIP, success, reason = null) {
    await this.logSecurityEvent('LICENSE_ACTIVATION', {
      schoolName,
      clientIP: this.hashIP(clientIP),
      success,
      reason,
      userAgent: this.getUserAgent(),
      timestamp: new Date().toISOString()
    }, success ? 'info' : 'warning');
  }

  async logLicenseValidation(validationResult, clientIP) {
    await this.logSecurityEvent('LICENSE_VALIDATION', {
      status: validationResult.status,
      isValid: validationResult.isValid,
      isExpired: validationResult.isExpired,
      isInGracePeriod: validationResult.isInGracePeriod,
      daysUntilExpiry: validationResult.daysUntilExpiry,
      clientIP: this.hashIP(clientIP),
      serverTime: new Date().toISOString()
    }, validationResult.isValid ? 'info' : 'warning');
  }

  async logSecurityViolation(violationType, details, severity = 'high') {
    await this.logSecurityEvent('SECURITY_VIOLATION', {
      violationType,
      details,
      severity,
      clientIP: this.hashIP(details.clientIP),
      userAgent: this.getUserAgent(),
      timestamp: new Date().toISOString()
    }, severity);
  }

  async logUnauthorizedAccess(path, clientIP, userAgent) {
    await this.logSecurityEvent('UNAUTHORIZED_ACCESS', {
      path,
      clientIP: this.hashIP(clientIP),
      userAgent: this.hashUserAgent(userAgent),
      timestamp: new Date().toISOString()
    }, 'high');
  }

  async logRateLimitExceeded(clientIP, endpoint) {
    await this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      clientIP: this.hashIP(clientIP),
      endpoint,
      timestamp: new Date().toISOString()
    }, 'medium');
  }

  async logBypassAttempt(method, details, clientIP) {
    await this.logSecurityEvent('BYPASS_ATTEMPT', {
      method,
      details,
      clientIP: this.hashIP(clientIP),
      timestamp: new Date().toISOString()
    }, 'critical');
  }

  async logDataAccess(resource, userId, action, clientIP) {
    await this.logSecurityEvent('DATA_ACCESS', {
      resource,
      userId: this.hashUserId(userId),
      action,
      clientIP: this.hashIP(clientIP),
      timestamp: new Date().toISOString()
    }, 'low');
  }

  getServerId() {
    // Generate or retrieve a unique server ID
    return process.env.SERVER_ID || crypto.randomBytes(8).toString('hex');
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  hashIP(ip) {
    if (!ip) return null;
    // Hash IP for privacy but keep pattern detection
    return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
  }

  hashUserAgent(userAgent) {
    if (!userAgent) return null;
    return crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 16);
  }

  hashUserId(userId) {
    if (!userId) return null;
    return crypto.createHash('sha256').update(userId.toString()).digest('hex').substring(0, 16);
  }

  getUserAgent() {
    // This would come from request headers in real implementation
    return 'Unknown';
  }

  async rotateLogsIfNeeded() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('security-') && file.endsWith('.log'));
      
      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.size > this.maxLogSize) {
          // Rotate the file
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedFile = path.join(this.logDir, `${file}.${timestamp}.rotated`);
          
          await fs.rename(filePath, rotatedFile);
          console.log(`[SecurityAuditLogger] Rotated log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('[SecurityAuditLogger] Failed to rotate logs:', error.message);
    }
  }

  async getRecentLogs(hours = 24, limit = 100) {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('security-') && file.endsWith('.log'));
      
      let allLogs = [];
      
      for (const file of logFiles.slice(-7)) { // Last 7 days
        const filePath = path.join(this.logDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        allLogs = allLogs.concat(lines);
      }
      
      // Parse and filter by time
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const recentLogs = allLogs
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(log => log && new Date(log.timestamp) >= cutoffTime)
        .slice(-limit);
      
      return recentLogs;
    } catch (error) {
      console.error('[SecurityAuditLogger] Failed to get recent logs:', error.message);
      return [];
    }
  }
}

module.exports = new SecurityAuditLogger();
