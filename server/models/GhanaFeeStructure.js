const mongoose = require("mongoose");

const ghanaFeeStructureSchema = new mongoose.Schema(
  {
    // Basic information
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    
    // Academic context
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
    
    // Class targeting
    applicableClasses: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaClass",
    }],
    applicableLevels: [{
      type: String,
      enum: [
        "Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
        "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
        "JHS 1", "JHS 2", "JHS 3", "SHS 1", "SHS 2", "SHS 3", "A-Level"
      ],
    }],
    
    // Fee structure
    feeItems: [{
      name: {
        type: String,
        required: true,
        trim: true,
      },
      category: {
        type: String,
        required: true,
        enum: [
          "Tuition", "Registration", "Examination", "Library", "Laboratory",
          "ICT", "Sports", "Development", "PTA", "Uniform", "Books",
          "Transport", "Feeding", "Boarding", "Medical", "Insurance",
          "Extra Curricular", "Field Trip", "Miscellaneous"
        ],
      },
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        required: true,
        enum: ["GHS"],
        default: "GHS",
      },
      isMandatory: {
        type: Boolean,
        default: true,
      },
      isRecurring: {
        type: Boolean,
        default: false,
      },
      paymentFrequency: {
        type: String,
        enum: ["One-time", "Termly", "Monthly", "Weekly"],
        default: "One-time",
      },
      dueDate: {
        type: Date,
      },
      description: {
        type: String,
        trim: true,
        maxlength: 200,
      },
      conditions: {
        type: String,
        trim: true,
        maxlength: 500,
      },
    }],
    
    // Payment options
    paymentOptions: {
      fullPaymentDiscount: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      installmentOptions: [{
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
        interestRate: {
          type: Number,
          min: 0,
          max: 100,
          default: 0,
        },
      }],
      latePaymentPenalty: {
        type: Number,
        min: 0,
        default: 0,
      },
      penaltyType: {
        type: String,
        enum: ["Fixed Amount", "Percentage"],
        default: "Fixed Amount",
      },
    },
    
    // Scholarships and discounts
    scholarships: [{
      name: {
        type: String,
        required: true,
        trim: true,
      },
      type: {
        type: String,
        required: true,
        enum: ["Academic", "Financial Need", "Special Talent", "Staff Child", "Sibling"],
      },
      discountPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      maxAmount: {
        type: Number,
        min: 0,
      },
      eligibilityCriteria: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      requiredDocuments: [String],
      applicationDeadline: Date,
      isActive: {
        type: Boolean,
        default: true,
      },
    }],
    
    // Status and workflow
    status: {
      type: String,
      enum: ["Draft", "Active", "Inactive", "Archived"],
      default: "Draft",
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    expiryDate: {
      type: Date,
    },
    
    // Approval workflow
    approval: {
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      submittedAt: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedAt: Date,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      approvedAt: Date,
      rejectionReason: String,
    },
    
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    schoolInfo: {
      name: {
        type: String,
        default: "EduSankofa Basic School",
      },
      address: String,
      contact: String,
      bankDetails: {
        bankName: String,
        accountName: String,
        accountNumber: String,
        branch: String,
        routingNumber: String,
      },
      mobileMoney: {
        provider: {
          type: String,
          enum: ["MTN", "Vodafone", "AirtelTigo", "Glo"],
        },
        number: String,
        name: String,
      },
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient queries
ghanaFeeStructureSchema.index({ academicYear: 1, term: 1, status: 1 });
ghanaFeeStructureSchema.index({ applicableClasses: 1 });
ghanaFeeStructureSchema.index({ applicableLevels: 1 });
ghanaFeeStructureSchema.index({ "feeItems.category": 1 });
ghanaFeeStructureSchema.index({ effectiveDate: 1, expiryDate: 1 });

// Virtual for total amount
ghanaFeeStructureSchema.virtual("totalAmount").get(function () {
  return this.feeItems.reduce((total, item) => total + item.amount, 0);
});

// Virtual for mandatory fees total
ghanaFeeStructureSchema.virtual("mandatoryFeesTotal").get(function () {
  return this.feeItems
    .filter(item => item.isMandatory)
    .reduce((total, item) => total + item.amount, 0);
});

// Virtual for optional fees total
ghanaFeeStructureSchema.virtual("optionalFeesTotal").get(function () {
  return this.feeItems
    .filter(item => !item.isMandatory)
    .reduce((total, item) => total + item.amount, 0);
});

// Method to calculate fee for specific student
ghanaFeeStructureSchema.methods.calculateStudentFee = function (student, selectedOptionalItems = []) {
  let totalFee = this.mandatoryFeesTotal;
  
  // Add selected optional items
  selectedOptionalItems.forEach(itemName => {
    const item = this.feeItems.find(f => f.name === itemName && !f.isMandatory);
    if (item) {
      totalFee += item.amount;
    }
  });
  
  // Apply scholarships if applicable
  let scholarshipDiscount = 0;
  this.scholarships.forEach(scholarship => {
    if (this.isStudentEligibleForScholarship(student, scholarship)) {
      const discountAmount = (totalFee * scholarship.discountPercentage) / 100;
      if (scholarship.maxAmount && discountAmount > scholarship.maxAmount) {
        scholarshipDiscount += scholarship.maxAmount;
      } else {
        scholarshipDiscount += discountAmount;
      }
    }
  });
  
  totalFee -= scholarshipDiscount;
  
  // Apply full payment discount if applicable
  if (this.paymentOptions.fullPaymentDiscount > 0) {
    totalFee -= (totalFee * this.paymentOptions.fullPaymentDiscount) / 100;
  }
  
  return Math.max(0, totalFee);
};

// Method to check scholarship eligibility
ghanaFeeStructureSchema.methods.isStudentEligibleForScholarship = function (student, scholarship) {
  // This would contain complex logic based on scholarship type
  // For now, return true for demonstration
  switch (scholarship.type) {
    case "Academic":
      return student.academicPerformance?.averageScore >= 80;
    case "Financial Need":
      return student.financialStatus?.needsAssistance === true;
    case "Staff Child":
      return student.guardians?.some(g => g.isStaffMember === true);
    case "Sibling":
      return student.hasSiblingsInSchool === true;
    default:
      return false;
  }
};

// Method to get installment plan
ghanaFeeStructureSchema.methods.getInstallmentPlan = function (totalFee, numberOfInstallments) {
  const installmentOption = this.paymentOptions.installmentOptions.find(
    option => option.numberOfInstallments === numberOfInstallments
  );
  
  if (!installmentOption) {
    return null;
  }
  
  return {
    numberOfInstallments: installmentOption.numberOfInstallments,
    installmentAmount: installmentOption.installmentAmount,
    totalAmount: installmentOption.installmentAmount * numberOfInstallments,
    dueDates: installmentOption.dueDates,
    interestRate: installmentOption.interestRate,
    totalInterest: (totalFee * installmentOption.interestRate) / 100,
  };
};

// Static method to get active fee structure
ghanaFeeStructureSchema.statics.getActiveStructure = async function (academicYearId, termId, classId) {
  const query = {
    academicYear: academicYearId,
    term: termId,
    status: "Active",
    effectiveDate: { $lte: new Date() },
    $or: [
      { expiryDate: { $exists: false } },
      { expiryDate: { $gt: new Date() } },
    ],
  };
  
  if (classId) {
    query.applicableClasses = classId;
  }
  
  return this.findOne(query)
    .populate("academicYear", "name")
    .populate("term", "name")
    .populate("applicableClasses", "name level section");
};

// Static method to get fee structures by level
ghanaFeeStructureSchema.statics.getByLevel = async function (level, academicYearId, termId) {
  return this.find({
    applicableLevels: level,
    academicYear: academicYearId,
    term: termId,
    status: "Active",
  })
    .populate("academicYear", "name")
    .populate("term", "name");
};

// Pre-save middleware for validation
ghanaFeeStructureSchema.pre("save", function (next) {
  // Validate that effective date is not in the past for new structures
  if (this.isNew && this.effectiveDate < new Date()) {
    return next(new Error("Effective date cannot be in the past for new fee structures"));
  }
  
  // Validate that expiry date is after effective date
  if (this.expiryDate && this.expiryDate <= this.effectiveDate) {
    return next(new Error("Expiry date must be after effective date"));
  }
  
  // Validate installment amounts
  this.paymentOptions.installmentOptions.forEach(option => {
    if (option.installmentAmount <= 0) {
      return next(new Error("Installment amount must be greater than 0"));
    }
  });
  
  next();
});

module.exports = mongoose.model("GhanaFeeStructure", ghanaFeeStructureSchema);
