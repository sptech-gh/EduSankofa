const jwt = require('jsonwebtoken');
const SuperAdmin = require('../models/SuperAdmin');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { hashIP } = require('../utils/helpers');
const { logger } = require('../utils/database');

// Super Admin authentication middleware
const superAdminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Access denied. No token provided.'
        }
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get super admin
    const superAdmin = await SuperAdmin.findById(decoded.id);
    if (!superAdmin || !superAdmin.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token or account deactivated.'
        }
      });
    }

    // Check if account is locked
    if (superAdmin.isLocked) {
      return res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to multiple failed login attempts.'
        }
      });
    }

    // Attach super admin to request
    req.superAdmin = superAdmin;
    req.superAdminId = superAdmin._id;
    
    next();
  } catch (error) {
    logger.error('Super Admin authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token.'
        }
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired.'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication error.'
      }
    });
  }
};

// Audit logging middleware
const auditLog = (action, entityType) => {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    let responseData = null;
    
    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };
    
    // Continue to next middleware
    res.on('finish', async () => {
      try {
        const entityId = req.params.id || req.body._id || req.superAdminId;
        const entityName = req.body.name || req.params.id || 'Unknown';
        
        await SuperAdminAuditLog.create({
          adminId: req.superAdminId,
          action,
          entityType,
          entityId,
          entityName,
          details: {
            method: req.method,
            url: req.url,
            body: req.body,
            params: req.params,
            query: req.query
          },
          ipAddress: hashIP(req.ip),
          userAgent: req.get('User-Agent') || 'Unknown',
          severity: getSeverity(action, res.statusCode),
          success: res.statusCode < 400,
          errorMessage: responseData?.error?.message || null
        });
      } catch (error) {
        logger.error('Audit logging error:', error);
      }
    });
    
    next();
  };
};

// Helper function to determine severity based on action and status code
const getSeverity = (action, statusCode) => {
  const criticalActions = ['DELETE_SCHOOL', 'SUSPEND_SCHOOL', 'SUSPEND_LICENSE'];
  const highActions = ['CREATE_SCHOOL', 'CREATE_LICENSE', 'SYSTEM_CONFIG'];
  
  if (statusCode >= 500) return 'critical';
  if (criticalActions.includes(action)) return 'high';
  if (highActions.includes(action)) return 'medium';
  return 'low';
};

// Role-based access control
const authorizeAction = (allowedActions) => {
  return (req, res, next) => {
    // For now, all super admins have access to all actions
    // This can be extended for role-based permissions
    next();
  };
};

// Rate limiting for sensitive operations
const sensitiveOperationLimit = (req, res, next) => {
  const sensitiveActions = ['DELETE', 'PATCH', 'POST'];
  
  if (sensitiveActions.includes(req.method)) {
    // Add additional validation for sensitive operations
    if (!req.superAdmin.lastLogin || 
        (Date.now() - new Date(req.superAdmin.lastLogin).getTime()) > 24 * 60 * 60 * 1000) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Please login again to perform this sensitive operation.'
        }
      });
    }
  }
  
  next();
};

module.exports = {
  superAdminAuth,
  auditLog,
  authorizeAction,
  sensitiveOperationLimit
};
