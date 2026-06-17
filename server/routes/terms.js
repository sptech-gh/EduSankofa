const express = require("express");
const { body, validationResult } = require("express-validator");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

const validateTerm = [
  body("academicYear").isMongoId().withMessage("Valid academicYear ID is required"),
  body("name")
    .isIn(["First Term", "Second Term", "Third Term"])
    .withMessage("Term name must be First Term, Second Term, or Third Term"),
  body("order")
    .isIn([1, 2, 3])
    .withMessage("Term order must be 1, 2, or 3"),
  body("legacySemester")
    .isIn(["Fall", "Spring", "Summer"])
    .withMessage("Invalid legacy semester"),
  body("startDate").optional({ checkFalsy: true }).isISO8601().withMessage("Invalid startDate"),
  body("endDate").optional({ checkFalsy: true }).isISO8601().withMessage("Invalid endDate"),
];

router.get("/", auth, async (req, res) => {
  try {
    const { academicYear, active } = req.query;
    const filter = {};
    if (academicYear) filter.academicYear = academicYear;
    if (active === "true") filter.isActive = true;

    const terms = await Term.find(filter)
      .populate("academicYear", "name isActive")
      .sort({ "academicYear": -1, order: 1 });

    res.json(terms);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/active", auth, async (req, res) => {
  try {
    const year = await AcademicYear.findOne({ isActive: true });
    if (!year) {
      return res.status(404).json({ message: "No active academic year" });
    }

    const term = await Term.findOne({ academicYear: year._id, isActive: true });
    if (!term) {
      return res.status(404).json({ message: "No active term for active academic year" });
    }

    res.json({ academicYear: year, term });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  validateTerm,
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

      const year = await AcademicYear.findById(req.body.academicYear);
      if (!year) {
        return res.status(404).json({ message: "Academic year not found" });
      }

      const term = new Term({
        academicYear: year._id,
        name: req.body.name,
        order: req.body.order,
        legacySemester: req.body.legacySemester,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        isActive: !!req.body.isActive,
      });

      if (term.isActive) {
        await Term.updateMany(
          { academicYear: year._id, isActive: true },
          { $set: { isActive: false } }
        );
      }

      await term.save();
      await term.populate("academicYear", "name isActive");

      res.status(201).json(term);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Term already exists for this academic year" });
      }
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
      const term = await Term.findById(req.params.id);
      if (!term) {
        return res.status(404).json({ message: "Term not found" });
      }

      const update = {};
      if (req.body.startDate) update.startDate = new Date(req.body.startDate);
      if (req.body.endDate) update.endDate = new Date(req.body.endDate);
      if (req.body.isActive !== undefined) update.isActive = !!req.body.isActive;

      if (update.isActive) {
        await Term.updateMany(
          { academicYear: term.academicYear, isActive: true },
          { $set: { isActive: false } }
        );
      }

      const updated = await Term.findByIdAndUpdate(req.params.id, update, {
        new: true,
        runValidators: true,
      }).populate("academicYear", "name isActive");

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/:id/activate",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const term = await Term.findById(req.params.id);
      if (!term) {
        return res.status(404).json({ message: "Term not found" });
      }

      await Term.updateMany(
        { academicYear: term.academicYear, isActive: true },
        { $set: { isActive: false } }
      );

      term.isActive = true;
      await term.save();
      await term.populate("academicYear", "name isActive");

      res.json(term);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
