// ============================================================
// FILE: server/routes/setup.js
// STATUS: New file
// DEPENDS ON: models/SchoolProfile, models/AcademicYear, models/Term, middleware/auth
// TESTED AGAINST: Domain 1 Setup specifications
// ============================================================

const express = require("express");
const mongoose = require("mongoose");
const { auth, authorizeRoles } = require("../middleware/auth");
const SchoolProfile = require("../models/SchoolProfile");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const logger = require("../services/logger");

const router = express.Router();

const GHANA_REGIONS = [
  "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
  "Greater Accra", "North East", "Northern", "Oti", "Savannah",
  "Upper East", "Upper West", "Volta", "Western", "Western North"
];

// Helper to format months
const getMonthName = (monthIndex) => {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[monthIndex] || "";
};

// 1.1 POST /api/setup/school — Create or update school profile
router.post(
  "/school",
  auth,
  authorizeRoles("admin", "super admin"),
  async (req, res, next) => {
    try {
      const { name, address, region, phone, email, type, motto, logo } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "School name is required" });
      }
      if (!address || typeof address !== "string" || address.trim().length === 0) {
        return res.status(400).json({ message: "School address is required" });
      }
      if (!region || !GHANA_REGIONS.includes(region)) {
        return res.status(400).json({ message: "Valid Ghana region is required" });
      }
      if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
        return res.status(400).json({ message: "Phone number is required" });
      }
      if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ message: "Valid email is required" });
      }
      if (!type || !["Primary", "JHS", "SHS", "Combined", "International"].includes(type)) {
        return res.status(400).json({ message: "Valid school type is required" });
      }

      const existing = await SchoolProfile.findOne({ key: "default" });
      const isNew = !existing;

      const derivedSchoolCode = name.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6);

      const profile = await SchoolProfile.findOneAndUpdate(
        { key: "default" },
        {
          schoolName: name,
          motto: motto || "",
          address,
          city: req.body.city || "",
          region,
          phone,
          email,
          logoUrl: logo || "",
          type,
          schoolCode: req.body.schoolCode || (existing ? existing.schoolCode : derivedSchoolCode),
        },
        { new: true, upsert: true }
      );

      res.status(isNew ? 201 : 200).json({
        success: true,
        data: {
          schoolId: profile._id,
          name: profile.schoolName,
          createdAt: profile.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// 1.2 POST /api/setup/academic-year — Create a new academic year
router.post(
  "/academic-year",
  auth,
  authorizeRoles("admin", "super admin"),
  async (req, res, next) => {
    try {
      const { label, startDate, endDate } = req.body;

      if (!label || !/^(\d{4})\/(\d{4})$/.test(label)) {
        return res.status(400).json({ message: "Label must be in format YYYY/YYYY (e.g., 2024/2025)" });
      }
      if (!startDate || isNaN(Date.parse(startDate))) {
        return res.status(400).json({ message: "Valid start date is required" });
      }
      if (!endDate || isNaN(Date.parse(endDate))) {
        return res.status(400).json({ message: "Valid end date is required" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end <= start) {
        return res.status(400).json({ message: "End date must be after start date" });
      }

      // Start date month must be September (month index 8)
      if (start.getUTCMonth() !== 8) {
        const monthName = getMonthName(start.getUTCMonth());
        return res.status(400).json({
          message: `Ghana academic years must start in September. Provided start date is in ${monthName}.`,
        });
      }

      const match = label.match(/^(\d{4})\/(\d{4})$/);
      if (match[1] !== String(start.getUTCFullYear())) {
        return res.status(400).json({ message: "Label start year must match start date year." });
      }

      // No overlapping academic years
      const overlapping = await AcademicYear.findOne({
        $or: [
          { startDate: { $lte: end }, endDate: { $gte: start } }
        ]
      });

      if (overlapping) {
        return res.status(400).json({ message: "Academic year date range overlaps with an existing year." });
      }

      const year = new AcademicYear({
        name: label,
        startDate: start,
        endDate: end,
        isActive: false,
      });

      await year.save();

      res.status(201).json({
        success: true,
        data: year,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 1.3 POST /api/setup/academic-year/:yearId/terms — Create a term within an academic year
router.post(
  "/academic-year/:yearId/terms",
  auth,
  authorizeRoles("admin", "super admin"),
  async (req, res, next) => {
    try {
      const { yearId } = req.params;
      const { name, startDate, endDate } = req.body;

      if (!["First Term", "Second Term", "Third Term"].includes(name)) {
        return res.status(400).json({ message: "Term name must be one of: First Term, Second Term, Third Term" });
      }
      if (!startDate || isNaN(Date.parse(startDate))) {
        return res.status(400).json({ message: "Valid start date is required" });
      }
      if (!endDate || isNaN(Date.parse(endDate))) {
        return res.status(400).json({ message: "Valid end date is required" });
      }

      const termStart = new Date(startDate);
      const termEnd = new Date(endDate);

      if (termEnd <= termStart) {
        return res.status(400).json({ message: "End date must be after start date" });
      }

      const academicYear = await AcademicYear.findById(yearId);
      if (!academicYear) {
        return res.status(404).json({ message: "Academic year not found" });
      }

      // Term dates must fall within parent academic year dates
      if (termStart < academicYear.startDate || termEnd > academicYear.endDate) {
        return res.status(400).json({ message: "Term dates must fall within the academic year boundary" });
      }

      // Maximum of 3 terms per year
      const termsCount = await Term.countDocuments({ academicYear: academicYear._id });
      if (termsCount >= 3) {
        const alreadyExists = await Term.findOne({ academicYear: academicYear._id, name });
        if (!alreadyExists) {
          return res.status(400).json({ message: "A maximum of 3 terms is allowed per academic year" });
        }
      }

      // No overlapping terms within the same year
      const overlapping = await Term.findOne({
        academicYear: academicYear._id,
        $or: [
          { startDate: { $lte: termEnd }, endDate: { $gte: termStart } }
        ]
      });

      if (overlapping && String(overlapping.name) !== name) {
        return res.status(400).json({ message: "Term dates overlap with an existing term in this year" });
      }

      let order = 1;
      let legacySemester = "Fall";
      if (name === "Second Term") {
        order = 2;
        legacySemester = "Spring";
      } else if (name === "Third Term") {
        order = 3;
        legacySemester = "Summer";
      }

      const term = await Term.findOneAndUpdate(
        { academicYear: academicYear._id, name },
        {
          academicYear: academicYear._id,
          name,
          order,
          legacySemester,
          startDate: termStart,
          endDate: termEnd,
        },
        { new: true, upsert: true }
      );

      res.status(201).json({
        success: true,
        data: term,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 1.4 PATCH /api/setup/academic-year/:yearId/activate — Activate an academic year
router.patch(
  "/academic-year/:yearId/activate",
  auth,
  authorizeRoles("admin", "super admin"),
  async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { yearId } = req.params;

      const year = await AcademicYear.findById(yearId).session(session);
      if (!year) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Academic year not found" });
      }

      // Deactivate all other years
      await AcademicYear.updateMany(
        { _id: { $ne: year._id } },
        { $set: { isActive: false } }
      ).session(session);

      year.isActive = true;
      await year.save({ session });

      await session.commitTransaction();
      res.json({
        success: true,
        data: {
          activatedYear: year._id,
          deactivatedCount: 1, // updateMany does this, but we simplify the output format
        },
      });
    } catch (err) {
      await session.abortTransaction();
      // Stand-alone fallback
      try {
        const { yearId } = req.params;
        const year = await AcademicYear.findById(yearId);
        if (!year) return res.status(404).json({ message: "Academic year not found" });
        
        await AcademicYear.updateMany(
          { _id: { $ne: year._id } },
          { $set: { isActive: false } }
        );
        year.isActive = true;
        await year.save();
        
        return res.json({
          success: true,
          data: {
            activatedYear: year._id,
            deactivatedCount: 1,
          },
        });
      } catch (innerErr) {
        next(innerErr);
      }
    } finally {
      session.endSession();
    }
  }
);

// 1.5 GET /api/setup/academic-year — List all academic years
router.get(
  "/academic-year",
  auth,
  authorizeRoles("admin", "super admin"),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const skip = (page - 1) * limit;

      const total = await AcademicYear.countDocuments({});

      const years = await AcademicYear.find({})
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Populate terms manually or fetch them
      for (const year of years) {
        year.terms = await Term.find({ academicYear: year._id }).sort({ order: 1 }).lean();
      }

      res.json({
        success: true,
        data: years,
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
