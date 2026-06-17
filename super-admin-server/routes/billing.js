const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { licenseLimiter } = require('../middleware/rateLimiter');
const { superAdminAuth, auditLog } = require('../middleware/superAdminAuth');
const { validate } = require('../utils/validation');

// Public webhook endpoint (no authentication required)
router.post('/webhook',
  licenseLimiter,
  billingController.handlePaystackWebhook
);

// Apply authentication to all other routes
router.use(superAdminAuth);

// Generate Payment Link
router.post('/payment-link',
  licenseLimiter,
  auditLog('RENEW_LICENSE', 'license'),
  billingController.generatePaymentLink
);

// Create School with Payment (new onboarding flow)
router.post('/create-school',
  licenseLimiter,
  auditLog('CREATE_SCHOOL', 'school'),
  billingController.createSchoolWithPayment
);

// Get Payment History
router.get('/payment-history/:schoolId',
  auditLog('VIEW_DASHBOARD', 'license'),
  billingController.getPaymentHistory
);

// Check Renewal Status
router.get('/renewal-status/:schoolId',
  auditLog('VIEW_DASHBOARD', 'license'),
  billingController.checkRenewalStatus
);

module.exports = router;
