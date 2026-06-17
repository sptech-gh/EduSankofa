const express = require('express');
const router = express.Router();
const demoController = require('../controllers/demoController');
const { schoolLimiter } = require('../middleware/rateLimiter');
const { superAdminAuth, auditLog } = require('../middleware/superAdminAuth');

// Apply authentication to all routes
router.use(superAdminAuth);

// Create Demo School
router.post('/',
  schoolLimiter,
  auditLog('CREATE_SCHOOL', 'school'),
  demoController.createDemoSchool
);

// Get Demo Schools
router.get('/',
  auditLog('VIEW_DASHBOARD', 'school'),
  demoController.getDemoSchools
);

// Get Demo School Details
router.get('/:id',
  auditLog('VIEW_DASHBOARD', 'school'),
  demoController.getDemoSchool
);

// Delete Demo School
router.delete('/:id',
  schoolLimiter,
  auditLog('DELETE_SCHOOL', 'school'),
  demoController.deleteDemoSchool
);

// Get Demo Statistics
router.get('/stats',
  auditLog('VIEW_DASHBOARD', 'school'),
  demoController.getDemoStatistics
);

module.exports = router;
