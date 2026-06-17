const express = require("express");
const { body, validationResult } = require("express-validator");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

const validateAcademicYear = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Academic year name is required")
    .custom((value) => {
      const raw = String(value).trim();
      const match = raw.match(/^(\d{4})\/(\d{4})$/);
      if (!match) {
        throw new Error("Academic year must be in format YYYY/YYYY (e.g., 2025/2026)");
      }
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      if (end !== start + 1) {
        throw new Error("Academic year end must be start year + 1");
      }
      return true;
    }),
  body("startDate").optional({ checkFalsy: true }).isISO8601().withMessage("Invalid startDate"),
  body("endDate").optional({ checkFalsy: true }).isISO8601().withMessage("Invalid endDate"),
];

const TERM_DEFS = [
  { name: "First Term", order: 1, legacySemester: "Fall" },
  { name: "Second Term", order: 2, legacySemester: "Spring" },
  { name: "Third Term", order: 3, legacySemester: "Summer" },
];

// List academic years
router.get("/", auth, async (req, res) => {
  try {
    const years = await AcademicYear.find({}).sort({ createdAt: -1 });
    res.json(years);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get active academic year
router.get("/active", auth, async (req, res) => {
  try {
    const year = await AcademicYear.findOne({ isActive: true });
    if (!year) {
      return res.status(404).json({ message: "No active academic year" });
    }
    res.json(year);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Create academic year
router.post(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  validateAcademicYear,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMsg = errors.array().map((e) => e.msg).join(", ");
        return res.status(400).json({
          message: errorMsg,
          errors: errors.array(),
          code: "VALIDATION_ERROR",
        });
      }

      const payload = {
        name: req.body.name,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        isActive: !!req.body.isActive,
      };

      if (payload.isActive) {
        await AcademicYear.updateMany(
          { isActive: true },
          { $set: { isActive: false } }
        );
      }

      const year = new AcademicYear(payload);
      await year.save();
      res.status(201).json(year);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Academic year already exists" });
      }
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Update academic year
router.put(
  "/:id",
  auth,
  authorizeRoles("admin", "staff"),
  validateAcademicYear,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMsg = errors.array().map((e) => e.msg).join(", ");
        return res.status(400).json({
          message: errorMsg,
          errors: errors.array(),
          code: "VALIDATION_ERROR",
        });
      }

      const update = {
        name: req.body.name,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      };

      const year = await AcademicYear.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      });

      if (!year) {
        return res.status(404).json({ message: "Academic year not found" });
      }

      res.json(year);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Academic year already exists" });
      }
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Activate an academic year (only one active at a time)
router.post(
  "/:id/activate",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const year = await AcademicYear.findById(req.params.id);
      if (!year) {
        return res.status(404).json({ message: "Academic year not found" });
      }

      await AcademicYear.updateMany({ isActive: true }, { $set: { isActive: false } });
      year.isActive = true;
      await year.save();

      res.json(year);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Seed First/Second/Third terms for an academic year
router.post(
  "/:id/seed-terms",
  auth,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const year = await AcademicYear.findById(req.params.id);
      if (!year) return res.status(404).json({ message: "Academic year not found" });

      const existing = await Term.find({ academicYear: year._id });
      if (existing.length) {
        return res.status(400).json({ message: "Terms already exist for this year" });
      }

      const terms = await Term.insertMany(
        TERM_DEFS.map((t) => ({
          academicYear: year._id,
          name: t.name,
          order: t.order,
          legacySemester: t.legacySemester,
          isActive: t.order === 1,
        }))
      );

      return res.json({ terms });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Duplicate term detected" });
      }
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
