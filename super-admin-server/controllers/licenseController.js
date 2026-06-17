const School = require('../models/School');
const CentralLicense = require('../models/CentralLicense');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { 
  generateLicenseKey, 
  hashLicenseKey, 
  compareLicenseKey,
  calculateExpiryDate,
  buildPaginationResponse,
  paginate
} = require('../utils/helpers');
const { logger } = require('../utils/database');

// Create License
const createLicense = async (req, res) => {
  try {
    const { schoolId, planType, maxUsers, expiryYears = 1 } = req.body;
    
    // Check if school exists
    const school = await School.findById(schoolId);
    if (!school || school.isDeleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHOOL_NOT_FOUND',
          message: 'School not found'
        }
      });
    }

    // Check if school already has an active license
    const existingLicense = await CentralLicense.findBySchool(schoolId);
    if (existingLicense && existingLicense.status === 'active') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'LICENSE_EXISTS',
          message: 'School already has an active license'
        }
      });
    }

    // Generate license key
    const licenseKey = generateLicenseKey();
    const licenseKeyHash = hashLicenseKey(licenseKey);
    const expiryDate = calculateExpiryDate(expiryYears);

    // Set features based on plan type
    const features = getPlanFeatures(planType);

    // Create new license
    const license = new CentralLicense({
      schoolId,
      licenseKey,
      licenseKeyHash,
      expiryDate,
      status: 'active',
      maxUsers,
      planType,
      features,
      activatedAt: new Date(),
      activationIP: req.ip
    });

    await license.save();

    // Update school with license reference
    school.licenseId = license._id;
    school.status = 'active';
    await school.save();

    // Log license creation
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'CREATE_LICENSE',
      entityType: 'license',
      entityId: license._id,
      entityName: `License for ${school.name}`,
      details: {
        schoolId,
        planType,
        maxUsers,
        expiryYears,
        expiryDate
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'high',
      success: true
    });

    logger.info(`License created for school: ${school.name} (${planType})`);

    // Return license with key (only this time)
    const licenseResponse = license.toSafeObject();
    licenseResponse.licenseKey = licenseKey; // Include key only in creation response

    res.status(201).json({
      success: true,
      message: 'License created successfully',
      data: {
        license: licenseResponse
      }
    });

  } catch (error) {
    logger.error('Create license error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_LICENSE_ERROR',
        message: 'Failed to create license'
      }
    });
  }
};

// Get License
const getLicense = async (req, res) => {
  try {
    const { id } = req.params;
    
    const license = await CentralLicense.findById(id)
      .populate('schoolId', 'name subdomain deploymentType');

    if (!license) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LICENSE_NOT_FOUND',
          message: 'License not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        license: license.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Get license error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_LICENSE_ERROR',
        message: 'Failed to get license'
      }
    });
  }
};

// List Licenses
const listLicenses = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', status, planType } = req.query;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (planType) {
      query.planType = planType;
    }

    // Pagination
    const { skip, limit: limitNum } = paginate(page, limit);
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [licenses, total] = await Promise.all([
      CentralLicense.find(query)
        .populate('schoolId', 'name subdomain deploymentType')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      CentralLicense.countDocuments(query)
    ]);

    const response = buildPaginationResponse(licenses, page, limitNum, total);

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('List licenses error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_LICENSES_ERROR',
        message: 'Failed to list licenses'
      }
    });
  }
};

// Renew License
const renewLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const { extendYears } = req.body;
    
    const license = await CentralLicense.findById(id)
      .populate('schoolId', 'name subdomain');

    if (!license) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LICENSE_NOT_FOUND',
          message: 'License not found'
        }
      });
    }

    const previousExpiry = license.expiryDate;
    await license.renew(extendYears, req.superAdminId);

    // Log license renewal
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'RENEW_LICENSE',
      entityType: 'license',
      entityId: license._id,
      entityName: `License for ${license.schoolId.name}`,
      details: {
        previousExpiry,
        newExpiry: license.expiryDate,
        extendYears
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'high',
      success: true
    });

    logger.info(`License renewed for school: ${license.schoolId.name}`);

    res.json({
      success: true,
      message: 'License renewed successfully',
      data: {
        license: license.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Renew license error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RENEW_LICENSE_ERROR',
        message: 'Failed to renew license'
      }
    });
  }
};

// Suspend License
const suspendLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const license = await CentralLicense.findById(id)
      .populate('schoolId', 'name subdomain');

    if (!license) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LICENSE_NOT_FOUND',
          message: 'License not found'
        }
      });
    }

    await license.suspend(reason || 'Suspended by admin', req.superAdminId);

    // Update school status
    if (license.schoolId) {
      const school = await School.findById(license.schoolId._id);
      if (school) {
        school.status = 'suspended';
        await school.save();
      }
    }

    // Log license suspension
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'SUSPEND_LICENSE',
      entityType: 'license',
      entityId: license._id,
      entityName: `License for ${license.schoolId.name}`,
      details: { reason },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'high',
      success: true
    });

    logger.info(`License suspended for school: ${license.schoolId.name}`);

    res.json({
      success: true,
      message: 'License suspended successfully',
      data: {
        license: license.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Suspend license error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SUSPEND_LICENSE_ERROR',
        message: 'Failed to suspend license'
      }
    });
  }
};

// Get License Statistics
const getLicenseStats = async (req, res) => {
  try {
    const stats = await CentralLicense.aggregate([
      {
        $group: {
          _id: null,
          totalLicenses: { $sum: 1 },
          activeLicenses: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          suspendedLicenses: {
            $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] }
          },
          expiredLicenses: {
            $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
          },
          basicLicenses: {
            $sum: { $cond: [{ $eq: ['$planType', 'basic'] }, 1, 0] }
          },
          premiumLicenses: {
            $sum: { $cond: [{ $eq: ['$planType', 'premium'] }, 1, 0] }
          },
          enterpriseLicenses: {
            $sum: { $cond: [{ $eq: ['$planType', 'enterprise'] }, 1, 0] }
          },
          totalMaxUsers: { $sum: '$maxUsers' },
          avgMaxUsers: { $avg: '$maxUsers' }
        }
      }
    ]);

    const result = stats[0] || {
      totalLicenses: 0,
      activeLicenses: 0,
      suspendedLicenses: 0,
      expiredLicenses: 0,
      basicLicenses: 0,
      premiumLicenses: 0,
      enterpriseLicenses: 0,
      totalMaxUsers: 0,
      avgMaxUsers: 0
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Get license stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_LICENSE_STATS_ERROR',
        message: 'Failed to get license statistics'
      }
    });
  }
};

// Get Expiring Licenses
const getExpiringLicenses = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const licenses = await CentralLicense.findExpiringSoon(parseInt(days))
      .populate('schoolId', 'name subdomain');

    res.json({
      success: true,
      data: {
        licenses: licenses.map(license => license.toSafeObject()),
        count: licenses.length
      }
    });

  } catch (error) {
    logger.error('Get expiring licenses error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_EXPIRING_LICENSES_ERROR',
        message: 'Failed to get expiring licenses'
      }
    });
  }
};

// Helper function to get features based on plan type
const getPlanFeatures = (planType) => {
  const baseFeatures = {
    students: true,
    attendance: true,
    fees: true,
    reports: true,
    dashboard: true
  };

  switch (planType) {
    case 'basic':
      return baseFeatures;
    
    case 'premium':
      return {
        ...baseFeatures,
        analytics: true,
        support: true
      };
    
    case 'enterprise':
      return {
        ...baseFeatures,
        analytics: true,
        api: true,
        support: true
      };
    
    default:
      return baseFeatures;
  }
};

module.exports = {
  createLicense,
  getLicense,
  listLicenses,
  renewLicense,
  suspendLicense,
  getLicenseStats,
  getExpiringLicenses
};
