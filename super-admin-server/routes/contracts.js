const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { licenseLimiter } = require('../middleware/rateLimiter');
const { superAdminAuth, auditLog } = require('../middleware/superAdminAuth');

// Apply authentication to all routes
router.use(superAdminAuth);

// Generate Contract PDF
router.get('/generate/:schoolId',
  licenseLimiter,
  auditLog('EXPORT_DATA', 'system'),
  contractController.generateContract
);

// Get Contract Preview
router.get('/preview/:schoolId',
  auditLog('VIEW_DASHBOARD', 'system'),
  contractController.getContractPreview
);

// Get Contract History
router.get('/history/:schoolId',
  auditLog('VIEW_DASHBOARD', 'system'),
  contractController.getContractHistory
);

// Delete Contract
router.delete('/:contractNumber',
  licenseLimiter,
  auditLog('EXPORT_DATA', 'system'),
  contractController.deleteContract
);

module.exports = router;
