const express = require('express');
const router = express.Router();
const schoolController = require('../controllers/schoolController');
const { schoolLimiter } = require('../middleware/rateLimiter');
const { superAdminAuth, auditLog, sensitiveOperationLimit } = require('../middleware/superAdminAuth');
const { validate } = require('../utils/validation');
const { 
  createSchoolSchema,
  updateSchoolStatusSchema,
  paginationSchema
} = require('../utils/validation');

// Apply authentication to all routes
router.use(superAdminAuth);

// Create School
router.post('/',
  schoolLimiter,
  sensitiveOperationLimit,
  validate(createSchoolSchema),
  auditLog('CREATE_SCHOOL', 'school'),
  schoolController.createSchool
);

// List Schools
router.get('/',
  validate(paginationSchema, 'query'),
  auditLog('VIEW_DASHBOARD', 'school'),
  schoolController.listSchools
);

// Get School Statistics
router.get('/stats',
  auditLog('VIEW_DASHBOARD', 'school'),
  schoolController.getSchoolStats
);

// Get School Details
router.get('/:id',
  auditLog('VIEW_DASHBOARD', 'school'),
  schoolController.getSchool
);

// Update School Status
router.patch('/:id/status',
  schoolLimiter,
  sensitiveOperationLimit,
  validate(updateSchoolStatusSchema),
  auditLog('UPDATE_SCHOOL', 'school'),
  schoolController.updateSchoolStatus
);

// Soft Delete School
router.delete('/:id',
  schoolLimiter,
  sensitiveOperationLimit,
  auditLog('DELETE_SCHOOL', 'school'),
  schoolController.deleteSchool
);

module.exports = router;
