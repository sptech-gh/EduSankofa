const mongoose = require("mongoose");
const { nextSeq } = require("../services/counterService");

const studentLedgerSchema = new mongoose.Schema(
  {
    // Core identification
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaStudent",
      required: true,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },
    term: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
      required: true,
    },
    feeStructure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaFeeStructure",
      required: true,
    },
    
    // Financial summary
    totalFees: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalPaid: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      enum: ["GHS"],
      default: "GHS",
    },
    
    // Fee breakdown
    feeBreakdown: [{
      feeItemName: {
        type: String,
        required: true,
      },
      category: {
        type: String,
        required: true,
      },
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
      paid: {
        type: Number,
        default: 0,
        min: 0,
      },
      balance: {
        type: Number,
        default: 0,
      },
      isMandatory: {
        type: Boolean,
        default: true,
      },
      dueDate: Date,
    }],
    
    // Payment transactions
    transactions: [{
      type: {
        type: String,
        required: true,
        enum: ["Payment", "Refund", "Adjustment", "Waiver", "Penalty"],
      },
      amount: {
        type: Number,
        required: true,
      },
      paymentMethod: {
        type: String,
        enum: ["Cash", "Bank Transfer", "Mobile Money", "Cheque", "Credit Card", "Online Payment"],
      },
      paymentReference: {
        type: String,
        trim: true,
      },
      transactionDate: {
        type: Date,
        required: true,
        default: Date.now,
      },
      receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      receiptNumber: {
        type: String,
        required: true,
      },
      feeItems: [{
        name: String,
        amount: Number,
      }],
      notes: {
        type: String,
        trim: true,
        maxlength: 500,
      },
      status: {
        type: String,
        enum: ["Pending", "Completed", "Failed", "Cancelled"],
        default: "Completed",
      },
      bankDetails: {
        bankName: String,
        accountNumber: String,
        transactionId: String,
        chequeNumber: String,
      },
      mobileMoneyDetails: {
        provider: {
          type: String,
          enum: ["MTN", "Vodafone", "AirtelTigo", "Glo"],
        },
        number: String,
        transactionId: String,
        reference: String,
      },
    }],
    
    // Installment plan
    installmentPlan: {
      isActive: {
        type: Boolean,
        default: false,
      },
      numberOfInstallments: {
        type: Number,
        min: 2,
        max: 12,
      },
      installmentAmount: {
        type: Number,
        min: 0,
      },
      dueDates: [Date],
      paidInstallments: [{
        installmentNumber: Number,
        amount: Number,
        paidDate: Date,
        transactionId: mongoose.Schema.Types.ObjectId,
      }],
      nextDueDate: Date,
      missedInstallments: [{
        installmentNumber: Number,
        dueDate: Date,
        penaltyAmount: Number,
        paidDate: Date,
      }],
    },
    
    // Scholarships and discounts
    scholarships: [{
      name: String,
      type: String,
      discountAmount: Number,
      discountPercentage: Number,
      appliedDate: Date,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      academicPeriod: String,
    }],
    
    // Penalties and late fees
    penalties: [{
      type: {
        type: String,
        enum: ["Late Payment", "Bounced Cheque", "Failed Payment"],
      },
      amount: Number,
      appliedDate: Date,
      reason: String,
      paid: {
        type: Boolean,
        default: false,
      },
      paidDate: Date,
      transactionId: mongoose.Schema.Types.ObjectId,
    }],
    
    // Status and workflow
    status: {
      type: String,
      enum: ["Active", "Paid", "Overdue", "Partially Paid", "Suspended", "Closed"],
      default: "Active",
    },
    
    // Payment reminders
    lastReminderSent: Date,
    reminderCount: {
      type: Number,
      default: 0,
    },
    nextReminderDate: Date,
    
    // Parent information
    parentNotified: {
      type: Boolean,
      default: false,
    },
    parentNotificationMethod: {
      type: String,
      enum: ["SMS", "Email", "Phone Call", "Letter"],
    },
    
    // Audit trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    // Metadata
    academicYearName: String,
    termName: String,
    studentName: String,
    studentId: String,
    className: String,
    parentName: String,
    parentContact: String,
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    optimisticConcurrency: true
  }
);

// Indexes for efficient queries
studentLedgerSchema.index({ student: 1, academicYear: 1, term: 1 });
studentLedgerSchema.index({ status: 1 });
studentLedgerSchema.index({ balance: 1 });
studentLedgerSchema.index({ "installmentPlan.nextDueDate": 1 });
studentLedgerSchema.index({ "transactions.transactionDate": 1 });
studentLedgerSchema.index({ receiptNumber: 1 });

// Virtual for payment percentage
studentLedgerSchema.virtual("paymentPercentage").get(function () {
  if (this.totalFees === 0) return 0;
  return Math.round((this.totalPaid / this.totalFees) * 100);
});

// Virtual for overdue amount
studentLedgerSchema.virtual("overdueAmount").get(function () {
  return this.balance > 0 ? this.balance : 0;
});

// Virtual for next payment due
studentLedgerSchema.virtual("nextPaymentDue").get(function () {
  if (this.installmentPlan.isActive && this.installmentPlan.nextDueDate) {
    return {
      amount: this.installmentPlan.installmentAmount,
      dueDate: this.installmentPlan.nextDueDate,
      daysOverdue: Math.max(0, Math.floor((new Date() - this.installmentPlan.nextDueDate) / (1000 * 60 * 60 * 24))),
    };
  }
  return null;
});

// Method to add payment
studentLedgerSchema.methods.addPayment = async function (paymentData) {
  const {
    amount,
    paymentMethod,
    paymentReference,
    feeItems,
    notes,
    bankDetails,
    mobileMoneyDetails,
    receivedBy,
  } = paymentData;

  // Validate payment amount
  if (amount <= 0) {
    throw new Error("Payment amount must be greater than 0");
  }

  // Check for overpayment
  if (this.totalPaid + amount > this.totalFees) {
    throw new Error("Payment amount exceeds outstanding balance");
  }

  // Generate receipt number
  const receiptNumber = await this.generateReceiptNumber();

  // Create transaction
  const transaction = {
    type: "Payment",
    amount,
    paymentMethod,
    paymentReference,
    transactionDate: new Date(),
    receivedBy,
    receiptNumber,
    feeItems: feeItems || [],
    notes,
    bankDetails,
    mobileMoneyDetails,
    status: "Completed",
  };

  this.transactions.push(transaction);

  // Update totals
  this.totalPaid += amount;
  this.balance = this.totalFees - this.totalPaid;

  // Update fee breakdown
  if (feeItems && feeItems.length > 0) {
    feeItems.forEach(item => {
      const feeItem = this.feeBreakdown.find(f => f.feeItemName === item.name);
      if (feeItem) {
        const paymentAmount = Math.min(item.amount, feeItem.balance);
        feeItem.paid += paymentAmount;
        feeItem.balance -= paymentAmount;
      }
    });
  } else {
    // Distribute payment proportionally
    const remainingAmount = amount;
    const totalBalance = this.feeBreakdown.reduce((sum, item) => sum + item.balance, 0);
    
    if (totalBalance > 0) {
      this.feeBreakdown.forEach(item => {
        if (item.balance > 0 && remainingAmount > 0) {
          const proportionalAmount = Math.min(
            (item.balance / totalBalance) * amount,
            item.balance,
            remainingAmount
          );
          item.paid += proportionalAmount;
          item.balance -= proportionalAmount;
        }
      });
    }
  }

  // Update installment plan if active
  if (this.installmentPlan.isActive) {
    this.updateInstallmentPlan(amount);
  }

  // Update status
  this.updateStatus();

  this.lastModifiedBy = receivedBy;

  await this.save();
  return transaction;
};

// Method to generate receipt number
studentLedgerSchema.methods.generateReceiptNumber = async function () {
  const year = new Date().getFullYear();
  const seq = await nextSeq(`receipt-${year}`);
  return `RCPT${year}${String(seq).padStart(6, '0')}`;
};

// Method to update installment plan
studentLedgerSchema.methods.updateInstallmentPlan = function (paymentAmount) {
  if (!this.installmentPlan.isActive) return;

  let remainingAmount = paymentAmount;
  
  // Pay missed installments first
  this.installmentPlan.missedInstallments.forEach(missed => {
    if (!missed.paid && remainingAmount > 0) {
      const totalDue = missed.installmentAmount + missed.penaltyAmount;
      const payment = Math.min(remainingAmount, totalDue);
      
      if (payment >= totalDue) {
        missed.paid = true;
        missed.paidDate = new Date();
        remainingAmount -= totalDue;
      }
    }
  });

  // Pay current and future installments
  let currentInstallment = this.installmentPlan.paidInstallments.length + 1;
  
  while (remainingAmount > 0 && currentInstallment <= this.installmentPlan.numberOfInstallments) {
    const installmentAmount = this.installmentPlan.installmentAmount;
    const payment = Math.min(remainingAmount, installmentAmount);
    
    this.installmentPlan.paidInstallments.push({
      installmentNumber: currentInstallment,
      amount: payment,
      paidDate: new Date(),
    });
    
    remainingAmount -= payment;
    currentInstallment++;
  }

  // Update next due date
  if (currentInstallment <= this.installmentPlan.numberOfInstallments) {
    this.installmentPlan.nextDueDate = this.installmentPlan.dueDates[currentInstallment - 1];
  } else {
    this.installmentPlan.isActive = false;
    this.installmentPlan.nextDueDate = null;
  }
};

// Method to update status
studentLedgerSchema.methods.updateStatus = function () {
  if (this.balance <= 0) {
    this.status = "Paid";
  } else if (this.totalPaid > 0) {
    this.status = "Partially Paid";
  } else if (this.isOverdue()) {
    this.status = "Overdue";
  } else {
    this.status = "Active";
  }
};

// Method to check if overdue
studentLedgerSchema.methods.isOverdue = function () {
  if (this.balance <= 0) return false;

  // Check installment plan
  if (this.installmentPlan.isActive && this.installmentPlan.nextDueDate) {
    return new Date() > this.installmentPlan.nextDueDate;
  }

  // Check fee due dates
  const overdueItems = this.feeBreakdown.filter(item => 
    item.balance > 0 && 
    item.dueDate && 
    new Date() > item.dueDate
  );

  return overdueItems.length > 0;
};

// Method to add penalty
studentLedgerSchema.methods.addPenalty = function (penaltyData) {
  const { type, amount, reason, appliedBy } = penaltyData;

  this.penalties.push({
    type,
    amount,
    appliedDate: new Date(),
    reason,
    paid: false,
  });

  this.totalFees += amount;
  this.balance += amount;

  // Add to fee breakdown as penalty
  this.feeBreakdown.push({
    feeItemName: `${type} Penalty`,
    category: "Penalty",
    amount,
    paid: 0,
    balance: amount,
    isMandatory: true,
    dueDate: new Date(),
  });

  this.lastModifiedBy = appliedBy;
  this.updateStatus();

  return this.save();
};

// Method to get payment summary
studentLedgerSchema.methods.getPaymentSummary = function () {
  const summary = {
    totalFees: this.totalFees,
    totalPaid: this.totalPaid,
    balance: this.balance,
    paymentPercentage: this.paymentPercentage,
    status: this.status,
    transactionCount: this.transactions.length,
    lastPaymentDate: null,
    paymentMethods: {},
    feeItemBreakdown: this.feeBreakdown.map(item => ({
      name: item.feeItemName,
      category: item.category,
      totalAmount: item.amount,
      paid: item.paid,
      balance: item.balance,
      paymentPercentage: item.amount > 0 ? Math.round((item.paid / item.amount) * 100) : 0,
    })),
  };

  // Get last payment date
  const payments = this.transactions.filter(t => t.type === "Payment");
  if (payments.length > 0) {
    summary.lastPaymentDate = new Date(Math.max(...payments.map(p => p.transactionDate)));
  }

  // Count payment methods
  this.transactions.forEach(transaction => {
    if (transaction.paymentMethod) {
      summary.paymentMethods[transaction.paymentMethod] = 
        (summary.paymentMethods[transaction.paymentMethod] || 0) + 1;
    }
  });

  return summary;
};

// Static method to get overdue ledgers
studentLedgerSchema.statics.getOverdueLedgers = async function (academicYearId, termId) {
  return this.find({
    academicYear: academicYearId,
    term: termId,
    balance: { $gt: 0 },
    status: { $in: ["Active", "Partially Paid", "Overdue"] },
  })
    .populate("student", "firstName lastName studentId")
    .populate("academicYear", "name")
    .populate("term", "name")
    .sort({ balance: -1 });
};

// Static method to get payment statistics
studentLedgerSchema.statics.getPaymentStatistics = async function (academicYearId, termId) {
  const stats = await this.aggregate([
    {
      $match: {
        academicYear: new mongoose.Types.ObjectId(academicYearId),
        term: new mongoose.Types.ObjectId(termId),
      },
    },
    {
      $group: {
        _id: null,
        totalStudents: { $sum: 1 },
        totalFees: { $sum: "$totalFees" },
        totalPaid: { $sum: "$totalPaid" },
        totalBalance: { $sum: "$balance" },
        fullyPaid: {
          $sum: { $cond: [{ $eq: ["$status", "Paid"] }, 1, 0] },
        },
        partiallyPaid: {
          $sum: { $cond: [{ $eq: ["$status", "Partially Paid"] }, 1, 0] },
        },
        overdue: {
          $sum: { $cond: [{ $eq: ["$status", "Overdue"] }, 1, 0] },
        },
      },
    },
  ]);

  const result = stats[0] || {
    totalStudents: 0,
    totalFees: 0,
    totalPaid: 0,
    totalBalance: 0,
    fullyPaid: 0,
    partiallyPaid: 0,
    overdue: 0,
  };

  result.collectionRate = result.totalFees > 0 
    ? Math.round((result.totalPaid / result.totalFees) * 100) 
    : 0;

  return result;
};

// Pre-save middleware for validation
studentLedgerSchema.pre("save", function (next) {
  // Ensure balance is calculated correctly
  this.balance = this.totalFees - this.totalPaid;
  
  // Update status based on balance
  this.updateStatus();
  
  next();
});

module.exports = mongoose.model("StudentLedger", studentLedgerSchema);
