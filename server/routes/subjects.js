const express = require("express");
const { body, validationResult } = require("express-validator");
const Subject = require("../models/Subject");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const GhanaClass = require("../models/GhanaClass");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

const normalizeSemesterToLegacy = (value) => {
  if (!value) return value;
  if (["Fall", "Spring", "Summer"].includes(value)) return value;
  if (value === "First") return "Fall";
  if (value === "First Term") return "Fall";
  if (value === "Second") return "Spring";
  if (value === "Second Term") return "Spring";
  if (value === "Third") return "Summer";
  if (value === "Third Term") return "Summer";
  return null;
};

// Validation middleware
const validateSubject = [
  body("name").trim().notEmpty().withMessage("Subject name is required"),
  body("code").trim().notEmpty().withMessage("Subject code is required"),
  body("credits").isNumeric().withMessage("Credits must be a number"),
  body("teacher").isMongoId().withMessage("Valid teacher ID is required"),
  body("academicYearId").optional().isMongoId(),
  body("termId").optional().isMongoId(),
  body("academicYear")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Academic year is required"),
  body("semester")
    .optional()
    .custom((value) => {
      const normalized = normalizeSemesterToLegacy(value);
      if (!normalized) {
        throw new Error("Invalid semester");
      }
      return true;
    }),
  body().custom((payload) => {
    if (payload.termId) return true;
    if (payload.semester && (payload.academicYear || payload.academicYearId)) return true;
    throw new Error(
      "Provide either termId OR (semester AND (academicYear OR academicYearId))"
    );
  }),
];

// Create a new subject
router.post(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  validateSubject,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (req.body.termId) {
        const term = await Term.findById(req.body.termId).populate(
          "academicYear",
          "name"
        );
        if (!term) {
          return res.status(404).json({ message: "Term not found" });
        }
        req.body.termId = term._id;
        req.body.academicYearId = term.academicYear._id;
        req.body.semester = term.legacySemester;
        req.body.academicYear = term.academicYear.name;
      } else {
        const legacy = normalizeSemesterToLegacy(req.body.semester);
        if (!legacy) {
          return res.status(400).json({ message: "Invalid semester" });
        }
        req.body.semester = legacy;
        if (req.body.academicYearId && !req.body.academicYear) {
          const year = await AcademicYear.findById(req.body.academicYearId);
          if (!year) {
            return res.status(404).json({ message: "Academic year not found" });
          }
          req.body.academicYear = year.name;
        }
      }

      if (req.body.classLevels) {
        if (!Array.isArray(req.body.classLevels)) {
          return res.status(400).json({ message: "classLevels must be an array of strings" });
        }
        const validLevels = GhanaClass.getGhanaianLevels().map(l => l.name);
        for (const lvl of req.body.classLevels) {
          if (!validLevels.includes(lvl)) {
            return res.status(400).json({ message: `Invalid class level: ${lvl}` });
          }
        }
      }

      const coreNames = ["English Language", "Mathematics", "Integrated Science", "Social Studies"];
      if (
        req.body.category === "Core" || 
        (req.body.name && coreNames.some(name => name.toLowerCase() === req.body.name.toLowerCase()))
      ) {
        req.body.isCompulsory = true;
      }

      // Uniqueness check for code
      const duplicateCode = await Subject.findOne({ code: req.body.code });
      if (duplicateCode) {
        return res.status(400).json({ message: "Subject code already exists" });
      }

      // Uniqueness check for name + academicYearId + termId
      if (req.body.academicYearId && req.body.termId) {
        const duplicateName = await Subject.findOne({
          name: req.body.name,
          academicYearId: req.body.academicYearId,
          termId: req.body.termId
        });
        if (duplicateName) {
          return res.status(400).json({ message: "Subject name already exists in this academic year and term" });
        }
      }

      const subject = new Subject(req.body);
      await subject.save();
      await subject.populate("teacher", "name email");
      res.status(201).json(subject);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Subject code already exists" });
      }
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get all subjects
router.get("/", auth, async (req, res) => {
  try {
    const { academicYear, academicYearId, termId, semester, teacher, status } =
      req.query;
    const filter = {};

    if (academicYear) filter.academicYear = academicYear;
    if (academicYearId) filter.academicYearId = academicYearId;
    if (termId) filter.termId = termId;
    if (semester) {
      const legacy = normalizeSemesterToLegacy(semester);
      if (!legacy) {
        return res.status(400).json({ message: "Invalid semester" });
      }
      filter.semester = legacy;
    }
    if (teacher) filter.teacher = teacher;
    if (status) filter.status = status;

    const subjects = await Subject.find(filter)
      .populate("teacher", "name email")
      .sort({ academicYear: -1, semester: 1, name: 1 });

    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get subject by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate(
      "teacher",
      "name email"
    );
    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }
    res.json(subject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update subject
router.put(
  "/:id",
  auth,
  authorizeRoles("admin", "staff"),
  validateSubject,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (req.body.termId) {
        const term = await Term.findById(req.body.termId).populate(
          "academicYear",
          "name"
        );
        if (!term) {
          return res.status(404).json({ message: "Term not found" });
        }
        req.body.termId = term._id;
        req.body.academicYearId = term.academicYear._id;
        req.body.semester = term.legacySemester;
        req.body.academicYear = term.academicYear.name;
      } else {
        const legacy = normalizeSemesterToLegacy(req.body.semester);
        if (!legacy) {
          return res.status(400).json({ message: "Invalid semester" });
        }
        req.body.semester = legacy;
        if (req.body.academicYearId && !req.body.academicYear) {
          const year = await AcademicYear.findById(req.body.academicYearId);
          if (!year) {
            return res.status(404).json({ message: "Academic year not found" });
          }
          req.body.academicYear = year.name;
        }
      }

      const existingSubject = await Subject.findById(req.params.id);
      if (!existingSubject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      if (req.body.classLevels) {
        if (!Array.isArray(req.body.classLevels)) {
          return res.status(400).json({ message: "classLevels must be an array of strings" });
        }
        const validLevels = GhanaClass.getGhanaianLevels().map(l => l.name);
        for (const lvl of req.body.classLevels) {
          if (!validLevels.includes(lvl)) {
            return res.status(400).json({ message: `Invalid class level: ${lvl}` });
          }
        }
      }

      const name = req.body.name || existingSubject.name;
      const code = req.body.code || existingSubject.code;
      const category = req.body.category || existingSubject.category;
      const academicYearId = req.body.academicYearId || existingSubject.academicYearId;
      const termId = req.body.termId || existingSubject.termId;

      const coreNames = ["English Language", "Mathematics", "Integrated Science", "Social Studies"];
      if (
        category === "Core" || 
        (name && coreNames.some(cn => cn.toLowerCase() === name.toLowerCase()))
      ) {
        req.body.isCompulsory = true;
      }

      // Uniqueness checks
      if (req.body.code) {
        const duplicateCode = await Subject.findOne({ code, _id: { $ne: req.params.id } });
        if (duplicateCode) {
          return res.status(400).json({ message: "Subject code already exists" });
        }
      }

      if (name && academicYearId && termId) {
        const duplicateName = await Subject.findOne({
          name,
          academicYearId,
          termId,
          _id: { $ne: req.params.id }
        });
        if (duplicateName) {
          return res.status(400).json({ message: "Subject name already exists in this academic year and term" });
        }
      }

      const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }).populate("teacher", "name email");

      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      res.json(subject);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Subject code already exists" });
      }
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete subject
router.delete("/:id", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }
    res.json({ message: "Subject deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get subjects by teacher
router.get("/teacher/:teacherId", auth, async (req, res) => {
  try {
    const subjects = await Subject.find({ teacher: req.params.teacherId })
      .populate("teacher", "name email")
      .sort({ academicYear: -1, semester: 1, name: 1 });

    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
