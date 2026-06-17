const express = require("express");
const { auth, authorizeRoles } = require("../middleware/auth");
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const router = express.Router();

// @route   POST /api/backup/create
// @desc    Create system backup
// @access  Private (Admin only)
router.post(
  "/create",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      const { includeFiles = true, includeDatabase = true } = req.body;
      
      const backupId = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const backupDir = path.join(process.cwd(), 'backups');
      
      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });
      
      const backupPath = path.join(backupDir, `${backupId}.zip`);
      const output = await fs.open(backupPath, 'w');
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.pipe(output.createWriteStream());
      
      // Add database backup if requested
      if (includeDatabase) {
        // Mock database backup - in real implementation, this would export MongoDB data
        const dbBackup = {
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          collections: {
            users: [],
            students: [],
            teachers: [],
            classes: [],
            subjects: [],
            grades: [],
            attendance: [],
            announcements: [],
            messages: [],
            fees: [],
            payments: [],
            reportcards: [],
            enrollments: []
          }
        };
        
        archive.append(JSON.stringify(dbBackup, null, 2), { name: 'database.json' });
      }
      
      // Add files if requested
      if (includeFiles) {
        // Mock file backup - in real implementation, this would backup uploaded files
        const filesBackup = {
          timestamp: new Date().toISOString(),
          directories: {
            uploads: [],
            documents: [],
            images: [],
            exports: []
          }
        };
        
        archive.append(JSON.stringify(filesBackup, null, 2), { name: 'files.json' });
      }
      
      // Add backup metadata
      const metadata = {
        backupId,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        options: { includeFiles, includeDatabase },
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
      
      await archive.finalize();
      await output.close();
      
      res.json({
        success: true,
        backupId,
        filename: `${backupId}.zip`,
        size: (await fs.stat(backupPath)).size,
        timestamp: new Date().toISOString(),
        downloadUrl: `/api/backup/download/${backupId}`
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to create backup" });
    }
  }
);

// @route   GET /api/backup/download/:backupId
// @desc    Download backup file
// @access  Private (Admin only)
router.get(
  "/download/:backupId",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      const { backupId } = req.params;
      const backupPath = path.join(process.cwd(), 'backups', `${backupId}.zip`);
      
      // Check if backup exists
      try {
        await fs.access(backupPath);
      } catch (err) {
        return res.status(404).json({ message: "Backup not found" });
      }
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${backupId}.zip"`);
      
      // Stream the file
      const fileStream = await fs.open(backupPath, 'r');
      const stream = fileStream.createReadStream();
      stream.pipe(res);
      
      stream.on('end', async () => {
        await fileStream.close();
      });
      
      stream.on('error', async (err) => {
        await fileStream.close();
        console.error(err);
        res.status(500).json({ message: "Error downloading backup" });
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   GET /api/backup/list
// @desc    List available backups
// @access  Private (Admin only)
router.get(
  "/list",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      
      // Ensure backup directory exists
      try {
        await fs.access(backupDir);
      } catch (err) {
        await fs.mkdir(backupDir, { recursive: true });
        return res.json({ backups: [] });
      }
      
      const files = await fs.readdir(backupDir);
      const backups = [];
      
      for (const file of files) {
        if (file.endsWith('.zip')) {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          
          // Extract backup ID from filename
          const backupId = file.replace('.zip', '');
          
          // Read metadata if available
          let metadata = {};
          try {
            // In a real implementation, you might store metadata separately
            // or read it from the zip file
            metadata = {
              backupId,
              timestamp: stats.birthtime.toISOString(),
              size: stats.size
            };
          } catch (err) {
            metadata = {
              backupId,
              timestamp: stats.birthtime.toISOString(),
              size: stats.size
            };
          }
          
          backups.push(metadata);
        }
      }
      
      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      res.json({ backups });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   DELETE /api/backup/:backupId
// @desc    Delete backup
// @access  Private (Admin only)
router.delete(
  "/:backupId",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      const { backupId } = req.params;
      const backupPath = path.join(process.cwd(), 'backups', `${backupId}.zip`);
      
      // Check if backup exists
      try {
        await fs.access(backupPath);
      } catch (err) {
        return res.status(404).json({ message: "Backup not found" });
      }
      
      // Delete the backup
      await fs.unlink(backupPath);
      
      res.json({
        success: true,
        message: `Backup ${backupId} deleted successfully`
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete backup" });
    }
  }
);

// @route   POST /api/backup/restore
// @desc    Restore from backup
// @access  Private (Admin only)
router.post(
  "/restore",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      const { backupId, options = {} } = req.body;
      
      if (!backupId) {
        return res.status(400).json({ message: "Backup ID is required" });
      }
      
      const backupPath = path.join(process.cwd(), 'backups', `${backupId}.zip`);
      
      // Check if backup exists
      try {
        await fs.access(backupPath);
      } catch (err) {
        return res.status(404).json({ message: "Backup not found" });
      }
      
      // Mock restore process - in real implementation, this would:
      // 1. Extract the backup file
      // 2. Read the database backup
      // 3. Restore data to MongoDB
      // 4. Restore files if included
      
      const restoreResult = {
        success: true,
        backupId,
        timestamp: new Date().toISOString(),
        restored: {
          database: options.restoreDatabase !== false,
          files: options.restoreFiles === true
        },
        summary: {
          usersRestored: 0,
          studentsRestored: 0,
          teachersRestored: 0,
          classesRestored: 0,
          gradesRestored: 0,
          attendanceRestored: 0,
          filesRestored: 0
        }
      };
      
      res.json(restoreResult);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to restore backup" });
    }
  }
);

// @route   GET /api/backup/schedule
// @desc    Get backup schedule
// @access  Private (Admin only)
router.get(
  "/schedule",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      // Mock schedule - in real implementation, this would be stored in database
      const schedule = {
        enabled: false,
        frequency: 'daily', // daily, weekly, monthly
        time: '02:00', // Time of day for backup
        retentionDays: 30,
        includeDatabase: true,
        includeFiles: false,
        nextBackup: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        lastBackup: null
      };
      
      res.json(schedule);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   PUT /api/backup/schedule
// @desc    Update backup schedule
// @access  Private (Admin only)
router.put(
  "/schedule",
  [
    auth,
    authorizeRoles("admin"),
  ],
  async (req, res) => {
    try {
      const {
        enabled,
        frequency,
        time,
        retentionDays,
        includeDatabase,
        includeFiles
      } = req.body;
      
      // Mock schedule update - in real implementation, this would:
      // 1. Validate the schedule
      // 2. Update database with new schedule
      // 3. Set up cron job if enabled
      
      const updatedSchedule = {
        enabled: enabled || false,
        frequency: frequency || 'daily',
        time: time || '02:00',
        retentionDays: retentionDays || 30,
        includeDatabase: includeDatabase !== false,
        includeFiles: includeFiles === true,
        nextBackup: enabled ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        lastBackup: null
      };
      
      res.json({
        success: true,
        schedule: updatedSchedule,
        message: "Backup schedule updated successfully"
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update backup schedule" });
    }
  }
);

module.exports = router;
