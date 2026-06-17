const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { authLimiter } = require('../middleware/rateLimiter');
const { superAdminAuth, auditLog } = require('../middleware/superAdminAuth');
const { validate } = require('../utils/validation');
const { 
  superAdminLoginSchema, 
  superAdminRegisterSchema 
} = require('../utils/validation');

// Public routes
router.post('/login', 
  authLimiter,
  validate(superAdminLoginSchema),
  auditLog('LOGIN', 'superadmin'),
  superAdminController.login
);

router.post('/register',
  authLimiter,
  validate(superAdminRegisterSchema),
  auditLog('CREATE_SCHOOL', 'superadmin'),
  superAdminController.register
);

// Protected routes
router.use(superAdminAuth);

router.get('/profile',
  auditLog('VIEW_DASHBOARD', 'superadmin'),
  superAdminController.getProfile
);

router.put('/profile',
  auditLog('UPDATE_SCHOOL', 'superadmin'),
  superAdminController.updateProfile
);

router.post('/logout',
  auditLog('LOGOUT', 'superadmin'),
  superAdminController.logout
);

module.exports = router;
