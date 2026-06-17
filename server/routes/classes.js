const express = require("express");
const { body, validationResult } = require("express-validator");
const ClassModel = require("../models/Class");
const AcademicYear = require("../models/AcademicYear");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

const normalizeGrade = (value) => {
  if (!value) return value;
  const raw = String(value).trim();
  if (raw === "KG 1") return "KG1";
  if (raw === "KG 2") return "KG2";
  return raw;
};

const ALLOWED_GRADES = [
  "Creche",
  "Nursery 1",
  "Nursery 2",
  "KG1",
  "KG2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JHS 1",
  "JHS 2",
  "JHS 3",
];

const validateClass = [
  body("name").trim().notEmpty().withMessage("Class name is required"),
  body("grade")
    .customSanitizer((v) => normalizeGrade(v))
    .isIn(ALLOWED_GRADES)
    .withMessage("Invalid grade (must be Creche through JHS 3)"),
  body("section").trim().notEmpty().withMessage("Section is required"),
  body("teacher").isMongoId().withMessage("Valid teacher ID is required"),
  body("academicYear").trim().notEmpty().withMessage("Academic year is required"),
];

// Create class (Creche–JHS3 only)
router.post(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  validateClass,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Optional normalization: if academicYearId is provided, ensure it exists
      if (req.body.academicYearId) {
        const year = await AcademicYear.findById(req.body.academicYearId);
        if (!year) {
          return res.status(404).json({ message: "Academic year not found" });
        }
      }

      const doc = new ClassModel({
        name: req.body.name,
        grade: normalizeGrade(req.body.grade),
        section: req.body.section,
        teacher: req.body.teacher,
        students: req.body.students || [],
        subjects: req.body.subjects || [],
        capacity: req.body.capacity,
        academicYear: req.body.academicYear,
        isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
      });

      await doc.save();
      await doc.populate("teacher", "name email role");
      res.status(201).json(doc);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

// List classes
router.get("/", auth, async (req, res) => {
  try {
    const { academicYear, grade, teacher, active } = req.query;
    const filter = {};
    if (academicYear) filter.academicYear = academicYear;
    if (grade) filter.grade = grade;
    if (teacher) filter.teacher = teacher;
    if (active === "true") filter.isActive = true;

    const classes = await ClassModel.find(filter)
      .populate("teacher", "name email role")
      .sort({ academicYear: -1, grade: 1, section: 1 });

    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get class by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const cls = await ClassModel.findById(req.params.id)
      .populate("teacher", "name email role")
      .populate("subjects", "name code");

    if (!cls) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json(cls);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Update class
router.put(
  "/:id",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      if (req.body.grade) {
        req.body.grade = normalizeGrade(req.body.grade);
      }

      if (req.body.grade && !ALLOWED_GRADES.includes(req.body.grade)) {
        return res.status(400).json({ message: "Invalid grade (must be Creche through JHS 3)" });
      }

      const updated = await ClassModel.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }).populate("teacher", "name email role");

      if (!updated) {
        return res.status(404).json({ message: "Class not found" });
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete class
router.delete(
  "/:id",
  auth,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const deleted = await ClassModel.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Class not found" });
      }
      res.json({ message: "Class deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
