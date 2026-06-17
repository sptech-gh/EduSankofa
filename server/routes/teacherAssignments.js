const express = require("express");
const { body, validationResult } = require("express-validator");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const ClassModel = require("../models/Class");
const Subject = require("../models/Subject");
const User = require("../models/User");
const TeacherAssignment = require("../models/TeacherAssignment");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

const validateAssignment = [
  body("academicYear").isMongoId().withMessage("Valid academicYear ID is required"),
  body("term").isMongoId().withMessage("Valid term ID is required"),
  body("class").isMongoId().withMessage("Valid class ID is required"),
  body("subject").isMongoId().withMessage("Valid subject ID is required"),
  body("teacher").isMongoId().withMessage("Valid teacher ID is required"),
];

router.post(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  validateAssignment,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const year = await AcademicYear.findById(req.body.academicYear);
      if (!year) return res.status(404).json({ message: "Academic year not found" });

      const term = await Term.findById(req.body.term);
      if (!term) return res.status(404).json({ message: "Term not found" });
      if (term.academicYear.toString() !== year._id.toString()) {
        return res.status(400).json({ message: "Term does not belong to the academic year" });
      }

      const cls = await ClassModel.findById(req.body.class);
      if (!cls) return res.status(404).json({ message: "Class not found" });

      const subject = await Subject.findById(req.body.subject);
      if (!subject) return res.status(404).json({ message: "Subject not found" });

      const teacher = await User.findById(req.body.teacher);
      if (!teacher) return res.status(404).json({ message: "Teacher not found" });
      if (teacher.role !== "teacher") {
        return res.status(400).json({ message: "User is not a teacher" });
      }

      const assignment = new TeacherAssignment({
        academicYear: year._id,
        term: term._id,
        class: cls._id,
        subject: subject._id,
        teacher: teacher._id,
        status: req.body.status,
      });

      await assignment.save();
      await assignment.populate([
        { path: "academicYear", select: "name isActive" },
        { path: "term", select: "name order legacySemester isActive" },
        { path: "class", select: "name grade section academicYear" },
        { path: "subject", select: "name code academicYear semester" },
        { path: "teacher", select: "name email role" },
      ]);

      res.status(201).json(assignment);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Assignment already exists" });
      }
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get("/", auth, async (req, res) => {
  try {
    const { academicYear, term, classId, subject, teacher, status } = req.query;
    const filter = {};
    if (academicYear) filter.academicYear = academicYear;
    if (term) filter.term = term;
    if (classId) filter.class = classId;
    if (subject) filter.subject = subject;
    if (teacher) filter.teacher = teacher;
    if (status) filter.status = status;

    // If teacher, only see their assignments
    if (req.user.role === "teacher") {
      filter.teacher = req.user.userId;
    }

    const assignments = await TeacherAssignment.find(filter)
      .populate("academicYear", "name isActive")
      .populate("term", "name order legacySemester isActive")
      .populate("class", "name grade section academicYear")
      .populate("subject", "name code academicYear semester")
      .populate("teacher", "name email role")
      .sort({ createdAt: -1 });

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete(
  "/:id",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const deleted = await TeacherAssignment.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.json({ message: "Assignment deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
