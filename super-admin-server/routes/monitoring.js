const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');
const { generalLimiter } = require('../middleware/rateLimiter');
const { superAdminAuth, auditLog } = require('../middleware/superAdminAuth');
const { validate } = require('../utils/validation');
const { 
  heartbeatSchema,
  paginationSchema
} = require('../utils/validation');

// Public route for heartbeat (schools send heartbeat here)
router.post('/heartbeat',
  generalLimiter,
  validate(heartbeatSchema),
  monitoringController.receiveHeartbeat
);

// Apply authentication to all other routes
router.use(superAdminAuth);

// Dashboard Overview
router.get('/dashboard/overview',
  auditLog('VIEW_DASHBOARD', 'system'),
  monitoringController.getDashboardOverview
);

// Get School Heartbeat Details
router.get('/schools/:id/heartbeat',
  auditLog('VIEW_DASHBOARD', 'school'),
  monitoringController.getSchoolHeartbeat
);

// Get Online Schools
router.get('/schools/online',
  auditLog('VIEW_DASHBOARD', 'school'),
  monitoringController.getOnlineSchools
);

// Get Offline Schools
router.get('/schools/offline',
  auditLog('VIEW_DASHBOARD', 'school'),
  monitoringController.getOfflineSchools
);

module.exports = router;
