const mongoose = require("mongoose");

const InvoiceItemSchema = new mongoose.Schema({
  fee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Fee",
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
});

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  items: [InvoiceItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  remainingAmount: {
    type: Number,
    default: function () {
      return this.totalAmount - this.paidAmount;
    },
  },
  status: {
    type: String,
    enum: ["draft", "sent", "partial", "paid", "overdue", "cancelled"],
    default: "draft",
  },
  issueDate: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  academicYear: {
    type: String,
    required: true,
  },
  semester: {
    type: String,
    enum: ["1", "2", "annual"],
    default: "annual",
  },
  notes: {
    type: String,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sentDate: {
    type: Date,
  },
  lastReminderDate: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Generate invoice number if not provided
InvoiceSchema.pre("save", function (next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    this.invoiceNumber = `INV${year}${month}${random}`;
  }

  // Calculate remaining amount and update status
  this.remainingAmount = this.totalAmount - this.paidAmount;

  if (
    this.paidAmount === 0 &&
    this.status !== "draft" &&
    this.status !== "cancelled"
  ) {
    this.status = new Date() > this.dueDate ? "overdue" : "sent";
  } else if (this.paidAmount >= this.totalAmount) {
    this.status = "paid";
  } else if (this.paidAmount > 0) {
    this.status = "partial";
  }

  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
InvoiceSchema.index({ student: 1, academicYear: 1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ dueDate: 1 });
InvoiceSchema.index({ invoiceNumber: 1 });

module.exports = mongoose.model("Invoice", InvoiceSchema);
