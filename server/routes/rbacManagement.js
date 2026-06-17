const express = require("express");
const { body, validationResult } = require("express-validator");
const RolePermission = require("../models/RolePermission");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");
const { rbac, requireRole, getPermissionSummary } = require("../middleware/rbac");

const router = express.Router();

// ============= ROLE PERMISSIONS MANAGEMENT =============

// Get all role permissions
router.get(
  "/roles",
  auth,
  rbac("user", "managePermissions"),
  async (req, res) => {
    try {
      const roles = await RolePermission.find({ isActive: true })
        .populate("createdBy", "firstName lastName email")
        .populate("lastModifiedBy", "firstName lastName email")
        .sort({ role: 1 });

      res.json({
        roles,
        total: roles.length,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get specific role permissions
router.get(
  "/roles/:role",
  auth,
  rbac("user", "read"),
  async (req, res) => {
    try {
      const { role } = req.params;

      const rolePermission = await RolePermission.findOne({ 
        role, 
        isActive: true 
      })
        .populate("createdBy", "firstName lastName email")
        .populate("lastModifiedBy", "firstName lastName email");

      if (!rolePermission) {
        return res.status(404).json({ message: "Role permissions not found" });
      }

      res.json(rolePermission);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Create or update role permissions
router.post(
  "/roles/:role",
  auth,
  rbac("user", "managePermissions"),
  [
    body("permissions").isObject().withMessage("Permissions object is required"),
    body("description").optional().trim().isLength({ max: 500 }).withMessage("Description must be max 500 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { role } = req.params;
      const { permissions, description, scope, timeRestrictions, restrictions } = req.body;

      let rolePermission = await RolePermission.findOne({ role });

      if (rolePermission) {
        // Update existing role permissions
        rolePermission.permissions = permissions;
        rolePermission.description = description || rolePermission.description;
        rolePermission.lastModifiedBy = req.user._id;
        
        if (scope) rolePermission.scope = { ...rolePermission.scope, ...scope };
        if (timeRestrictions) rolePermission.timeRestrictions = { ...rolePermission.timeRestrictions, ...timeRestrictions };
        if (restrictions) rolePermission.restrictions = { ...rolePermission.restrictions, ...restrictions };
      } else {
        // Create new role permissions
        rolePermission = new RolePermission({
          role,
          permissions,
          description: description || `Permissions for ${role} role`,
          scope: scope || {
            dataAccess: role === "Parent" ? "Own Children" : 
                       role === "Teacher" ? "Own Class" : 
                       role === "Student" ? "Self Only" : "All",
          },
          timeRestrictions: timeRestrictions || {
            canAccess247: true,
            accessHours: { start: "00:00", end: "23:59" },
            accessDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            holidaysAllowed: true,
          },
          restrictions: restrictions || {
            allowedIPs: [],
            allowedDevices: [],
            requireMFA: false,
            sessionTimeout: 30,
            maxConcurrentSessions: 3,
          },
          createdBy: req.user._id,
        });
      }

      await rolePermission.save();

      const populatedRole = await RolePermission.findById(rolePermission._id)
        .populate("createdBy", "firstName lastName email")
        .populate("lastModifiedBy", "firstName lastName email");

      res.json({
        message: rolePermission.isNew ? "Role permissions created successfully" : "Role permissions updated successfully",
        rolePermission: populatedRole,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Update specific permission
router.put(
  "/roles/:role/permissions/:category/:permission",
  auth,
  rbac("user", "managePermissions"),
  [
    body("value").isBoolean().withMessage("Permission value must be boolean"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { role, category, permission } = req.params;
      const { value } = req.body;

      const rolePermission = await RolePermission.findOne({ role, isActive: true });
      if (!rolePermission) {
        return res.status(404).json({ message: "Role permissions not found" });
      }

      await rolePermission.updatePermission(category, permission, value);
      rolePermission.lastModifiedBy = req.user._id;
      await rolePermission.save();

      res.json({
        message: "Permission updated successfully",
        role: rolePermission.role,
        category,
        permission,
        value,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Deactivate role permissions
router.delete(
  "/roles/:role",
  auth,
  rbac("user", "managePermissions"),
  async (req, res) => {
    try {
      const { role } = req.params;

      const rolePermission = await RolePermission.findOne({ role });
      if (!rolePermission) {
        return res.status(404).json({ message: "Role permissions not found" });
      }

      rolePermission.isActive = false;
      rolePermission.lastModifiedBy = req.user._id;
      await rolePermission.save();

      res.json({
        message: "Role permissions deactivated successfully",
        role,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= USER PERMISSIONS =============

// Get user's current permissions
router.get(
  "/user-permissions",
  auth,
  async (req, res) => {
    try {
      const permissionSummary = await getPermissionSummary(
        req.user._id.toString(),
        req.user.role
      );

      res.json({
        user: {
          id: req.user._id,
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
          role: req.user.role,
        },
        permissions: permissionSummary,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get permissions for specific user (admin only)
router.get(
  "/user-permissions/:userId",
  auth,
  rbac("user", "read"),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select("firstName lastName email role");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const permissionSummary = await getPermissionSummary(
        userId,
        user.role
      );

      res.json({
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role,
        },
        permissions: permissionSummary,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Check if user has specific permission
router.post(
  "/check-permission",
  auth,
  [
    body("category").notEmpty().withMessage("Category is required"),
    body("permission").notEmpty().withMessage("Permission is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { category, permission, userId } = req.body;
      const targetUserId = userId || req.user._id;
      const targetUserRole = userId ? 
        (await User.findById(userId).select("role")).role : 
        req.user.role;

      const hasPermission = await RolePermission.hasPermission(
        targetUserRole,
        category,
        permission
      );

      res.json({
        hasPermission,
        user: targetUserId,
        role: targetUserRole,
        category,
        permission,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= ACCESS CONTROL MATRIX =============

// Get complete access control matrix
router.get(
  "/access-matrix",
  auth,
  rbac("user", "read"),
  async (req, res) => {
    try {
      const allRoles = await RolePermission.find({ isActive: true })
        .sort({ role: 1 });

      const categories = [
        "academic", "student", "attendance", "announcements", 
        "financial", "user", "system", "reports", "communication"
      ];

      const permissions = [
        "create", "read", "update", "delete", "viewAll", "viewOwn",
        "manageStudents", "manageClasses", "manageSubjects", "manageGrades",
        "markDaily", "markOwnClass", "override", "approve", "publish",
        "targetAll", "targetSpecific", "manageFees", "managePayments",
        "manageRoles", "managePermissions", "manageSchool", "manageSettings",
        "generateReports", "exportReports", "sendMessages", "sendEmails"
      ];

      const matrix = {
        roles: allRoles.map(r => r.role),
        categories,
        permissions,
        data: {},
      };

      // Build the matrix data
      allRoles.forEach(rolePermission => {
        matrix.data[rolePermission.role] = {};
        
        categories.forEach(category => {
          matrix.data[rolePermission.role][category] = {};
          
          permissions.forEach(permission => {
            matrix.data[rolePermission.role][category][permission] = 
              rolePermission.can(category, permission);
          });
        });
      });

      res.json(matrix);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get role comparison
router.get(
  "/role-comparison",
  auth,
  rbac("user", "read"),
  async (req, res) => {
    try {
      const { roles } = req.query;
      
      if (!roles) {
        return res.status(400).json({ message: "Roles parameter is required" });
      }

      const roleList = Array.isArray(roles) ? roles : [roles];
      const rolePermissions = await RolePermission.find({
        role: { $in: roleList },
        isActive: true,
      });

      const comparison = {};

      rolePermissions.forEach(rolePermission => {
        comparison[rolePermission.role] = {
          totalPermissions: 0,
          categories: {},
        };

        Object.entries(rolePermission.permissions).forEach(([category, perms]) => {
          const enabledPerms = Object.entries(perms)
            .filter(([_, value]) => value === true)
            .map(([perm]) => perm);

          comparison[rolePermission.role].categories[category] = enabledPerms;
          comparison[rolePermission.role].totalPermissions += enabledPerms.length;
        });
      });

      res.json({
        roles: roleList,
        comparison,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= PERMISSION AUDIT =============

// Get permission audit log
router.get(
  "/audit",
  auth,
  rbac("system", "viewLogs"),
  async (req, res) => {
    try {
      const { startDate, endDate, role, category, limit = 50 } = req.query;

      // This would typically query an audit log collection
      // For now, return a placeholder response
      res.json({
        message: "Permission audit log would be implemented here",
        filters: { startDate, endDate, role, category },
        limit,
        note: "Implement audit logging for permission changes",
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= BULK OPERATIONS =============

// Create default permissions for all roles
router.post(
  "/create-defaults",
  auth,
  rbac("user", "managePermissions"),
  async (req, res) => {
    try {
      const createdRoles = await RolePermission.createDefaultPermissions();

      res.json({
        message: "Default permissions created successfully",
        createdRoles,
        total: createdRoles.length,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Bulk update permissions
router.post(
  "/bulk-update",
  auth,
  rbac("user", "managePermissions"),
  [
    body("updates").isArray({ min: 1 }).withMessage("Updates array is required"),
    body("updates.*.role").notEmpty().withMessage("Role is required"),
    body("updates.*.category").notEmpty().withMessage("Category is required"),
    body("updates.*.permission").notEmpty().withMessage("Permission is required"),
    body("updates.*.value").isBoolean().withMessage("Value must be boolean"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { updates } = req.body;
      const results = {
        successful: [],
        failed: [],
      };

      for (const update of updates) {
        try {
          const rolePermission = await RolePermission.findOne({
            role: update.role,
            isActive: true,
          });

          if (!rolePermission) {
            results.failed.push({
              role: update.role,
              error: "Role permissions not found",
            });
            continue;
          }

          await rolePermission.updatePermission(
            update.category,
            update.permission,
            update.value
          );

          rolePermission.lastModifiedBy = req.user._id;
          await rolePermission.save();

          results.successful.push({
            role: update.role,
            category: update.category,
            permission: update.permission,
            value: update.value,
          });
        } catch (err) {
          results.failed.push({
            role: update.role,
            error: err.message,
          });
        }
      }

      res.json({
        message: "Bulk update completed",
        results,
        summary: {
          total: updates.length,
          successful: results.successful.length,
          failed: results.failed.length,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= PERMISSION TEMPLATES =============

// Create permission template
router.post(
  "/templates",
  auth,
  rbac("user", "managePermissions"),
  [
    body("name").trim().isLength({ min: 3, max: 100 }).withMessage("Template name must be 3-100 characters"),
    body("description").trim().isLength({ max: 500 }).withMessage("Description must be max 500 characters"),
    body("permissions").isObject().withMessage("Permissions object is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, permissions } = req.body;

      // This would typically save to a templates collection
      // For now, return a placeholder response
      res.json({
        message: "Permission template creation would be implemented here",
        template: { name, description, permissions },
        note: "Implement permission templates for reusable permission sets",
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Apply template to role
router.post(
  "/templates/:templateId/apply/:role",
  auth,
  rbac("user", "managePermissions"),
  async (req, res) => {
    try {
      const { templateId, role } = req.params;

      // This would typically apply template permissions to role
      res.json({
        message: "Template application would be implemented here",
        templateId,
        role,
        note: "Implement template application to roles",
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

module.exports = router;
