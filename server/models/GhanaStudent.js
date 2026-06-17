const mongoose = require("mongoose");
const { nextSeq } = require("../services/counterService");

const GHANA_CARD_REGEX = /^GHA-\d{9}-[A-Z0-9]$/i;
const NHIS_REGEX = /^\d{8}$/;
const BIRTH_CERT_REGEX = /^[A-Z0-9\/\-]+$/i;
const PASSPORT_REGEX = /^[A-Z]{1,2}\d{6,7}$/i;

const ghanaStudentSchema = new mongoose.Schema(
  {
    // Basic Information
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    middleName: {
      type: String,
      trim: true,
    },
    otherNames: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      required: true,
      enum: ["Male", "Female"],
    },
    placeOfBirth: {
      type: String,
      required: true,
      trim: true,
    },
    nationality: {
      type: String,
      required: true,
      default: "Ghanaian",
    },
    regionOfBirth: {
      type: String,
      required: true,
      enum: [
        "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
        "Greater Accra", "North East", "Northern", "Oti", "Savannah",
        "Upper East", "Upper West", "Volta", "Western", "Western North"
      ],
    },

    // Identification
    studentId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    admissionNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    upiNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    }, // Universal Personal Identifier

    // Academic Information
    currentClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaClass",
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
    stream: {
      type: String,
      enum: ["General", "Science", "Arts", "Business", "Technical", "Vocational", "Home Economics", "Visual Arts", "General Arts", "General Science", "Agricultural Science"],
    },
    house: {
      type: String,
      trim: true,
    },

    // Enrollment Information
    enrollmentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    admissionType: {
      type: String,
      required: true,
      enum: ["New Admission", "Transfer", "Readmission"],
    },
    previousSchool: {
      name: String,
      address: String,
      lastClassAttended: String,
      leavingDate: Date,
      transferReason: String,
    },

    // Ghana-Specific Documents
    birthCertificate: {
      certificateNumber: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
      },
      issueDate: Date,
      issuingAuthority: String,
    },
    nhis: {
      cardNumber: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
      },
      expiryDate: Date,
      issueDate: Date,
    },
    ghanaCard: {
      cardNumber: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
      },
      pinNumber: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
      },
      issueDate: Date,
      expiryDate: Date,
    },

    // Contact Information
    address: {
      houseNumber: String,
      street: String,
      area: String,
      city: String,
      region: {
        type: String,
        required: true,
        enum: [
          "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
          "Greater Accra", "North East", "Northern", "Oti", "Savannah",
          "Upper East", "Upper West", "Volta", "Western", "Western North"
        ],
      },
      postalCode: String,
      gpsCoordinates: String,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    emergencyPhone: {
      type: String,
      trim: true,
    },

    // Parent/Guardian Information
    guardians: [{
      type: { type: String, enum: ["Father", "Mother", "Guardian", "Sponsor"], required: true },
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      occupation: { type: String, trim: true },
      employer: { type: String, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, lowercase: true, trim: true },
      address: { type: String, trim: true },
      relationship: { type: String, trim: true },
      isPrimary: { type: Boolean, default: false },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      ghanaCard: {
        cardNumber: String,
        pinNumber: String,
      },
      incomeLevel: {
        type: String,
        enum: ["Low", "Middle", "High"],
      },
    }],

    // Medical Information
    medical: {
      bloodGroup: {
        type: String,
        enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      },
      genotype: {
        type: String,
        enum: ["AA", "AS", "SS", "AC"],
      },
      allergies: [String],
      chronicConditions: [String],
      medications: [String],
      emergencyContact: {
        name: String,
        relationship: String,
        phone: String,
        address: String,
      },
      doctor: {
        name: String,
        phone: String,
        hospital: String,
      },
      vaccinations: [{
        name: String,
        date: Date,
        batchNumber: String,
      }],
    },

    // Academic Performance
    academicHistory: [{
      academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear" },
      class: { type: mongoose.Schema.Types.ObjectId, ref: "GhanaClass" },
      term: { type: mongoose.Schema.Types.ObjectId, ref: "Term" },
      position: Number,
      totalStudents: Number,
      averageScore: Number,
      attendanceRate: Number,
      conduct: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
      },
      promoted: { type: Boolean, default: false },
      remarks: String,
    }],

    // Status and Progress
    status: {
      type: String,
      required: true,
      enum: ["Active", "Inactive", "Graduated", "Suspended", "Withdrawn", "Transferred"],
      default: "Active",
    },
    graduationDate: Date,
    lastPromotionDate: Date,

    // Fees and Financials
    fees: {
      balance: { type: Number, default: 0 },
      lastPaymentDate: Date,
      paymentHistory: [{
        date: Date,
        amount: Number,
        method: { type: String, enum: ["Cash", "Bank Transfer", "Mobile Money", "Cheque"] },
        reference: String,
        term: { type: mongoose.Schema.Types.ObjectId, ref: "Term" },
        academicYear: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear" },
      }],
      scholarships: [{
        name: String,
        percentage: Number,
        donor: String,
        startDate: Date,
        endDate: Date,
      }],
    },

    // Extracurricular Activities
    activities: [{
      name: String,
      type: { type: String, enum: ["Sports", "Club", "Society", "Prefect"] },
      position: String,
      achievements: [String],
      startDate: Date,
      endDate: Date,
    }],

    // Discipline Records
    discipline: [{
      date: Date,
      type: { type: String, enum: ["Warning", "Suspension", "Expulsion", "Commendation"] },
      reason: String,
      action: String,
      reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      resolved: { type: Boolean, default: false },
    }],

    // Special Needs
    specialNeeds: {
      hasDisability: { type: Boolean, default: false },
      disabilityType: String,
      accommodations: [String],
      supportServices: [String],
      iep: { type: Boolean, default: false }, // Individualized Education Program
    },

    // System Fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
ghanaStudentSchema.index({ studentId: 1 }, { unique: true });
ghanaStudentSchema.index({ admissionNumber: 1 }, { unique: true });
ghanaStudentSchema.index({ currentClass: 1 });
ghanaStudentSchema.index({ academicYear: 1, term: 1 });
ghanaStudentSchema.index({ status: 1 });
ghanaStudentSchema.index({ "guardians.userId": 1 });
ghanaStudentSchema.index({ "guardians.isPrimary": 1 });
ghanaStudentSchema.index({ "ghanaCard.cardNumber": 1 }, { unique: true, sparse: true });

// Pre-save middleware for student ID generation
ghanaStudentSchema.pre("save", async function (next) {
  if (this.isNew && !this.studentId) {
    try {
      const year = new Date().getFullYear();
      const seq = await nextSeq(`studentId-${year}`);
      this.studentId = `EDU${year}${seq.toString().padStart(4, '0')}`;
    } catch (err) {
      return next(err);
    }
  }

  if (this.isNew && !this.admissionNumber) {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const seq = await nextSeq(`admissionNumber-${year}-${month}`);
      this.admissionNumber = `ADM${year}${month}${seq.toString().padStart(4, '0')}`;
    } catch (err) {
      return next(err);
    }
  }

  if (this.nhis && this.nhis.cardNumber && !NHIS_REGEX.test(this.nhis.cardNumber)) {
    return next(new Error("Invalid NHIS card number format. Must be exactly 8 digits."));
  }
  if (this.birthCertificate && this.birthCertificate.certificateNumber) {
    const val = this.birthCertificate.certificateNumber;
    const isValid = BIRTH_CERT_REGEX.test(val) && /\d/.test(val) && val.length >= 5 && val.length <= 15;
    if (!isValid) {
      return next(new Error("Invalid Birth Certificate entry number format."));
    }
  }
  if (this.ghanaCard && this.ghanaCard.pinNumber && !GHANA_CARD_REGEX.test(this.ghanaCard.pinNumber)) {
    return next(new Error("Invalid Ghana Card PIN format. Expected format GHA-123456789-0."));
  }

  next();
});

// Instance methods
ghanaStudentSchema.methods.getCurrentAcademicRecord = function () {
  return this.academicHistory.find(record => 
    record.academicYear.toString() === this.academicYear.toString() &&
    record.term.toString() === this.term.toString()
  );
};

ghanaStudentSchema.methods.promoteToNextClass = async function (newClassId, newAcademicYear, newTerm) {
  const GhanaClass = mongoose.model("GhanaClass");
  const currentClass = await GhanaClass.findById(this.currentClass);
  const nextClass = await GhanaClass.findById(newClassId);

  if (!currentClass || !nextClass) {
    throw new Error("Invalid class information");
  }

  // Update academic history
  const currentRecord = this.getCurrentAcademicRecord();
  if (currentRecord) {
    currentRecord.promoted = true;
  }

  // Add new academic record
  this.academicHistory.push({
    academicYear: newAcademicYear,
    class: newClassId,
    term: newTerm,
  });

  // Update current class information
  this.currentClass = newClassId;
  this.academicYear = newAcademicYear;
  this.term = newTerm;
  this.lastPromotionDate = new Date();

  return this.save();
};

ghanaStudentSchema.methods.addGuardian = function (guardianData) {
  // If this is the first guardian, make them primary
  if (this.guardians.length === 0) {
    guardianData.isPrimary = true;
  }

  this.guardians.push(guardianData);
  return this.save();
};

ghanaStudentSchema.methods.updateFees = function (paymentData) {
  this.fees.balance -= paymentData.amount;
  this.fees.lastPaymentDate = paymentData.date;
  this.fees.paymentHistory.push(paymentData);
  return this.save();
};

ghanaStudentSchema.methods.getAge = function () {
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Static methods
ghanaStudentSchema.statics.findByGuardian = function (guardianUserId) {
  return this.find({ "guardians.userId": guardianUserId })
    .populate("currentClass")
    .populate("academicYear")
    .populate("term");
};

ghanaStudentSchema.statics.findByClass = function (classId, academicYear, term) {
  const filter = { currentClass: classId };
  if (academicYear) filter.academicYear = academicYear;
  if (term) filter.term = term;
  
  return this.find(filter)
    .populate("currentClass")
    .populate("academicYear")
    .populate("term");
};

ghanaStudentSchema.statics.getPromotionCandidates = function (classId, academicYear, term) {
  return this.find({
    currentClass: classId,
    academicYear: academicYear,
    term: term,
    status: "Active"
  }).populate("currentClass");
};

module.exports = mongoose.model("GhanaStudent", ghanaStudentSchema);
