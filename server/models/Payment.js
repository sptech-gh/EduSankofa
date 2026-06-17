const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  fee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Fee",
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["cash", "card", "bank_transfer", "online", "cheque", "upi", "mobile_money"],
  },
  currency: {
    type: String,
    required: true,
    enum: ["GHS"],
    default: "GHS",
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "completed",
  },
  reference: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
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

// Generate unique transaction ID if not provided
PaymentSchema.pre("save", function (next) {
  if (!this.transactionId && this.status === "completed") {
    this.transactionId = `TXN${Date.now()}${Math.random()
      .toString(36)
      .substr(2, 9)
      .toUpperCase()}`;
  }
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
PaymentSchema.index({ fee: 1 });
PaymentSchema.index({ student: 1 });
PaymentSchema.index({ paymentDate: -1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ transactionId: 1 });

module.exports = mongoose.model("Payment", PaymentSchema);
