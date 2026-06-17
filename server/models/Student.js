const mongoose = require("mongoose");

const GHANA_CARD_REGEX = /^GHA-\d{9}-[A-Z0-9]$/i;
const NHIS_REGEX = /^\d{8}$/;
const BIRTH_CERT_REGEX = /^[A-Z0-9\/\-]+$/i;
const PASSPORT_REGEX = /^[A-Z]{1,2}\d{6,7}$/i;

const studentSchema = new mongoose.Schema(
  {
    firstName: {
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
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    studentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    admissionNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    class: {
      type: String,
      trim: true,
    },
    placeOfBirth: {
      type: String,
      trim: true,
    },
    address: {
      type: mongoose.Schema.Types.Mixed,
    },
    phone: {
      type: String,
      trim: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "graduated", "suspended"],
      default: "active",
    },
    birthCertificateNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    birthCertificateIssueDate: {
      type: Date,
    },
    nhisNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    nhisExpiryDate: {
      type: Date,
    },
    identityType: {
      type: String,
      enum: ["ghana-card", "passport"],
    },
    identityNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    identityExpiryDate: {
      type: Date,
    },
    fatherDetails: {
      firstName: {
        type: String,
        trim: true,
      },
      lastName: {
        type: String,
        trim: true,
      },
      occupation: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      address: {
        type: String,
        trim: true,
      },
      identityType: {
        type: String,
        enum: ["ghana-card", "passport", "voters-id"],
      },
      identityNumber: {
        type: String,
        trim: true,
      },
    },
    motherDetails: {
      firstName: {
        type: String,
        trim: true,
      },
      lastName: {
        type: String,
        trim: true,
      },
      occupation: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      address: {
        type: String,
        trim: true,
      },
      identityType: {
        type: String,
        enum: ["ghana-card", "passport", "voters-id"],
      },
      identityNumber: {
        type: String,
        trim: true,
      },
    },
    emergencyContact: {
      firstName: {
        type: String,
        trim: true,
      },
      lastName: {
        type: String,
        trim: true,
      },
      relationship: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
      },
    },
  },
  { timestamps: true, collection: "studentghanas" }
);

studentSchema.pre("save", function (next) {
  if (this.admissionNumber && !this.studentId) {
    this.studentId = this.admissionNumber;
  }
  if (this.studentId && !this.admissionNumber) {
    this.admissionNumber = this.studentId;
  }

  // Enforce document validations
  if (this.nhisNumber && !NHIS_REGEX.test(this.nhisNumber)) {
    return next(new Error("Invalid NHIS card number format. Must be exactly 8 digits."));
  }
  if (this.birthCertificateNumber) {
    const val = this.birthCertificateNumber;
    const isValid = BIRTH_CERT_REGEX.test(val) && /\d/.test(val) && val.length >= 5 && val.length <= 15;
    if (!isValid) {
      return next(new Error("Invalid Birth Certificate entry number format."));
    }
  }
  if (this.identityNumber) {
    const type = String(this.identityType || "").toLowerCase().replace(/\s+/g, "-");
    if ((type === "ghana-card" || type === "national-id") && !GHANA_CARD_REGEX.test(this.identityNumber)) {
      return next(new Error("Invalid Ghana Card PIN format. Expected format GHA-123456789-0."));
    }
    if (type === "passport" && !PASSPORT_REGEX.test(this.identityNumber)) {
      return next(new Error("Invalid Passport number format."));
    }
    if (type === "voter-id" && !/^\d{10}$/.test(this.identityNumber)) {
      return next(new Error("Invalid Voter ID format. Must be exactly 10 digits."));
    }
    if (type === "driver-license" && !/^[A-Z0-9\-]{8,16}$/i.test(this.identityNumber)) {
      return next(new Error("Invalid Driver License format. Must be 8-16 alphanumeric characters."));
    }
  }

  next();
});

studentSchema.index({ class: 1 });
studentSchema.index({ parentId: 1 });

module.exports =
  (mongoose.models && mongoose.models.Student) ||
  mongoose.model("Student", studentSchema);
