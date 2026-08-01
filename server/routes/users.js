const express = require("express");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");
const router = express.Router();

// Admin roles that can manage users
const USER_MANAGER_ROLES = ["admin", "school admin", "super admin", "headmaster", "proprietor"];

// Get users by role (e.g., teachers)
router.get("/", auth, authorizeRoles(...USER_MANAGER_ROLES, "staff"), async (req, res) => {
  try {
    const { role } = req.query;
    const query = role ? { role } : {};

    const users = await User.find(query)
      .select("name email role secondaryRoles")
      .sort({ name: 1 });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server error",
      code: "USER_FETCH_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route   PATCH /api/users/:userId/roles
 * @desc    Grant or update a user's secondary (cross-role) permissions
 * @access  Admin, School Admin, Headmaster, Proprietor
 * 
 * Example: Grant an accountant the accounts officer role:
 *   PATCH /api/users/abc123/roles
 *   { "secondaryRoles": ["accounts officer"] }
 */
router.patch(
  "/:userId/roles",
  auth,
  authorizeRoles(...USER_MANAGER_ROLES),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { secondaryRoles } = req.body;

      if (!Array.isArray(secondaryRoles)) {
        return res.status(400).json({
          message: "secondaryRoles must be an array of role names",
          code: "INVALID_SECONDARY_ROLES",
          timestamp: new Date().toISOString(),
        });
      }

      // Validate each role against the User model enum
      const user = await User.findById(userId).select("name email role secondaryRoles");
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          timestamp: new Date().toISOString(),
        });
      }

      // Don't allow self-modification of super admin
      if (user.role === "super admin" && String(user._id) !== String(req.user._id)) {
        return res.status(403).json({
          message: "Cannot modify super admin roles",
          code: "SUPER_ADMIN_PROTECTED",
          timestamp: new Date().toISOString(),
        });
      }

      // Normalize and deduplicate roles
      const normalizeRole = (r) => String(r || "").trim().toLowerCase();
      const normalized = [...new Set(secondaryRoles.map(normalizeRole))].filter(Boolean);

      // Verify all roles are valid
      const validRoles = [
        "super admin", "school admin", "admin", "teacher", "student",
        "staff", "accountant", "accounts officer", "parent", "librarian",
        "counselor", "head teacher", "deputy head teacher", "subject head",
        "class teacher", "administrative staff", "support staff",
        "headmaster", "proprietor",
      ];

      const invalid = normalized.filter((r) => !validRoles.includes(r));
      if (invalid.length > 0) {
        return res.status(400).json({
          message: `Invalid role(s): ${invalid.join(", ")}`,
          code: "INVALID_ROLE",
          timestamp: new Date().toISOString(),
        });
      }

      // Cannot assign secondary role equal to primary role
      const primaryRole = normalizeRole(user.role);
      const withoutPrimary = normalized.filter((r) => r !== primaryRole);

      user.secondaryRoles = withoutPrimary;
      await user.save();

      // Audit log
      const AuditLog = require("../models/AuditLog");
      await AuditLog.create({
        action: "USER_ROLES_UPDATED",
        performedBy: req.user._id,
        targetUser: user._id,
        details: {
          userId: user._id.toString(),
          userName: user.name,
          primaryRole: user.role,
          secondaryRoles: withoutPrimary,
          updatedBy: req.user._id.toString(),
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        message: "User roles updated successfully",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          secondaryRoles: user.secondaryRoles,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Server error",
        code: "ROLE_UPDATE_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * @route   GET /api/users/:userId
 * @desc    Get a single user with their roles
 * @access  Admin, School Admin, Headmaster, Proprietor
 */
router.get("/:userId", auth, authorizeRoles(...USER_MANAGER_ROLES), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "name email role secondaryRoles phone staffId status createdAt"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        code: "USER_NOT_FOUND",
        timestamp: new Date().toISOString(),
      });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server error",
      code: "USER_FETCH_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
