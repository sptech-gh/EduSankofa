const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const Enrollment = require("../models/Enrollment");
const TeacherAssignment = require("../models/TeacherAssignment");
const Announcement = require("../models/Announcement");
const Message = require("../models/Message");
const Notification = require("../models/Notification");

// @route   GET /analytics/dashboard
// @desc    Get analytics dashboard data
// @access  Private
router.get("/dashboard", auth, async (req, res) => {
  try {
    const roleToAudienceKey = (role) => {
      if (role === "teacher") return "teachers";
      if (role === "student") return "students";
      if (role === "staff" || role === "accounts officer") return "staff";
      if (role === "admin") return "admin";
      if (role === "parent") return "parents";
      return role;
    };

    let academicYearId = req.query.academicYearId;
    if (!academicYearId) {
      const activeYear = await AcademicYear.findOne({ isActive: true }).select("_id");
      if (activeYear) academicYearId = activeYear._id.toString();
    }

    if (!academicYearId) {
      return res.status(400).json({ message: "academicYearId is required" });
    }

    let termId = req.query.termId;
    if (!termId) {
      const activeTerm = await Term.findOne({ academicYear: academicYearId, isActive: true }).select(
        "_id"
      );
      if (activeTerm) termId = activeTerm._id.toString();
    }

    let totalStudents = 0;

    if (req.user.role === "teacher") {
      const assignmentFilter = {
        teacher: req.user.userId,
        academicYear: academicYearId,
        status: "active",
      };
      if (termId) assignmentFilter.term = termId;

      const assignments = await TeacherAssignment.find(assignmentFilter).select(
        "class"
      );
      const classIds = [...new Set(assignments.map((a) => a.class.toString()))];

      if (classIds.length > 0) {
        totalStudents = await Enrollment.countDocuments({
          academicYear: academicYearId,
          class: { $in: classIds },
          status: "active",
        });
      }
    } else {
      totalStudents = await Enrollment.countDocuments({
        academicYear: academicYearId,
        status: "active",
      });
    }

    const audienceKey = roleToAudienceKey(req.user.role);

    const unreadAnnouncements = await Announcement.countDocuments({
      status: "published",
      scheduledDate: { $lte: new Date() },
      $and: [
        {
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: { $gt: new Date() } },
          ],
        },
        { "readBy.user": { $ne: req.user.userId } },
        { $or: [{ targetAudience: "all" }, { targetAudience: audienceKey }] },
      ],
    });

    const unreadMessages = await Message.getUnreadCount(req.user.userId);
    const unreadNotifications = await Notification.getUnreadCount(req.user.userId);

    res.json({
      academicYearId,
      termId,
      totalStudents,
      unreadAnnouncements,
      unreadMessages,
      unreadNotifications,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
