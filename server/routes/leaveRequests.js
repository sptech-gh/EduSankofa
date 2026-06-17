const express = require("express");
const { body, validationResult } = require("express-validator");
const LeaveRequest = require("../models/LeaveRequest");
const Student = require("../models/Student");
const Notification = require("../models/Notification");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// Validation middleware
const validateLeaveRequest = [
  body("student").isMongoId().withMessage("Valid student ID is required"),
  body("startDate").isISO8601().withMessage("Valid start date is required"),
  body("endDate").isISO8601().withMessage("Valid end date is required"),
  body("type")
    .isIn(["sick", "personal", "family", "medical", "other"])
    .withMessage("Invalid leave type"),
  body("reason").trim().notEmpty().withMessage("Reason is required"),
  body("academicYear")
    .trim()
    .notEmpty()
    .withMessage("Academic year is required"),
  body("semester")
    .isIn(["Fall", "Spring", "Summer"])
    .withMessage("Invalid semester"),
];

// Submit leave request
router.post("/", auth, validateLeaveRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      student,
      startDate,
      endDate,
      type,
      reason,
      academicYear,
      semester,
      documents,
    } = req.body;

    // Verify student exists
    const studentDoc = await Student.findById(student);
    if (!studentDoc) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res
        .status(400)
        .json({ message: "End date must be after start date" });
    }

    if (start < new Date()) {
      return res
        .status(400)
        .json({ message: "Cannot request leave for past dates" });
    }

    // Create leave request
    const leaveRequest = new LeaveRequest({
      student,
      requestedBy: req.user.userId,
      startDate: start,
      endDate: end,
      type,
      reason,
      academicYear,
      semester,
      documents: documents || [],
      metadata: {
        submittedVia: "web",
        ipAddress: req.ip,
        deviceInfo: req.get("User-Agent"),
      },
    });

    // Check for overlapping leaves
    const hasOverlap = await leaveRequest.checkOverlap();
    if (hasOverlap) {
      return res
        .status(400)
        .json({ message: "Leave request overlaps with existing leave" });
    }

    await leaveRequest.save();

    // Create notification for administrators
    const adminUsers = await require("../models/User").find({
      role: { $in: ["admin", "staff"] },
    });
    const notifications = adminUsers.map((admin) => ({
      recipient: admin._id,
      sender: req.user.userId,
      title: "New Leave Request",
      message: `${studentDoc.firstName} ${
        studentDoc.lastName
      } has submitted a leave request from ${start.toDateString()} to ${end.toDateString()}`,
      type: "system",
      priority: "medium",
      actionRequired: true,
      actionUrl: `/leave-requests/${leaveRequest._id}`,
      actionText: "Review Request",
      relatedEntity: {
        entityType: "leave",
        entityId: leaveRequest._id,
      },
    }));

    await Notification.createBulk(notifications);

    await leaveRequest.populate([
      { path: "student", select: "firstName lastName email" },
      { path: "requestedBy", select: "name email" },
    ]);

    res.status(201).json(leaveRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get leave requests with filtering
router.get("/", auth, async (req, res) => {
  try {
    const {
      student,
      status,
      type,
      startDate,
      endDate,
      academicYear,
      semester,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (student) filter.student = student;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = semester;

    // Date range filter
    if (startDate || endDate) {
      filter.$or = [];
      if (startDate) {
        filter.$or.push({ startDate: { $gte: new Date(startDate) } });
        filter.$or.push({ endDate: { $gte: new Date(startDate) } });
      }
      if (endDate) {
        filter.$or.push({ startDate: { $lte: new Date(endDate) } });
        filter.$or.push({ endDate: { $lte: new Date(endDate) } });
      }
    }

    // Role-based filtering
    if (req.user.role === "student") {
      filter.requestedBy = req.user.userId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const leaveRequests = await LeaveRequest.find(filter)
      .populate("student", "firstName lastName email")
      .populate("requestedBy", "name email")
      .populate("approver", "name email")
      .populate("comments.user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await LeaveRequest.countDocuments(filter);

    res.json({
      leaveRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get leave request by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate("student", "firstName lastName email dateOfBirth")
      .populate("requestedBy", "name email")
      .populate("approver", "name email")
      .populate("comments.user", "name email");

    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check authorization
    if (
      req.user.role === "student" &&
      leaveRequest.requestedBy._id.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(leaveRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update leave request (only for pending requests)
router.put("/:id", auth, async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check authorization
    if (
      req.user.role === "student" &&
      leaveRequest.requestedBy.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (leaveRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Only pending leave requests can be updated" });
    }

    const { startDate, endDate, type, reason, documents } = req.body;

    // Validate date range if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return res
          .status(400)
          .json({ message: "End date must be after start date" });
      }

      if (start < new Date()) {
        return res
          .status(400)
          .json({ message: "Cannot request leave for past dates" });
      }

      leaveRequest.startDate = start;
      leaveRequest.endDate = end;
    }

    if (type) leaveRequest.type = type;
    if (reason) leaveRequest.reason = reason;
    if (documents) leaveRequest.documents = documents;

    // Check for overlapping leaves if dates changed
    if (startDate && endDate) {
      const hasOverlap = await leaveRequest.checkOverlap();
      if (hasOverlap) {
        return res
          .status(400)
          .json({ message: "Leave request overlaps with existing leave" });
      }
    }

    await leaveRequest.save();

    await leaveRequest.populate([
      { path: "student", select: "firstName lastName email" },
      { path: "requestedBy", select: "name email" },
    ]);

    res.json(leaveRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Approve leave request
router.patch(
  "/:id/approve",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const leaveRequest = await LeaveRequest.findById(req.params.id);
      if (!leaveRequest) {
        return res.status(404).json({ message: "Leave request not found" });
      }

      await leaveRequest.approve(req.user.userId);

      // Create notification for requester
      await Notification.create({
        recipient: leaveRequest.requestedBy,
        sender: req.user.userId,
        title: "Leave Request Approved",
        message: `Your leave request from ${leaveRequest.startDate.toDateString()} to ${leaveRequest.endDate.toDateString()} has been approved`,
        type: "system",
        priority: "medium",
        actionUrl: `/leave-requests/${leaveRequest._id}`,
        actionText: "View Details",
        relatedEntity: {
          entityType: "leave",
          entityId: leaveRequest._id,
        },
      });

      await leaveRequest.populate([
        { path: "student", select: "firstName lastName email" },
        { path: "requestedBy", select: "name email" },
        { path: "approver", select: "name email" },
      ]);

      res.json(leaveRequest);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message || "Server error" });
    }
  }
);

// Reject leave request
router.patch(
  "/:id/reject",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const { reason } = req.body;

      if (!reason) {
        return res
          .status(400)
          .json({ message: "Rejection reason is required" });
      }

      const leaveRequest = await LeaveRequest.findById(req.params.id);
      if (!leaveRequest) {
        return res.status(404).json({ message: "Leave request not found" });
      }

      await leaveRequest.reject(req.user.userId, reason);

      // Create notification for requester
      await Notification.create({
        recipient: leaveRequest.requestedBy,
        sender: req.user.userId,
        title: "Leave Request Rejected",
        message: `Your leave request from ${leaveRequest.startDate.toDateString()} to ${leaveRequest.endDate.toDateString()} has been rejected. Reason: ${reason}`,
        type: "system",
        priority: "medium",
        actionUrl: `/leave-requests/${leaveRequest._id}`,
        actionText: "View Details",
        relatedEntity: {
          entityType: "leave",
          entityId: leaveRequest._id,
        },
      });

      await leaveRequest.populate([
        { path: "student", select: "firstName lastName email" },
        { path: "requestedBy", select: "name email" },
        { path: "approver", select: "name email" },
      ]);

      res.json(leaveRequest);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message || "Server error" });
    }
  }
);

// Cancel leave request
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Check authorization
    if (
      req.user.role === "student" &&
      leaveRequest.requestedBy.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    await leaveRequest.cancel();

    await leaveRequest.populate([
      { path: "student", select: "firstName lastName email" },
      { path: "requestedBy", select: "name email" },
    ]);

    res.json(leaveRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Add comment to leave request
router.post("/:id/comments", auth, async (req, res) => {
  try {
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ message: "Comment is required" });
    }

    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    leaveRequest.comments.push({
      user: req.user.userId,
      comment,
    });

    await leaveRequest.save();

    await leaveRequest.populate("comments.user", "name email");

    res.json(leaveRequest.comments[leaveRequest.comments.length - 1]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get leave summary for a student
router.get("/student/:studentId/summary", auth, async (req, res) => {
  try {
    const { academicYear, semester } = req.query;

    if (!academicYear || !semester) {
      return res
        .status(400)
        .json({ message: "Academic year and semester are required" });
    }

    const summary = await LeaveRequest.getStudentSummary(
      req.params.studentId,
      academicYear,
      semester
    );
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get pending leave requests (for administrators)
router.get(
  "/pending/list",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const pendingRequests = await LeaveRequest.find({ status: "pending" })
        .populate("student", "firstName lastName email")
        .populate("requestedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await LeaveRequest.countDocuments({ status: "pending" });

      res.json({
        leaveRequests: pendingRequests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete leave request (admin only)
router.delete("/:id", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findByIdAndDelete(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    res.json({ message: "Leave request deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
