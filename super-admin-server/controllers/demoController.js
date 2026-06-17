const School = require('../models/School');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const CentralLicense = require('../models/CentralLicense');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const provisioningService = require('../services/provisioningService');
const { logger } = require('../utils/database');

// Create Demo School
const createDemoSchool = async (req, res) => {
  try {
    const { name, subdomain } = req.body;
    
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

    // Get demo plan
    const demoPlan = await SubscriptionPlan.findOne({ isDemo: true, isActive: true });
    if (!demoPlan) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DEMO_PLAN_NOT_FOUND',
          message: 'Demo plan not found or inactive'
        }
      });
    }

    // Initialize provisioning service
    await provisioningService.initializeConnection();

    // Create demo school record
    const timestamp = Date.now().toString(36);
    const cleanSubdomain = subdomain.replace(/[^a-z0-9]/g, '_').substring(0, 20);
    const databaseName = `sch_${cleanSubdomain}_${timestamp}`;
    const school = new School({
      name: `${name} (Demo)`,
      subdomain,
      deploymentType: 'cloud',
      status: 'pending',
      isDemo: true,
      databaseName
    });

    await school.save();

    try {
      // Provision demo school with database and license
      const provisioningResult = await provisioningService.provisionSchool(
        { id: school._id, name, subdomain, deploymentType: 'cloud', isDemo: true },
        demoPlan, // Pass the full plan object with _id
        req.superAdminId
      );

      // Log demo school creation
      await SuperAdminAuditLog.create({
        adminId: req.superAdminId,
        action: 'CREATE_SCHOOL',
        entityType: 'school',
        entityId: school._id,
        entityName: school.name,
        details: {
          name: school.name,
          subdomain,
          deploymentType: 'cloud',
          planId: demoPlan._id,
          planName: demoPlan.name,
          databaseName: provisioningResult.databaseName,
          isDemo: true,
          autoProvisioned: true,
          demoDataSeeded: true
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || 'Unknown',
        severity: 'medium',
        success: true
      });

      logger.info(`Demo school created: ${school.name} (${provisioningResult.databaseName})`);

      res.status(201).json({
        success: true,
        message: 'Demo school created successfully',
        data: {
          school: provisioningResult.school,
          databaseName: provisioningResult.databaseName,
          adminCredentials: provisioningResult.adminCredentials,
          license: provisioningResult.license,
          licenseKey: provisioningResult.licenseKey,
          demoDetails: {
            isDemo: true,
            expiresInDays: 30,
            maxStudents: demoPlan.maxStudents,
            maxStaff: demoPlan.maxStaff,
            features: demoPlan.features,
            autoExpiry: true
          },
          provisioningDetails: {
            databaseInitialized: true,
            adminUserCreated: true,
            licenseGenerated: true,
            planApplied: demoPlan.name,
            demoDataSeeded: true
          }
        }
      });

    } catch (provisioningError) {
      // Rollback school creation if provisioning fails
      await School.findByIdAndDelete(school._id);
      throw provisioningError;
    }

  } catch (error) {
    logger.error('Create demo school error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_DEMO_SCHOOL_ERROR',
        message: 'Failed to create demo school'
      }
    });
  } finally {
    await provisioningService.closeConnection();
  }
};

// Get Demo Schools
const getDemoSchools = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build query for demo schools
    const query = { isDeleted: false, isDemo: true };

    // Pagination
    const skip = (page - 1) * limit;
    const limitNum = parseInt(limit);
    
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

    const response = {
      schools: schools.map(school => school.toSafeObject()),
      pagination: {
        current: parseInt(page),
        pageSize: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('Get demo schools error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_DEMO_SCHOOLS_ERROR',
        message: 'Failed to get demo schools'
      }
    });
  }
};

// Get Demo School Details
const getDemoSchool = async (req, res) => {
  try {
    const { id } = req.params;
    
    const school = await School.findOne({ _id: id, isDemo: true, isDeleted: false })
      .populate('licenseId', 'planType expiryDate status maxUsers');

    if (!school) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEMO_SCHOOL_NOT_FOUND',
          message: 'Demo school not found'
        }
      });
    }

    // Calculate days until expiry
    const now = new Date();
    const expiryDate = school.licenseId?.expiryDate;
    let daysUntilExpiry = 0;
    let expiryStatus = 'expired';

    if (expiryDate) {
      const diffTime = expiryDate - now;
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffTime > 0) {
        expiryStatus = daysUntilExpiry <= 7 ? 'expiring_soon' : 'active';
      }
    }

    res.json({
      success: true,
      data: {
        school: school.toSafeObject(),
        demoInfo: {
          isDemo: true,
          daysUntilExpiry,
          expiryStatus,
          expiresOn: expiryDate,
          autoDeleteOnExpiry: true,
          canExtend: false, // Demo schools cannot be extended
          maxStudents: school.licenseId?.maxUsers || 0,
          currentUsage: school.licenseId?.currentUsers || 0
        }
      }
    });

  } catch (error) {
    logger.error('Get demo school error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_DEMO_SCHOOL_ERROR',
        message: 'Failed to get demo school details'
      }
    });
  }
};

// Delete Demo School
const deleteDemoSchool = async (req, res) => {
  try {
    const { id } = req.params;
    
    const school = await School.findOne({ _id: id, isDemo: true });
    if (!school) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEMO_SCHOOL_NOT_FOUND',
          message: 'Demo school not found'
        }
      });
    }

    // Soft delete demo school
    await School.findByIdAndUpdate(id, { 
      isDeleted: true,
      status: 'deleted',
      deletedAt: new Date()
    });

    // Suspend associated license
    if (school.licenseId) {
      const CentralLicense = require('../models/CentralLicense');
      await CentralLicense.findByIdAndUpdate(school.licenseId, { 
        status: 'expired',
        expiredAt: new Date()
      });
    }

    // Log demo school deletion
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'DELETE_SCHOOL',
      entityType: 'school',
      entityId: school._id,
      entityName: school.name,
      details: {
        deletionType: 'soft',
        isDemo: true,
        reason: 'Admin deletion or auto-expiry'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'medium',
      success: true
    });

    logger.info(`Demo school deleted: ${school.name}`);

    res.json({
      success: true,
      message: 'Demo school deleted successfully'
    });

  } catch (error) {
    logger.error('Delete demo school error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_DEMO_SCHOOL_ERROR',
        message: 'Failed to delete demo school'
      }
    });
  }
};

// Get Demo Statistics
const getDemoStatistics = async (req, res) => {
  try {
    const stats = await School.aggregate([
      {
        $match: { isDeleted: false, isDemo: true }
      },
      {
        $group: {
          _id: null,
          totalDemoSchools: { $sum: 1 },
          activeDemoSchools: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          expiredDemoSchools: {
            $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
          },
          totalDemoStudents: { $sum: '$metadata.totalStudents' },
          totalDemoTeachers: { $sum: '$metadata.totalTeachers' }
        }
      }
    ]);

    const result = stats[0] || {
      totalDemoSchools: 0,
      activeDemoSchools: 0,
      expiredDemoSchools: 0,
      totalDemoStudents: 0,
      totalDemoTeachers: 0
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Get demo statistics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_DEMO_STATS_ERROR',
        message: 'Failed to get demo statistics'
      }
    });
  }
};

// Auto-expire Demo Schools (Scheduled task)
const autoExpireDemoSchools = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Find demo schools older than 30 days
    const expiredDemoSchools = await School.find({
      isDemo: true,
      isDeleted: false,
      createdAt: { $lt: thirtyDaysAgo }
    }).populate('licenseId');

    for (const school of expiredDemoSchools) {
      // Mark school as expired
      await School.findByIdAndUpdate(school._id, {
        status: 'expired',
        expiredAt: new Date()
      });

      // Mark license as expired
      if (school.licenseId) {
        const CentralLicense = require('../models/CentralLicense');
        await CentralLicense.findByIdAndUpdate(school.licenseId._id, {
          status: 'expired',
          expiredAt: new Date()
        });
      }

      // Log auto-expiry
      await SuperAdminAuditLog.create({
        adminId: null,
        action: 'DELETE_SCHOOL',
        entityType: 'school',
        entityId: school._id,
        entityName: school.name,
        details: {
          deletionType: 'auto_expiry',
          isDemo: true,
          reason: '30-day demo period expired',
          createdAt: school.createdAt
        },
        ipAddress: '127.0.0.1',
        userAgent: 'System Scheduler',
        severity: 'medium',
        success: true
      });
    }

    logger.info(`Auto-expired ${expiredDemoSchools.length} demo schools`);

    return {
      success: true,
      expiredCount: expiredDemoSchools.length
    };

  } catch (error) {
    logger.error('Auto-expire demo schools error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  createDemoSchool,
  getDemoSchools,
  getDemoSchool,
  deleteDemoSchool,
  getDemoStatistics,
  autoExpireDemoSchools
};
