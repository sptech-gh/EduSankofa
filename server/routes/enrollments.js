const express = require("express");
const { body, validationResult } = require("express-validator");
const Enrollment = require("../models/Enrollment");
const Student = require("../models/Student");
const AcademicYear = require("../models/AcademicYear");
const ClassModel = require("../models/Class");
const Term = require("../models/Term");
const TeacherAssignment = require("../models/TeacherAssignment");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

const validateEnrollment = [
  body("student").isMongoId().withMessage("Valid student ID is required"),
  body("academicYear").isMongoId().withMessage("Valid academicYear ID is required"),
  body("class").isMongoId().withMessage("Valid class ID is required"),
];

router.post(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  validateEnrollment,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const student = await Student.findById(req.body.student);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      const year = await AcademicYear.findById(req.body.academicYear);
      if (!year) {
        return res.status(404).json({ message: "Academic year not found" });
      }

      const cls = await ClassModel.findById(req.body.class);
      if (!cls) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (cls.academicYear && cls.academicYear !== year.name) {
        return res
          .status(400)
          .json({ message: "Class does not belong to the academic year" });
      }

      const enrollment = await Enrollment.findOneAndUpdate(
        { student: student._id, academicYear: year._id },
        {
          $set: {
            class: cls._id,
            status: req.body.status || "active",
            withdrawnAt: req.body.withdrawnAt,
          },
          $setOnInsert: {
            enrolledAt: req.body.enrolledAt || new Date(),
          },
        },
        { new: true, upsert: true, runValidators: true }
      );

      student.class = cls.name;
      await student.save();

      await enrollment.populate([
        { path: "student", select: "firstName lastName email studentId admissionNumber" },
        { path: "academicYear", select: "name isActive" },
        { path: "class", select: "name grade section academicYear" },
      ]);

      res.status(201).json(enrollment);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Student already enrolled for this academic year" });
      }
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get("/", auth, authorizeRoles("admin", "staff", "teacher"), async (req, res) => {
  try {
    const { academicYear, classId, student, status } = req.query;
    const filter = {};

    let effectiveAcademicYear = academicYear;

    if (req.user.role === "teacher" && !effectiveAcademicYear) {
      const activeYear = await AcademicYear.findOne({ isActive: true }).select(
        "_id"
      );
      if (activeYear) {
        effectiveAcademicYear = activeYear._id.toString();
      }
    }

    if (effectiveAcademicYear) filter.academicYear = effectiveAcademicYear;
    if (classId) filter.class = classId;
    if (student) filter.student = student;
    if (status) filter.status = status;

    if (req.user.role === "teacher") {
      if (!effectiveAcademicYear) {
        return res
          .status(400)
          .json({ message: "Academic year is required" });
      }

      const activeTerm = await Term.findOne({
        academicYear: effectiveAcademicYear,
        isActive: true,
      }).select("_id");

      const assignmentFilter = {
        teacher: req.user.userId,
        academicYear: effectiveAcademicYear,
        status: "active",
      };
      if (activeTerm) assignmentFilter.term = activeTerm._id;

      const assignments = await TeacherAssignment.find(assignmentFilter).select(
        "class"
      );
      const classIds = [...new Set(assignments.map((a) => a.class.toString()))];

      filter.class = classId ? classId : { $in: classIds };
    }

    const enrollments = await Enrollment.find(filter)
      .populate("student", "firstName lastName email studentId admissionNumber class")
      .populate("academicYear", "name isActive")
      .populate("class", "name grade section academicYear")
      .sort({ createdAt: -1 });

    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/student/:studentId",
  auth,
  authorizeRoles("admin", "staff", "teacher"),
  async (req, res) => {
    try {
      const filter = { student: req.params.studentId };

      let effectiveAcademicYear = req.query.academicYear;
      if (req.user.role === "teacher" && !effectiveAcademicYear) {
        const activeYear = await AcademicYear.findOne({ isActive: true }).select(
          "_id"
        );
        if (activeYear) {
          effectiveAcademicYear = activeYear._id.toString();
        }
      }

      if (effectiveAcademicYear) filter.academicYear = effectiveAcademicYear;

      if (req.user.role === "teacher") {
        if (!effectiveAcademicYear) {
          return res
            .status(400)
            .json({ message: "Academic year is required" });
        }

        const activeTerm = await Term.findOne({
          academicYear: effectiveAcademicYear,
          isActive: true,
        }).select("_id");

        const assignmentFilter = {
          teacher: req.user.userId,
          academicYear: effectiveAcademicYear,
          status: "active",
        };
        if (activeTerm) assignmentFilter.term = activeTerm._id;

        const assignments = await TeacherAssignment.find(assignmentFilter).select(
          "class"
        );
        const classIds = [...new Set(assignments.map((a) => a.class.toString()))];

        filter.class = { $in: classIds };
      }

      const enrollments = await Enrollment.find(filter)
        .populate("academicYear", "name isActive")
        .populate("class", "name grade section academicYear")
        .sort({ createdAt: -1 });

      res.json(enrollments);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/:id",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const enrollment = await Enrollment.findById(req.params.id);
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }

      if (req.body.class) {
        const cls = await ClassModel.findById(req.body.class);
        if (!cls) {
          return res.status(404).json({ message: "Class not found" });
        }
        enrollment.class = cls._id;

        const student = await Student.findById(enrollment.student);
        if (student) {
          student.class = cls.name;
          await student.save();
        }
      }

      if (req.body.status) enrollment.status = req.body.status;
      if (req.body.withdrawnAt !== undefined)
        enrollment.withdrawnAt = req.body.withdrawnAt ? new Date(req.body.withdrawnAt) : undefined;

      await enrollment.save();
      await enrollment.populate([
        { path: "student", select: "firstName lastName email studentId admissionNumber" },
        { path: "academicYear", select: "name isActive" },
        { path: "class", select: "name grade section academicYear" },
      ]);

      res.json(enrollment);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
