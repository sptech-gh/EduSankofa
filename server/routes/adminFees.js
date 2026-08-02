const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const { auth, authorizeRoles } = require("../middleware/auth");
const FeeComponent = require("../models/FeeComponent");
const ClassFeeSchedule = require("../models/ClassFeeSchedule");
const SchoolProfile = require("../models/SchoolProfile");
const { generateBillsForClass } = require("../utils/billingHelper");
const { generateScheduleRef } = require("../utils/currency");

// Helper to fetch/ensure school ID for the tenant context
async function getSchoolId() {
  // 1. Prefer tenant context from authenticated user (AsyncLocalStorage)
  const { getTenantSchoolId } = require("../middleware/tenantContext");
  const tenantSchoolId = getTenantSchoolId();
  if (tenantSchoolId) return tenantSchoolId;

  // 2. Fallback: default profile (single-school databases)
  const profile = await SchoolProfile.findOne({ key: "default" });
  if (profile) return profile._id;

  // 3. Hard fail — never use a hardcoded ObjectId
  throw new Error("School not configured");
}

// 1. Fee Component Routes

// @route   POST /api/admin/fees/components
// @desc    Create a new fee component
router.post(
  "/components",
  [
    auth,
    authorizeRoles("school admin", "admin"),
    [
      body("name", "Name is required (max 100 chars)").isString().notEmpty().isLength({ max: 100 }),
      body("code", "Code is required").isString().notEmpty(),
      body("category", "Valid Category enum required").isIn([
        "TUITION", "ADMISSION", "REGISTRATION", "PTA_LEVY", "ICT",
        "EXAMINATION", "BECE_REGISTRATION", "WASSCE_REGISTRATION",
        "TRANSPORT", "FEEDING", "BOARDING", "LIBRARY", "UNIFORM",
        "FRIDAY_WEAR", "LACOAST", "BOOKS_STATIONERY", "GRADUATION",
        "VACATION_CLASSES", "EXTRA_CLASSES", "SPORTS_LEVY", "SPORTS",
        "MUSIC_ARTS", "MEDICAL", "EXCURSION", "AFTERCARE",
        "DEVELOPMENT_LEVY", "CAUTION_DEPOSIT", "MISCELLANEOUS", "CUSTOM",
        "EXTRACURRICULAR", "OTHER"
      ]),
      body("billingCycle", "Valid Billing Cycle enum required").isIn([
        "PER_TERM", "PER_YEAR", "ONE_TIME", "DAILY", "MONTHLY"
      ]),
    ],
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const schoolId = await getSchoolId();
      const {
        name,
        code,
        category,
        description,
        applicableClasses,
        billingCycle,
        isOptional,
        isRefundable,
        isBoardingOnly,
        isDayStudentOnly,
        requiresClassSpecificAmount,
      } = req.body;

      // Check unique code per school
      const existing = await FeeComponent.findOne({ schoolId, code });
      if (existing) {
        return res.status(400).json({ message: `Fee Component with code '${code}' already exists.` });
      }

      const component = new FeeComponent({
        schoolId,
        name,
        code,
        category,
        description,
        applicableClasses: applicableClasses || [],
        billingCycle,
        isOptional: !!isOptional,
        isRefundable: !!isRefundable,
        isBoardingOnly: !!isBoardingOnly,
        isDayStudentOnly: !!isDayStudentOnly,
        requiresClassSpecificAmount: requiresClassSpecificAmount !== false,
        createdBy: req.user._id,
      });

      await component.save();
      res.status(201).json(component);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/admin/fees/components
// @desc    List all components for school
router.get(
  "/components",
  auth,
  authorizeRoles("school admin", "admin"),
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const filter = { schoolId };
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === "true";
      }
      if (req.query.category) filter.category = req.query.category;
      if (req.query.class) {
        filter.$or = [
          { applicableClasses: { $size: 0 } },
          { applicableClasses: req.query.class },
        ];
      }

      const components = await FeeComponent.find(filter).sort({ name: 1 });
      res.json({ data: components, total: components.length });
    } catch (err) {
      next(err);
    }
  }
);

// @route   PATCH /api/admin/fees/components/:id
// @desc    Update a component
router.patch(
  "/components/:id",
  [
    auth,
    authorizeRoles("school admin", "admin"),
    [
      body("name", "Name cannot exceed 100 chars").optional().isLength({ max: 100 }),
      body("category", "Valid Category enum required").optional().isIn([
        "TUITION", "ADMISSION", "REGISTRATION", "PTA_LEVY", "ICT",
        "EXAMINATION", "BECE_REGISTRATION", "WASSCE_REGISTRATION",
        "TRANSPORT", "FEEDING", "BOARDING", "LIBRARY", "UNIFORM",
        "FRIDAY_WEAR", "LACOAST", "BOOKS_STATIONERY", "GRADUATION",
        "VACATION_CLASSES", "EXTRA_CLASSES", "SPORTS_LEVY", "SPORTS",
        "MUSIC_ARTS", "MEDICAL", "EXCURSION", "AFTERCARE",
        "DEVELOPMENT_LEVY", "CAUTION_DEPOSIT", "MISCELLANEOUS", "CUSTOM",
        "EXTRACURRICULAR", "OTHER"
      ]),
    ],
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const schoolId = await getSchoolId();
      const component = await FeeComponent.findOne({ _id: req.params.id, schoolId });
      if (!component) {
        return res.status(404).json({ message: "Fee Component not found" });
      }

      const updates = req.body;
      if (updates.code !== undefined || updates.category !== undefined) {
        return res.status(400).json({ message: "Fee component code and category are immutable after creation" });
      }
      const allowed = [
        "name",
        "description",
        "applicableClasses",
        "billingCycle",
        "isOptional",
        "isRefundable",
        "isBoardingOnly",
        "isDayStudentOnly",
        "isActive",
      ];
      allowed.forEach((key) => {
        if (updates[key] !== undefined) component[key] = updates[key];
      });
      component.updatedBy = req.user._id;

      await component.save();
      res.json(component);
    } catch (err) {
      next(err);
    }
  }
);

// @route   DELETE /api/admin/fees/components/:id
// @desc    Soft-delete a component
router.delete(
  "/components/:id",
  auth,
  authorizeRoles("school admin", "admin"),
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const component = await FeeComponent.findOne({ _id: req.params.id, schoolId });
      if (!component) {
        return res.status(404).json({ message: "Fee Component not found" });
      }

      const publishedSchedules = await ClassFeeSchedule.find({
        schoolId,
        $or: [{ isPublished: true }, { status: "PUBLISHED" }],
        "fees.feeComponentId": component._id,
      }).select("scheduleRef academicYear term classCode studentType");

      if (publishedSchedules.length > 0) {
        return res.status(409).json({
          message: "Cannot deactivate a component used in published schedules",
          schedules: publishedSchedules,
        });
      }

      component.isActive = false;
      await component.save();
      res.json({ message: "Fee component soft-deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// 2. Class Fee Schedule Routes

// @route   POST /api/admin/fees/schedules
// @desc    Create or replace a class fee schedule
router.post(
  "/schedules",
  [
    auth,
    authorizeRoles("school admin", "admin"),
    [
      body("academicYear", "Academic Year (YYYY/YYYY) required").matches(/^\d{4}\/\d{4}$/),
      body("term", "Term must be 1, 2, or 3").isIn([1, 2, 3]),
      body("classCode", "Class level code is required").isString().notEmpty(),
      body("fees", "Fees array is required").isArray(),
    ],
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const schoolId = await getSchoolId();
      const { academicYear, term, classCode } = req.body;
      const fees = req.body.fees || req.body.lineItems || [];

      const snapshotFees = [];
      for (const fee of fees) {
        const comp = await FeeComponent.findOne({ _id: fee.feeComponentId, schoolId });
        if (!comp) {
          return res.status(400).json({ message: `Invalid Fee Component ID: ${fee.feeComponentId}` });
        }

        const amountPesewas = Number(fee.amountPesewas ?? fee.amount ?? 0);
        snapshotFees.push({
          feeComponentId: comp._id,
          feeComponentName: comp.name,
          feeComponentCode: comp.code,
          category: comp.category,
          billingCycle: comp.billingCycle,
          amountPesewas,
          originalAmountPesewas: Number(fee.originalAmountPesewas ?? amountPesewas),
          discountAmountPesewas: Number(fee.discountAmountPesewas ?? 0),
          dueDate: fee.dueDate,
          notes: fee.notes || "",
          isOptional: !!comp.isOptional,
        });
      }

      // Upsert class schedule with immutable snapshots
      const query = { schoolId, academicYear, term, classCode, studentType: req.body.studentType || "ALL" };
      const update = {
        fees: snapshotFees,
        isPublished: false,
        status: "DRAFT",
        studentType: req.body.studentType || "ALL",
        createdBy: req.user._id,
        updatedBy: req.user._id,
        totalScheduledPesewas: snapshotFees.reduce((sum, fee) => sum + Number(fee.amountPesewas || 0), 0),
      };

      const schedule = await ClassFeeSchedule.findOneAndUpdate(query, update, {
        new: true,
        upsert: true,
        runValidators: true,
      });

      res.status(201).json(schedule);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/admin/fees/schedules
// @desc    List all schedules matching filters
router.get(
  "/schedules",
  auth,
  authorizeRoles("school admin", "admin"),
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const query = { schoolId };

      if (req.query.academicYear) query.academicYear = req.query.academicYear;
      if (req.query.term) query.term = parseInt(req.query.term, 10);
      if (req.query.classCode) query.classCode = req.query.classCode;
      if (req.query.status) query.status = req.query.status;

      const schedules = await ClassFeeSchedule.find(query)
        .populate("fees.feeComponentId")
        .sort({ classCode: 1 });
      res.json(schedules);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/admin/fees/schedules/:id
// @desc    Get full details for a schedule
router.get(
  "/schedules/:id",
  auth,
  authorizeRoles("school admin", "admin"),
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const schedule = await ClassFeeSchedule.findOne({ _id: req.params.id, schoolId })
        .populate("fees.feeComponentId");

      if (!schedule) {
        return res.status(404).json({ message: "Class Fee Schedule not found" });
      }

      res.json(schedule);
    } catch (err) {
      next(err);
    }
  }
);

// @route   PATCH /api/admin/fees/schedules/:id
// @desc    Update fee entries in a schedule
router.patch(
  "/schedules/:id",
  auth,
  authorizeRoles("school admin", "admin"),
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const schedule = await ClassFeeSchedule.findOne({ _id: req.params.id, schoolId });
      if (!schedule) {
        return res.status(404).json({ message: "Class Fee Schedule not found" });
      }

      if (schedule.isPublished || schedule.status === "PUBLISHED") {
        return res.status(409).json({ message: "Published schedules cannot be edited" });
      }

      // Allow editing core fields on drafts
      if (req.body.academicYear) schedule.academicYear = req.body.academicYear;
      if (req.body.term !== undefined) schedule.term = Number(req.body.term);
      if (req.body.classCode) schedule.classCode = req.body.classCode;

      const incomingFees = req.body.fees || req.body.lineItems;
      if (incomingFees) {
        // Apply schedule-level due date to fees if provided
        const dueDate = req.body.dueDate;
        // Validate component existence
        const snapshotFees = [];
        for (const fee of incomingFees) {
          const comp = await FeeComponent.findOne({ _id: fee.feeComponentId, schoolId });
          if (!comp) {
            return res.status(400).json({ message: `Invalid Fee Component ID: ${fee.feeComponentId}` });
          }
          const amountPesewas = Number(fee.amountPesewas ?? 0);
          if (!Number.isInteger(amountPesewas) || amountPesewas < 0) {
            return res.status(400).json({ message: "amountPesewas must be a non-negative integer" });
          }
          snapshotFees.push({
            feeComponentId: comp._id,
            feeComponentName: comp.name,
            feeComponentCode: comp.code,
            category: comp.category,
            billingCycle: comp.billingCycle,
            amountPesewas,
            originalAmountPesewas: Number(fee.originalAmountPesewas ?? amountPesewas),
            discountAmountPesewas: Number(fee.discountAmountPesewas ?? 0),
            dueDate: fee.dueDate || dueDate,
            notes: fee.notes || "",
            isOptional: !!comp.isOptional,
          });
        }
        schedule.fees = snapshotFees;
      } else if (req.body.dueDate) {
        // Apply a new due date to all existing fees
        schedule.fees = schedule.fees.map(f => ({ ...f, dueDate: req.body.dueDate }));
      }
      if (req.body.studentType) schedule.studentType = req.body.studentType;
      schedule.updatedBy = req.user._id;
      schedule.totalScheduledPesewas = schedule.fees.reduce((sum, fee) => sum + Number(fee.amountPesewas || 0), 0);

      await schedule.save();
      res.json(schedule);
    } catch (err) {
      next(err);
    }
  }
);

// @route   DELETE /api/admin/fees/schedules/:id
// @desc    Delete a draft schedule (published schedules cannot be deleted)
router.delete(
  "/schedules/:id",
  auth,
  authorizeRoles("school admin", "admin"),
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const schedule = await ClassFeeSchedule.findOne({ _id: req.params.id, schoolId });
      if (!schedule) {
        return res.status(404).json({ message: "Class Fee Schedule not found" });
      }

      if (schedule.isPublished || schedule.status === "PUBLISHED") {
        return res.status(409).json({ message: "Published schedules cannot be deleted. Archive it instead." });
      }

      await ClassFeeSchedule.deleteOne({ _id: schedule._id, schoolId });
      res.json({ message: "Class Fee Schedule deleted." });
    } catch (err) {
      next(err);
    }
  }
);

// @route   POST /api/admin/fees/schedules/:id/publish
// @desc    Publish a schedule and trigger student bill generation
router.post(
  "/schedules/:id/publish",
  auth,
  authorizeRoles("school admin", "admin"),
  async (req, res, next) => {
    const isTest = process.env.NODE_ENV === "test";
    const session = isTest ? null : await mongoose.startSession();

    try {
      const schoolId = await getSchoolId();
      const schedule = await ClassFeeSchedule.findOne({ _id: req.params.id, schoolId }).session(session);
      if (!schedule) {
        return res.status(404).json({ message: "Class Fee Schedule not found" });
      }

      const publishWork = async () => {
        if (!schedule.fees || schedule.fees.length === 0) {
          throw Object.assign(new Error("Cannot publish an empty fee schedule"), { statusCode: 400 });
        }

        const activeCount = await FeeComponent.countDocuments({
          schoolId,
          _id: { $in: schedule.fees.map((fee) => fee.feeComponentId) },
          isActive: true,
        }).session(session);
        if (activeCount !== schedule.fees.length) {
          throw Object.assign(new Error("Every fee component must be active before publishing"), { statusCode: 409 });
        }

        schedule.scheduleRef = schedule.scheduleRef || await generateScheduleRef(
          schoolId,
          schedule.academicYear,
          schedule.term,
          schedule.classCode,
          session
        );
        schedule.isPublished = true;
        schedule.status = "PUBLISHED";
        schedule.publishedAt = new Date();
        schedule.publishedBy = req.user._id;
        await schedule.save({ session });

        await generateBillsForClass(
          schoolId,
          schedule.academicYear,
          schedule.term,
          schedule.classCode,
          req.user._id,
          session
        );
      };

      if (session) {
        await session.withTransaction(publishWork);
      } else {
        await publishWork();
      }

      res.json({ message: "Class fee schedule published and student bills generated successfully.", schedule });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ message: err.message || "Server error" });
    } finally {
      if (session) session.endSession();
    }
  }
);

router.get("/components/:id", auth, authorizeRoles("school admin", "admin"), async (req, res, next) => {
  try {
    const schoolId = await getSchoolId();
    const component = await FeeComponent.findOne({ _id: req.params.id, schoolId });
    if (!component) return res.status(404).json({ message: "Fee Component not found" });
    res.json(component);
  } catch (err) {
    next(err);
  }
});

router.post("/fee-types", (req, res, next) => {
  req.url = "/components";
  router.handle(req, res, next);
});

router.get("/fee-types", (req, res, next) => {
  req.url = "/components";
  router.handle(req, res, next);
});

router.get("/fee-types/:id", (req, res, next) => {
  req.url = `/components/${req.params.id}`;
  router.handle(req, res, next);
});

router.patch("/fee-types/:id", (req, res, next) => {
  req.url = `/components/${req.params.id}`;
  router.handle(req, res, next);
});

router.delete("/fee-types/:id", (req, res, next) => {
  req.url = `/components/${req.params.id}`;
  router.handle(req, res, next);
});

router.post("/fee-schedules", (req, res, next) => {
  req.url = "/schedules";
  router.handle(req, res, next);
});

router.get("/fee-schedules", (req, res, next) => {
  req.url = "/schedules";
  router.handle(req, res, next);
});

router.get("/fee-schedules/:id", (req, res, next) => {
  req.url = `/schedules/${req.params.id}`;
  router.handle(req, res, next);
});

router.patch("/fee-schedules/:id", (req, res, next) => {
  req.url = `/schedules/${req.params.id}`;
  router.handle(req, res, next);
});

router.post("/fee-schedules/:id/publish", (req, res, next) => {
  req.url = `/schedules/${req.params.id}/publish`;
  router.handle(req, res, next);
});

module.exports = router;
