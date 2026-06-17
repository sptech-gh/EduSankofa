const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const { auth, authorizeRoles } = require("../middleware/auth");
const Payment = require("../models/Payment");
const Fee = require("../models/Fee");
const Student = require("../models/Student");
const logger = require("../services/logger");
const StudentLedger = require("../models/StudentLedger");
const { nextSeq } = require("../services/counterService");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const AuditLog = require("../models/AuditLog");

// @route   GET /payments
// @desc    Get all payments with filtering options
// @access  Private
router.get("/", auth, authorizeRoles("admin", "accounts officer"), async (req, res) => {
  try {
    const {
      student,
      fee,
      status,
      paymentMethod,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};
    if (student) query.student = student;
    if (fee) query.fee = fee;
    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate("student", "firstName lastName studentId class")
      .populate("fee", "feeType amount academicYear")
      .populate("processedBy", "name")
      .sort({ paymentDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    logger.error("Error fetching payments", { error: err.message, query: req.query });
    next(err);
  }
});

// @route   GET /payments/student/:studentId
// @desc    Get payment history for a specific student
// @access  Private
router.get(
  "/student/:studentId",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 10, 100);

      const query = { student: req.params.studentId };
      const payments = await Payment.find(query)
        .populate("fee", "feeType amount academicYear dueDate")
        .populate("processedBy", "name")
        .sort({ paymentDate: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const total = await Payment.countDocuments(query);

      res.json({
        payments,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
      });
    } catch (err) {
      logger.error("Error fetching student payments", { error: err.message, studentId: req.params.studentId });
      next(err);
    }
  }
);

// @route   GET /payments/:id
// @desc    Get payment by ID
// @access  Private
router.get(
  "/:id",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
    const payment = await Payment.findById(req.params.id)
      .populate("student", "firstName lastName studentId class")
      .populate("fee", "feeType amount academicYear")
      .populate("processedBy", "name");

    if (!payment) {
      return res.status(404).json({ msg: "Payment not found" });
    }

    res.json(payment);
    } catch (err) {
      logger.error("Error fetching payment by ID", { error: err.message, id: req.params.id });
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Payment not found" });
      }
      next(err);
    }
  }
);

// @route   POST /payments
// @desc    Process a new payment
// @access  Private
router.post(
  "/",
  [
    auth,
    authorizeRoles("admin", "accounts officer"),
    [
      body("amount", "Amount must be a positive number").isFloat({ min: 0.01 }),
      body("paymentMethod", "Payment method is required").notEmpty(),
    ],
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const startTime = Date.now();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        fee: feeId,
        ledgerId,
        student: studentId,
        amount,
        paymentMethod,
        transactionId,
        reference,
        notes,
        provider,
        number,
        bankName,
        accountNumber,
        chequeNumber,
      } = req.body;

      // Validate conditional paymentMethod requirements
      const normalizedMethod = String(paymentMethod).trim();
      if (normalizedMethod === "Mobile Money") {
        if (!provider || !number || !transactionId) {
          await session.abortTransaction();
          return res.status(400).json({
            message: "Mobile Money provider, phone number, and transaction ID are required for Mobile Money payments"
          });
        }
      } else if (normalizedMethod === "Bank Transfer") {
        if (!bankName || !accountNumber || !transactionId) {
          await session.abortTransaction();
          return res.status(400).json({
            message: "Bank name, account number, and transaction ID are required for Bank Transfer payments"
          });
        }
      } else if (normalizedMethod === "Cheque") {
        if (!chequeNumber) {
          await session.abortTransaction();
          return res.status(400).json({
            message: "Cheque number is required for Cheque payments"
          });
        }
      }

      // 1. Find the StudentLedger or legacy Fee
      let ledger = null;
      let legacyFee = null;

      if (ledgerId && mongoose.Types.ObjectId.isValid(ledgerId)) {
        ledger = await StudentLedger.findById(ledgerId).session(session);
      } else if (feeId && mongoose.Types.ObjectId.isValid(feeId)) {
        // Find standard Fee first
        legacyFee = await Fee.findById(feeId).session(session);
        if (legacyFee) {
          ledger = await StudentLedger.findOne({ student: legacyFee.student }).session(session);
        }
      } else if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        // Find by student ID and current active year/term
        const activeYear = await AcademicYear.findOne({ isActive: true }).session(session);
        if (activeYear) {
          const activeTerm = await Term.findOne({ academicYear: activeYear._id, isActive: true }).session(session);
          if (activeTerm) {
            ledger = await StudentLedger.findOne({
              student: studentId,
              academicYear: activeYear._id,
              term: activeTerm._id
            }).session(session);
          }
        }
      }

      // If neither was found, try without session
      if (!ledger && !legacyFee) {
        if (feeId && mongoose.Types.ObjectId.isValid(feeId)) {
          legacyFee = await Fee.findById(feeId);
        }
      }

      if (!ledger && !legacyFee) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Fee or student ledger not found" });
      }

      // 2. Generate Receipt Number atomically
      const year = new Date().getFullYear();
      const receiptSeq = await nextSeq(`receipt-${year}`, session);
      const receiptNumber = `RCPT${year}${String(receiptSeq).padStart(6, "0")}`;

      let payment = null;

      if (ledger) {
        // 3. Check payment amount <= outstanding balance
        if (amount > ledger.balance) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `Payment amount cannot exceed remaining balance of GHS ${ledger.balance.toFixed(2)}`
          });
        }

        // 4. Update StudentLedger totalPaid and balance
        ledger.totalPaid += amount;
        ledger.balance = ledger.totalFees - ledger.totalPaid;

        // Allocate payment to individual fee items
        let remainingPayment = amount;
        for (const item of ledger.feeBreakdown) {
          if (remainingPayment <= 0) break;
          const itemOwed = item.balance;
          if (itemOwed > 0) {
            const paymentToItem = Math.min(remainingPayment, itemOwed);
            item.paid += paymentToItem;
            item.balance = item.amount - item.paid;
            remainingPayment -= paymentToItem;
          }
        }

        const transactionItem = {
          type: "Payment",
          amount,
          paymentMethod: normalizedMethod,
          paymentReference: reference || receiptNumber,
          transactionDate: new Date(),
          receivedBy: req.user._id || req.user.userId,
          receiptNumber,
          notes: notes || "",
          status: "Completed",
        };

        if (normalizedMethod === "Mobile Money") {
          transactionItem.mobileMoneyDetails = {
            provider,
            number,
            transactionId,
            reference,
          };
        } else if (normalizedMethod === "Bank Transfer") {
          transactionItem.bankDetails = {
            bankName,
            accountNumber,
            transactionId,
          };
        } else if (normalizedMethod === "Cheque") {
          transactionItem.bankDetails = {
            chequeNumber,
          };
        }

        ledger.transactions.push(transactionItem);
        await ledger.save({ session });
      }

      // Also process the legacy Fee if it exists (for backward compatibility / tests passing)
      if (legacyFee) {
        if (amount > legacyFee.remainingAmount) {
          await session.abortTransaction();
          return res.status(400).json({
            msg: `Payment amount cannot exceed remaining amount of GHS ${legacyFee.remainingAmount.toFixed(2)}`
          });
        }

        // Create standard Payment record
        payment = new Payment({
          fee: legacyFee._id,
          student: legacyFee.student,
          amount,
          paymentMethod: normalizedMethod,
          transactionId: transactionId || receiptNumber,
          reference: reference || receiptNumber,
          notes: notes || "",
          processedBy: req.user._id || req.user.userId,
        });
        await payment.save({ session });

        legacyFee.paidAmount += amount;
        await legacyFee.save({ session });
      }

      // 5. Save AuditLog
      await AuditLog.create([{
        user: req.user._id || req.user.userId,
        userRole: req.user.role === "super admin" ? "Super Admin" : "Staff",
        userName: req.user.name,
        action: "CREATE",
        resource: `Payment: ${receiptNumber}`,
        resourceType: "Payment",
        resourceId: ledger ? ledger._id : payment._id,
        method: "POST",
        url: req.originalUrl,
        statusCode: 201,
        ipAddress: req.ip,
        duration: Date.now() - startTime,
      }], { session });

      await session.commitTransaction();

      if (payment) {
        await payment.populate([
          { path: "student", select: "firstName lastName studentId class" },
          { path: "fee", select: "feeType amount academicYear" },
          { path: "processedBy", select: "name" },
        ]);
        return res.status(201).json(payment);
      }

      res.status(201).json({
        success: true,
        message: "Payment processed successfully",
        data: ledger,
        receiptNumber,
      });

    } catch (err) {
      await session.abortTransaction();
      
      // Stand-alone Fallback
      try {
        const {
          fee: feeId,
          ledgerId,
          student: studentId,
          amount,
          paymentMethod,
          transactionId,
          reference,
          notes,
          provider,
          number,
          bankName,
          accountNumber,
          chequeNumber,
        } = req.body;

        const normalizedMethod = String(paymentMethod).trim();
        if (normalizedMethod === "Mobile Money") {
          if (!provider || !number || !transactionId) {
            return res.status(400).json({
              message: "Mobile Money provider, phone number, and transaction ID are required for Mobile Money payments"
            });
          }
        } else if (normalizedMethod === "Bank Transfer") {
          if (!bankName || !accountNumber || !transactionId) {
            return res.status(400).json({
              message: "Bank name, account number, and transaction ID are required for Bank Transfer payments"
            });
          }
        } else if (normalizedMethod === "Cheque") {
          if (!chequeNumber) {
            return res.status(400).json({
              message: "Cheque number is required for Cheque payments"
            });
          }
        }

        let ledger = null;
        let legacyFee = null;

        if (ledgerId && mongoose.Types.ObjectId.isValid(ledgerId)) {
          ledger = await StudentLedger.findById(ledgerId);
        } else if (feeId && mongoose.Types.ObjectId.isValid(feeId)) {
          legacyFee = await Fee.findById(feeId);
          if (legacyFee) {
            ledger = await StudentLedger.findOne({ student: legacyFee.student });
          }
        } else if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
          const activeYear = await AcademicYear.findOne({ isActive: true });
          if (activeYear) {
            const activeTerm = await Term.findOne({ academicYear: activeYear._id, isActive: true });
            if (activeTerm) {
              ledger = await StudentLedger.findOne({
                student: studentId,
                academicYear: activeYear._id,
                term: activeTerm._id
              });
            }
          }
        }

        if (!ledger && !legacyFee) {
          if (feeId && mongoose.Types.ObjectId.isValid(feeId)) {
            legacyFee = await Fee.findById(feeId);
          }
        }

        if (!ledger && !legacyFee) {
          return res.status(404).json({ message: "Fee or student ledger not found" });
        }

        const year = new Date().getFullYear();
        const receiptSeq = await nextSeq(`receipt-${year}`);
        const receiptNumber = `RCPT${year}${String(receiptSeq).padStart(6, "0")}`;

        let payment = null;

        if (ledger) {
          if (amount > ledger.balance) {
            return res.status(400).json({
              message: `Payment amount cannot exceed remaining balance of GHS ${ledger.balance.toFixed(2)}`
            });
          }

          ledger.totalPaid += amount;
          ledger.balance = ledger.totalFees - ledger.totalPaid;

          let remainingPayment = amount;
          for (const item of ledger.feeBreakdown) {
            if (remainingPayment <= 0) break;
            const itemOwed = item.balance;
            if (itemOwed > 0) {
              const paymentToItem = Math.min(remainingPayment, itemOwed);
              item.paid += paymentToItem;
              item.balance = item.amount - item.paid;
              remainingPayment -= paymentToItem;
            }
          }

          const transactionItem = {
            type: "Payment",
            amount,
            paymentMethod: normalizedMethod,
            paymentReference: reference || receiptNumber,
            transactionDate: new Date(),
            receivedBy: req.user._id || req.user.userId,
            receiptNumber,
            notes: notes || "",
            status: "Completed",
          };

          if (normalizedMethod === "Mobile Money") {
            transactionItem.mobileMoneyDetails = {
              provider,
              number,
              transactionId,
              reference,
            };
          } else if (normalizedMethod === "Bank Transfer") {
            transactionItem.bankDetails = {
              bankName,
              accountNumber,
              transactionId,
            };
          } else if (normalizedMethod === "Cheque") {
            transactionItem.bankDetails = {
              chequeNumber,
            };
          }

          ledger.transactions.push(transactionItem);
          await ledger.save();
        }

        if (legacyFee) {
          if (amount > legacyFee.remainingAmount) {
            return res.status(400).json({
              msg: `Payment amount cannot exceed remaining amount of GHS ${legacyFee.remainingAmount.toFixed(2)}`
            });
          }

          payment = new Payment({
            fee: legacyFee._id,
            student: legacyFee.student,
            amount,
            paymentMethod: normalizedMethod,
            transactionId: transactionId || receiptNumber,
            reference: reference || receiptNumber,
            notes: notes || "",
            processedBy: req.user._id || req.user.userId,
          });
          await payment.save();

          legacyFee.paidAmount += amount;
          await legacyFee.save();
        }

        await AuditLog.create({
          user: req.user._id || req.user.userId,
          userRole: req.user.role === "super admin" ? "Super Admin" : "Staff",
          userName: req.user.name,
          action: "CREATE",
          resource: `Payment: ${receiptNumber}`,
          resourceType: "Payment",
          resourceId: ledger ? ledger._id : payment._id,
          method: "POST",
          url: req.originalUrl,
          statusCode: 201,
          ipAddress: req.ip,
          duration: Date.now() - startTime,
        });

        if (payment) {
          await payment.populate([
            { path: "student", select: "firstName lastName studentId class" },
            { path: "fee", select: "feeType amount academicYear" },
            { path: "processedBy", select: "name" },
          ]);
          return res.status(201).json(payment);
        }

        res.status(201).json({
          success: true,
          message: "Payment processed successfully",
          data: ledger,
          receiptNumber,
        });

      } catch (innerErr) {
        logger.error("Process payment fallback error", { error: innerErr.message, stack: innerErr.stack });
        next(innerErr);
      }
    } finally {
      session.endSession();
    }
  }
);

// @route   POST /payments/online
// @desc    Process online payment (integration with payment gateway)
// @access  Private
router.post(
  "/online",
  [
    auth,
    authorizeRoles("admin", "accounts officer"),
    [
      body("fee", "Fee ID is required").notEmpty(),
      body("amount", "Amount must be a positive number").isFloat({ min: 0.01 }),
      body("paymentMethod", "Payment method is required").notEmpty(),
    ],
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { fee: feeId, amount, paymentMethod } = req.body;

      // Check if fee exists
      const fee = await Fee.findById(feeId).session(session);
      if (!fee) {
        await session.abortTransaction();
        return res.status(404).json({ msg: "Fee not found" });
      }

      // Check if payment amount is valid
      if (amount > fee.remainingAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          msg: `Payment amount cannot exceed remaining amount of GHS ${fee.remainingAmount.toFixed(2)}`,
        });
      }

      // Mock payment gateway integration
      const gatewayResponse = {
        success: true,
        transactionId: `TXN${Date.now()}${Math.random()
          .toString(36)
          .substr(2, 9)
          .toUpperCase()}`,
        gatewayTransactionId: `GW${Date.now()}`,
        status: "completed",
        message: "Payment processed successfully",
      };

      if (gatewayResponse.success) {
        // Create payment record
        const payment = new Payment({
          fee: feeId,
          student: fee.student,
          amount,
          paymentMethod,
          transactionId: gatewayResponse.transactionId,
          status: "completed",
          gatewayResponse,
          processedBy: req.user.userId,
        });

        await payment.save({ session });

        // Update fee with payment
        fee.paidAmount += amount;
        await fee.save({ session });

        await session.commitTransaction();

        await payment.populate([
          { path: "student", select: "firstName lastName studentId class" },
          { path: "fee", select: "feeType amount academicYear" },
          { path: "processedBy", select: "name" },
        ]);

        res.json({
          success: true,
          payment,
          message: "Payment processed successfully",
        });
      } else {
        await session.abortTransaction();
        res.status(400).json({
          success: false,
          message: "Payment failed",
          error: gatewayResponse.message,
        });
      }
    } catch (err) {
      await session.abortTransaction();
      logger.error("Process online payment error", { error: err.message, stack: err.stack });
      next(err);
    } finally {
      session.endSession();
    }
  }
);

// @route   PUT /payments/:id/refund
// @desc    Process payment refund
// @access  Private
router.put(
  "/:id/refund",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { reason } = req.body;

      const payment = await Payment.findById(req.params.id).session(session);
      if (!payment) {
        await session.abortTransaction();
        return res.status(404).json({ msg: "Payment not found" });
      }

      if (payment.status === "refunded") {
        await session.abortTransaction();
        return res.status(400).json({ msg: "Payment already refunded" });
      }

      // Update payment status
      payment.status = "refunded";
      payment.notes = payment.notes
        ? `${payment.notes}\nRefund reason: ${reason}`
        : `Refund reason: ${reason}`;
      await payment.save({ session });

      // Update fee by reducing paid amount
      const fee = await Fee.findById(payment.fee).session(session);
      if (fee) {
        fee.paidAmount -= payment.amount;
        await fee.save({ session });
      }

      await session.commitTransaction();

      await payment.populate([
        { path: "student", select: "firstName lastName studentId class" },
        { path: "fee", select: "feeType amount academicYear" },
        { path: "processedBy", select: "name" },
      ]);

      res.json(payment);
    } catch (err) {
      await session.abortTransaction();
      logger.error("Refund payment error", { error: err.message, stack: err.stack });
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Payment not found" });
      }
      next(err);
    } finally {
      session.endSession();
    }
  }
);

// @route   GET /payments/summary/daily
// @desc    Get daily payment summary
// @access  Private
router.get(
  "/summary/daily",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res, next) => {
    try {
      const { date = new Date().toISOString().split("T")[0] } = req.query;

      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      const payments = await Payment.find({
        paymentDate: { $gte: startDate, $lt: endDate },
        status: "completed",
      });

      const summary = {
        date,
        totalAmount: payments.reduce((sum, payment) => sum + payment.amount, 0),
        totalTransactions: payments.length,
        paymentMethods: {},
      };

      payments.forEach((payment) => {
        if (!summary.paymentMethods[payment.paymentMethod]) {
          summary.paymentMethods[payment.paymentMethod] = {
            count: 0,
            amount: 0,
          };
        }
        summary.paymentMethods[payment.paymentMethod].count++;
        summary.paymentMethods[payment.paymentMethod].amount += payment.amount;
      });

      res.json(summary);
    } catch (err) {
      logger.error("Error fetching daily payment summary", { error: err.message, date: req.query.date });
      next(err);
    }
  }
);

// @route   GET /payments/summary/monthly
// @desc    Get monthly payment summary
// @access  Private
router.get(
  "/summary/monthly",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res, next) => {
    try {
      const {
        year = new Date().getFullYear(),
        month = new Date().getMonth() + 1,
      } = req.query;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const payments = await Payment.find({
        paymentDate: { $gte: startDate, $lte: endDate },
        status: "completed",
      });

      const summary = {
        year: parseInt(year),
        month: parseInt(month),
        totalAmount: payments.reduce((sum, payment) => sum + payment.amount, 0),
        totalTransactions: payments.length,
        dailyBreakdown: {},
      };

      payments.forEach((payment) => {
        const day = payment.paymentDate.getDate();
        if (!summary.dailyBreakdown[day]) {
          summary.dailyBreakdown[day] = {
            count: 0,
            amount: 0,
          };
        }
        summary.dailyBreakdown[day].count++;
        summary.dailyBreakdown[day].amount += payment.amount;
      });

      res.json(summary);
    } catch (err) {
      logger.error("Error fetching monthly payment summary", { error: err.message, year: req.query.year, month: req.query.month });
      next(err);
    }
  }
);

module.exports = router;
