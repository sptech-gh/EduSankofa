"use strict";

/**
 * Admin Parent Management Routes
 * Admin-initiated parent account creation with one-time setup links
 * Compliance: Goals Module 6, Outcome 6.5
 */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { auth, authorizeRoles } = require("../middleware/auth");
const User = require("../models/User");
const GhanaStudent = require("../models/GhanaStudent");
const AuditLog = require("../models/AuditLog");

// Admin roles allowed to create parent accounts
const ADMIN_ROLES = ["school admin", "admin", "headmaster", "proprietor"];

/**
 * @route   POST /api/admin/parents/invite
 * @desc    Admin creates parent account and sends one-time setup link
 * @access  Admin only
 */
router.post(
  "/invite",
  [auth, authorizeRoles(...ADMIN_ROLES)],
  async (req, res, next) => {
    try {
      const { email, name, phone, studentIds } = req.body;

      // Validation
      if (!email || !name || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
          message: "Email, name, and at least one student ID are required",
        });
      }

      // Verify email not already in use
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          message: "A user account with this email already exists",
        });
      }

      // Verify all students exist
      const students = await GhanaStudent.find({ _id: { $in: studentIds } });
      if (students.length !== studentIds.length) {
        return res.status(400).json({
          message: "One or more student IDs are invalid",
        });
      }

      // Generate one-time setup token (valid for 7 days)
      const setupToken = crypto.randomBytes(32).toString("hex");
      const setupTokenExpiry = new Date();
      setupTokenExpiry.setDate(setupTokenExpiry.getDate() + 7);

      // Create parent account (inactive until password is set)
      const parent = new User({
        email: email.toLowerCase(),
        name,
        phone,
        role: "parent",
        isActive: false, // Inactive until setup completed
        forcePasswordChange: false, // They'll set password via setup link
        passwordSetupToken: setupToken,
        passwordSetupTokenExpiry: setupTokenExpiry,
        createdBy: req.user._id,
      });

      await parent.save();

      // Link parent to students
      for (const student of students) {
        if (!student.guardians) student.guardians = [];
        
        // Check if already linked
        const alreadyLinked = student.guardians.some(
          g => g.userId && g.userId.toString() === parent._id.toString()
        );

        if (!alreadyLinked) {
          student.guardians.push({
            userId: parent._id,
            name: name,
            relationship: "Parent/Guardian",
            phone: phone,
            email: email.toLowerCase(),
            isPrimary: student.guardians.length === 0, // First guardian is primary
          });
          await student.save();
        }
      }

      // Generate setup link
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
      const setupLink = `${frontendUrl}/auth/setup-password?token=${setupToken}`;

      // Log action
      await AuditLog.create({
        action: "PARENT_ACCOUNT_CREATED",
        performedBy: req.user._id,
        targetUser: parent._id,
        details: {
          parentEmail: email,
          parentName: name,
          linkedStudents: studentIds,
          setupLinkGenerated: true,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // TODO: Send email/SMS with setup link
      // For now, return the link in response (admin can manually send)

      res.status(201).json({
        message: "Parent account created successfully",
        parent: {
          _id: parent._id,
          email: parent.email,
          name: parent.name,
          role: parent.role,
          isActive: parent.isActive,
        },
        linkedStudents: students.map(s => ({
          _id: s._id,
          name: `${s.firstName} ${s.lastName}`,
          studentId: s.studentId,
        })),
        setupLink,
        setupLinkExpiry: setupTokenExpiry,
        note: "Send this setup link to the parent via email or SMS. Link expires in 7 days.",
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route   GET /api/admin/parents
 * @desc    List all parent accounts
 * @access  Admin only
 */
router.get(
  "/",
  [auth, authorizeRoles(...ADMIN_ROLES)],
  async (req, res, next) => {
    try {
      const parents = await User.find({ role: "parent" })
        .select("_id email name phone isActive createdAt")
        .sort({ createdAt: -1 });

      // Get linked students for each parent
      const parentsWithStudents = await Promise.all(
        parents.map(async (parent) => {
          const students = await GhanaStudent.find({
            "guardians.userId": parent._id,
          }).select("firstName lastName studentId currentClass");

          return {
            ...parent.toObject(),
            linkedStudents: students.map(s => ({
              _id: s._id,
              name: `${s.firstName} ${s.lastName}`,
              studentId: s.studentId,
              class: s.currentClass?.name || s.currentClass,
            })),
          };
        })
      );

      res.json({
        count: parentsWithStudents.length,
        parents: parentsWithStudents,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route   POST /api/admin/parents/:parentId/resend-setup
 * @desc    Regenerate setup link for parent who hasn't completed setup
 * @access  Admin only
 */
router.post(
  "/:parentId/resend-setup",
  [auth, authorizeRoles(...ADMIN_ROLES)],
  async (req, res, next) => {
    try {
      const parent = await User.findOne({
        _id: req.params.parentId,
        role: "parent",
      });

      if (!parent) {
        return res.status(404).json({ message: "Parent account not found" });
      }

      if (parent.isActive) {
        return res.status(400).json({
          message: "Parent account is already active. Cannot resend setup link.",
        });
      }

      // Generate new setup token
      const setupToken = crypto.randomBytes(32).toString("hex");
      const setupTokenExpiry = new Date();
      setupTokenExpiry.setDate(setupTokenExpiry.getDate() + 7);

      parent.passwordSetupToken = setupToken;
      parent.passwordSetupTokenExpiry = setupTokenExpiry;
      await parent.save();

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
      const setupLink = `${frontendUrl}/auth/setup-password?token=${setupToken}`;

      await AuditLog.create({
        action: "PARENT_SETUP_LINK_RESENT",
        performedBy: req.user._id,
        targetUser: parent._id,
        details: {
          parentEmail: parent.email,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        message: "Setup link regenerated successfully",
        setupLink,
        setupLinkExpiry: setupTokenExpiry,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route   DELETE /api/admin/parents/:parentId
 * @desc    Deactivate parent account (soft delete)
 * @access  Admin only
 */
router.delete(
  "/:parentId",
  [auth, authorizeRoles(...ADMIN_ROLES)],
  async (req, res, next) => {
    try {
      const parent = await User.findOne({
        _id: req.params.parentId,
        role: "parent",
      });

      if (!parent) {
        return res.status(404).json({ message: "Parent account not found" });
      }

      parent.isActive = false;
      await parent.save();

      await AuditLog.create({
        action: "PARENT_ACCOUNT_DEACTIVATED",
        performedBy: req.user._id,
        targetUser: parent._id,
        details: {
          parentEmail: parent.email,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        message: "Parent account deactivated successfully",
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
