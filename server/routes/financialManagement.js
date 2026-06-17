const express = require("express");
const { body, validationResult } = require("express-validator");
const GhanaFeeStructure = require("../models/GhanaFeeStructure");
const StudentLedger = require("../models/StudentLedger");
const GhanaStudent = require("../models/GhanaStudent");
const GhanaClass = require("../models/GhanaClass");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");
const { rbac } = require("../middleware/rbac");

const router = express.Router();

// ============= FEE STRUCTURE MANAGEMENT =============

// Create fee structure
router.post(
  "/fee-structures",
  auth,
  rbac("financial", "create"),
  [
    body("name").trim().isLength({ min: 3, max: 100 }).withMessage("Name must be 3-100 characters"),
    body("description").optional().trim().isLength({ max: 500 }).withMessage("Description too long"),
    body("academicYearId").isMongoId().withMessage("Valid academic year ID required"),
    body("termId").isMongoId().withMessage("Valid term ID required"),
    body("feeItems").isArray({ min: 1 }).withMessage("At least one fee item required"),
    body("feeItems.*.name").trim().notEmpty().withMessage("Fee item name required"),
    body("feeItems.*.category").isIn([
      "Tuition", "Registration", "Examination", "Library", "Laboratory",
      "ICT", "Sports", "Development", "PTA", "Uniform", "Books",
      "Transport", "Feeding", "Boarding", "Medical", "Insurance",
      "Extra Curricular", "Field Trip", "Miscellaneous"
    ]).withMessage("Invalid fee category"),
    body("feeItems.*.amount").isInt({ min: 0 }).withMessage("Amount must be non-negative"),
    body("effectiveDate").isISO8601().withMessage("Valid effective date required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const feeStructureData = req.body;
      feeStructureData.createdBy = req.user._id;

      const feeStructure = new GhanaFeeStructure(feeStructureData);
      await feeStructure.save();

      const populatedStructure = await GhanaFeeStructure.findById(feeStructure._id)
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("applicableClasses", "name level section")
        .populate("createdBy", "firstName lastName");

      res.status(201).json({
        message: "Fee structure created successfully",
        feeStructure: populatedStructure,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get fee structures
router.get(
  "/fee-structures",
  auth,
  rbac("financial", "read"),
  async (req, res) => {
    try {
      const { academicYearId, termId, status, classId } = req.query;
      
      const filter = {};
      if (academicYearId) filter.academicYear = academicYearId;
      if (termId) filter.term = termId;
      if (status) filter.status = status;
      if (classId) filter.applicableClasses = classId;

      const feeStructures = await GhanaFeeStructure.find(filter)
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("applicableClasses", "name level section")
        .populate("createdBy", "firstName lastName")
        .sort({ effectiveDate: -1 });

      res.json(feeStructures);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get active fee structure for specific class
router.get(
  "/fee-structures/active/:classId/:academicYearId/:termId",
  auth,
  rbac("financial", "read"),
  async (req, res) => {
    try {
      const { classId, academicYearId, termId } = req.params;

      const feeStructure = await GhanaFeeStructure.getActiveStructure(
        academicYearId,
        termId,
        classId
      );

      if (!feeStructure) {
        return res.status(404).json({ message: "No active fee structure found" });
      }

      res.json(feeStructure);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Update fee structure
router.put(
  "/fee-structures/:structureId",
  auth,
  rbac("financial", "update"),
  [
    body("name").optional().trim().isLength({ min: 3, max: 100 }),
    body("description").optional().trim().isLength({ max: 500 }),
    body("feeItems").optional().isArray(),
    body("status").optional().isIn(["Draft", "Active", "Inactive", "Archived"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { structureId } = req.params;
      const updateData = req.body;
      updateData.lastModifiedBy = req.user._id;

      const feeStructure = await GhanaFeeStructure.findByIdAndUpdate(
        structureId,
        updateData,
        { new: true, runValidators: true }
      )
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("applicableClasses", "name level section");

      if (!feeStructure) {
        return res.status(404).json({ message: "Fee structure not found" });
      }

      res.json({
        message: "Fee structure updated successfully",
        feeStructure,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= STUDENT LEDGER MANAGEMENT =============

// Create student ledgers for a class
router.post(
  "/ledgers/create-class",
  auth,
  rbac("financial", "create"),
  [
    body("classId").isMongoId().withMessage("Valid class ID required"),
    body("academicYearId").isMongoId().withMessage("Valid academic year ID required"),
    body("termId").isMongoId().withMessage("Valid term ID required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { classId, academicYearId, termId } = req.body;

      // Get class and fee structure
      const classInfo = await GhanaClass.findById(classId).populate("students");
      const feeStructure = await GhanaFeeStructure.getActiveStructure(academicYearId, termId, classId);

      if (!classInfo) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (!feeStructure) {
        return res.status(404).json({ message: "No active fee structure found for this class" });
      }

      const results = {
        successful: [],
        failed: [],
      };

      for (const student of classInfo.students) {
        try {
          // Check if ledger already exists
          const existingLedger = await StudentLedger.findOne({
            student: student._id,
            academicYear: academicYearId,
            term: termId,
          });

          if (existingLedger) {
            results.failed.push({
              studentId: student._id,
              error: "Ledger already exists",
            });
            continue;
          }

          // Calculate student fees
          const totalFees = feeStructure.calculateStudentFee(student);

          // Create fee breakdown
          const feeBreakdown = feeStructure.feeItems.map(item => ({
            feeItemName: item.name,
            category: item.category,
            amount: item.amount,
            paid: 0,
            balance: item.amount,
            isMandatory: item.isMandatory,
            dueDate: item.dueDate,
          }));

          // Create ledger
          const ledger = new StudentLedger({
            student: student._id,
            academicYear: academicYearId,
            term: termId,
            feeStructure: feeStructure._id,
            totalFees,
            feeBreakdown,
            createdBy: req.user._id,
            academicYearName: (await AcademicYear.findById(academicYearId))?.name || "",
            termName: (await Term.findById(termId))?.name || "",
            studentName: `${student.firstName} ${student.lastName}`,
            studentId: student.studentId,
            className: classInfo.name,
          });

          await ledger.save();
          results.successful.push({
            studentId: student._id,
            ledgerId: ledger._id,
            totalFees,
          });
        } catch (err) {
          results.failed.push({
            studentId: student._id,
            error: err.message,
          });
        }
      }

      res.json({
        message: "Class ledgers created",
        results,
        summary: {
          total: classInfo.students.length,
          successful: results.successful.length,
          failed: results.failed.length,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get student ledger
router.get(
  "/ledgers/:studentId/:academicYearId/:termId",
  auth,
  rbac("financial", "read"),
  async (req, res) => {
    try {
      const { studentId, academicYearId, termId } = req.params;

      const ledger = await StudentLedger.findOne({
        student: studentId,
        academicYear: academicYearId,
        term: termId,
      })
        .populate("student", "firstName lastName studentId")
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("feeStructure", "name")
        .populate("transactions.receivedBy", "firstName lastName");

      if (!ledger) {
        return res.status(404).json({ message: "Student ledger not found" });
      }

      res.json(ledger);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get class ledgers summary
router.get(
  "/ledgers/class/:classId/:academicYearId/:termId",
  auth,
  rbac("financial", "read"),
  async (req, res) => {
    try {
      const { classId, academicYearId, termId } = req.params;

      const ledgers = await StudentLedger.find({
        "student.currentClass": classId,
        academicYear: academicYearId,
        term: termId,
      })
        .populate("student", "firstName lastName studentId")
        .sort({ "student.lastName": 1, "student.firstName": 1 });

      const summary = {
        totalStudents: ledgers.length,
        totalFees: ledgers.reduce((sum, ledger) => sum + ledger.totalFees, 0),
        totalPaid: ledgers.reduce((sum, ledger) => sum + ledger.totalPaid, 0),
        totalBalance: ledgers.reduce((sum, ledger) => sum + ledger.balance, 0),
        fullyPaid: ledgers.filter(l => l.status === "Paid").length,
        partiallyPaid: ledgers.filter(l => l.status === "Partially Paid").length,
        overdue: ledgers.filter(l => l.status === "Overdue").length,
        collectionRate: 0,
      };

      if (summary.totalFees > 0) {
        summary.collectionRate = Math.round((summary.totalPaid / summary.totalFees) * 100);
      }

      res.json({
        class: await GhanaClass.findById(classId, "name level section"),
        academicYear: await AcademicYear.findById(academicYearId, "name"),
        term: await Term.findById(termId, "name"),
        summary,
        ledgers: ledgers.map(ledger => ({
          student: ledger.student,
          totalFees: ledger.totalFees,
          totalPaid: ledger.totalPaid,
          balance: ledger.balance,
          paymentPercentage: ledger.paymentPercentage,
          status: ledger.status,
          lastPaymentDate: ledger.transactions.length > 0 
            ? new Date(Math.max(...ledger.transactions.map(t => t.transactionDate)))
            : null,
        })),
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= PAYMENT PROCESSING =============

// Process payment
router.post(
  "/payments",
  auth,
  rbac("financial", "create"),
  [
    body("studentId").isMongoId().withMessage("Valid student ID required"),
    body("academicYearId").isMongoId().withMessage("Valid academic year ID required"),
    body("termId").isMongoId().withMessage("Valid term ID required"),
    body("amount").isInt({ min: 1 }).withMessage("Payment amount must be positive"),
    body("paymentMethod").isIn([
      "Cash", "Bank Transfer", "Mobile Money", "Cheque", "Credit Card", "Online Payment"
    ]).withMessage("Invalid payment method"),
    body("feeItems").optional().isArray(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        studentId,
        academicYearId,
        termId,
        amount,
        paymentMethod,
        paymentReference,
        feeItems,
        notes,
        bankDetails,
        mobileMoneyDetails,
      } = req.body;

      // Find student ledger
      const ledger = await StudentLedger.findOne({
        student: studentId,
        academicYear: academicYearId,
        term: termId,
      });

      if (!ledger) {
        return res.status(404).json({ message: "Student ledger not found" });
      }

      // Process payment
      const transaction = await ledger.addPayment({
        amount,
        paymentMethod,
        paymentReference,
        feeItems,
        notes,
        bankDetails,
        mobileMoneyDetails,
        receivedBy: req.user._id,
      });

      // Generate receipt data
      const receiptData = {
        receiptNumber: transaction.receiptNumber,
        student: await GhanaStudent.findById(studentId, "firstName lastName studentId"),
        amount,
        paymentMethod,
        transactionDate: transaction.transactionDate,
        receivedBy: `${req.user.firstName} ${req.user.lastName}`,
        feeItems: transaction.feeItems,
        balance: ledger.balance,
        totalPaid: ledger.totalPaid,
      };

      res.status(201).json({
        message: "Payment processed successfully",
        transaction,
        receipt: receiptData,
        ledger: {
          totalFees: ledger.totalFees,
          totalPaid: ledger.totalPaid,
          balance: ledger.balance,
          status: ledger.status,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get payment history
router.get(
  "/payments/:studentId/:academicYearId/:termId",
  auth,
  rbac("financial", "read"),
  async (req, res) => {
    try {
      const { studentId, academicYearId, termId } = req.params;

      const ledger = await StudentLedger.findOne({
        student: studentId,
        academicYear: academicYearId,
        term: termId,
      })
        .populate("transactions.receivedBy", "firstName lastName")
        .populate("transactions.feeItems");

      if (!ledger) {
        return res.status(404).json({ message: "Student ledger not found" });
      }

      const payments = ledger.transactions
        .filter(t => t.type === "Payment")
        .sort({ transactionDate: -1 });

      res.json({
        student: await GhanaStudent.findById(studentId, "firstName lastName studentId"),
        payments,
        summary: ledger.getPaymentSummary(),
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= ACCOUNTANT DASHBOARD =============

// Get accountant dashboard data
router.get(
  "/dashboard/accountant/:academicYearId/:termId",
  auth,
  rbac("financial", "read"),
  async (req, res) => {
    try {
      const { academicYearId, termId } = req.params;

      // Get payment statistics
      const paymentStats = await StudentLedger.getPaymentStatistics(academicYearId, termId);

      // Get overdue ledgers
      const overdueLedgers = await StudentLedger.getOverdueLedgers(academicYearId, termId);

      // Get recent transactions
      const recentTransactions = await StudentLedger.aggregate([
        {
          $match: {
            academicYear: new mongoose.Types.ObjectId(academicYearId),
            term: new mongoose.Types.ObjectId(termId),
          },
        },
        { $unwind: "$transactions" },
        { $sort: { "transactions.transactionDate": -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "ghanastudents",
            localField: "student",
            foreignField: "_id",
            as: "studentInfo",
          },
        },
        { $unwind: "$studentInfo" },
        {
          $project: {
            receiptNumber: "$transactions.receiptNumber",
            amount: "$transactions.amount",
            paymentMethod: "$transactions.paymentMethod",
            transactionDate: "$transactions.transactionDate",
            studentName: {
              $concat: ["$studentInfo.firstName", " ", "$studentInfo.lastName"],
            },
            studentId: "$studentInfo.studentId",
          },
        },
      ]);

      // Get payment method breakdown
      const paymentMethodStats = await StudentLedger.aggregate([
        {
          $match: {
            academicYear: new mongoose.Types.ObjectId(academicYearId),
            term: new mongoose.Types.ObjectId(termId),
          },
        },
        { $unwind: "$transactions" },
        {
          $match: {
            "transactions.type": "Payment",
          },
        },
        {
          $group: {
            _id: "$transactions.paymentMethod",
            count: { $sum: 1 },
            totalAmount: { $sum: "$transactions.amount" },
          },
        },
      ]);

      // Get monthly collection trends
      const monthlyTrends = await StudentLedger.aggregate([
        {
          $match: {
            academicYear: new mongoose.Types.ObjectId(academicYearId),
            term: new mongoose.Types.ObjectId(termId),
          },
        },
        { $unwind: "$transactions" },
        {
          $match: {
            "transactions.type": "Payment",
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$transactions.transactionDate" },
              month: { $month: "$transactions.transactionDate" },
            },
            totalAmount: { $sum: "$transactions.amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

      res.json({
        period: {
          academicYear: await AcademicYear.findById(academicYearId, "name"),
          term: await Term.findById(termId, "name"),
        },
        statistics: paymentStats,
        overdueLedgers: overdueLedgers.slice(0, 20), // Limit for performance
        recentTransactions,
        paymentMethods: paymentMethodStats,
        monthlyTrends,
        summary: {
          totalRevenue: paymentStats.totalPaid,
          outstandingBalance: paymentStats.totalBalance,
          collectionRate: paymentStats.collectionRate,
          overdueCount: overdueLedgers.length,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= FINANCIAL REPORTS =============

// Generate financial report
router.get(
  "/reports/:academicYearId/:termId",
  auth,
  rbac("financial", "generateReports"),
  async (req, res) => {
    try {
      const { academicYearId, termId } = req.params;
      const { format } = req.query;

      // Get comprehensive financial data
      const paymentStats = await StudentLedger.getPaymentStatistics(academicYearId, termId);
      
      const classBreakdown = await StudentLedger.aggregate([
        {
          $match: {
            academicYear: new mongoose.Types.ObjectId(academicYearId),
            term: new mongoose.Types.ObjectId(termId),
          },
        },
        {
          $lookup: {
            from: "ghanastudents",
            localField: "student",
            foreignField: "_id",
            as: "studentInfo",
          },
        },
        { $unwind: "$studentInfo" },
        {
          $lookup: {
            from: "ghanaclasses",
            localField: "studentInfo.currentClass",
            foreignField: "_id",
            as: "classInfo",
          },
        },
        { $unwind: "$classInfo" },
        {
          $group: {
            _id: "$classInfo._id",
            className: { $first: "$classInfo.name" },
            level: { $first: "$classInfo.level" },
            totalStudents: { $sum: 1 },
            totalFees: { $sum: "$totalFees" },
            totalPaid: { $sum: "$totalPaid" },
            balance: { $sum: "$balance" },
          },
        },
        { $sort: { className: 1 } },
      ]);

      const feeCategoryBreakdown = await StudentLedger.aggregate([
        {
          $match: {
            academicYear: new mongoose.Types.ObjectId(academicYearId),
            term: new mongoose.Types.ObjectId(termId),
          },
        },
        { $unwind: "$feeBreakdown" },
        {
          $group: {
            _id: "$feeBreakdown.category",
            totalAmount: { $sum: "$feeBreakdown.amount" },
            totalPaid: { $sum: "$feeBreakdown.paid" },
            balance: { $sum: "$feeBreakdown.balance" },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]);

      const reportData = {
        period: {
          academicYear: await AcademicYear.findById(academicYearId, "name"),
          term: await Term.findById(termId, "name"),
          generatedAt: new Date(),
          generatedBy: `${req.user.firstName} ${req.user.lastName}`,
        },
        summary: paymentStats,
        classBreakdown,
        feeCategoryBreakdown,
        recommendations: generateFinancialRecommendations(paymentStats, classBreakdown),
      };

      if (format === "csv") {
        // Generate CSV (placeholder - would use a CSV library)
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="financial-report-${academicYearId}-${termId}.csv"`);
        return res.json({ message: "CSV generation would be implemented here", data: reportData });
      }

      res.json(reportData);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Helper function to generate financial recommendations
function generateFinancialRecommendations(stats, classBreakdown) {
  const recommendations = [];

  if (stats.collectionRate < 80) {
    recommendations.push("Consider implementing payment reminders for parents with outstanding balances");
  }

  if (stats.overdue > 0) {
    recommendations.push("Follow up with parents of overdue accounts to arrange payment plans");
  }

  const lowPerformanceClasses = classBreakdown.filter(cls => 
    cls.totalFees > 0 && (cls.totalPaid / cls.totalFees) < 70
  );

  if (lowPerformanceClasses.length > 0) {
    recommendations.push(`Focus collection efforts on: ${lowPerformanceClasses.map(c => c.className).join(", ")}`);
  }

  if (recommendations.length === 0) {
    recommendations.push("Financial performance is excellent. Continue current practices.");
  }

  return recommendations;
}

module.exports = router;
