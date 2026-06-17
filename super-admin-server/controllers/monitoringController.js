const School = require('../models/School');
const SchoolHeartbeat = require('../models/SchoolHeartbeat');
const CentralLicense = require('../models/CentralLicense');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { isWithinDays } = require('../utils/helpers');
const { logger } = require('../utils/database');

// Receive Heartbeat
const receiveHeartbeat = async (req, res) => {
  try {
    const { schoolId, activeUsers, databaseSize, version } = req.body;
    
    // Validate school exists and is cloud deployment
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

    // Only allow heartbeat from cloud deployments
    if (school.deploymentType !== 'cloud') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DEPLOYMENT_TYPE_MISMATCH',
          message: 'Heartbeat only allowed for cloud deployments'
        }
      });
    }

    // Validate school license
    const license = await CentralLicense.findBySchool(schoolId);
    if (!license || license.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'LICENSE_INVALID',
          message: 'School license is not active'
        }
      });
    }

    // Create or update heartbeat
    const heartbeat = await SchoolHeartbeat.findBySchool(schoolId);
    
    if (heartbeat) {
      // Update existing heartbeat
      heartbeat.lastPing = new Date();
      heartbeat.activeUsers = activeUsers;
      heartbeat.databaseSize = databaseSize;
      heartbeat.version = version;
      heartbeat.status = 'online';
      heartbeat.uptime = req.body.uptime || 0;
      
      if (req.body.metrics) {
        heartbeat.metrics = { ...heartbeat.metrics, ...req.body.metrics };
      }
      
      await heartbeat.save();
    } else {
      // Create new heartbeat
      const newHeartbeat = new SchoolHeartbeat({
        schoolId,
        activeUsers,
        databaseSize,
        version,
        status: 'online',
        uptime: req.body.uptime || 0,
        metrics: req.body.metrics || {}
      });
      
      await newHeartbeat.save();
    }

    // Update school metadata
    school.metadata.totalStudents = activeUsers;
    school.metadata.lastActiveAt = new Date();
    await school.save();

    // Check for any issues and return warnings
    const warnings = [];
    
    if (license.isExpired) {
      warnings.push({
        type: 'LICENSE_EXPIRED',
        message: 'License has expired'
      });
    } else if (license.isInGracePeriod) {
      warnings.push({
        type: 'LICENSE_GRACE_PERIOD',
        message: 'License is in grace period'
      });
    } else if (license.daysUntilExpiry <= 30) {
      warnings.push({
        type: 'LICENSE_EXPIRING_SOON',
        message: `License expires in ${license.daysUntilExpiry} days`
      });
    }

    if (activeUsers >= license.maxUsers) {
      warnings.push({
        type: 'USER_LIMIT_EXCEEDED',
        message: 'User limit exceeded'
      });
    }

    res.json({
      success: true,
      message: 'Heartbeat received',
      data: {
        status: 'online',
        warnings,
        nextPing: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      }
    });

  } catch (error) {
    logger.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEARTBEAT_ERROR',
        message: 'Failed to process heartbeat'
      }
    });
  }
};

// Get Dashboard Overview
const getDashboardOverview = async (req, res) => {
  try {
    // Get school statistics
    const schoolStats = await School.aggregate([
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
          cloudSchools: {
            $sum: { $cond: [{ $eq: ['$deploymentType', 'cloud'] }, 1, 0] }
          },
          selfHostedSchools: {
            $sum: { $cond: [{ $eq: ['$deploymentType', 'self-hosted'] }, 1, 0] }
          },
          totalStudents: { $sum: '$metadata.totalStudents' },
          totalTeachers: { $sum: '$metadata.totalTeachers' }
        }
      }
    ]);

    // Get license statistics
    const licenseStats = await CentralLicense.aggregate([
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
          expiringIn30Days: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lte: ['$expiryDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] },
                    { $gt: ['$expiryDate', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalMaxUsers: { $sum: '$maxUsers' },
          currentTotalUsers: { $sum: '$currentUsers' }
        }
      }
    ]);

    // Get online/offline schools (only cloud deployments)
    const timeoutMinutes = parseInt(process.env.HEARTBEAT_TIMEOUT_MINUTES) || 10;
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    
    const heartbeatStats = await SchoolHeartbeat.aggregate([
      {
        $match: {
          lastPing: { $gte: cutoffTime }
        }
      },
      {
        $lookup: {
          from: 'schools',
          localField: 'schoolId',
          foreignField: '_id',
          as: 'school'
        }
      },
      {
        $unwind: '$school'
      },
      {
        $match: { 'school.deploymentType': 'cloud' }
      },
      {
        $group: {
          _id: null,
          onlineSchools: { $sum: 1 },
          totalActiveUsers: { $sum: '$activeUsers' },
          avgActiveUsers: { $avg: '$activeUsers' }
        }
      }
    ]);

    // Get offline schools
    const offlineSchools = await SchoolHeartbeat.aggregate([
      {
        $match: {
          lastPing: { $lt: cutoffTime }
        }
      },
      {
        $lookup: {
          from: 'schools',
          localField: 'schoolId',
          foreignField: '_id',
          as: 'school'
        }
      },
      {
        $unwind: '$school'
      },
      {
        $match: { 
          'school.deploymentType': 'cloud',
          'school.isDeleted': false
        }
      },
      {
        $group: {
          _id: null,
          offlineSchools: { $sum: 1 }
        }
      }
    ]);

    // Get recent activity
    const recentActivity = await SuperAdminAuditLog.getRecentActivity(24, 10);

    // Get expiring licenses
    const expiringLicenses = await CentralLicense.findExpiringSoon(30)
      .populate('schoolId', 'name subdomain')
      .limit(10);

    // Combine all statistics
    const schoolData = schoolStats[0] || {
      totalSchools: 0,
      activeSchools: 0,
      suspendedSchools: 0,
      cloudSchools: 0,
      selfHostedSchools: 0,
      totalStudents: 0,
      totalTeachers: 0
    };

    const licenseData = licenseStats[0] || {
      totalLicenses: 0,
      activeLicenses: 0,
      suspendedLicenses: 0,
      expiredLicenses: 0,
      expiringIn30Days: 0,
      totalMaxUsers: 0,
      currentTotalUsers: 0
    };

    const heartbeatData = heartbeatStats[0] || {
      onlineSchools: 0,
      totalActiveUsers: 0,
      avgActiveUsers: 0
    };

    const offlineData = offlineSchools[0] || {
      offlineSchools: 0
    };

    const overview = {
      schools: {
        ...schoolData,
        onlineSchools: heartbeatData.onlineSchools,
        offlineSchools: offlineData.offlineSchools
      },
      licenses: {
        ...licenseData,
        utilizationRate: licenseData.totalMaxUsers > 0 
          ? Math.round((licenseData.currentTotalUsers / licenseData.totalMaxUsers) * 100)
          : 0
      },
      system: {
        totalActiveUsers: heartbeatData.totalActiveUsers,
        avgActiveUsers: Math.round(heartbeatData.avgActiveUsers || 0),
        uptime: calculateSystemUptime()
      },
      recentActivity: recentActivity.map(log => ({
        action: log.action,
        entityName: log.entityName,
        timestamp: log.timestamp,
        adminEmail: log.adminId?.email || 'System'
      })),
      expiringLicenses: expiringLicenses.map(license => ({
        id: license._id,
        schoolName: license.schoolId?.name || 'Unknown',
        expiryDate: license.expiryDate,
        daysUntilExpiry: license.daysUntilExpiry,
        planType: license.planType
      }))
    };

    // Log dashboard view
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'VIEW_DASHBOARD',
      entityType: 'system',
      entityId: null,
      entityName: 'Dashboard Overview',
      details: { timestamp: new Date() },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'low',
      success: true
    });

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    logger.error('Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_ERROR',
        message: 'Failed to get dashboard overview'
      }
    });
  }
};

// Get School Heartbeat Details
const getSchoolHeartbeat = async (req, res) => {
  try {
    const { id } = req.params;
    
    const heartbeat = await SchoolHeartbeat.findBySchool(id)
      .populate('schoolId', 'name subdomain deploymentType');

    if (!heartbeat) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'HEARTBEAT_NOT_FOUND',
          message: 'Heartbeat data not found'
        }
      });
    }

    // Get historical metrics
    const metrics = await SchoolHeartbeat.getSchoolMetrics(id, 24);

    res.json({
      success: true,
      data: {
        heartbeat: heartbeat.toSafeObject(),
        metrics: metrics[0] || null
      }
    });

  } catch (error) {
    logger.error('Get school heartbeat error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_HEARTBEAT_ERROR',
        message: 'Failed to get heartbeat data'
      }
    });
  }
};

// Get Online Schools
const getOnlineSchools = async (req, res) => {
  try {
    const onlineSchools = await SchoolHeartbeat.findOnline();

    res.json({
      success: true,
      data: {
        schools: onlineSchools.map(hb => ({
          id: hb.schoolId._id,
          name: hb.schoolId.name,
          subdomain: hb.schoolId.subdomain,
          lastPing: hb.lastPing,
          activeUsers: hb.activeUsers,
          version: hb.version,
          uptime: hb.uptime
        })),
        count: onlineSchools.length
      }
    });

  } catch (error) {
    logger.error('Get online schools error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ONLINE_SCHOOLS_ERROR',
        message: 'Failed to get online schools'
      }
    });
  }
};

// Get Offline Schools
const getOfflineSchools = async (req, res) => {
  try {
    const offlineSchools = await SchoolHeartbeat.findOffline();

    res.json({
      success: true,
      data: {
        schools: offlineSchools.map(hb => ({
          id: hb.schoolId._id,
          name: hb.schoolId.name,
          subdomain: hb.schoolId.subdomain,
          lastPing: hb.lastPing,
          status: hb.status
        })),
        count: offlineSchools.length
      }
    });

  } catch (error) {
    logger.error('Get offline schools error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_OFFLINE_SCHOOLS_ERROR',
        message: 'Failed to get offline schools'
      }
    });
  }
};

// Helper function to calculate system uptime (placeholder)
const calculateSystemUptime = () => {
  // This would typically be calculated from actual system start time
  // For now, return a placeholder value
  return '99.9%';
};

module.exports = {
  receiveHeartbeat,
  getDashboardOverview,
  getSchoolHeartbeat,
  getOnlineSchools,
  getOfflineSchools
};
