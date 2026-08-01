const express = require("express");
const mongoose = require("mongoose");
const { auth, authorizeRoles } = require("../middleware/auth");
const { generateReceiptNumber } = require("../utils/currency");
const { generateBillPDF, generateReceiptPDF } = require("../services/pdfService");
const StudentBill = require("../models/StudentBill");
const Payment = require("../models/Payment");
const GhanaStudent = require("../models/GhanaStudent");
const SchoolProfile = require("../models/SchoolProfile");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const { sendReminder } = require("../services/reminderDeliveryService");

const paymentsRouter = express.Router();
const billsRouter = express.Router();

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

const SUPPORTED_PAYMENT_METHODS = new Set([
  "CASH",
  "MTN_MOMO",
  "TELECEL_CASH",
  "AIRTELTIGO_MONEY",
  "BANK_TRANSFER",
  "CHEQUE",
  "POS",
  "cash",
  "bank",
  "bank_transfer",
  "mobile_money",
  "cheque",
  "card",
]);

const normalizePaymentMethod = (method, momoNetwork = "") => {
  const raw = String(method || "").trim().toUpperCase();
  if (raw === "CASH") return "CASH";
  if (raw === "MTN_MOMO" || raw === "MOMO") return "MTN_MOMO";
  if (raw === "TELECEL_CASH" || raw === "VODAFONE_CASH" || raw === "VODAFONE") return "TELECEL_CASH";
  if (raw === "AIRTELTIGO_MONEY") return "AIRTELTIGO_MONEY";
  if (raw === "BANK_TRANSFER" || raw === "BANK") return "BANK_TRANSFER";
  if (raw === "CHEQUE") return "CHEQUE";
  if (raw === "POS") return "POS";
  if (raw === "MOBILE_MONEY") {
    const network = String(momoNetwork || "").trim().toUpperCase();
    if (network === "AIRTELTIGO") return "AIRTELTIGO_MONEY";
    if (network === "TELECEL" || network === "VODAFONE") return "TELECEL_CASH";
    return "MTN_MOMO";
  }
  if (raw === "CARD") return "POS";
  return raw;
};

const isMoney = (value) => Number.isInteger(Number(value)) && Number(value) >= 0;

const formatPesewas = (amountPesewas) => `GHS ${(Number(amountPesewas || 0) / 100).toFixed(2)}`;

const toAuditRole = (role) => String(role || "Staff")
  .trim()
  .toLowerCase()
  .split(/\s+/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

const getAuditUserName = (user) => (
  user?.name
  || [user?.firstName, user?.lastName].filter(Boolean).join(" ")
  || user?.email
  || "Financial User"
);

const renderReminderMessage = ({ template, schoolName, student, bill }) => {
  const fallback = [
    `${schoolName}: Fee reminder for ${student.firstName} ${student.lastName}.`,
    `Outstanding balance: ${formatPesewas(bill.outstandingPesewas)}.`,
    `Academic year: ${bill.academicYear}, Term ${bill.term}.`,
  ].join(" ");

  const messageTemplate = String(template || process.env.FEE_REMINDER_TEMPLATE || fallback);
  return messageTemplate
    .replace(/\{\{schoolName\}\}/g, schoolName)
    .replace(/\{\{studentName\}\}/g, `${student.firstName} ${student.lastName}`)
    .replace(/\{\{studentId\}\}/g, student.studentId || "")
    .replace(/\{\{academicYear\}\}/g, bill.academicYear)
    .replace(/\{\{term\}\}/g, String(bill.term))
    .replace(/\{\{outstandingBalance\}\}/g, formatPesewas(bill.outstandingPesewas))
    .replace(/\{\{billRef\}\}/g, bill.billRef || "");
};

const validatePaymentMethodPayload = (paymentMethod, body) => {
  switch (paymentMethod) {
    case "CASH":
      return true;
    case "MTN_MOMO":
    case "TELECEL_CASH":
    case "AIRTELTIGO_MONEY":
      return !!body.momoPhone && !!body.momoReference;
    case "BANK_TRANSFER":
      return !!body.bankName && !!body.bankTransactionRef;
    case "CHEQUE":
      return !!body.chequeNumber && !!body.bankName && !!body.chequeDate;
    case "POS":
      return !!body.posTerminalId && !!body.posReference && !!body.cardType;
    default:
      return false;
  }
};

const applyPaymentToBillAndStudent = async ({ bill, payment, student, session }) => {
  bill.totalPaidPesewas += payment.amountPesewas;
  bill.outstandingPesewas = Math.max(0, bill.totalFinalPesewas - bill.totalPaidPesewas);

  let remaining = payment.amountPesewas;
  for (const item of bill.lineItems) {
    if (remaining <= 0) break;
    if (item.isPaid) continue;

    const outstandingForItem = item.finalAmountPesewas - (item.paidAmountPesewas || 0);
    if (remaining >= outstandingForItem) {
      item.isPaid = true;
      item.paidDate = new Date();
      item.paidAmountPesewas = item.finalAmountPesewas;
      remaining -= outstandingForItem;
    }
  }

  bill.status = bill.outstandingPesewas <= 0 ? "PAID" : "PARTIALLY_PAID";

  await bill.save({ session });

  if (student) {
    if (!student.fees) {
      student.fees = { balance: 0 };
    }
    student.fees.balance -= payment.amountPesewas;
    student.fees.lastPaymentDate = new Date();
    student.fees.paymentHistory.push({
      date: new Date(),
      amount: payment.amountPesewas,
      method: payment.paymentMethod.includes("MOMO")
        ? "Mobile Money"
        : payment.paymentMethod === "BANK_TRANSFER"
        ? "Bank Transfer"
        : payment.paymentMethod === "CHEQUE"
        ? "Cheque"
        : payment.paymentMethod === "POS"
        ? "Card"
        : "Cash",
      reference: payment.receiptNumber,
      term: student.term,
      academicYear: student.academicYear,
    });
    await student.save({ session });
  }
};

const rebuildBillFromPayments = async ({ bill, payments, student, session }) => {
  const sortedPayments = [...payments].sort(
    (a, b) => new Date(a.paymentDate || a.createdAt) - new Date(b.paymentDate || b.createdAt)
  );

  bill.lineItems.forEach((item) => {
    item.isPaid = false;
    item.paidAmountPesewas = 0;
    item.paidDate = undefined;
  });

  bill.totalPaidPesewas = 0;

  for (const payment of sortedPayments) {
    let remaining = payment.amountPesewas;
    bill.totalPaidPesewas += payment.amountPesewas;

    for (const item of bill.lineItems) {
      if (remaining <= 0) break;
      const outstandingForItem = Math.max(0, item.finalAmountPesewas - (item.paidAmountPesewas || 0));
      if (outstandingForItem <= 0) continue;

      const applied = Math.min(remaining, outstandingForItem);
      item.paidAmountPesewas = (item.paidAmountPesewas || 0) + applied;
      if (item.paidAmountPesewas >= item.finalAmountPesewas) {
        item.isPaid = true;
        item.paidDate = payment.paymentDate || new Date();
      }
      remaining -= applied;
    }
  }

  bill.outstandingPesewas = Math.max(0, bill.totalFinalPesewas - bill.totalPaidPesewas);
  bill.status = bill.outstandingPesewas <= 0 ? "PAID" : "PARTIALLY_PAID";
  await bill.save({ session });

  if (student) {
    student.fees = student.fees || { balance: 0 };
    student.fees.balance = Math.max(0, bill.outstandingPesewas);
    student.fees.lastPaymentDate = sortedPayments.length > 0 ? new Date(sortedPayments[sortedPayments.length - 1].paymentDate || Date.now()) : student.fees.lastPaymentDate;
    await student.save({ session });
  }
};

// ==========================================
// PAYMENTS ROUTER ENDPOINTS
// ==========================================

// @route   POST /api/payments
// @desc    Process payment collection for a bill
paymentsRouter.post("/", auth, authorizeRoles("school admin", "admin", "staff", "accountant", "accounts officer"), async (req, res, next) => {
  const isTest = process.env.NODE_ENV === "test";
  const session = isTest ? null : await mongoose.startSession();

  try {
    const {
      billId,
      amountPesewas,
      paymentMethod,
      momoNetwork,
      momoPhone,
      momoReference,
      bankName,
      bankBranch,
      bankTransactionRef,
      cashReceiptNumber,
      chequeNumber,
      chequeDate,
      posTerminalId,
      posReference,
      cardType,
      notes,
    } = req.body;

    const canonicalMethod = normalizePaymentMethod(paymentMethod, momoNetwork);

    if (!billId || amountPesewas === undefined || !paymentMethod) {
      return res.status(400).json({ message: "billId, amountPesewas, and paymentMethod are required" });
    }

    if (["MTN_MOMO", "TELECEL_CASH", "AIRTELTIGO_MONEY"].includes(canonicalMethod)) {
      return res.status(400).json({
        message: "Mobile money payments must be initiated through /api/paystack/momo/initiate and confirmed by Paystack webhook before balances are updated",
      });
    }

    if (!isMoney(amountPesewas) || Number(amountPesewas) <= 0) {
      return res.status(400).json({ message: "payment amount must be a non-negative integer greater than zero" });
    }

    if (!SUPPORTED_PAYMENT_METHODS.has(String(paymentMethod)) && !SUPPORTED_PAYMENT_METHODS.has(canonicalMethod)) {
      return res.status(400).json({ message: "Unsupported payment method" });
    }

    if (!validatePaymentMethodPayload(canonicalMethod, req.body)) {
      return res.status(400).json({ message: `Required fields missing for ${canonicalMethod}` });
    }

    const result = await (session
      ? session.withTransaction(async () => {
          const bill = await StudentBill.findById(billId).session(session);
          if (!bill) {
            throw Object.assign(new Error("student bill not found"), { statusCode: 404 });
          }

          if (Number(amountPesewas) > bill.outstandingPesewas) {
            throw Object.assign(new Error(`payment amount (${amountPesewas}) exceeds outstanding balance (${bill.outstandingPesewas})`), { statusCode: 400 });
          }

          const receiptNumber = await generateReceiptNumber(bill.schoolId, session);
          const paymentData = {
            schoolId: bill.schoolId,
            studentId: bill.studentId,
            billId: bill._id,
            amountPesewas: Number(amountPesewas),
            paymentMethod: canonicalMethod,
            receiptNumber,
            transactionId: receiptNumber,
            academicYear: bill.academicYear,
            term: bill.term,
            notes,
            status: canonicalMethod === "CHEQUE" ? "PENDING_CLEARANCE" : "completed",
            clearanceStatus: canonicalMethod === "CHEQUE" ? "PENDING" : undefined,
          };

          if (canonicalMethod === "MTN_MOMO" || canonicalMethod === "TELECEL_CASH" || canonicalMethod === "AIRTELTIGO_MONEY") {
            paymentData.momoNetwork = momoNetwork || (canonicalMethod === "MTN_MOMO" ? "MTN" : canonicalMethod === "TELECEL_CASH" ? "Telecel" : "AirtelTigo");
            paymentData.momoPhone = momoPhone;
            paymentData.momoReference = momoReference || receiptNumber;
          } else if (canonicalMethod === "BANK_TRANSFER") {
            paymentData.bankName = bankName;
            paymentData.bankBranch = bankBranch;
            paymentData.bankTransactionRef = bankTransactionRef || receiptNumber;
          } else if (canonicalMethod === "CASH") {
            paymentData.receivedByStaffId = req.user._id;
            paymentData.cashReceiptNumber = cashReceiptNumber || receiptNumber;
          } else if (canonicalMethod === "CHEQUE") {
            paymentData.chequeNumber = chequeNumber;
            paymentData.chequeDate = chequeDate;
            paymentData.bankName = bankName;
          } else if (canonicalMethod === "POS") {
            paymentData.posTerminalId = posTerminalId;
            paymentData.posReference = posReference || receiptNumber;
            paymentData.cardType = cardType;
          }

          const payment = new Payment(paymentData);
          await payment.save({ session });

          const student = await GhanaStudent.findById(bill.studentId).session(session);
          if (!student) {
            throw Object.assign(new Error("student not found"), { statusCode: 404 });
          }

          if (canonicalMethod !== "CHEQUE") {
            await applyPaymentToBillAndStudent({ bill, payment, student, session });
          } else {
            bill.status = "PENDING_CLEARANCE";
            await bill.save({ session });
          }

          return payment;
        })
      : (async () => {
          const bill = await StudentBill.findById(billId);
          if (!bill) {
            const err = new Error("student bill not found");
            err.statusCode = 404;
            throw err;
          }

          if (Number(amountPesewas) > bill.outstandingPesewas) {
            const err = new Error(`payment amount (${amountPesewas}) exceeds outstanding balance (${bill.outstandingPesewas})`);
            err.statusCode = 400;
            throw err;
          }

          const receiptNumber = await generateReceiptNumber(bill.schoolId, null);
          const paymentData = {
            schoolId: bill.schoolId,
            studentId: bill.studentId,
            billId: bill._id,
            amountPesewas: Number(amountPesewas),
            paymentMethod: canonicalMethod,
            receiptNumber,
            transactionId: receiptNumber,
            academicYear: bill.academicYear,
            term: bill.term,
            notes,
            status: canonicalMethod === "CHEQUE" ? "PENDING_CLEARANCE" : "completed",
            clearanceStatus: canonicalMethod === "CHEQUE" ? "PENDING" : undefined,
          };

          if (canonicalMethod === "MTN_MOMO" || canonicalMethod === "TELECEL_CASH" || canonicalMethod === "AIRTELTIGO_MONEY") {
            paymentData.momoNetwork = momoNetwork || (canonicalMethod === "MTN_MOMO" ? "MTN" : canonicalMethod === "TELECEL_CASH" ? "Telecel" : "AirtelTigo");
            paymentData.momoPhone = momoPhone;
            paymentData.momoReference = momoReference || receiptNumber;
          } else if (canonicalMethod === "BANK_TRANSFER") {
            paymentData.bankName = bankName;
            paymentData.bankBranch = bankBranch;
            paymentData.bankTransactionRef = bankTransactionRef || receiptNumber;
          } else if (canonicalMethod === "CASH") {
            paymentData.receivedByStaffId = req.user._id;
            paymentData.cashReceiptNumber = cashReceiptNumber || receiptNumber;
          } else if (canonicalMethod === "CHEQUE") {
            paymentData.chequeNumber = chequeNumber;
            paymentData.chequeDate = chequeDate;
            paymentData.bankName = bankName;
          } else if (canonicalMethod === "POS") {
            paymentData.posTerminalId = posTerminalId;
            paymentData.posReference = posReference || receiptNumber;
            paymentData.cardType = cardType;
          }

          const payment = new Payment(paymentData);
          await payment.save();

          const student = await GhanaStudent.findById(bill.studentId);
          if (!student) {
            const err = new Error("student not found");
            err.statusCode = 404;
            throw err;
          }

          if (canonicalMethod !== "CHEQUE") {
            await applyPaymentToBillAndStudent({ bill, payment, student, session: null });
          } else {
            bill.status = "PENDING_CLEARANCE";
            await bill.save();
          }

          return payment;
        })());

res.status(201).json(result);
  } catch (err) {
    if (session) await session.abortTransaction();
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ message: err.message || "Server error" });
  } finally {
    if (session) session.endSession();
  }
});

// @route   GET /api/payments
// @desc    List all payments for a school
paymentsRouter.get("/", auth, authorizeRoles("school admin", "admin", "staff", "accountant", "accounts officer"), async (req, res, next) => {
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
});

// @route   GET /api/payments/student/:studentId
// @desc    Get payment history for student
paymentsRouter.get("/student/:studentId", auth, async (req, res, next) => {
  try {
    const schoolId = await getSchoolId();
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
});

// @route   GET /api/payments/:id
// @desc    Get details for a single payment
paymentsRouter.get("/:id", auth, async (req, res, next) => {
  try {
    const schoolId = await getSchoolId();
    const payment = await Payment.findOne({ _id: req.params.id, schoolId })
      .populate("studentId", "firstName lastName studentId currentClass");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

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
});

// @route   PUT /api/payments/:paymentId/clearance
// @desc    Mark a cheque as cleared or dishonoured
paymentsRouter.put("/:paymentId/clearance", auth, authorizeRoles("school admin", "admin", "staff", "accountant", "accounts officer"), async (req, res, next) => {
  const { clearanceStatus } = req.body;
  const normalizedStatus = String(clearanceStatus || "").trim().toUpperCase();
  if (!["CLEARED", "DISHONOURED"].includes(normalizedStatus)) {
    return res.status(400).json({ message: "clearanceStatus must be CLEARED or DISHONOURED" });
  }

  const isTest = process.env.NODE_ENV === "test";
  const session = isTest ? null : await mongoose.startSession();

  try {
    const payment = await Payment.findById(req.params.paymentId).session(session);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    if (payment.paymentMethod !== "CHEQUE") {
      return res.status(400).json({ message: "Only cheque payments can be cleared or dishonoured" });
    }

    const bill = await StudentBill.findById(payment.billId).session(session);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    const student = await GhanaStudent.findById(payment.studentId).session(session);

    if (session) {
      await session.withTransaction(async () => {
        if (normalizedStatus === "CLEARED") {
          payment.clearanceStatus = "CLEARED";
          payment.status = "completed";
          await payment.save({ session });

          if (bill.status === "PENDING_CLEARANCE") {
            await applyPaymentToBillAndStudent({ bill, payment, student, session });
          }
        } else {
          payment.clearanceStatus = "DISHONOURED";
          payment.status = "failed";
          await payment.save({ session });

          const activePayments = await Payment.find({
            billId: bill._id,
            _id: { $ne: payment._id },
            clearanceStatus: { $ne: "DISHONOURED" },
          }).session(session);
          await rebuildBillFromPayments({ bill, payments: activePayments, student, session });
        }
      });
    } else if (normalizedStatus === "CLEARED") {
      payment.clearanceStatus = "CLEARED";
      payment.status = "completed";
      await payment.save();
      if (bill.status === "PENDING_CLEARANCE") {
        await applyPaymentToBillAndStudent({ bill, payment, student, session: null });
      }
    } else {
      payment.clearanceStatus = "DISHONOURED";
      payment.status = "failed";
      await payment.save();
      const activePayments = await Payment.find({
        billId: bill._id,
        _id: { $ne: payment._id },
        clearanceStatus: { $ne: "DISHONOURED" },
      });
      await rebuildBillFromPayments({ bill, payments: activePayments, student, session: null });
    }

    res.json(payment);
  } catch (err) {
    next(err);
  } finally {
    if (session) session.endSession();
  }
});

// @route   GET /api/payments/:paymentId/receipt/pdf
// @desc    Download payment receipt PDF (Logs reprint audit & applies DUPLICATE watermark on reprint)
paymentsRouter.get("/:paymentId/receipt/pdf", auth, async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId)
      .populate("studentId")
      .populate("billId")
      .populate("receivedByStaffId", "name email firstName lastName")
      .populate("processedBy", "name email firstName lastName");
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Tenant check
    const userRole = String(req.user.role).toLowerCase();
    if (userRole === "parent" && payment.studentId.guardians.every(g => g.userId?.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: "Access denied" });
    }

    const school = await SchoolProfile.findOne({ key: "default" }) || { schoolName: "EduSankofa Academy" };

    const isReprint = req.query.isReprint === "true" || (payment.reprintCount && payment.reprintCount > 0);

    if (isReprint) {
      payment.reprintCount = (payment.reprintCount || 0) + 1;
      await payment.save();

      // Log Audit Event for Receipt Reprint
      try {
        const AuditLog = mongoose.model("AuditLog");
        const auditEntry = new AuditLog({
          user: req.user._id,
          userRole: req.user.role || "Staff",
          userName: req.user.name || req.user.email || "Staff User",
          action: "RECEIPT_GENERATE",
          category: "FINANCIAL",
          resource: `Receipt Reprint: ${payment.receiptNumber}`,
          resourceType: "Payment",
          resourceId: payment._id,
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "",
          notes: `Receipt ${payment.receiptNumber} reprinted by ${req.user.name || req.user.email}. Reprint count: ${payment.reprintCount}`,
        });
        await auditEntry.save();
      } catch (auditErr) {
        console.error("Audit log error on receipt reprint:", auditErr);
      }
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=receipt-${payment.receiptNumber}${isReprint ? '-duplicate' : ''}.pdf`);

    generateReceiptPDF(res, payment, school, payment.studentId, isReprint);
  } catch (err) {
    next(err);
  }
});


// ==========================================
// BILLS ROUTER ENDPOINTS
// ==========================================

// @route   GET /api/bills
// @desc    List all student bills (filterable by studentId, academicYear, term)
billsRouter.get("/", auth, async (req, res, next) => {
  try {
    const { studentId, academicYear, term } = req.query;
    const filter = {};
    if (studentId) filter.studentId = studentId;
    if (academicYear) filter.academicYear = academicYear;
    if (term) filter.term = parseInt(term, 10);

    const userRole = String(req.user.role).toLowerCase();
    if (userRole === "parent") {
      const students = await GhanaStudent.find({ "guardians.userId": req.user._id });
      const parentStudentIds = students.map(s => s._id.toString());
      if (studentId && !parentStudentIds.includes(studentId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      filter.studentId = { $in: parentStudentIds };
    }

    const bills = await StudentBill.find(filter).populate("studentId", "firstName lastName studentId").sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/bills/:billId/discounts/manual
// @desc    Apply an audited manual discount to a bill line item
billsRouter.post(
  "/:billId/discounts/manual",
  auth,
  authorizeRoles("school admin", "admin", "accountant"),
  async (req, res, next) => {
    const session = process.env.NODE_ENV === "test" ? null : await mongoose.startSession();
    try {
      const { lineItemId, amountPesewas, reason } = req.body;
      const discountAmountPesewas = Number(amountPesewas);

      if (!lineItemId || amountPesewas === undefined || !reason) {
        return res.status(400).json({ message: "lineItemId, amountPesewas, and reason are required" });
      }

      if (!Number.isInteger(discountAmountPesewas) || discountAmountPesewas <= 0) {
        return res.status(400).json({ message: "amountPesewas must be a positive integer in pesewas" });
      }

      const applyDiscount = async () => {
        const bill = await StudentBill.findById(req.params.billId).session(session);
        if (!bill) {
          throw Object.assign(new Error("Bill not found"), { statusCode: 404 });
        }

        const lineItem = bill.lineItems.id(lineItemId);
        if (!lineItem) {
          throw Object.assign(new Error("Bill line item not found"), { statusCode: 404 });
        }

        const itemOutstanding = Math.max(0, lineItem.finalAmountPesewas - (lineItem.paidAmountPesewas || 0));
        if (discountAmountPesewas > itemOutstanding) {
          throw Object.assign(new Error("Manual discount cannot exceed the unpaid amount for this line item"), { statusCode: 400 });
        }

        lineItem.discountAmountPesewas = (lineItem.discountAmountPesewas || 0) + discountAmountPesewas;
        lineItem.finalAmountPesewas -= discountAmountPesewas;
        lineItem.discountType = "CUSTOM";
        lineItem.discountReason = reason;
        if (lineItem.finalAmountPesewas <= (lineItem.paidAmountPesewas || 0)) {
          lineItem.isPaid = true;
          lineItem.paidDate = lineItem.paidDate || new Date();
        }

        bill.totalDiscountPesewas += discountAmountPesewas;
        bill.totalFinalPesewas -= discountAmountPesewas;
        bill.outstandingPesewas = Math.max(0, bill.totalFinalPesewas - bill.totalPaidPesewas);
        bill.status = bill.outstandingPesewas <= 0
          ? "PAID"
          : bill.totalPaidPesewas > 0
          ? "PARTIALLY_PAID"
          : "ISSUED";
        bill.lastUpdatedBy = req.user._id || req.user.userId;

        await bill.save({ session });

        const auditLog = new AuditLog({
          user: req.user._id || req.user.userId,
          userRole: toAuditRole(req.user.role),
          userName: getAuditUserName(req.user),
          action: "MANUAL_DISCOUNT_APPLY",
          category: "FINANCIAL",
          resource: `Manual discount on bill ${bill.billRef || bill._id}`,
          resourceType: "StudentBill",
          resourceId: bill._id,
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "",
          notes: reason,
          requestBody: JSON.stringify({
            billId: String(bill._id),
            lineItemId,
            amountPesewas: discountAmountPesewas,
            reason,
          }),
        });
        await auditLog.save({ session });

        return bill;
      };

      const bill = session
        ? await session.withTransaction(applyDiscount)
        : await applyDiscount();

      res.json({
        message: "Manual discount applied",
        bill,
      });
    } catch (err) {
      res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
    } finally {
      if (session) session.endSession();
    }
  }
);

// @route   POST /api/bills/reminders/send
// @desc    Send outstanding-balance reminders to current guardians via Hubtel SMS and/or Meta WhatsApp
billsRouter.post(
  "/reminders/send",
  auth,
  authorizeRoles("school admin", "admin", "staff", "accountant", "accounts officer"),
  async (req, res, next) => {
    try {
      const {
        billIds,
        studentId,
        academicYear,
        term,
        classCode,
        channels = ["sms"],
        messageTemplate,
      } = req.body;

      const requestedChannels = Array.isArray(channels)
        ? channels.map((channel) => String(channel).trim().toLowerCase()).filter(Boolean)
        : [String(channels).trim().toLowerCase()].filter(Boolean);
      const deliveryChannels = [...new Set(requestedChannels)];

      if (deliveryChannels.length === 0) {
        return res.status(400).json({ message: "At least one delivery channel is required" });
      }

      const unsupportedChannels = deliveryChannels.filter((channel) => !["sms", "whatsapp"].includes(channel));
      if (unsupportedChannels.length > 0) {
        return res.status(400).json({
          message: "Unsupported reminder channel",
          unsupportedChannels,
        });
      }

      const filter = { outstandingPesewas: { $gt: 0 } };
      if (Array.isArray(billIds) && billIds.length > 0) filter._id = { $in: billIds };
      if (studentId) filter.studentId = studentId;
      if (academicYear) filter.academicYear = academicYear;
      if (term) filter.term = parseInt(term, 10);
      if (classCode) filter.classCode = classCode;

      const bills = await StudentBill.find(filter).populate("studentId");
      const school = await SchoolProfile.findOne({ key: "default" });
      const schoolName = school?.schoolName || "EduSankofa";
      const results = [];

      for (const bill of bills) {
        const student = bill.studentId;
        if (!student) {
          results.push({
            billId: bill._id,
            status: "skipped",
            reason: "Bill has no linked student",
          });
          continue;
        }

        const guardians = (student.guardians || []).filter((guardian) => guardian.phone || guardian.userId);
        if (guardians.length === 0) {
          results.push({
            billId: bill._id,
            studentId: student._id,
            status: "skipped",
            reason: "Student has no guardian contact",
          });
          continue;
        }

        const message = renderReminderMessage({
          template: messageTemplate,
          schoolName,
          student,
          bill,
        });

        for (const guardian of guardians) {
          const guardianResult = {
            billId: bill._id,
            studentId: student._id,
            guardianUserId: guardian.userId,
            guardianPhone: guardian.phone,
            channels: {},
          };

          let notification = null;
          if (guardian.userId) {
            notification = new Notification({
              recipient: guardian.userId,
              sender: req.user.userId || req.user._id,
              title: "Fee reminder",
              message,
              type: "reminder",
              priority: "medium",
              actionRequired: true,
              actionUrl: `/parent/bills/${bill._id}`,
              actionText: "View bill",
              deliveryMethod: ["in-app", ...deliveryChannels],
              relatedEntity: {
                entityType: "student",
                entityId: student._id,
              },
              metadata: {
                category: "fee-reminder",
                data: {
                  billId: bill._id,
                  billRef: bill.billRef,
                  outstandingPesewas: bill.outstandingPesewas,
                  academicYear: bill.academicYear,
                  term: bill.term,
                },
              },
            });
            await notification.save();
          }

          if (!guardian.phone) {
            guardianResult.status = "partial";
            guardianResult.reason = "Guardian has no phone number for external channels";
            results.push(guardianResult);
            continue;
          }

          try {
            const providerResults = await sendReminder({
              channels: deliveryChannels,
              to: guardian.phone,
              message,
            });

            for (const providerResult of providerResults) {
              guardianResult.channels[providerResult.channel] = {
                status: "accepted",
                provider: providerResult.provider,
                recipient: providerResult.recipient,
                providerResponse: providerResult.providerResponse,
              };
              if (notification) {
                await notification.markDelivered(providerResult.channel);
              }
            }
            guardianResult.status = "sent";
          } catch (err) {
            guardianResult.status = "failed";
            guardianResult.error = err.message;
          }

          results.push(guardianResult);
        }
      }

      const sent = results.filter((result) => result.status === "sent").length;
      const failed = results.filter((result) => result.status === "failed").length;
      const skipped = results.filter((result) => result.status === "skipped").length;

      res.json({
        message: "Fee reminders processed",
        billCount: bills.length,
        sent,
        failed,
        skipped,
        results,
      });
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/bills/:id
// @desc    Get bill details by ID
billsRouter.get("/:id", auth, async (req, res, next) => {
  try {
    const bill = await StudentBill.findById(req.params.id).populate("studentId");
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    const userRole = String(req.user.role).toLowerCase();
    if (userRole === "parent" && bill.studentId.guardians.every(g => g.userId?.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(bill);
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/bills/:billId/pdf
// @desc    Download student invoice PDF
billsRouter.get("/:billId/pdf", auth, async (req, res, next) => {
  try {
    const bill = await StudentBill.findById(req.params.billId).populate("studentId");
    if (!bill) {
      return res.status(404).json({ message: "Student bill not found" });
    }

    const userRole = String(req.user.role).toLowerCase();
    if (userRole === "parent" && bill.studentId.guardians.every(g => g.userId?.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: "Access denied" });
    }

    const school = await SchoolProfile.findOne({ key: "default" }) || { schoolName: "EduSankofa Academy" };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=bill-${bill.studentId.studentId}.pdf`);

    generateBillPDF(res, bill, school, bill.studentId);
  } catch (err) {
    next(err);
  }
});

module.exports = {
  paymentsRouter,
  billsRouter
};
