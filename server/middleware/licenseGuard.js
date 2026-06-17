const { getInstance } = require('../services/licenseService');
const securityAuditLogger = require('../services/securityAuditLogger');

class LicenseGuard {
  constructor() {
    this.licenseService = getInstance();
    this.publicRoutes = new Set([
      '/api/auth/login',
      '/api/auth/register', 
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/license/activate',
      '/api/health',
      '/api/license/status',
      '/'
    ]);
    
    this.licenseManagementRoutes = new Set([
      '/api/license/activate',
      '/api/license/status',
      '/api/license/renew'
    ]);
  }

  middleware() {
    return async (req, res, next) => {
      try {
        if (process.env.NODE_ENV === 'test') {
          return next();
        }

        // Skip license check for public routes
        if (this.isPublicRoute(req.path)) {
          return next();
        }

        // Get license validation result
        const licenseValidation = await this.licenseService.validateLicense();

        if (
          process.env.NODE_ENV === 'development' &&
          (licenseValidation.status === 'missing' ||
            licenseValidation.status === 'invalid' ||
            licenseValidation.status === 'error')
        ) {
          req.licenseInfo = licenseValidation;
          res.set('X-License-Warning', licenseValidation.message || 'License not configured');
          return next();
        }
        
        // Log license status for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log(`[LicenseGuard] Route: ${req.path}, License Status: ${licenseValidation.status}`);
        }

        // Log security events
        await securityAuditLogger.logLicenseValidation(licenseValidation, req.ip);

        // Handle different license states
        switch (licenseValidation.status) {
          case 'active':
            // License is valid, allow access
            req.licenseInfo = licenseValidation;
            return next();

          case 'grace_period':
            // Allow access but warn about expiry
            req.licenseInfo = licenseValidation;
            res.set('X-License-Warning', licenseValidation.message);
            return next();

          case 'expired':
            // Block access except for license management routes
            if (this.isLicenseManagementRoute(req.path)) {
              req.licenseInfo = licenseValidation;
              return next();
            }
            
            return this.sendLicenseError(res, {
              code: 'LICENSE_EXPIRED',
              message: licenseValidation.message,
              gracePeriod: false,
              canRenew: true
            }, 403);

          case 'suspended':
            // Block access
            await securityAuditLogger.logSecurityViolation('LICENSE_SUSPENDED', {
              path: req.path,
              method: req.method,
              clientIP: req.ip
            }, 'high');
            
            return this.sendLicenseError(res, {
              code: 'LICENSE_SUSPENDED',
              message: licenseValidation.message,
              canRenew: false
            }, 403);

          case 'user_limit_exceeded':
            // Block access
            await securityAuditLogger.logSecurityViolation('USER_LIMIT_EXCEEDED', {
              path: req.path,
              method: req.method,
              currentUsers: licenseValidation.currentUsers,
              maxUsers: licenseValidation.maxUsers,
              clientIP: req.ip
            }, 'medium');
            
            return this.sendLicenseError(res, {
              code: 'USER_LIMIT_EXCEEDED',
              message: licenseValidation.message,
              currentUsers: licenseValidation.currentUsers,
              maxUsers: licenseValidation.maxUsers,
              canRenew: true
            }, 403);

          case 'missing':
          case 'invalid':
          default:
            // Block access for license management routes only
            if (this.isLicenseManagementRoute(req.path)) {
              req.licenseInfo = licenseValidation;
              return next();
            }
            
            // Log unauthorized access attempt
            await securityAuditLogger.logUnauthorizedAccess(req.path, req.ip, req.get('User-Agent'));
            
            return this.sendLicenseError(res, {
              code: 'LICENSE_MISSING',
              message: 'No valid license found',
              canActivate: true
            }, 403);
        }

      } catch (error) {
        console.error('[LicenseGuard] Middleware error:', error.message);
        
        // Fail secure - block access if license check fails
        return this.sendLicenseError(res, {
          code: 'LICENSE_ERROR',
          message: 'License validation failed',
          canRetry: true
        }, 500);
      }
    };
  }

  isPublicRoute(path) {
    return this.publicRoutes.has(path) || 
           path.startsWith('/api/auth/') || 
           path.startsWith('/api/license/') ||
           path === '/api/health' ||
           path === '/';
  }

  isLicenseManagementRoute(path) {
    return this.licenseManagementRoutes.has(path);
  }

  sendLicenseError(res, errorData, statusCode = 403) {
    const response = {
      success: false,
      error: {
        code: errorData.code,
        message: errorData.message,
        details: errorData
      },
      timestamp: new Date().toISOString()
    };

    // Add helpful headers for frontend
    res.set({
      'X-License-Error': errorData.code,
      'X-License-Status': 'error',
      'Content-Type': 'application/json'
    });

    return res.status(statusCode).json(response);
  }

  // Middleware for user count tracking
  userTrackingMiddleware() {
    return async (req, res, next) => {
      try {
        const licenseValidation = await this.licenseService.validateLicense();
        
        // Only track users for authenticated routes
        if (req.user && licenseValidation.isValid) {
          // Increment user count on login
          if (req.path === '/api/auth/login' && req.method === 'POST') {
            await this.licenseService.incrementUserCount();
          }
          
          // Decrement user count on logout
          if (req.path === '/api/auth/logout' && req.method === 'POST') {
            await this.licenseService.decrementUserCount();
          }
        }
        
        return next();
      } catch (error) {
        console.error('[LicenseGuard] User tracking error:', error.message);
        return next(); // Don't block for tracking errors
      }
    };
  }

  // Middleware to add license info to all responses
  licenseInfoMiddleware() {
    return async (req, res, next) => {
      try {
        const licenseInfo = await this.licenseService.validateLicense();
        
        // Add license info to response headers
        res.set({
          'X-License-Status': licenseInfo.status,
          'X-License-Valid': licenseInfo.isValid.toString(),
          'X-License-Expiry': licenseInfo.daysUntilExpiry.toString(),
          'X-License-Users': `${licenseInfo.currentUsers}/${licenseInfo.maxUsers}`
        });

        // Add license info to request for use in controllers
        req.licenseInfo = licenseInfo;
        
        return next();
      } catch (error) {
        console.error('[LicenseGuard] License info middleware error:', error.message);
        return next();
      }
    };
  }

  // Health check middleware
  healthCheckMiddleware() {
    return async (req, res, next) => {
      if (req.path === '/api/health') {
        try {
          const licenseValidation = await this.licenseService.validateLicense();
          const currentLicense = this.licenseService.getCurrentLicense();
          
          const healthData = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            license: {
              status: licenseValidation.status,
              isValid: licenseValidation.isValid,
              schoolName: currentLicense?.schoolName || null,
              deploymentType: currentLicense?.deploymentType || null,
              daysUntilExpiry: licenseValidation.daysUntilExpiry,
              users: {
                current: licenseValidation.currentUsers,
                max: licenseValidation.maxUsers
              }
            }
          };

          return res.json(healthData);
        } catch (error) {
          return res.status(500).json({
            status: 'ERROR',
            message: 'License health check failed',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      return next();
    };
  }
}

module.exports = new LicenseGuard();
