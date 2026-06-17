const express = require("express");
const { body, validationResult } = require("express-validator");
const SchoolConfig = require("../models/SchoolConfig");
const GradingSystem = require("../models/GradingSystem");
const GhanaClass = require("../models/GhanaClass");
const GhanaSubject = require("../models/GhanaSubject");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// ============= SCHOOL CONFIGURATION ROUTES =============

// Get school configuration
router.get("/config", auth, async (req, res) => {
  try {
    const config = await SchoolConfig.findOne({ isActive: true })
      .populate("currentAcademicYear")
      .populate("currentTerm")
      .populate("gradingSystem");
    
    if (!config) {
      return res.status(404).json({ message: "School configuration not found" });
    }
    
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Create/update school configuration
router.post(
  "/config",
  auth,
  authorizeRoles("admin", "super_admin"),
  [
    body("schoolName").trim().notEmpty().withMessage("School name is required"),
    body("schoolCode").trim().notEmpty().withMessage("School code is required"),
    body("address.city").trim().notEmpty().withMessage("City is required"),
    body("address.region").trim().notEmpty().withMessage("Region is required"),
    body("contact.phone").trim().notEmpty().withMessage("Phone number is required"),
    body("contact.email").isEmail().withMessage("Valid email is required"),
    body("establishment").isISO8601().withMessage("Valid establishment date is required"),
    body("schoolType").isIn(["Public", "Private", "International"]).withMessage("Invalid school type"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const config = await SchoolConfig.findOneAndUpdate(
        { isActive: true },
        { ...req.body, isActive: true },
        { new: true, upsert: true }
      );

      res.json(config);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= GRADING SYSTEM ROUTES =============

// Get all grading systems
router.get("/grading-systems", auth, async (req, res) => {
  try {
    const systems = await GradingSystem.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(systems);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Create Ghanaian standard grading system
router.post(
  "/grading-systems/ghanaian",
  auth,
  authorizeRoles("admin", "super_admin"),
  async (req, res) => {
    try {
      // Check if Ghanaian system already exists
      const existing = await GradingSystem.findOne({ systemType: "Ghana Basic" });
      if (existing) {
        return res.status(400).json({ message: "Ghanaian grading system already exists" });
      }

      const ghanaianGrades = [
        { scoreRange: { min: 80, max: 100 }, grade: "A", interpretation: "Excellent", remarks: "Outstanding Performance", gpaPoints: 4.0 },
        { scoreRange: { min: 75, max: 79 }, grade: "B2", interpretation: "Very Good", remarks: "Very Good Performance", gpaPoints: 3.5 },
        { scoreRange: { min: 70, max: 74 }, grade: "B3", interpretation: "Good", remarks: "Good Performance", gpaPoints: 3.0 },
        { scoreRange: { min: 65, max: 69 }, grade: "C4", interpretation: "Credit", remarks: "Credit Performance", gpaPoints: 2.5 },
        { scoreRange: { min: 60, max: 64 }, grade: "C5", interpretation: "Credit", remarks: "Credit Performance", gpaPoints: 2.0 },
        { scoreRange: { min: 55, max: 59 }, grade: "C6", interpretation: "Credit", remarks: "Credit Performance", gpaPoints: 1.5 },
        { scoreRange: { min: 50, max: 54 }, grade: "D7", interpretation: "Pass", remarks: "Pass Performance", gpaPoints: 1.0 },
        { scoreRange: { min: 45, max: 49 }, grade: "E8", interpretation: "Weak Pass", remarks: "Weak Performance", gpaPoints: 0.5 },
        { scoreRange: { min: 0, max: 44 }, grade: "F9", interpretation: "Fail", remarks: "Poor Performance", gpaPoints: 0.0 },
      ];

      const gradingSystem = new GradingSystem({
        name: "Ghanaian Basic Education Grading System",
        description: "Standard WAEC grading system for Ghanaian basic schools",
        systemType: "Ghana Basic",
        passingScore: 50,
        maxScore: 100,
        gradeBands: ghanaianGrades,
        assessmentWeights: {
          classAssessment: 30,
          homework: 10,
          tests: 20,
          exams: 40,
        },
        isDefault: true,
      });

      await gradingSystem.save();
      res.status(201).json(gradingSystem);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= CLASS STRUCTURE ROUTES =============

// Get all Ghanaian class levels
router.get("/class-levels", auth, (req, res) => {
  try {
    const levels = GhanaClass.getGhanaianLevels();
    res.json(levels);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Create classes for all Ghanaian levels
router.post(
  "/classes/create-all",
  auth,
  authorizeRoles("admin", "super_admin"),
  [
    body("academicYear").notEmpty().withMessage("Academic year is required"),
    body("term").notEmpty().withMessage("Term is required"),
    body("sections").isArray().withMessage("Sections must be an array"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { academicYear, term, sections = ["A"], capacity = 30 } = req.body;
      
      // Verify academic year and term exist
      const yearExists = await AcademicYear.findById(academicYear);
      const termExists = await Term.findById(term);
      
      if (!yearExists || !termExists) {
        return res.status(400).json({ message: "Invalid academic year or term" });
      }

      const levels = GhanaClass.getGhanaianLevels();
      const classes = [];

      for (const level of levels) {
        for (const section of sections) {
          const classData = {
            name: `${level.name} ${section}`,
            level: level.name,
            section: section,
            capacity: capacity,
            academicYear: academicYear,
            term: term,
          };

          const newClass = new GhanaClass(classData);
          classes.push(newClass);
        }
      }

      const savedClasses = await GhanaClass.insertMany(classes);
      res.status(201).json(savedClasses);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get classes by academic year and term
router.get("/classes", auth, async (req, res) => {
  try {
    const { academicYear, term, level } = req.query;
    const filter = { isActive: true };
    
    if (academicYear) filter.academicYear = academicYear;
    if (term) filter.term = term;
    if (level) filter.level = level;

    const classes = await GhanaClass.find(filter)
      .populate("classTeacher", "firstName lastName email")
      .populate("academicYear", "name")
      .populate("term", "name")
      .sort({ "metadata.order": 1, section: 1 });

    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Create single class
router.post(
  "/classes",
  auth,
  authorizeRoles("admin", "super_admin"),
  [
    body("name").trim().notEmpty().withMessage("Class name is required"),
    body("level").isIn(Object.keys(GhanaClass.getGhanaianLevels().reduce((acc, level) => ({...acc, [level.name]: true}), {}))).withMessage("Invalid class level"),
    body("section").isIn(["A", "B", "C", "D", "E", "F"]).withMessage("Invalid section"),
    body("academicYear").notEmpty().withMessage("Academic year is required"),
    body("term").notEmpty().withMessage("Term is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const newClass = new GhanaClass(req.body);
      await newClass.save();
      
      const populatedClass = await GhanaClass.findById(newClass._id)
        .populate("classTeacher", "firstName lastName email")
        .populate("academicYear", "name")
        .populate("term", "name");

      res.status(201).json(populatedClass);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Class already exists for this level and section" });
      }
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= SUBJECT ROUTES =============

// Get Ghanaian curriculum structure
router.get("/subjects/curriculum", auth, (req, res) => {
  try {
    const curriculum = GhanaSubject.getGhanaianCurriculum();
    res.json(curriculum);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Create subjects for all levels
router.post(
  "/subjects/create-all",
  auth,
  authorizeRoles("admin", "super_admin"),
  [
    body("academicYear").notEmpty().withMessage("Academic year is required"),
    body("term").notEmpty().withMessage("Term is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { academicYear, term } = req.body;
      
      // Verify academic year and term exist
      const yearExists = await AcademicYear.findById(academicYear);
      const termExists = await Term.findById(term);
      
      if (!yearExists || !termExists) {
        return res.status(400).json({ message: "Invalid academic year or term" });
      }

      const levels = GhanaClass.getGhanaianLevels();
      const allSubjects = [];

      for (const level of levels) {
        try {
          const levelSubjects = await GhanaSubject.createSubjectsForLevel(level.name, academicYear, term);
          allSubjects.push(...levelSubjects);
        } catch (err) {
          // Continue even if one level fails
          console.warn(`Failed to create subjects for ${level.name}:`, err.message);
        }
      }

      res.status(201).json({
        message: "Subjects created successfully",
        subjects: allSubjects,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get subjects by academic year and term
router.get("/subjects", auth, async (req, res) => {
  try {
    const { academicYear, term, level, category } = req.query;
    const filter = { isActive: true };
    
    if (academicYear) filter.academicYear = academicYear;
    if (term) filter.term = term;
    if (level) filter.levels = level;
    if (category) filter.category = category;

    const subjects = await GhanaSubject.find(filter)
      .populate("academicYear", "name")
      .populate("term", "name")
      .populate("teachers", "firstName lastName email")
      .sort({ category: 1, name: 1 });

    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
