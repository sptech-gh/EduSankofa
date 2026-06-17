const mongoose = require("mongoose");

const FeeSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  feeType: {
    type: String,
    required: true,
    enum: [
      "tuition",
      "library",
      "laboratory",
      "sports",
      "transport",
      "examination",
      "admission",
      "development",
      "miscellaneous",
    ],
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
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "partial", "paid", "overdue"],
    default: "pending",
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  remainingAmount: {
    type: Number,
    default: function () {
      return this.amount - this.paidAmount;
    },
  },
  description: {
    type: String,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
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

// Update remainingAmount and status before saving
FeeSchema.pre("save", function (next) {
  this.remainingAmount = this.amount - this.paidAmount;

  if (this.paidAmount === 0) {
    this.status = new Date() > this.dueDate ? "overdue" : "pending";
  } else if (this.paidAmount >= this.amount) {
    this.status = "paid";
  } else {
    this.status = "partial";
  }

  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
FeeSchema.index({ student: 1, academicYear: 1 });
FeeSchema.index({ status: 1 });
FeeSchema.index({ dueDate: 1 });

module.exports = mongoose.model("Fee", FeeSchema);
