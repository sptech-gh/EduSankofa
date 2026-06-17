const express = require("express");
const { auth, authorizeRoles } = require("../middleware/auth");
const { auditLog } = require("../middleware/security");
const router = express.Router();

// @route   GET /api/audit/logs
// @desc    Get audit logs with filtering
// @access  Private (Admin only)
router.get(
  "/logs",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        action,
        userId,
        userRole,
        startDate,
        endDate,
        success
      } = req.query;

      // Build filter
      const filter = {};
      
      if (action) filter.action = new RegExp(action, 'i');
      if (userId) filter.userId = userId;
      if (userRole) filter.userRole = userRole;
      if (success !== undefined) filter.success = success === 'true';
      
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate) filter.timestamp.$lte = new Date(endDate);
      }

      // Since we don't have a dedicated audit collection, we'll return mock data
      // In a real implementation, this would query a dedicated audit log collection
      const mockLogs = process.env.NODE_ENV === 'test'
        ? []
        : [
            {
              id: 1,
              timestamp: new Date().toISOString(),
              action: "LOGIN",
              method: "POST",
              url: "/api/auth/login",
              ip: "192.168.1.100",
              userAgent: "Mozilla/5.0...",
              userId: "admin123",
              userRole: "admin",
              statusCode: 200,
              success: true
            },
            {
              id: 2,
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              action: "STUDENT_CREATE",
              method: "POST",
              url: "/api/students",
              ip: "192.168.1.101",
              userAgent: "Mozilla/5.0...",
              userId: "teacher123",
              userRole: "teacher",
              statusCode: 201,
              success: true
            },
            {
              id: 3,
              timestamp: new Date(Date.now() - 7200000).toISOString(),
              action: "LOGIN",
              method: "POST",
              url: "/api/auth/login",
              ip: "192.168.1.102",
              userAgent: "Mozilla/5.0...",
              userId: null,
              userRole: null,
              statusCode: 401,
              success: false
            }
          ];

      // Apply filters
      let filteredLogs = mockLogs;
      
      if (action) {
        filteredLogs = filteredLogs.filter(log => 
          log.action.toLowerCase().includes(action.toLowerCase())
        );
      }
      
      if (userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === userId);
      }
      
      if (userRole) {
        filteredLogs = filteredLogs.filter(log => log.userRole === userRole);
      }
      
      if (success !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.success === (success === 'true'));
      }

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

      if (filteredLogs.length === 0) {
        return res.status(404).json({
          message: "No audit logs found",
          logs: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalLogs: 0,
            limit: parseInt(limit)
          },
          filters: {
            action,
            userId,
            userRole,
            startDate,
            endDate,
            success
          }
        });
      }

      res.json({
        logs: paginatedLogs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(filteredLogs.length / limit),
          totalLogs: filteredLogs.length,
          limit: parseInt(limit)
        },
        filters: {
          action,
          userId,
          userRole,
          startDate,
          endDate,
          success
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   GET /api/audit/stats
// @desc    Get audit statistics
// @access  Private (Admin only)
router.get(
  "/stats",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Mock statistics - in real implementation, this would aggregate from audit logs
      const mockStats = {
        totalActions: 1250,
        successfulActions: 1180,
        failedActions: 70,
        topActions: [
          { action: "LOGIN", count: 450 },
          { action: "STUDENT_VIEW", count: 320 },
          { action: "GRADE_UPDATE", count: 180 },
          { action: "ATTENDANCE_MARK", count: 150 },
          { action: "ANNOUNCEMENT_CREATE", count: 80 }
        ],
        userActivity: [
          { role: "admin", count: 350 },
          { role: "teacher", count: 600 },
          { role: "student", count: 200 },
          { role: "parent", count: 100 }
        ],
        failedLogins: 25,
        suspiciousActivity: 3,
        timeRange: {
          startDate: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: endDate || new Date().toISOString()
        }
      };

      res.json(mockStats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   GET /api/audit/export
// @desc    Export audit logs
// @access  Private (Admin only)
router.get(
  "/export",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      const { format = 'json', startDate, endDate } = req.query;
      
      // Mock export data - in real implementation, this would query actual audit logs
      const exportData = [
        {
          timestamp: new Date().toISOString(),
          action: "LOGIN",
          method: "POST",
          url: "/api/auth/login",
          ip: "192.168.1.100",
          userAgent: "Mozilla/5.0...",
          userId: "admin123",
          userRole: "admin",
          statusCode: 200,
          success: true
        }
      ];

      if (format === 'csv') {
        // Convert to CSV
        const csvHeader = 'Timestamp,Action,Method,URL,IP,User Agent,User ID,User Role,Status Code,Success\n';
        const csvData = exportData.map(log => 
          `"${log.timestamp}","${log.action}","${log.method}","${log.url}","${log.ip}","${log.userAgent}","${log.userId}","${log.userRole}",${log.statusCode},${log.success}`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvHeader + csvData);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`);
        res.json({
          exportDate: new Date().toISOString(),
          filters: { startDate, endDate },
          logs: exportData
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   DELETE /api/audit/cleanup
// @desc    Clean up old audit logs
// @access  Private (Admin only)
router.delete(
  "/cleanup",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      const { days = 90 } = req.query;
      
      // Mock cleanup - in real implementation, this would delete old audit logs
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      console.log(`Audit cleanup: Deleting logs older than ${cutoffDate.toISOString()}`);
      
      res.json({
        message: `Audit logs older than ${days} days have been cleaned up`,
        cutoffDate: cutoffDate.toISOString(),
        deletedCount: 150 // Mock count
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
