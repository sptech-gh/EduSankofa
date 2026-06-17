const jwt = require("jsonwebtoken");
const RolePermission = require("../models/RolePermission");
const User = require("../models/User");
const GhanaStudent = require("../models/GhanaStudent");
const GhanaClass = require("../models/GhanaClass");

/**
 * Enhanced RBAC Middleware for Ghanaian School Management System
 */

// Cache for role permissions to improve performance
const permissionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for user contexts to improve performance
const contextCache = new Map();
const CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get user permissions with caching
 */
const getUserPermissions = async (userId, userRole) => {
  const cacheKey = `${userId}-${userRole}`;
  
  // Check cache first
  if (permissionCache.has(cacheKey)) {
    const cached = permissionCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.permissions;
    }
  }

  // Get permissions from database
  const rolePermission = await RolePermission.getRolePermissions(userRole);
  const permissions = rolePermission || {};
  
  // Cache the result
  permissionCache.set(cacheKey, {
    permissions,
    timestamp: Date.now(),
  });

  return permissions;
};

/**
 * Check if user has specific permission
 */
const hasPermission = (permissions, category, permission, context = {}) => {
  if (!permissions || !permissions[category]) {
    return false;
  }

  const hasDirectPermission = permissions[category][permission] === true;
  
  // If no direct permission, check contextual permissions
  if (!hasDirectPermission) {
    return checkContextualPermission(permissions, category, permission, context);
  }

  return hasDirectPermission;
};

/**
 * Check contextual permissions based on user context
 */
const checkContextualPermission = (permissions, category, permission, context) => {
  const { userRole, userClass, userSubjects, userChildren } = context;

  switch (category) {
    case "student":
      if (permission === "read") {
        if (userRole === "Parent" && userChildren && userChildren.length > 0) {
          return permissions.student.viewOwn || false;
        }
        if (userRole === "Teacher" && userClass) {
          return permissions.student.viewOwnClass || false;
        }
        if (userRole === "Student") {
          return permissions.student.manageSelf || false;
        }
      }
      break;

    case "attendance":
      if (permission === "markDaily") {
        if (userRole === "Teacher" && userClass) {
          return permissions.attendance.markOwnClass || false;
        }
      }
      if (permission === "read") {
        if (userRole === "Parent" && userChildren && userChildren.length > 0) {
          return permissions.attendance.viewOwnClass || false;
        }
        if (userRole === "Teacher" && userClass) {
          return permissions.attendance.viewOwnClass || false;
        }
      }
      break;

    case "financial":
      if (permission === "read") {
        if (userRole === "Parent" && userChildren && userChildren.length > 0) {
          return permissions.financial.viewOwnClass || false;
        }
        if (userRole === "Teacher" && userClass) {
          return permissions.financial.viewOwnClass || false;
        }
      }
      break;

    case "announcements":
      if (permission === "targetSpecific") {
        if (userRole === "Teacher") {
          return permissions.announcements.targetSpecific || false;
        }
      }
      break;
  }

  return false;
};

/**
 * Get user context for permission checking
 */
const getUserContext = async (user) => {
  const userId = user._id.toString();

  // Check context cache first
  if (contextCache.has(userId)) {
    const cached = contextCache.get(userId);
    if (Date.now() - cached.timestamp < CONTEXT_CACHE_TTL) {
      return cached.context;
    }
  }

  const context = {
    userRole: user.role,
    userClass: null,
    userSubjects: [],
    userChildren: [],
  };

  try {
    switch (user.role) {
      case "Teacher":
        // Get teacher's assigned class and subjects
        const teacherClass = await GhanaClass.findOne({
          $or: [
            { classTeacher: user._id },
            { subjectTeachers: user._id }
          ]
        }).populate("students");
        
        if (teacherClass) {
          context.userClass = teacherClass;
          context.userSubjects = teacherClass.subjects || [];
        }
        break;

      case "Parent":
        // Get parent's children
        const students = await GhanaStudent.find({
          "guardians.userId": user._id,
          status: "Active"
        }).select("_id firstName lastName currentClass");
        
        context.userChildren = students;
        break;

      case "Student":
        // Get student's own record
        const student = await GhanaStudent.findById(user._id).select("currentClass");
        if (student) {
          context.userClass = student.currentClass;
        }
        break;
    }
  } catch (error) {
    console.error("Error getting user context:", error);
  }

  // Cache context
  contextCache.set(userId, {
    context,
    timestamp: Date.now(),
  });

  return context;
};

/**
 * Main RBAC middleware
 */
const rbac = (category, permission, options = {}) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user._id) {
        return res.status(401).json({
          message: "Authentication required",
          code: "AUTH_REQUIRED",
        });
      }

      // Get user permissions
      const permissions = await getUserPermissions(req.user._id.toString(), req.user.role);
      
      if (!permissions || Object.keys(permissions).length === 0) {
        return res.status(403).json({
          message: "No permissions found for your role",
          code: "NO_PERMISSIONS",
        });
      }

      // Get user context
      const userContext = await getUserContext(req.user);
      
      // Check permission
      const authorized = hasPermission(permissions, category, permission, {
        ...userContext,
        req,
      });

      if (!authorized) {
        return res.status(403).json({
          message: `Access denied. Required permission: ${category}.${permission}`,
          code: "PERMISSION_DENIED",
          required: `${category}.${permission}`,
          userRole: req.user.role,
        });
      }

      // Additional checks based on options
      if (options.checkOwnership && options.resourceId) {
        const ownsResource = await checkResourceOwnership(
          req.user._id,
          req.user.role,
          options.resourceId,
          options.resourceType
        );

        if (!ownsResource) {
          return res.status(403).json({
            message: "Access denied. You don't own this resource",
            code: "RESOURCE_OWNERSHIP_DENIED",
          });
        }
      }

      // Add permission info to request for later use
      req.permissions = permissions;
      req.userContext = userContext;

      next();
    } catch (error) {
      console.error("RBAC middleware error:", error);
      return res.status(500).json({
        message: "Authorization error",
        code: "AUTH_ERROR",
      });
    }
  };
};

/**
 * Check if user owns a specific resource
 */
const checkResourceOwnership = async (userId, userRole, resourceId, resourceType) => {
  try {
    switch (resourceType) {
      case "student":
        if (userRole === "Parent") {
          const student = await GhanaStudent.findOne({
            _id: resourceId,
            "guardians.userId": userId,
          });
          return !!student;
        }
        if (userRole === "Student") {
          return resourceId.toString() === userId.toString();
        }
        break;

      case "announcement":
        if (["Teacher", "School Admin", "Super Admin"].includes(userRole)) {
          const Announcement = require("../models/GhanaAnnouncement");
          const announcement = await Announcement.findOne({
            _id: resourceId,
            author: userId,
          });
          return !!announcement;
        }
        break;

      case "class":
        if (["Teacher", "Head Teacher"].includes(userRole)) {
          const classRecord = await GhanaClass.findOne({
            _id: resourceId,
            $or: [
              { classTeacher: userId },
              { subjectTeachers: userId },
              { headTeacher: userId },
            ],
          });
          return !!classRecord;
        }
        break;
    }
  } catch (error) {
    console.error("Error checking resource ownership:", error);
  }

  return false;
};

/**
 * Permission checking helpers
 */
const can = (permissions, category, permission) => {
  return hasPermission(permissions, category, permission);
};

const cannot = (permissions, category, permission) => {
  return !hasPermission(permissions, category, permission);
};

/**
 * Role-based access control middleware factory
 */
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
        code: "ROLE_DENIED",
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Data scope middleware
 */
const requireDataScope = (scope) => {
  return async (req, res, next) => {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const userContext = await getUserContext(req.user);
    
    switch (scope) {
      case "own-class":
        if (!userContext.userClass) {
          return res.status(403).json({
            message: "Access denied. You must be assigned to a class",
            code: "NO_CLASS_ASSIGNED",
          });
        }
        break;

      case "own-children":
        if (!userContext.userChildren || userContext.userChildren.length === 0) {
          return res.status(403).json({
            message: "Access denied. No children found",
            code: "NO_CHILDREN_FOUND",
          });
        }
        break;

      case "self-only":
        if (req.user.role !== "Student") {
          return res.status(403).json({
            message: "Access denied. This action is only for students",
            code: "STUDENT_ONLY",
          });
        }
        break;
    }

    req.dataScope = scope;
    req.userContext = userContext;
    next();
  };
};

/**
 * Time-based access control
 */
const checkTimeRestrictions = (userRole, timeRestrictions) => {
  if (!timeRestrictions || timeRestrictions.canAccess247) {
    return true;
  }

  const now = new Date();
  const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

  // Check day restrictions
  if (!timeRestrictions.accessDays.includes(currentDay)) {
    return false;
  }

  // Check time restrictions
  if (currentTime < timeRestrictions.accessHours.start || 
      currentTime > timeRestrictions.accessHours.end) {
    return false;
  }

  return true;
};

/**
 * Clear permission cache
 */
const clearPermissionCache = (userId, userRole) => {
  const cacheKey = `${userId}-${userRole}`;
  permissionCache.delete(cacheKey);
  contextCache.delete(userId);
};

/**
 * Clear all permission cache
 */
const clearAllPermissionCache = () => {
  permissionCache.clear();
  contextCache.clear();
};

/**
 * Get permission summary for a user
 */
const getPermissionSummary = async (userId, userRole) => {
  const permissions = await getUserPermissions(userId, userRole);
  
  const summary = {
    role: userRole,
    permissions: {},
    can: {},
    cannot: {},
  };

  if (permissions) {
    for (const [category, categoryPerms] of Object.entries(permissions)) {
      summary.permissions[category] = categoryPerms;
      summary.can[category] = {};
      summary.cannot[category] = {};
      
      for (const [permission, value] of Object.entries(categoryPerms)) {
        summary.can[category][permission] = value;
        summary.cannot[category][permission] = !value;
      }
    }
  }

  return summary;
};

module.exports = {
  rbac,
  requireRole,
  requireDataScope,
  checkResourceOwnership,
  getUserPermissions,
  getUserContext,
  hasPermission,
  can,
  cannot,
  checkTimeRestrictions,
  clearPermissionCache,
  clearAllPermissionCache,
  getPermissionSummary,
};
