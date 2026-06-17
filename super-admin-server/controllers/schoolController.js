const School = require('../models/School');
const CentralLicense = require('../models/CentralLicense');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { buildPaginationResponse, paginate } = require('../utils/helpers');
const { logger } = require('../utils/database');
const provisioningService = require('../services/provisioningService');

// Create School with Automated Provisioning
const createSchool = async (req, res) => {
  try {
    const { name, subdomain, deploymentType, planId } = req.body;
    
    // Check if subdomain already exists
    const existingSchool = await School.findBySubdomain(subdomain);
    if (existingSchool) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SUBDOMAIN_EXISTS',
          message: 'Subdomain is already taken'
        }
      });
    }

    // Get subscription plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Subscription plan not found or inactive'
        }
      });
    }

    // Initialize provisioning service
    await provisioningService.initializeConnection();

    // Create new school record first
    const timestamp = Date.now().toString(36);
    const cleanSubdomain = subdomain.replace(/[^a-z0-9]/g, '_').substring(0, 20);
    const databaseName = `sch_${cleanSubdomain}_${timestamp}`;
    const school = new School({
      name,
      subdomain,
      deploymentType,
      status: 'pending', // Will be updated to 'active' after provisioning
      databaseName
    });

    await school.save();

    try {
      // Provision school with database and license
      const provisioningResult = await provisioningService.provisionSchool(
        { id: school._id, name, subdomain, deploymentType },
        plan,
        req.superAdminId
      );

      // Log school creation
      await SuperAdminAuditLog.create({
        adminId: req.superAdminId,
        action: 'CREATE_SCHOOL',
        entityType: 'school',
        entityId: school._id,
        entityName: school.name,
        details: {
          name,
          subdomain,
          deploymentType,
          planId,
          planName: plan.name,
          databaseName: provisioningResult.databaseName,
          autoProvisioned: true
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'Unknown',
        severity: 'high',
        success: true
      });

      logger.info(`School created and provisioned: ${school.name} (${provisioningResult.databaseName})`);

      res.status(201).json({
        success: true,
        message: 'School created and provisioned successfully',
        data: {
          school: provisioningResult.school,
          databaseName: provisioningResult.databaseName,
          adminCredentials: provisioningResult.adminCredentials,
          license: provisioningResult.license,
          licenseKey: provisioningResult.licenseKey, // Include key for initial setup
          provisioningDetails: {
            databaseInitialized: true,
            adminUserCreated: true,
            licenseGenerated: true,
            planApplied: plan.name
          }
        }
      });

    } catch (provisioningError) {
      // Rollback school creation if provisioning fails
      await School.findByIdAndDelete(school._id);
      throw provisioningError;
    }

  } catch (error) {
    logger.error('Create school error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_SCHOOL_ERROR',
        message: 'Failed to create and provision school'
      }
    });
  } finally {
    await provisioningService.closeConnection();
  }
};

// List Schools
const listSchools = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', status, deploymentType } = req.query;
    
    // Build query
    const query = { isDeleted: false };
    
    if (status) {
      query.status = status;
    }
    
    if (deploymentType) {
      query.deploymentType = deploymentType;
    }

    // Pagination
    const { skip, limit: limitNum } = paginate(page, limit);
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [schools, total] = await Promise.all([
      School.find(query)
        .populate('licenseId', 'planType expiryDate status maxUsers')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      School.countDocuments(query)
    ]);

    const response = buildPaginationResponse(schools, page, limitNum, total);

    // Log dashboard view
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'VIEW_DASHBOARD',
      entityType: 'school',
      entityId: null,
      entityName: 'School List',
      details: { page, limit, filters: { status, deploymentType } },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'low',
      success: true
    });

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('List schools error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_SCHOOLS_ERROR',
        message: 'Failed to list schools'
      }
    });
  }
};

// Get School Details
const getSchool = async (req, res) => {
  try {
    const { id } = req.params;
    
    const school = await School.findById(id)
      .populate('licenseId', 'planType expiryDate status maxUsers features')
      .populate('metadata');

    if (!school || school.isDeleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHOOL_NOT_FOUND',
          message: 'School not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        school: school.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Get school error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_SCHOOL_ERROR',
        message: 'Failed to get school details'
      }
    });
  }
};

// Update School Status
const updateSchoolStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const school = await School.findById(id);
    if (!school || school.isDeleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHOOL_NOT_FOUND',
          message: 'School not found'
        }
      });
    }

    const previousStatus = school.status;
    school.status = status;
    await school.save();

    // Update associated license status if suspending/activating
    if (school.licenseId) {
      const license = await CentralLicense.findById(school.licenseId);
      if (license) {
        if (status === 'suspended') {
          await license.suspend('School suspended', req.superAdminId);
        } else if (status === 'active') {
          await license.reactivate(req.superAdminId);
        }
      }
    }

    // Log status update
    const action = status === 'suspended' ? 'SUSPEND_SCHOOL' : 'ACTIVATE_SCHOOL';
    
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action,
      entityType: 'school',
      entityId: school._id,
      entityName: school.name,
      details: {
        previousStatus,
        newStatus: status
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: status === 'suspended' ? 'high' : 'medium',
      success: true
    });

    logger.info(`School status updated: ${school.name} (${previousStatus} -> ${status})`);

    res.json({
      success: true,
      message: `School ${status} successfully`,
      data: {
        school: school.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Update school status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_STATUS_ERROR',
        message: 'Failed to update school status'
      }
    });
  }
};

// Soft Delete School
const deleteSchool = async (req, res) => {
  try {
    const { id } = req.params;
    
    const school = await School.findById(id);
    if (!school || school.isDeleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHOOL_NOT_FOUND',
          message: 'School not found'
        }
      });
    }

    // Soft delete
    await School.softDelete(id);

    // Suspend associated license
    if (school.licenseId) {
      const license = await CentralLicense.findById(school.licenseId);
      if (license) {
        await license.suspend('School deleted', req.superAdminId);
      }
    }

    // Log deletion
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'DELETE_SCHOOL',
      entityType: 'school',
      entityId: school._id,
      entityName: school.name,
      details: {
        deletionType: 'soft',
        previousStatus: school.status
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'critical',
      success: true
    });

    logger.info(`School deleted: ${school.name}`);

    res.json({
      success: true,
      message: 'School deleted successfully'
    });

  } catch (error) {
    logger.error('Delete school error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_SCHOOL_ERROR',
        message: 'Failed to delete school'
      }
    });
  }
};

// Get School Statistics
const getSchoolStats = async (req, res) => {
  try {
    const stats = await School.aggregate([
      {
        $match: { isDeleted: false }
      },
      {
        $group: {
          _id: null,
          totalSchools: { $sum: 1 },
          activeSchools: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          suspendedSchools: {
            $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] }
          },
          pendingSchools: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          cloudSchools: {
            $sum: { $cond: [{ $eq: ['$deploymentType', 'cloud'] }, 1, 0] }
          },
          selfHostedSchools: {
            $sum: { $cond: [{ $eq: ['$deploymentType', 'self-hosted'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalSchools: 0,
      activeSchools: 0,
      suspendedSchools: 0,
      pendingSchools: 0,
      cloudSchools: 0,
      selfHostedSchools: 0
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Get school stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_STATS_ERROR',
        message: 'Failed to get school statistics'
      }
    });
  }
};

module.exports = {
  createSchool,
  listSchools,
  getSchool,
  updateSchoolStatus,
  deleteSchool,
  getSchoolStats
};
