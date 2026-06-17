const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { auth, authorizeRoles } = require("../middleware/auth");
const Fee = require("../models/Fee");
const Payment = require("../models/Payment");
const Student = require("../models/Student");
const mongoose = require("mongoose");
const Term = require("../models/Term");

// @route   GET /fees
// @desc    Get all fees with filtering options
// @access  Private
router.get("/", auth, authorizeRoles("admin", "accounts officer"), async (req, res) => {
  try {
    const {
      student,
      academicYear,
      semester,
      status,
      feeType,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};
    if (student) query.student = student;
    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = semester;
    if (status) query.status = status;
    if (feeType) query.feeType = feeType;

    const fees = await Fee.find(query)
      .populate("student", "firstName lastName studentId class")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Fee.countDocuments(query);

    res.json({
      fees,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /fees/student/:studentId
// @desc    Get fees for a specific student
// @access  Private
router.get(
  "/student/:studentId",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const fees = await Fee.find({ student: req.params.studentId })
        .populate("student", "firstName lastName studentId class")
        .sort({ dueDate: 1 });

      res.json(fees);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   GET /fees/:id
// @desc    Get fee by ID
// @access  Private
router.get("/:id", auth, authorizeRoles("admin", "accounts officer"), async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate("student", "firstName lastName studentId class")
      .populate("createdBy", "name");

    if (!fee) {
      return res.status(404).json({ msg: "Fee not found" });
    }

    res.json(fee);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Fee not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   POST /fees
// @desc    Create a new fee
// @access  Private
router.post(
  "/",
  [
    auth,
    authorizeRoles("admin", "accounts officer"),
    [
      body("student", "Student is required").notEmpty(),
      body("feeType", "Fee type is required").notEmpty(),
      body("academicYear", "Academic year is required").notEmpty(),
      body("amount", "Amount must be a positive number").isFloat({ min: 0 }),
      body("dueDate", "Due date is required").isISO8601(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        student,
        feeType,
        academicYear,
        semester,
        amount,
        dueDate,
        description,
      } = req.body;

      // Check if student exists
      const studentExists = await Student.findById(student);
      if (!studentExists) {
        return res.status(404).json({ msg: "Student not found" });
      }

      const fee = new Fee({
        student,
        feeType,
        academicYear,
        semester,
        amount,
        dueDate,
        description,
        createdBy: req.user.userId,
      });

      await fee.save();
      await fee.populate("student", "firstName lastName studentId class");

      res.json(fee);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   PUT /fees/:id
// @desc    Update a fee
// @access  Private
router.put("/:id", auth, authorizeRoles("admin", "accounts officer"), async (req, res) => {
  try {
    const { feeType, academicYear, semester, amount, dueDate, description } =
      req.body;

    const fee = await Fee.findById(req.params.id);
    if (!fee) {
      return res.status(404).json({ msg: "Fee not found" });
    }

    // Update fields
    if (feeType) fee.feeType = feeType;
    if (academicYear) fee.academicYear = academicYear;
    if (semester) fee.semester = semester;
    if (amount) fee.amount = amount;
    if (dueDate) fee.dueDate = dueDate;
    if (description) fee.description = description;

    await fee.save();
    await fee.populate("student", "firstName lastName studentId class");

    res.json(fee);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Fee not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   DELETE /fees/:id
// @desc    Delete a fee
// @access  Private
router.delete(
  "/:id",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const fee = await Fee.findById(req.params.id);
      if (!fee) {
        return res.status(404).json({ msg: "Fee not found" });
      }

      // Check if fee has any payments
      const payments = await Payment.find({ fee: req.params.id });
      if (payments.length > 0) {
        return res.status(400).json({
          msg: "Cannot delete fee with existing payments",
        });
      }

      await Fee.findByIdAndDelete(req.params.id);
      res.json({ msg: "Fee deleted successfully" });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Fee not found" });
      }
      res.status(500).send("Server error");
    }
  }
);

// @route   GET /fees/summary/student/:studentId
// @desc    Get fee summary for a student
// @access  Private
router.get(
  "/summary/student/:studentId",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const { academicYear } = req.query;
      const query = { student: req.params.studentId };
      if (academicYear) query.academicYear = academicYear;

      const fees = await Fee.find(query);

      const summary = {
        totalFees: fees.reduce((sum, fee) => sum + fee.amount, 0),
        totalPaid: fees.reduce((sum, fee) => sum + fee.paidAmount, 0),
        totalPending: fees.reduce((sum, fee) => sum + fee.remainingAmount, 0),
        overdueAmount: fees
          .filter((fee) => fee.status === "overdue")
          .reduce((sum, fee) => sum + fee.remainingAmount, 0),
        feesByType: {},
        feesByStatus: {
          pending: 0,
          partial: 0,
          paid: 0,
          overdue: 0,
        },
      };

      fees.forEach((fee) => {
        // Group by fee type
        if (!summary.feesByType[fee.feeType]) {
          summary.feesByType[fee.feeType] = {
            total: 0,
            paid: 0,
            pending: 0,
          };
        }
        summary.feesByType[fee.feeType].total += fee.amount;
        summary.feesByType[fee.feeType].paid += fee.paidAmount;
        summary.feesByType[fee.feeType].pending += fee.remainingAmount;

        // Group by status
        summary.feesByStatus[fee.status]++;
      });

      res.json(summary);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   GET /fees/overdue
// @desc    Get all overdue fees
// @access  Private
router.get(
  "/overdue/list",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const overdueFees = await Fee.find({
        status: "overdue",
        remainingAmount: { $gt: 0 },
      })
        .populate("student", "firstName lastName studentId class")
        .sort({ dueDate: 1 });

      res.json(overdueFees);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// ============================================================
// New Ghanaian Fee Structure and StudentLedger Arrears Routes
// ============================================================

const GhanaFeeStructure = require("../models/GhanaFeeStructure");
const StudentLedger = require("../models/StudentLedger");

// @route   POST /api/fees/structure
// @desc    Create a new Ghana fee structure
// @access  Private (Admin, Accounts Officer)
router.post(
  "/structure",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res, next) => {
    try {
      const { name, description, academicYear, term, applicableClasses, applicableLevels, feeItems, dueDate, status, effectiveDate } = req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Name is required" });
      }
      if (!academicYear || !mongoose.Types.ObjectId.isValid(academicYear)) {
        return res.status(400).json({ message: "Valid academicYear ID is required" });
      }
      if (!term || !mongoose.Types.ObjectId.isValid(term)) {
        return res.status(400).json({ message: "Valid term ID is required" });
      }
      if (!feeItems || !Array.isArray(feeItems) || feeItems.length === 0) {
        return res.status(400).json({ message: "At least one fee item is required" });
      }

      // Check term range
      const termDoc = await Term.findById(term);
      if (!termDoc) {
        return res.status(404).json({ message: "Term not found" });
      }

      const structDueDate = dueDate ? new Date(dueDate) : termDoc.endDate;
      if (structDueDate < termDoc.startDate || structDueDate > termDoc.endDate) {
        return res.status(400).json({ message: "Due date must fall within the term range" });
      }

      // Enforce currency is GHS and amount >= 0
      for (const item of feeItems) {
        if (!item.name || typeof item.name !== "string") {
          return res.status(400).json({ message: "Fee item name is required" });
        }
        if (item.amount === undefined || typeof item.amount !== "number" || item.amount < 0) {
          return res.status(400).json({ message: "Fee item amount must be a non-negative number" });
        }
        item.currency = "GHS"; // Enforce GHS
      }

      const structure = new GhanaFeeStructure({
        name,
        description: description || "",
        academicYear,
        term,
        applicableClasses: applicableClasses || [],
        applicableLevels: applicableLevels || [],
        feeItems,
        dueDate: structDueDate,
        status: status || "Draft",
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      });

      await structure.save();
      res.status(201).json(structure);
    } catch (err) {
      next(err);
    }
  }
);

// @route   POST /api/fees/structure/:structureId/apply
// @desc    Apply structure to students in batches of 50
// @access  Private (Admin, Accounts Officer)
router.post(
  "/structure/:structureId/apply",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res, next) => {
    try {
      const structure = await GhanaFeeStructure.findById(req.params.structureId);
      if (!structure) {
        return res.status(404).json({ message: "Fee structure not found" });
      }

      const filter = { status: "Active" };

      if (structure.applicableClasses && structure.applicableClasses.length > 0) {
        filter.currentClass = { $in: structure.applicableClasses };
      } else if (structure.applicableLevels && structure.applicableLevels.length > 0) {
        const classes = await mongoose.model("GhanaClass").find({
          level: { $in: structure.applicableLevels },
          academicYear: structure.academicYear
        });
        const classIds = classes.map(c => c._id);
        filter.currentClass = { $in: classIds };
      } else {
        return res.status(400).json({ message: "Fee structure must specify applicable classes or levels" });
      }

      const students = await mongoose.model("GhanaStudent").find(filter).populate("currentClass");

      const feeBreakdown = structure.feeItems.map(item => ({
        feeItemName: item.name,
        category: item.category,
        amount: item.amount,
        paid: 0,
        balance: item.amount,
        isMandatory: item.isMandatory !== undefined ? item.isMandatory : true,
        dueDate: item.dueDate || structure.dueDate,
      }));
      const totalFees = feeBreakdown.reduce((sum, item) => sum + (item.isMandatory ? item.amount : 0), 0);

      const operations = [];
      for (const student of students) {
        operations.push({
          updateOne: {
            filter: {
              student: student._id,
              academicYear: structure.academicYear,
              term: structure.term,
            },
            update: {
              $setOnInsert: {
                student: student._id,
                academicYear: structure.academicYear,
                term: structure.term,
                feeStructure: structure._id,
                totalFees,
                totalPaid: 0,
                balance: totalFees,
                currency: "GHS",
                feeBreakdown,
                transactions: [],
                status: "Active",
                createdBy: req.user.userId,
                studentName: `${student.firstName} ${student.lastName}`,
                studentId: student.studentId,
                className: student.currentClass ? student.currentClass.name : "",
              }
            },
            upsert: true
          }
        });
      }

      let modifiedCount = 0;
      let upsertedCount = 0;
      for (let i = 0; i < operations.length; i += 50) {
        const batch = operations.slice(i, i + 50);
        const result = await StudentLedger.bulkWrite(batch);
        modifiedCount += result.modifiedCount || 0;
        upsertedCount += result.upsertedCount || 0;
      }

      res.json({
        success: true,
        message: "Fee structure applied successfully",
        totalProcessed: operations.length,
        upsertedCount,
        modifiedCount
      });
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/fees/arrears
// @desc    List outstanding balances (arrears)
// @access  Private (Admin, Accounts Officer)
router.get(
  "/arrears",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const skip = (page - 1) * limit;

      const query = { balance: { $gt: 0 } };
      if (req.query.student) query.student = req.query.student;
      if (req.query.academicYear) query.academicYear = req.query.academicYear;
      if (req.query.term) query.term = req.query.term;

      const total = await StudentLedger.countDocuments(query);
      const arrears = await StudentLedger.find(query)
        .populate("student", "firstName lastName studentId phone email")
        .skip(skip)
        .limit(limit)
        .sort({ balance: -1 });

      res.json({
        success: true,
        data: arrears,
        total,
        page,
        pages: Math.ceil(total / limit)
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
