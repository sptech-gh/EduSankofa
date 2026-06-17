const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { auth, authorizeRoles } = require("../middleware/auth");
const Invoice = require("../models/Invoice");
const Fee = require("../models/Fee");
const Payment = require("../models/Payment");
const Student = require("../models/Student");

// @route   GET /invoices
// @desc    Get all invoices with filtering options
// @access  Private
router.get("/", auth, authorizeRoles("admin", "accounts officer"), async (req, res) => {
  try {
    const {
      student,
      status,
      academicYear,
      semester,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};
    if (student) query.student = student;
    if (status) query.status = status;
    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = semester;

    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = new Date(startDate);
      if (endDate) query.issueDate.$lte = new Date(endDate);
    }

    const invoices = await Invoice.find(query)
      .populate("student", "firstName lastName studentId class")
      .populate("createdBy", "name")
      .populate("items.fee", "feeType")
      .sort({ issueDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Invoice.countDocuments(query);

    res.json({
      invoices,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /invoices/student/:studentId
// @desc    Get invoices for a specific student
// @access  Private
router.get(
  "/student/:studentId",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const invoices = await Invoice.find({ student: req.params.studentId })
        .populate("items.fee", "feeType")
        .sort({ issueDate: -1 });

      res.json(invoices);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   GET /invoices/:id
// @desc    Get invoice by ID
// @access  Private
router.get(
  "/:id",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const invoice = await Invoice.findById(req.params.id)
        .populate("student", "firstName lastName studentId class email phone")
        .populate("createdBy", "name")
        .populate("items.fee", "feeType academicYear semester");

      if (!invoice) {
        return res.status(404).json({ msg: "Invoice not found" });
      }

      res.json(invoice);
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Invoice not found" });
      }
      res.status(500).send("Server error");
    }
  }
);

// @route   POST /invoices
// @desc    Create a new invoice
// @access  Private
router.post(
  "/",
  [
    auth,
    authorizeRoles("admin", "accounts officer"),
    [
      body("student", "Student is required").notEmpty(),
      body("items", "Invoice items are required").isArray({ min: 1 }),
      body("items.*.fee", "Fee ID is required for each item").notEmpty(),
      body("items.*.amount", "Amount is required for each item").isFloat({
        min: 0,
      }),
      body("dueDate", "Due date is required").isISO8601(),
      body("academicYear", "Academic year is required").notEmpty(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { student, items, dueDate, academicYear, semester, notes } =
        req.body;

      // Check if student exists
      const studentExists = await Student.findById(student);
      if (!studentExists) {
        return res.status(404).json({ msg: "Student not found" });
      }

      // Validate and populate items
      const populatedItems = [];
      let totalAmount = 0;

      for (const item of items) {
        const fee = await Fee.findById(item.fee);
        if (!fee) {
          return res.status(404).json({ msg: `Fee not found: ${item.fee}` });
        }

        if (fee.student.toString() !== student) {
          return res.status(400).json({
            msg: `Fee ${item.fee} does not belong to the specified student`,
          });
        }

        populatedItems.push({
          fee: item.fee,
          description:
            item.description || `${fee.feeType} - ${fee.academicYear}`,
          amount: item.amount,
        });

        totalAmount += item.amount;
      }

      const invoice = new Invoice({
        student,
        items: populatedItems,
        totalAmount,
        dueDate,
        academicYear,
        semester,
        notes,
        createdBy: req.user.id,
      });

      await invoice.save();
      await invoice.populate([
        { path: "student", select: "firstName lastName studentId class" },
        { path: "items.fee", select: "feeType" },
        { path: "createdBy", select: "name" },
      ]);

      res.json(invoice);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   POST /invoices/generate/:studentId
// @desc    Auto-generate invoice for student's unpaid fees
// @access  Private
router.post(
  "/generate/:studentId",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const { academicYear, semester, dueDate } = req.body;

    // Check if student exists
    const student = await Student.findById(req.params.studentId);
    if (!student) {
      return res.status(404).json({ msg: "Student not found" });
    }

    // Find unpaid fees for the student
    const query = {
      student: req.params.studentId,
      remainingAmount: { $gt: 0 },
    };

    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = semester;

    const unpaidFees = await Fee.find(query);

    if (unpaidFees.length === 0) {
      return res
        .status(400)
        .json({ msg: "No unpaid fees found for this student" });
    }

    // Create invoice items from unpaid fees
    const items = unpaidFees.map((fee) => ({
      fee: fee._id,
      description: `${fee.feeType} - ${fee.academicYear}${
        fee.semester !== "annual" ? ` (Semester ${fee.semester})` : ""
      }`,
      amount: fee.remainingAmount,
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    const invoice = new Invoice({
      student: req.params.studentId,
      items,
      totalAmount,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      academicYear: academicYear || unpaidFees[0].academicYear,
      semester: semester || unpaidFees[0].semester,
      createdBy: req.user.id,
    });

    await invoice.save();
    await invoice.populate([
      { path: "student", select: "firstName lastName studentId class" },
      { path: "items.fee", select: "feeType" },
      { path: "createdBy", select: "name" },
    ]);

      res.json(invoice);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   PUT /invoices/:id
// @desc    Update an invoice
// @access  Private
router.put(
  "/:id",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const { dueDate, notes, status } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ msg: "Invoice not found" });
    }

    // Only allow updates if invoice is in draft status
    if (invoice.status !== "draft" && status !== "cancelled") {
      return res.status(400).json({
        msg: "Can only update draft invoices or cancel sent invoices",
      });
    }

    // Update fields
    if (dueDate) invoice.dueDate = dueDate;
    if (notes) invoice.notes = notes;
    if (status) invoice.status = status;

    await invoice.save();
    await invoice.populate([
      { path: "student", select: "firstName lastName studentId class" },
      { path: "items.fee", select: "feeType" },
      { path: "createdBy", select: "name" },
    ]);

    res.json(invoice);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Invoice not found" });
    }
    res.status(500).send("Server error");
  }
  }
);

// @route   PUT /invoices/:id/send
// @desc    Send an invoice to student
// @access  Private
router.put(
  "/:id/send",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ msg: "Invoice not found" });
    }

    if (invoice.status !== "draft") {
      return res.status(400).json({ msg: "Can only send draft invoices" });
    }

    invoice.status = "sent";
    invoice.sentDate = new Date();
    await invoice.save();

    await invoice.populate([
      { path: "student", select: "firstName lastName studentId class email" },
      { path: "items.fee", select: "feeType" },
    ]);

    // Here you would integrate with email service to send invoice
    // For now, we'll just log it
    console.log(
      `Invoice ${invoice.invoiceNumber} sent to ${invoice.student.email}`
    );

      res.json({
        msg: "Invoice sent successfully",
        invoice,
      });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Invoice not found" });
      }
      res.status(500).send("Server error");
    }
  }
);

// @route   PUT /invoices/:id/payment
// @desc    Record payment against an invoice
// @access  Private
router.put(
  "/:id/payment",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const { amount, paymentMethod, transactionId, reference } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ msg: "Invoice not found" });
    }

    if (amount > invoice.remainingAmount) {
      return res.status(400).json({
        msg: `Payment amount cannot exceed remaining amount of $${invoice.remainingAmount}`,
      });
    }

    // Update invoice payment
    invoice.paidAmount += amount;
    await invoice.save();

    // Create payment records for individual fees
    const paymentPerItem = amount / invoice.items.length; // Simple distribution

    for (const item of invoice.items) {
      const payment = new Payment({
        fee: item.fee,
        student: invoice.student,
        amount: paymentPerItem,
        paymentMethod,
        transactionId,
        reference: `Invoice: ${invoice.invoiceNumber}${
          reference ? ` - ${reference}` : ""
        }`,
        processedBy: req.user.id,
      });

      await payment.save();

      // Update fee payment
      const fee = await Fee.findById(item.fee);
      if (fee) {
        fee.paidAmount += paymentPerItem;
        await fee.save();
      }
    }

    await invoice.populate([
      { path: "student", select: "firstName lastName studentId class" },
      { path: "items.fee", select: "feeType" },
    ]);

    res.json(invoice);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
  }
);

// @route   DELETE /invoices/:id
// @desc    Delete an invoice
// @access  Private
router.delete(
  "/:id",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ msg: "Invoice not found" });
    }

    // Only allow deletion of draft invoices
    if (invoice.status !== "draft") {
      return res.status(400).json({
        msg: "Can only delete draft invoices",
      });
    }

    await Invoice.findByIdAndDelete(req.params.id);
      res.json({ msg: "Invoice deleted successfully" });
    } catch (err) {
      console.error(err.message);
      if (err.kind === "ObjectId") {
        return res.status(404).json({ msg: "Invoice not found" });
      }
      res.status(500).send("Server error");
    }
  }
);

// @route   GET /invoices/overdue/list
// @desc    Get all overdue invoices
// @access  Private
router.get(
  "/overdue/list",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const overdueInvoices = await Invoice.find({
        status: "overdue",
        remainingAmount: { $gt: 0 },
      })
        .populate("student", "firstName lastName studentId class email")
        .sort({ dueDate: 1 });

      res.json(overdueInvoices);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   GET /invoices/summary
// @desc    Get invoice summary statistics
// @access  Private
router.get(
  "/summary/stats",
  auth,
  authorizeRoles("admin", "accounts officer"),
  async (req, res) => {
    try {
      const { academicYear } = req.query;
      const query = {};
      if (academicYear) query.academicYear = academicYear;

      const invoices = await Invoice.find(query);

      const summary = {
        totalInvoices: invoices.length,
        totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
        totalPaid: invoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
        totalPending: invoices.reduce(
          (sum, inv) => sum + inv.remainingAmount,
          0
        ),
        statusBreakdown: {
          draft: 0,
          sent: 0,
          partial: 0,
          paid: 0,
          overdue: 0,
          cancelled: 0,
        },
      };

      invoices.forEach((invoice) => {
        summary.statusBreakdown[invoice.status]++;
      });

      res.json(summary);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

module.exports = router;
