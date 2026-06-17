const express = require('express');
const { getInstance } = require('../services/licenseService');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Rate limiting for activation attempts
const activationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 activation attempts per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many activation attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Get current license status
router.get('/status', async (req, res) => {
  try {
    const licenseService = getInstance();
    const currentLicense = licenseService.getCurrentLicense();
    const licenseValidation = await licenseService.validateLicense();
    
    const response = {
      success: true,
      data: {
        license: currentLicense,
        validation: licenseValidation,
        deploymentMode: licenseService.getDeploymentMode(),
        isCloudMode: licenseService.isCloudMode(),
        isSelfHosted: licenseService.isSelfHostedMode()
      }
    };

    res.json(response);
  } catch (error) {
    console.error('[LicenseRoutes] Status check failed:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: 'Failed to retrieve license status'
      }
    });
  }
});

// Activate license
router.post('/activate', activationLimiter, async (req, res) => {
  try {
    const { schoolName, licenseKey } = req.body;

    // Validate input
    if (!schoolName || !licenseKey) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'School name and license key are required'
        }
      });
    }

    // Get client IP for logging
    const clientIP = req.ip || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress ||
                    (req.connection.socket ? req.connection.socket.remoteAddress : null);

    const licenseService = getInstance();
    const result = await licenseService.activateLicense(schoolName, licenseKey, clientIP);

    // Log activation attempt
    console.log(`[LicenseRoutes] Activation attempt: ${schoolName} from ${clientIP} - ${result.success ? 'SUCCESS' : 'FAILED'}`);

    res.status(result.success ? 200 : 400).json(result);

  } catch (error) {
    console.error('[LicenseRoutes] Activation failed:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACTIVATION_ERROR',
        message: 'License activation failed'
      }
    });
  }
});

// Validate license (for frontend checks)
router.post('/validate', async (req, res) => {
  try {
    const licenseService = getInstance();
    const validation = await licenseService.validateLicense();
    
    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    console.error('[LicenseRoutes] Validation failed:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'License validation failed'
      }
    });
  }
});

// Get license info for authenticated users
router.get('/info', async (req, res) => {
  try {
    const licenseService = getInstance();
    const currentLicense = licenseService.getCurrentLicense();
    
    if (!currentLicense) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_LICENSE',
          message: 'No license found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        schoolName: currentLicense.schoolName,
        deploymentType: currentLicense.deploymentType,
        status: currentLicense.status,
        expiryDate: currentLicense.expiryDate,
        maxUsers: currentLicense.maxUsers,
        currentUsers: currentLicense.currentUsers,
        features: currentLicense.features,
        daysUntilExpiry: currentLicense.daysUntilExpiry,
        isExpired: currentLicense.isExpired,
        isInGracePeriod: currentLicense.isInGracePeriod
      }
    });

  } catch (error) {
    console.error('[LicenseRoutes] Info retrieval failed:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INFO_RETRIEVAL_ERROR',
        message: 'Failed to retrieve license information'
      }
    });
  }
});

// Renew license (placeholder for future implementation)
router.post('/renew', async (req, res) => {
  try {
    const { licenseKey, newLicenseKey } = req.body;

    if (!licenseKey || !newLicenseKey) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Current license key and new license key are required'
        }
      });
    }

    // This would integrate with payment processor in production
    res.json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'License renewal not yet implemented'
      }
    });

  } catch (error) {
    console.error('[LicenseRoutes] Renewal failed:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'RENEWAL_ERROR',
        message: 'License renewal failed'
      }
    });
  }
});

// Deactivate license (admin only)
router.post('/deactivate', async (req, res) => {
  try {
    // This would require admin authentication in production
    const licenseService = getInstance();
    await licenseService.updateLicenseStatus('suspended');
    
    console.log('[LicenseRoutes] License deactivated by admin');

    res.json({
      success: true,
      message: 'License deactivated successfully'
    });

  } catch (error) {
    console.error('[LicenseRoutes] Deactivation failed:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEACTIVATION_ERROR',
        message: 'License deactivation failed'
      }
    });
  }
});

module.exports = router;
