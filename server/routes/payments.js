const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const { auth, authorizeRoles } = require("../middleware/auth");
const Payment = require("../models/Payment");
const StudentBill = require("../models/StudentBill");
const GhanaStudent = require("../models/GhanaStudent");
const SchoolProfile = require("../models/SchoolProfile");
const { generateReceiptNumber } = require("../utils/currency");
const { generateReceiptPDF } = require("../services/pdfService");

// Helper to fetch/ensure school ID for the tenant context
async function getSchoolId() {
  const profile = await SchoolProfile.findOne({ key: "default" });
  if (profile) return profile._id;
  return new mongoose.Types.ObjectId("6a40bb51bc763e2a0a45ad9e");
}

// @route   POST /api/payments
// @desc    Record a collection against a student bill
router.post(
  "/",
  [
    auth,
    authorizeRoles("school admin", "admin", "accountant", "accounts officer"),
    [
      body("billId", "Student Bill ID is required").isMongoId(),
      body("amountPesewas", "Amount in Pesewas must be greater than 0").isInt({ min: 1 }),
      body("paymentMethod", "Invalid payment method").isIn([
        "MTN_MOMO", "VODAFONE_CASH", "TELECEL_CASH", "AIRTELTIGO_MONEY", "BANK_TRANSFER", "CASH", "CHEQUE", "POS"
      ]),
    ],
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const isTest = process.env.NODE_ENV === "test";
    const session = isTest ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    try {
      const {
        billId,
        amountPesewas,
        paymentMethod,
        momoNetwork,
        momoPhone,
        momoReference,
        bankName,
        bankTransactionRef,
        cashReceiptNumber,
        notes,
      } = req.body;

      const schoolId = await getSchoolId();

      // Find target bill
      const bill = await StudentBill.findOne({ _id: billId, schoolId }).session(session);
      if (!bill) {
        if (session) await session.abortTransaction();
        return res.status(404).json({ message: "Student Bill not found" });
      }

      // Check overpayment
      if (amountPesewas > bill.outstandingPesewas) {
        if (session) await session.abortTransaction();
        return res.status(400).json({
          message: `Payment amount (${amountPesewas}) exceeds the outstanding balance (${bill.outstandingPesewas})`
        });
      }

      // Generate receipt number atomically
      const receiptNumber = await generateReceiptNumber(schoolId, session);

      // Create Payment document
      const payment = new Payment({
        schoolId,
        studentId: bill.studentId,
        billId,
        amountPesewas,
        paymentMethod,
        momoNetwork,
        momoPhone,
        momoReference,
        bankName,
        bankTransactionRef,
        receivedByStaffId: paymentMethod === "CASH" ? req.user._id : undefined,
        cashReceiptNumber,
        paymentDate: new Date(),
        academicYear: bill.academicYear,
        term: bill.term,
        notes,
        receiptNumber,
      });

      await payment.save({ session });

      // Update StudentBill totals & outstanding balance
      bill.totalPaidPesewas += amountPesewas;
      bill.outstandingPesewas = bill.totalFinalPesewas - bill.totalPaidPesewas;

      // Allocate payments to line items
      let remaining = amountPesewas;
      for (const item of bill.lineItems) {
        if (remaining <= 0) break;
        if (item.isPaid) continue;

        const outstandingForItem = item.finalAmountPesewas; // Simple model: item is paid or unpaid
        if (remaining >= outstandingForItem) {
          item.isPaid = true;
          item.paidDate = new Date();
          remaining -= outstandingForItem;
        }
      }

      // Set Bill Status based on payment
      if (bill.outstandingPesewas <= 0) {
        bill.status = "PAID";
      } else {
        bill.status = "PARTIALLY_PAID";
      }

      await bill.save({ session });

      // Update student balance field on student profile
      const student = await GhanaStudent.findById(bill.studentId).session(session);
      if (student) {
        student.fees.balance -= amountPesewas;
        student.fees.lastPaymentDate = new Date();
        student.fees.paymentHistory.push({
          date: new Date(),
          amount: amountPesewas,
          method: paymentMethod.includes("MOMO") ? "Mobile Money" : paymentMethod === "BANK_TRANSFER" ? "Bank Transfer" : "Cash",
          reference: receiptNumber,
          term: student.term,
          academicYear: student.academicYear,
        });
        await student.save({ session });
      }

      if (session) await session.commitTransaction();
      res.status(201).json(payment);
    } catch (err) {
      if (session) await session.abortTransaction();
      next(err);
    } finally {
      if (session) session.endSession();
    }
  }
);

// @route   GET /api/payments
// @desc    List all payments for a school
router.get(
  "/",
  auth,
  authorizeRoles("school admin", "admin", "accountant", "accounts officer"),
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const query = { schoolId };

      if (req.query.studentId) query.studentId = req.query.studentId;
      if (req.query.academicYear) query.academicYear = req.query.academicYear;
      if (req.query.term) query.term = parseInt(req.query.term, 10);

      const payments = await Payment.find(query)
        .populate("studentId", "firstName lastName studentId")
        .sort({ paymentDate: -1 });

      res.json(payments);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/payments/student/:studentId
// @desc    Get payment history for student
router.get(
  "/student/:studentId",
  auth,
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      // Guard: parents can only see their own students
      if (req.user.role === "parent") {
        const student = await GhanaStudent.findOne({ _id: req.params.studentId, "guardians.userId": req.user._id });
        if (!student) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const payments = await Payment.find({ schoolId, studentId: req.params.studentId })
        .populate("studentId", "firstName lastName studentId")
        .sort({ paymentDate: -1 });

      res.json(payments);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/payments/:id
// @desc    Get details for a single payment
router.get(
  "/:id",
  auth,
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const payment = await Payment.findOne({ _id: req.params.id, schoolId })
        .populate("studentId", "firstName lastName studentId currentClass");

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Guard: parents can only see their own student's payments
      if (req.user.role === "parent") {
        const student = await GhanaStudent.findOne({ _id: payment.studentId, "guardians.userId": req.user._id });
        if (!student) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(payment);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/payments/:paymentId/receipt/pdf
// @desc    Download receipt PDF
router.get(
  "/:paymentId/receipt/pdf",
  auth,
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const payment = await Payment.findOne({ _id: req.params.paymentId, schoolId });
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const student = await GhanaStudent.findById(payment.studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Guard: parents can only download receipts for their own student
      if (req.user.role === "parent") {
        const isLinked = student.guardians.some(
          (g) => g.userId && g.userId.toString() === req.user._id.toString()
        );
        if (!isLinked) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const school = await SchoolProfile.findById(schoolId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=receipt-${payment.receiptNumber}.pdf`);

      generateReceiptPDF(res, payment, school || {}, student);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @route   PATCH /api/payments/:paymentId/dishonour
 * @desc    Mark a cheque payment as dishonoured and atomically reverse the bill payment
 * @access  Admin, Accountant, Accounts Officer only
 * @requirements Goals Module 4, Outcome 4.7 - Atomic cheque reversal
 */
router.patch(
  "/:paymentId/dishonour",
  [
    auth,
    authorizeRoles("school admin", "admin", "accountant", "accounts officer"),
    [
      body("reason", "Reason for dishonour is required").notEmpty().trim().isLength({ min: 10, max: 500 }),
    ],
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const schoolId = await getSchoolId();
        const { reason } = req.body;

        // 1. Fetch the payment
        const payment = await Payment.findOne({
          _id: req.params.paymentId,
          schoolId,
        }).session(session);

        if (!payment) {
          throw Object.assign(new Error("Payment not found"), { statusCode: 404 });
        }

        // 2. Validate payment can be dishonoured
        if (payment.paymentMethod !== "CHEQUE") {
          throw Object.assign(
            new Error("Only cheque payments can be marked as dishonoured"),
            { statusCode: 400 }
          );
        }

        if (payment.chequeStatus === "DISHONOURED") {
          throw Object.assign(
            new Error("This payment has already been marked as dishonoured"),
            { statusCode: 400 }
          );
        }

        if (payment.chequeStatus === "CLEARED") {
          throw Object.assign(
            new Error("Cannot dishonour a cheque that has already been cleared. Payment is final."),
            { statusCode: 400 }
          );
        }

        // 3. Fetch the associated bill
        const bill = await StudentBill.findOne({
          _id: payment.billId,
          schoolId,
        }).session(session);

        if (!bill) {
          throw Object.assign(new Error("Associated bill not found"), { statusCode: 404 });
        }

        // 4. Reverse the payment on the bill (atomic update)
        const paymentAmountPesewas = payment.amountPesewas || 0;
        
        bill.paidAmountPesewas = Math.max(0, (bill.paidAmountPesewas || 0) - paymentAmountPesewas);
        bill.remainingAmountPesewas = Math.max(0, (bill.totalAmountPesewas || 0) - bill.paidAmountPesewas);
        
        // Update bill status if necessary
        if (bill.remainingAmountPesewas > 0 && bill.status === "PAID") {
          bill.status = "PARTIALLY_PAID";
        } else if (bill.remainingAmountPesewas === bill.totalAmountPesewas && bill.paidAmountPesewas === 0) {
          bill.status = "UNPAID";
        }

        await bill.save({ session });

        // 5. Mark payment as dishonoured
        payment.chequeStatus = "DISHONOURED";
        payment.status = "DISHONOURED";
        payment.dishonouredAt = new Date();
        payment.dishonouredBy = req.user._id;
        payment.dishonourReason = reason;
        
        // Add to payment history
        if (!payment.statusHistory) payment.statusHistory = [];
        payment.statusHistory.push({
          status: "DISHONOURED",
          changedAt: new Date(),
          changedBy: req.user._id,
          reason: reason,
        });

        await payment.save({ session });

        // 6. Create audit log entry
        const AuditLog = require("../models/AuditLog");
        await AuditLog.create([{
          action: "CHEQUE_DISHONOURED",
          performedBy: req.user._id,
          targetModel: "Payment",
          targetId: payment._id,
          details: {
            paymentId: payment._id.toString(),
            receiptNumber: payment.receiptNumber,
            billId: bill._id.toString(),
            studentId: payment.studentId?.toString(),
            amountPesewas: paymentAmountPesewas,
            chequeNumber: payment.chequeNumber,
            reason: reason,
            billStatusBefore: bill.status,
            billPaidAmountBefore: bill.paidAmountPesewas + paymentAmountPesewas,
            billPaidAmountAfter: bill.paidAmountPesewas,
            billRemainingAmountAfter: bill.remainingAmountPesewas,
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        }], { session });

        // 7. TODO: Send notification to admin/accountant about dishonoured cheque
        // This would integrate with the notification system
      });

      // Transaction successful - fetch updated payment to return
      const updatedPayment = await Payment.findById(req.params.paymentId)
        .populate("studentId", "firstName lastName studentId")
        .populate("billId", "billNumber totalAmountPesewas paidAmountPesewas remainingAmountPesewas status");

      res.json({
        message: "Cheque marked as dishonoured and payment reversed successfully",
        payment: updatedPayment,
      });

    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      next(err);
    } finally {
      session.endSession();
    }
  }
);

module.exports = router;
