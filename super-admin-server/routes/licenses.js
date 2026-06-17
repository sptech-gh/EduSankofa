const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/licenseController');
const { licenseLimiter } = require('../middleware/rateLimiter');
const { superAdminAuth, auditLog, sensitiveOperationLimit } = require('../middleware/superAdminAuth');
const { validate } = require('../utils/validation');
const { 
  createLicenseSchema,
  renewLicenseSchema,
  paginationSchema
} = require('../utils/validation');

// Apply authentication to all routes
router.use(superAdminAuth);

// Create License
router.post('/',
  licenseLimiter,
  sensitiveOperationLimit,
  validate(createLicenseSchema),
  auditLog('CREATE_LICENSE', 'license'),
  licenseController.createLicense
);

// List Licenses
router.get('/',
  validate(paginationSchema, 'query'),
  auditLog('VIEW_DASHBOARD', 'license'),
  licenseController.listLicenses
);

// Get License Statistics
router.get('/stats',
  auditLog('VIEW_DASHBOARD', 'license'),
  licenseController.getLicenseStats
);

// Get Expiring Licenses
router.get('/expiring',
  auditLog('VIEW_DASHBOARD', 'license'),
  licenseController.getExpiringLicenses
);

// Get License Details
router.get('/:id',
  auditLog('VIEW_DASHBOARD', 'license'),
  licenseController.getLicense
);

// Renew License
router.patch('/:id/renew',
  licenseLimiter,
  sensitiveOperationLimit,
  validate(renewLicenseSchema),
  auditLog('RENEW_LICENSE', 'license'),
  licenseController.renewLicense
);

// Suspend License
router.patch('/:id/suspend',
  licenseLimiter,
  sensitiveOperationLimit,
  auditLog('SUSPEND_LICENSE', 'license'),
  licenseController.suspendLicense
);

module.exports = router;
