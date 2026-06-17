const express = require('express');
const router = express.Router();
const subscriptionPlanController = require('../controllers/subscriptionPlanController');
const { licenseLimiter } = require('../middleware/rateLimiter');
const { superAdminAuth, auditLog, sensitiveOperationLimit } = require('../middleware/superAdminAuth');
const { validate } = require('../utils/validation');
const { 
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  paginationSchema
} = require('../utils/validation');

// Apply authentication to all routes
router.use(superAdminAuth);

// Create Subscription Plan
router.post('/',
  licenseLimiter,
  sensitiveOperationLimit,
  validate(createSubscriptionPlanSchema),
  auditLog('CREATE_LICENSE', 'license'),
  subscriptionPlanController.createSubscriptionPlan
);

// List Subscription Plans
router.get('/',
  validate(paginationSchema, 'query'),
  auditLog('VIEW_DASHBOARD', 'license'),
  subscriptionPlanController.listSubscriptionPlans
);

// Get Active Plans (for frontend dropdown)
router.get('/active',
  auditLog('VIEW_DASHBOARD', 'license'),
  subscriptionPlanController.getActivePlans
);

// Get Subscription Plan Details
router.get('/:id',
  auditLog('VIEW_DASHBOARD', 'license'),
  subscriptionPlanController.getSubscriptionPlan
);

// Update Subscription Plan
router.put('/:id',
  licenseLimiter,
  sensitiveOperationLimit,
  validate(updateSubscriptionPlanSchema),
  auditLog('UPDATE_LICENSE', 'license'),
  subscriptionPlanController.updateSubscriptionPlan
);

// Delete Subscription Plan (Soft Delete)
router.delete('/:id',
  licenseLimiter,
  sensitiveOperationLimit,
  auditLog('DELETE_LICENSE', 'license'),
  subscriptionPlanController.deleteSubscriptionPlan
);

module.exports = router;
